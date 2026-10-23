/**
 * A tiny PostgREST-shaped adapter over the database twin: it runs, as the
 * service role against real PostgreSQL with the real migrations, the exact
 * queries the server code builds with the Supabase client.
 */
import type { DatabaseTwin } from "../../../scripts/db-twin.mts";

export const lit = (v: unknown): string =>
  v === null
    ? "null"
    : v instanceof Date
      ? `'${v.toISOString()}'`
      : typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : typeof v === "object"
          ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
          : `'${String(v).replace(/'/g, "''")}'`;

/** A PostgREST column, with `a->>b` JSON access written as SQL. */
const column = (c: string) => c.replace(/->>(\w+)$/, "->>'$1'");

/** Top-level comma split of a PostgREST filter list: commas inside quotes or parentheses stay. */
function terms(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let at = 0; at < list.length; at += 1) {
    const ch = list[at];
    if (ch === "\\") at += 1;
    else if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "(") depth += 1;
    else if (!quoted && ch === ")") depth -= 1;
    else if (!quoted && depth === 0 && ch === ",") {
      out.push(list.slice(start, at));
      start = at + 1;
    }
  }
  out.push(list.slice(start));
  return out;
}

/** A PostgREST `or`/`and` filter list as SQL. */
function logic(list: string, joiner: string): string {
  return terms(list)
    .map((term) => {
      const group = /^and\((.*)\)$/.exec(term);
      if (group) return `(${logic(group[1]!, " and ")})`;
      const [, c, op, raw] = term.match(/^(.+?)\.(is|eq|lt|gt)\.(.*)$/)!;
      const v = raw!.replace(/^"(.*)"$/, "$1").replace(/\\(.)/g, "$1");
      if (op === "is") return `${column(c!)} is null`;
      return `${column(c!)} ${{ eq: "=", lt: "<", gt: ">" }[op as "eq" | "lt" | "gt"]} ${lit(v)}`;
    })
    .join(joiner);
}

export function restOver(twin: DatabaseTwin) {
  return {
    /** The Library bucket's signed upload, as Supabase Storage names it (nothing is stored). */
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => ({
          data: { signedUrl: `https://storage.test/${path}` },
          error: null,
        }),
      }),
    },
    from(table: string) {
      const where: string[] = [];
      let verb: "select" | "update" | "delete" | "insert" | "upsert" = "select";
      let rows: Record<string, unknown>[] = [];
      let conflict = "";
      let columns = "*";
      let patch: Record<string, unknown> = {};
      let tail = "";
      const orders: string[] = [];
      let returning = false;
      let one: "single" | "maybe" | null = null;
      let counting = false;
      // PostgREST's JSON path: `action->>action` is the text at key "action".
      const col = column;
      const q = {
        select(cols = "*", options?: { head?: boolean }) {
          columns = cols;
          counting = options?.head === true;
          returning = verb !== "select";
          return q;
        },
        update(p: Record<string, unknown>) {
          verb = "update";
          patch = p;
          return q;
        },
        delete() {
          verb = "delete";
          return q;
        },
        insert(p: Record<string, unknown>) {
          verb = "insert";
          patch = p;
          return q;
        },
        // Only the form the server builds: several rows, an existing one left as it is.
        upsert(r: Record<string, unknown>[], o: { onConflict: string; ignoreDuplicates: true }) {
          verb = "upsert";
          rows = r;
          conflict = o.onConflict;
          return q;
        },
        eq: (c: string, v: unknown) => (where.push(`${col(c)} = ${lit(v)}`), q),
        neq: (c: string, v: unknown) => (where.push(`${c} <> ${lit(v)}`), q),
        gt: (c: string, v: unknown) => (where.push(`${col(c)} > ${lit(v)}`), q),
        lt: (c: string, v: unknown) => (where.push(`${c} < ${lit(v)}`), q),
        lte: (c: string, v: unknown) => (where.push(`${c} <= ${lit(v)}`), q),
        is: (c: string, v: unknown) => (where.push(`${c} is ${lit(v)}`), q),
        // PostgREST's `not.in`: the only negation the server code builds besides `not.is`.
        not: (c: string, op: string, v: string) => (
          where.push(
            op === "in"
              ? `${col(c)} not in (${v
                  .replace(/^\(|\)$/g, "")
                  .split(",")
                  .map(lit)
                  .join(",")})`
              : `${c} is not ${lit(v)}`,
          ),
          q
        ),
        in: (c: string, vs: unknown[]) => (
          where.push(vs.length ? `${col(c)} in (${vs.map(lit).join(",")})` : "false"),
          q
        ),
        // PostgREST's `or`: comma-separated `column.is.null` / `.eq.` / `.lt.` / `.gt.` terms,
        // and `and(...)` groups of them (the export's keyset cursor).
        or: (terms: string) => (where.push(`(${logic(terms, " or ")})`), q),
        order: (c: string, o?: { ascending?: boolean }) => (
          orders.push(`${c} ${o?.ascending === false ? "desc" : "asc"}`),
          q
        ),
        limit: (n: number) => ((tail += ` limit ${n}`), q),
        range: (from: number, to: number) => (
          (tail += ` limit ${to - from + 1} offset ${from}`),
          q
        ),
        maybeSingle: () => ((one = "maybe"), q),
        single: () => ((one = "single"), q),
        then(resolve: (r: unknown) => void) {
          const w = where.length ? ` where ${where.join(" and ")}` : "";
          if (orders.length) tail = ` order by ${orders.join(", ")}${tail}`;
          const t = `public.${table}`;
          const sql =
            verb === "select"
              ? `select ${columns} from ${t}${w}${tail}`
              : verb === "update"
                ? `update ${t} set ${Object.entries(patch)
                    .map(([k, v]) => `${k} = ${lit(v)}`)
                    .join(", ")}${w}${returning ? ` returning ${columns}` : ""}`
                : verb === "delete"
                  ? `delete from ${t}${w}`
                  : verb === "upsert"
                    ? `insert into ${t} (${Object.keys(rows[0]!).join(",")}) values ${rows
                        .map((r) => `(${Object.values(r).map(lit).join(",")})`)
                        .join(",")} on conflict (${conflict}) do nothing returning ${columns}`
                    : `insert into ${t} (${Object.keys(patch).join(",")}) values (${Object.values(
                        patch,
                      )
                        .map(lit)
                        .join(",")}) returning ${columns}`;
          if (counting) {
            twin.asServiceRole<{ n: number }>(`select count(*)::int as n from ${t}${w}`).then(
              (rows) => resolve({ count: rows[0]!.n, error: null }),
              (error) => resolve({ count: null, error }),
            );
            return;
          }
          twin.asServiceRole(sql).then(
            (rows) =>
              // As PostgREST: more than one row is an error for either, none only for single (F-142).
              resolve(
                one && (rows.length > 1 || (one === "single" && rows.length === 0))
                  ? { data: null, error: { code: "PGRST116", message: `${rows.length} rows` } }
                  : { data: one ? (rows[0] ?? null) : rows, error: null },
              ),
            // As supabase-js: a failed statement resolves with its error, it never throws.
            (error) => resolve({ data: null, error }),
          );
        },
      };
      return q;
    },
  };
}

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

export function restOver(twin: DatabaseTwin) {
  return {
    from(table: string) {
      const where: string[] = [];
      let verb: "select" | "update" | "delete" | "insert" = "select";
      let columns = "*";
      let patch: Record<string, unknown> = {};
      let tail = "";
      let returning = false;
      let one: "single" | "maybe" | null = null;
      let counting = false;
      // PostgREST's JSON path: `action->>action` is the text at key "action".
      const col = (c: string) => c.replace(/->>(\w+)$/, "->>'$1'");
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
        eq: (c: string, v: unknown) => (where.push(`${col(c)} = ${lit(v)}`), q),
        neq: (c: string, v: unknown) => (where.push(`${c} <> ${lit(v)}`), q),
        gt: (c: string, v: unknown) => (where.push(`${col(c)} > ${lit(v)}`), q),
        lt: (c: string, v: unknown) => (where.push(`${c} < ${lit(v)}`), q),
        lte: (c: string, v: unknown) => (where.push(`${c} <= ${lit(v)}`), q),
        is: (c: string, v: unknown) => (where.push(`${c} is ${lit(v)}`), q),
        in: (c: string, vs: unknown[]) => (
          where.push(vs.length ? `${col(c)} in (${vs.map(lit).join(",")})` : "false"),
          q
        ),
        order: (c: string, o: { ascending: boolean }) => (
          (tail += ` order by ${c} ${o.ascending ? "asc" : "desc"}`),
          q
        ),
        limit: (n: number) => ((tail += ` limit ${n}`), q),
        maybeSingle: () => ((one = "maybe"), q),
        single: () => ((one = "single"), q),
        then(resolve: (r: unknown) => void) {
          const w = where.length ? ` where ${where.join(" and ")}` : "";
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
            (rows) => resolve({ data: one ? (rows[0] ?? null) : rows, error: null }),
            // As supabase-js: a failed statement resolves with its error, it never throws.
            (error) => resolve({ data: null, error }),
          );
        },
      };
      return q;
    },
  };
}

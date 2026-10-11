import { describe, expect, it } from "vitest";
import {
  buildAccountExport,
  type DynamicTableClient,
  type ExportedRow,
  type PostgrestFailure,
} from "../data-rights";
import { ACCOUNT_DATA_CLASSES, type AccountTable } from "../data-classes";

/**
 * THE TWO FAILURES AN EXPORT HAS, AND NEITHER OF THEM RAISES AN ERROR.
 *
 * PostgREST returns at most `db-max-rows` â€” a thousand by default â€” and says
 * nothing about the rest. An unpaged export therefore hands somebody a file
 * that looks complete and stops partway, which is worse than failing, because
 * they will rely on it. The second failure is quieter still: a cascaded child
 * read with too many parent ids in one query string is refused by a proxy long
 * before the account is unusual, and the export loses every message while
 * keeping every conversation title.
 *
 * Neither reproduces against a database with three rows in it. So the database
 * is a parameter, and these tests hand it thousands.
 */

/** PostgREST's `or` filter over one row: `a.gt."x"` and `and(a.eq."x",b.gt."y")` terms. */
function matchesOr(row: ExportedRow, filters: string): boolean {
  const terms: string[] = [];
  let depth = 0;
  let start = 0;
  for (let at = 0; at < filters.length; at += 1) {
    const c = filters[at];
    if (c === "(") depth += 1;
    if (c === ")") depth -= 1;
    if (c === "," && depth === 0) {
      terms.push(filters.slice(start, at));
      start = at + 1;
    }
  }
  terms.push(filters.slice(start));
  return terms.some((term) => {
    if (term.startsWith("and(")) {
      return term
        .slice(4, -1)
        .split(",")
        .every((part) => matchesOr(row, part));
    }
    const [, column, op, raw] = /^(\w+)\.(eq|gt)\.(.*)$/.exec(term)!;
    const value = raw!.replace(/^"(.*)"$/, "$1").replace(/\\(.)/g, "$1");
    const order = String(row[column!]).localeCompare(value);
    return op === "eq" ? order === 0 : order > 0;
  });
}

/**
 * A fake that answers pages as PostgreSQL does: in a stable order only when one was
 * asked for. Unordered, each page sees the rows in a different order. `between` runs
 * after each page, so a test can change the table while an export reads it.
 */
function fakeDatabase(options: {
  rows?: Partial<Record<AccountTable, ExportedRow[]>>;
  failOn?: AccountTable;
  /** Every `.in()` list this fake was asked for, to check chunking. */
  seenIdBatches?: number[];
  deleted?: AccountTable[];
  between?: () => void;
}): DynamicTableClient {
  const rows = options.rows ?? {};
  let calls = 0;
  const page = (all: ExportedRow[], failure: PostgrestFailure) => {
    const by: string[] = [];
    let filter: string | null = null;
    const query = {
      order: (column: string) => (by.push(column), query),
      or: (filters: string) => ((filter = filters), query),
      limit: (count: number) => {
        calls += 1;
        const view = by.length
          ? [...all].sort((a, b) => String(a[by[0]!]).localeCompare(String(b[by[0]!])))
          : calls % 2
            ? all
            : [...all].reverse();
        const page = view.filter((row) => !filter || matchesOr(row, filter)).slice(0, count);
        options.between?.();
        return Promise.resolve({ data: failure ? null : page, error: failure });
      },
    };
    return query;
  };
  return {
    from(table: AccountTable) {
      const failure = options.failOn === table ? { message: "permission denied" } : null;
      const all = rows[table] ?? [];
      return {
        select: () => ({
          eq: () => page(all, failure),
          in: (_column: string, values: readonly string[]) => {
            options.seenIdBatches?.push(values.length);
            const matching = all.filter((row) => values.includes(String(row.parent)));
            return page(matching, failure);
          },
        }),
        delete: () => ({
          eq: () => {
            options.deleted?.push(table);
            return Promise.resolve({ error: failure });
          },
        }),
      };
    },
  };
}

function manyRows(
  count: number,
  extra: (index: number) => ExportedRow = () => ({}),
): ExportedRow[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `row-${index}`,
    ...extra(index),
  }));
}

describe("exporting an account", () => {
  it("reads every row exactly once even when the database's own order changes between pages", async () => {
    const all = manyRows(1200);
    const exported = await buildAccountExport(
      fakeDatabase({ rows: { ocade_library_items: all } }),
      "account-1",
    );
    const read = exported.classes
      .flatMap((entry) => entry.tables)
      .find((entry) => entry.table === "ocade_library_items")!.rows;
    expect(new Set(read.map((row) => row.id)).size).toBe(all.length);
    expect(read).toHaveLength(all.length);
  });

  it("misses no row when an earlier one is deleted between pages (C16)", async () => {
    const all = manyRows(1200).map((row, index) => ({
      ...row,
      id: `row-${String(index).padStart(4, "0")}`,
    }));
    const expected = all.map((row) => row.id);
    let pages = 0;
    const exported = await buildAccountExport(
      fakeDatabase({
        rows: { ocade_library_items: all },
        // After the first page, the person deletes a row that page already read.
        between: () => {
          pages += 1;
          if (pages === 1) all.splice(0, 1);
        },
      }),
      "account-1",
    );
    const read = exported.classes
      .flatMap((entry) => entry.tables)
      .find((entry) => entry.table === "ocade_library_items")!
      .rows.map((row) => row.id);
    // Every row that still exists was read, once: none slid into a page already passed.
    expect(read.slice(1)).toEqual(expected.slice(1));
    expect(new Set(read).size).toBe(read.length);
  });

  it("reads past the first page rather than stopping at it", async () => {
    // 1,700 conversations is three pages of 500 and a remainder. An unpaged
    // read returns the first page and reports it as the whole account.
    const conversations = manyRows(1_700);
    const result = await buildAccountExport(
      fakeDatabase({ rows: { ocade_conversations: conversations } }),
      "account-1",
    );
    const table = result.classes
      .flatMap((entry) => entry.tables)
      .find((entry) => entry.table === "ocade_conversations");
    expect(table?.rows).toHaveLength(1_700);
    expect(result.rowCount).toBe(1_700);
    expect(result.partial).toBe(false);
  });

  it("reads the messages inside those conversations, not just their titles", async () => {
    const conversations = manyRows(600);
    const messages = manyRows(600, (index) => ({ parent: `row-${index}`, body: "hello" })).map(
      (row, index) => ({ ...row, id: `message-${index}` }),
    );
    const seenIdBatches: number[] = [];
    const result = await buildAccountExport(
      fakeDatabase({
        rows: { ocade_conversations: conversations, ocade_messages: messages },
        seenIdBatches,
      }),
      "account-1",
    );
    const table = result.classes
      .flatMap((entry) => entry.tables)
      .find((entry) => entry.table === "ocade_messages");
    expect(table?.rows).toHaveLength(600);
    // Chunked, so the id list cannot outgrow a query string.
    expect(Math.max(...seenIdBatches)).toBeLessThanOrEqual(100);
  });

  it("says which table failed instead of pretending the class is empty", async () => {
    const result = await buildAccountExport(
      fakeDatabase({ rows: { activity_log: manyRows(3) }, failOn: "activity_log" }),
      "account-1",
    );
    const table = result.classes
      .flatMap((entry) => entry.tables)
      .find((entry) => entry.table === "activity_log");
    expect(table?.unavailable).toBe("permission denied");
    expect(result.partial).toBe(true);
    expect(result.notes.join(" ")).toMatch(/could not be read/i);
  });

  it("covers every class the map declares, including the ones it will not delete", async () => {
    const result = await buildAccountExport(fakeDatabase({}), "account-1");
    expect(result.classes.map((entry) => entry.id)).toEqual(
      ACCOUNT_DATA_CLASSES.map((entry) => entry.id),
    );
    for (const id of ["billing", "legal", "profile"]) {
      const entry = result.classes.find((candidate) => candidate.id === id);
      expect(entry?.retention, id).toBeTruthy();
      expect(entry?.tables.length, id).toBeGreaterThan(0);
    }
  });

  it("carries the account it was made for, and when", async () => {
    const result = await buildAccountExport(fakeDatabase({}), "account-42");
    expect(result.accountId).toBe("account-42");
    expect(Number.isNaN(Date.parse(result.generatedAt))).toBe(false);
    expect(result.schemaVersion).toBeGreaterThan(0);
  });

  it("says what is NOT in the file, because a reader cannot see an absence", async () => {
    const result = await buildAccountExport(fakeDatabase({}), "account-1");
    const notes = result.notes.join(" ");
    /*
     * This note used to name the "Browser Only" and "PC Vault" data classes
     * `PLAN.md` Phase 2 removed. What it must still do is state the absence:
     * an export cannot contain what OCADE never received.
     */
    expect(notes).toMatch(/never received/i);
    expect(notes).not.toMatch(/Browser Only|PC Vault/i);
    expect(notes).toMatch(/Offline Intelligence/);
  });
});

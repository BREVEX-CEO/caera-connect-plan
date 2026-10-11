/**
 * ACCESS AND ERASURE, AS PLAN.md §O DEFINES THEM — THE PART THAT CAN BE TESTED.
 *
 * The server functions in `lib/account-data.functions.ts` are thin: they
 * authenticate, they take the caller's own account id, and they call these two.
 * Everything that can be wrong lives here — paging, cascade traversal, the
 * retention refusals and the confirmation phrase — and all of it takes the
 * database as a parameter, so a test can hand it a client that returns three
 * pages, or one that fails on the fourth table, and see exactly what the person
 * would have received.
 *
 * WHY THE CLIENT IS INJECTED RATHER THAN IMPORTED. The failures worth catching
 * only appear at size: an export that silently stops at PostgREST's thousand-row
 * cap, or a cascaded child read with a parent id list too long for a query
 * string. Neither reproduces against an empty database, and neither is visible
 * in the result — the file simply arrives smaller than the truth.
 */
import type { Json } from "@/integrations/supabase/types";
import {
  ACCOUNT_DATA_CLASSES,
  exportedTablesFor,
  type AccountDataClassId,
  type AccountTable,
  type OwnerColumn,
} from "./data-classes";

/** Bumped when the SHAPE changes, so a reader can tell what it is holding. */
const ACCOUNT_EXPORT_SCHEMA_VERSION = 1;

/** How many rows one page of a table read asks for. */
const PAGE_SIZE = 500;

/**
 * One row, as the database returned it.
 *
 * Typed as JSON rather than `unknown` because the value crosses a server-
 * function boundary: `unknown` is not provably serialisable and the framework
 * refuses it, which is the right refusal — an export that cannot be serialised
 * is an export that does not arrive.
 */
export type ExportedRow = Record<string, Json | undefined>;

export interface AccountExportTable {
  table: AccountTable;
  rows: ExportedRow[];
  /**
   * Present when the table could not be read. The export still returns —
   * a partial export that SAYS it is partial is useful; one that silently
   * omits a table is a lie in a file somebody may rely on in a dispute.
   */
  unavailable?: string;
}

export interface AccountExportClass {
  id: AccountDataClassId;
  label: string;
  description: string;
  /** Null when the class may be deleted on request; otherwise why not. */
  retention: string | null;
  tables: AccountExportTable[];
}

export interface AccountDataExport {
  schemaVersion: number;
  generatedAt: string;
  accountId: string;
  /** Total rows across every table, so a reader can sanity-check the file. */
  rowCount: number;
  /** True when at least one table could not be read. */
  partial: boolean;
  classes: AccountExportClass[];
  /**
   * Said in the file itself, because an export is read long after it is made
   * and out of the context of the screen that produced it.
   */
  notes: string[];
}

/**
 * THE ONE CAST IN THIS FILE, AND WHY IT IS THE NARROW KIND.
 *
 * The Supabase client types `.from()` against a literal union of table names,
 * and every column method after it is narrowed to that ONE table's columns.
 * Passing a variable that could be any of seventy tables collapses the column
 * type to `never`, so `.eq("user_id", …)` stops compiling — not because the
 * query is wrong but because the client cannot know which table it is looking
 * at until runtime.
 *
 * The answer is not `any`. This declares exactly the calls this file makes, so
 * a typo in a method name is still a compile error, and the TABLE names remain
 * checked against the generated schema through `AccountTable`. What is given up
 * is column checking on two columns whose names are already constrained by
 * `OwnerColumn`.
 */
export type PostgrestFailure = { message: string } | null;

export interface RowPage {
  order(column: string): RowPage;
  or(filters: string): RowPage;
  limit(count: number): PromiseLike<{ data: ExportedRow[] | null; error: PostgrestFailure }>;
}

export interface RowSelection {
  eq(column: OwnerColumn, value: string): RowPage;
  in(column: string, values: readonly string[]): RowPage;
}

export interface DynamicTableClient {
  from(table: AccountTable): {
    select(columns: "*"): RowSelection;
    delete(): { eq(column: OwnerColumn, value: string): PromiseLike<{ error: PostgrestFailure }> };
  };
}

/**
 * Each table's unique key, so pages read in one stable order: without it PostgreSQL may
 * return a row on two pages, or on none. Every other exported table is keyed by `id`.
 */
const UNIQUE_KEY: Partial<Record<AccountTable, readonly string[]>> = {
  ocade_push_subscriptions: ["endpoint"],
  user_settings: ["user_id"],
  ocade_notification_preferences: ["user_id"],
  data_class_privacy: ["user_id", "data_class"],
  user_private_records: ["user_id", "data_class", "id"],
};

/** A value inside a PostgREST `or` filter, quoted so commas, dots and colons stay data. */
const quoted = (value: unknown) => `"${String(value).replace(/["\\]/g, (c) => `\\${c}`)}"`;

/** Rows after `last` in key order: (k1 > v1) or (k1 = v1 and k2 > v2) or ... */
function after(keys: readonly string[], last: ExportedRow): string {
  return keys
    .map((key, at) => {
      const before = keys.slice(0, at).map((k) => `${k}.eq.${quoted(last[k])}`);
      const next = `${key}.gt.${quoted(last[key])}`;
      return before.length ? `and(${[...before, next].join(",")})` : next;
    })
    .join(",");
}

/**
 * Read every row a query selects, a page at a time, each page continuing after the last row
 * read in the table's own unique-key order. Unlike counting rows to skip, a row deleted or
 * added meanwhile cannot make a later row be skipped (C16). `fixed` names key columns the
 * query already pins (the owner), which need no ordering.
 */
async function readByKey(
  table: AccountTable,
  query: () => RowPage,
  fixed: readonly string[] = [],
): Promise<AccountExportTable> {
  const keys = (UNIQUE_KEY[table] ?? ["id"]).filter((key) => !fixed.includes(key));
  const rows: ExportedRow[] = [];
  for (let last: ExportedRow | undefined; ;) {
    const ordered = keys.reduce((page, key) => page.order(key), query());
    const { data, error } = await (last ? ordered.or(after(keys, last)) : ordered).limit(PAGE_SIZE);
    if (error) return { table, rows, unavailable: error.message };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    last = data[data.length - 1];
  }
  return { table, rows };
}

/** Read one table completely. */
function readTable(
  admin: DynamicTableClient,
  table: AccountTable,
  userId: string,
  owner: OwnerColumn,
): Promise<AccountExportTable> {
  return readByKey(table, () => admin.from(table).select("*").eq(owner, userId), [owner]);
}

/**
 * A cascaded child is owned through its parent, not by a `user_id` of its own.
 *
 * `ocade_messages` has `conversation_id` and no `user_id` of its own. Reading
 * such a table by parent id keeps the export complete without
 * assuming a column the schema does not have — and the parent ids are already
 * in hand from the read above, so this costs no extra query to find them.
 */
async function readCascadedTable(
  admin: DynamicTableClient,
  table: AccountTable,
  parentColumn: string,
  parentIds: string[],
): Promise<AccountExportTable> {
  const rows: ExportedRow[] = [];
  // Chunked so the id list cannot outgrow a query string, which is how the
  // previous version of the deletion path failed at a few thousand rows.
  const CHUNK = 100;
  for (let index = 0; index < parentIds.length; index += CHUNK) {
    const slice = parentIds.slice(index, index + CHUNK);
    const read = await readByKey(table, () =>
      admin.from(table).select("*").in(parentColumn, slice),
    );
    rows.push(...read.rows);
    if (read.unavailable) return { table, rows, unavailable: read.unavailable };
  }
  return { table, rows };
}

/** Which column ties each cascaded child to its parent. */
const CASCADE_PARENT_COLUMN: Partial<
  Record<AccountTable, { parent: AccountTable; column: string }>
> = {
  ocade_messages: { parent: "ocade_conversations", column: "conversation_id" },
};

/** The `id` column of every row that has one, for the cascaded reads below. */
function identifiersIn(rows: readonly ExportedRow[]): string[] {
  return rows.map((row) => row.id).filter((id): id is string => typeof id === "string");
}

/**
 * Everything the account holds, read completely.
 *
 * A table that fails is reported in its own entry and `partial` is set; the
 * export still returns. A partial export that SAYS it is partial is useful; one
 * that silently omits a table is a lie in a file somebody may rely on later.
 */
export async function buildAccountExport(
  admin: DynamicTableClient,
  userId: string,
): Promise<AccountDataExport> {
  const classes: AccountExportClass[] = [];
  let rowCount = 0;
  let partial = false;
  /** Parent ids collected as they are read, for the cascaded children. */
  const idsByTable = new Map<AccountTable, string[]>();

  for (const entry of ACCOUNT_DATA_CLASSES) {
    const tables: AccountExportTable[] = [];
    for (const table of entry.tables) {
      const read = await readTable(admin, table.table, userId, table.owner);
      tables.push(read);
      idsByTable.set(table.table, identifiersIn(read.rows));
    }
    for (const child of exportedTablesFor(entry)) {
      const link = CASCADE_PARENT_COLUMN[child];
      if (!link) continue;
      const parentIds = idsByTable.get(link.parent) ?? [];
      const read = await readCascadedTable(admin, child, link.column, parentIds);
      tables.push(read);
      idsByTable.set(child, identifiersIn(read.rows));
    }
    for (const table of tables) {
      rowCount += table.rows.length;
      if (table.unavailable) partial = true;
    }
    classes.push({
      id: entry.id,
      label: entry.label,
      description: entry.description,
      retention: entry.retention,
      tables,
    });
  }

  return {
    schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    accountId: userId,
    rowCount,
    partial,
    classes,
    notes: [
      "This file contains the data OCADE holds for this account in its own database.",
      "Anything OCADE never received is not in here — a draft you never sent, or a file you never uploaded.",
      "Offline Intelligence is a model on your device, not account data, and is unaffected by an export or a deletion.",
      "Not included: security credentials (recovery-code hashes, device keys, short-lived permits) and OCADE's own operator records.",
      partial
        ? "At least one table could not be read; every table that failed says so in its own entry."
        : "Every table was read in full.",
    ],
  };
}

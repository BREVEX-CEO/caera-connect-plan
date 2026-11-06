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
} from "./data-classes.ts";

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
  // Keyed by its task: it has no `id`, so ordering by `id` made every export partial (V15).
  ocade_jarvis_task_charges: ["task_id"],
};

/** The columns an exported table's pages are ordered by: its unique key. */
export const exportKeyOf = (table: AccountTable): readonly string[] => UNIQUE_KEY[table] ?? ["id"];

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

/** One page of a table's rows, or why the table could not be read further. */
type Page = { rows: ExportedRow[] } | { unavailable: string };

/**
 * Every row a query selects, a page at a time, each page continuing after the last row
 * read in the table's own unique-key order. Unlike counting rows to skip, a row deleted or
 * added meanwhile cannot make a later row be skipped (C16). `fixed` names key columns the
 * query already pins (the owner), which need no ordering.
 */
async function* pagesByKey(
  table: AccountTable,
  query: () => RowPage,
  fixed: readonly string[] = [],
): AsyncGenerator<Page> {
  const keys = exportKeyOf(table).filter((key) => !fixed.includes(key));
  for (let last: ExportedRow | undefined; ;) {
    const ordered = keys.reduce((page, key) => page.order(key), query());
    const { data, error } = await (last ? ordered.or(after(keys, last)) : ordered).limit(PAGE_SIZE);
    if (error) {
      yield { unavailable: "This table could not be read. Try exporting again." };
      return;
    }
    if (!data || data.length === 0) return;
    yield { rows: data };
    if (data.length < PAGE_SIZE) return;
    last = data[data.length - 1];
  }
}

/** One table completely. */
function tablePages(
  admin: DynamicTableClient,
  table: AccountTable,
  userId: string,
  owner: OwnerColumn,
): AsyncGenerator<Page> {
  return pagesByKey(table, () => admin.from(table).select("*").eq(owner, userId), [owner]);
}

/**
 * A cascaded child is owned through its parent, not by a `user_id` of its own.
 *
 * `ocade_messages` has `conversation_id` and no `user_id` of its own. Reading
 * such a table by parent id keeps the export complete without
 * assuming a column the schema does not have — and the parent ids are already
 * in hand from the read above, so this costs no extra query to find them.
 */
async function* cascadedPages(
  admin: DynamicTableClient,
  table: AccountTable,
  parentColumn: string,
  parentIds: string[],
): AsyncGenerator<Page> {
  // Chunked so the id list cannot outgrow a query string, which is how the
  // previous version of the deletion path failed at a few thousand rows.
  const CHUNK = 100;
  for (let index = 0; index < parentIds.length; index += CHUNK) {
    const slice = parentIds.slice(index, index + CHUNK);
    for await (const page of pagesByKey(table, () =>
      admin.from(table).select("*").in(parentColumn, slice),
    )) {
      yield page;
      if ("unavailable" in page) return;
    }
  }
}

/** Which column ties each cascaded child to its parent. */
const CASCADE_PARENT_COLUMN: Partial<
  Record<AccountTable, { parent: AccountTable; column: string }>
> = {
  ocade_messages: { parent: "ocade_conversations", column: "conversation_id" },
};

const PRIVATE_EXPORT_COLUMNS: Partial<Record<AccountTable, ReadonlySet<string>>> = {
  jarvis_tasks: new Set(["model_metric_ids"]),
  jarvis_devices: new Set(["public_key", "enrollment_expires_at", "last_request_ms"]),
  ocade_push_subscriptions: new Set(["auth", "endpoint", "p256dh", "session_id"]),
};

function exportRow(table: AccountTable, row: ExportedRow): ExportedRow {
  const excluded = PRIVATE_EXPORT_COLUMNS[table];
  const exported = excluded
    ? Object.fromEntries(Object.entries(row).filter(([column]) => !excluded.has(column)))
    : row;
  const checkpoint = exported.checkpoint;
  if (
    table === "jarvis_tasks" &&
    checkpoint &&
    typeof checkpoint === "object" &&
    !Array.isArray(checkpoint)
  ) {
    return {
      ...exported,
      checkpoint: Object.fromEntries(
        Object.entries(checkpoint).filter(([field]) => field !== "authorizedSessionId"),
      ),
    };
  }
  return exported;
}

/**
 * Everything the account holds, as the JSON text of an `AccountDataExport`, one page of
 * rows at a time (PLAN Phase 09). Built whole in the Worker, a large account's export could
 * outgrow its memory and arrive as nothing; streamed, only one page is held at once, and
 * `rowCount` and `partial`, known only at the end, come last in the file.
 */
async function* exportText(admin: DynamicTableClient, userId: string): AsyncGenerator<string> {
  const json = JSON.stringify;
  let rowCount = 0;
  let partial = false;
  /** Parent ids collected as they are read, for the cascaded children. */
  const idsByTable = new Map<AccountTable, string[]>();
  yield `{"schemaVersion":${ACCOUNT_EXPORT_SCHEMA_VERSION},"generatedAt":${json(new Date().toISOString())},"accountId":${json(userId)},"classes":[`;
  for (const [at, entry] of ACCOUNT_DATA_CLASSES.entries()) {
    yield `${at ? "," : ""}{"id":${json(entry.id)},"label":${json(entry.label)},"description":${json(entry.description)},"retention":${json(entry.retention)},"tables":[`;
    let tables = 0;
    async function* table(name: AccountTable, pages: AsyncGenerator<Page>) {
      yield `${tables++ ? "," : ""}{"table":${json(name)},"rows":[`;
      const ids: string[] = [];
      let first = true;
      let unavailable: string | null = null;
      for await (const page of pages) {
        if ("unavailable" in page) {
          unavailable = page.unavailable;
          break;
        }
        for (const row of page.rows) {
          yield `${first ? "" : ","}${json(exportRow(name, row))}`;
          first = false;
        }
        rowCount += page.rows.length;
        for (const row of page.rows) if (typeof row.id === "string") ids.push(row.id);
      }
      idsByTable.set(name, ids);
      if (unavailable !== null) partial = true;
      yield `]${unavailable !== null ? `,"unavailable":${json(unavailable)}` : ""}}`;
    }
    for (const owned of entry.tables) {
      yield* table(owned.table, tablePages(admin, owned.table, userId, owned.owner));
    }
    for (const child of exportedTablesFor(entry)) {
      const link = CASCADE_PARENT_COLUMN[child];
      if (!link) continue;
      const parentIds = idsByTable.get(link.parent) ?? [];
      yield* table(child, cascadedPages(admin, child, link.column, parentIds));
    }
    yield "]}";
  }
  const notes = [
    "This file contains the data OCADE holds for this account in its own database.",
    "Anything OCADE never received is not in here — a draft you never sent, or a file you never uploaded.",
    "Offline Intelligence is a model on your device, not account data, and is unaffected by an export or a deletion.",
    "Not included: security credentials (recovery-code hashes, device keys, short-lived permits) and OCADE's own operator records.",
    partial
      ? "At least one table could not be read; every table that failed says so in its own entry."
      : "Every table was read in full.",
  ];
  yield `],"rowCount":${rowCount},"partial":${partial},"notes":${json(notes)}}`;
}

/** The export as a byte stream that reads the next page only when the last was taken. */
export function streamAccountExport(
  admin: DynamicTableClient,
  userId: string,
): ReadableStream<Uint8Array> {
  const text = exportText(admin, userId);
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await text.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(value));
    },
    async cancel() {
      await text.return(undefined);
    },
  });
}

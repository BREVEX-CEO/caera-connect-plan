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
  findAccountDataClass,
  type AccountDataClassId,
  type AccountTable,
  type OwnerColumn,
} from "./data-classes";

/** Bumped when the SHAPE changes, so a reader can tell what it is holding. */
export const ACCOUNT_EXPORT_SCHEMA_VERSION = 1;

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
  range(
    from: number,
    to: number,
  ): PromiseLike<{ data: ExportedRow[] | null; error: PostgrestFailure }>;
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

/** Read one table completely, a page at a time. */
async function readTable(
  admin: DynamicTableClient,
  table: AccountTable,
  userId: string,
  owner: OwnerColumn,
): Promise<AccountExportTable> {
  const rows: ExportedRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from(table)
      .select("*")
      .eq(owner, userId)
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { table, rows, unavailable: error.message };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }
  return { table, rows };
}

/**
 * A cascaded child is owned through its parent, not by a `user_id` of its own.
 *
 * `ocade_messages` has `conversation_id`, `ocade_project_items` has
 * `project_id`. Reading them by parent id keeps the export complete without
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
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await admin
        .from(table)
        .select("*")
        .in(parentColumn, slice)
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { table, rows, unavailable: error.message };
      if (!data || data.length === 0) break;
      rows.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
  }
  return { table, rows };
}

/** Which column ties each cascaded child to its parent. */
const CASCADE_PARENT_COLUMN: Partial<
  Record<AccountTable, { parent: AccountTable; column: string }>
> = {
  ocade_messages: { parent: "ocade_conversations", column: "conversation_id" },
  ocade_project_items: { parent: "ocade_projects", column: "project_id" },
  ocade_support_messages: { parent: "ocade_support_tickets", column: "ticket_id" },
  ocade_automation_runs: { parent: "ocade_automations", column: "automation_id" },
  ocade_automation_step_receipts: { parent: "ocade_automation_runs", column: "run_id" },
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
      "Anything you chose to keep on your device only — Browser Only or PC Vault data classes — is not in here, because OCADE never received it.",
      "Offline Intelligence is a model on your device, not account data, and is unaffected by an export or a deletion.",
      partial
        ? "At least one table could not be read; every table that failed says so in its own entry."
        : "Every table was read in full.",
    ],
  };
}

export interface DataClassDeletionReceipt {
  dataClass: AccountDataClassId;
  label: string;
  completedAt: string;
  /** Tables cleared, parents and the children their cascade removed. */
  cleared: string[];
  /**
   * Said out loud because it is the question people actually have: clearing a
   * class of account data does not touch the model on the device.
   */
  offlineIntelligencePreserved: true;
}

export interface ClearDataClassRequest {
  dataClass: string;
  /** The person types the class label. A button alone is not consent. */
  confirmation: string;
}

/**
 * Clear one class of account data.
 *
 * Throws rather than returning a failure shape: every reason to refuse is
 * something the person needs to read — a class that may not be erased, a
 * confirmation that does not match, a table that would not clear — and a
 * silent no-op on a deletion is the worst of the available outcomes.
 */
export async function clearAccountDataClass(
  admin: DynamicTableClient,
  userId: string,
  request: ClearDataClassRequest,
): Promise<DataClassDeletionReceipt> {
  const entry = findAccountDataClass(request.dataClass);
  if (!entry) throw new Error("That is not a data class OCADE holds.");
  /*
   * REFUSED HERE, not merely absent from the screen. The retention reason is
   * the product's answer to a legal obligation, and an obligation that only
   * holds while somebody uses the interface is not an obligation.
   */
  if (entry.retention !== null) throw new Error(entry.retention);
  if (request.confirmation.trim().toLowerCase() !== entry.label.toLowerCase()) {
    throw new Error(`Type ${entry.label} exactly to confirm.`);
  }

  const cleared: string[] = [];
  for (const table of entry.tables) {
    const { error } = await admin.from(table.table).delete().eq(table.owner, userId);
    if (error) throw new Error(`${table.table} could not be cleared: ${error.message}`);
    cleared.push(table.table);
    cleared.push(...(table.cascades ?? []));
  }

  return {
    dataClass: entry.id,
    label: entry.label,
    completedAt: new Date().toISOString(),
    cleared,
    offlineIntelligencePreserved: true,
  };
}

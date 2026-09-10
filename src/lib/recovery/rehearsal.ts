/**
 * BACKUP AND RESTORE, AS CODE THAT RUNS RATHER THAN A RUNBOOK THAT READS WELL.
 *
 * `PLAN.md` Phase 16 asks for recovery to be demonstrated, not documented, and
 * the difference is the whole point. `docs/deployment/BACKUP_AND_RESTORE.md`
 * described a restore rehearsal in shell commands nobody had run since the
 * commands were written -- by the time this file existed the document still
 * said the schema was 58 migrations and still told an operator to check a
 * `vault_config` table that Phase 2 removed. A runbook drifts silently because
 * nothing executes it. This does.
 *
 * WHAT A BACKUP HAS TO BE, FOR THIS TO MEAN ANYTHING. It has to be restorable
 * into an EMPTY database, not the one it came from, which may be the thing
 * that is broken. So the export here carries no object identifiers and no
 * assumptions about what already exists: schema comes from
 * `supabase/migrations/`, rows come from the export, and the restore runs
 * against a database that has never seen either.
 *
 * WHAT AN EVIDENCE FILE MAY NOT CARRY. Row contents are people's
 * conversations. A rehearsal that writes them into `release/` for the sake of
 * proving a count has leaked the data it was protecting, so integrity is
 * proven by digest and count: `digestRows` folds a table into one hex string
 * that changes if any value changes and reveals nothing about what the values
 * were.
 */

/** One table's rows, exactly as they were read. Never written to evidence. */
export interface BackupTable {
  table: string;
  rows: Array<Record<string, unknown>>;
}

export interface RecoveryBackup {
  schemaVersion: 1;
  takenAt: string;
  /** The release the backup was taken from, so a restore can be dated. */
  release: string;
  /** How many migrations the source schema had applied. */
  migrationCount: number;
  tables: BackupTable[];
}

/** Counts and digests only: the shape that is safe to keep as evidence. */
export interface TableInventory {
  table: string;
  rowCount: number;
  digest: string;
}

/**
 * A stable digest of a table's contents.
 *
 * FNV-1a over a canonical rendering, because the property needed is "any
 * difference changes the string", not cryptographic strength, and because a
 * pure function with no imports runs identically in a test, a script and a
 * browser. Keys are sorted so column order cannot change the digest; rows are
 * sorted after rendering so row order cannot either. A restore that returns
 * the same rows in a different order is a correct restore.
 */
export function digestRows(rows: Array<Record<string, unknown>>): string {
  const rendered = rows.map(renderRow).sort();
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (const character of rendered.join("\n")) {
    hash = ((hash ^ BigInt(character.codePointAt(0) ?? 0)) * prime) & mask;
  }
  return hash.toString(16).padStart(16, "0");
}

function renderValue(value: unknown): string {
  if (value === null || value === undefined) return " null";
  if (value instanceof Date) return `d:${value.toISOString()}`;
  if (typeof value === "object") return `j:${JSON.stringify(value)}`;
  return `v:${String(value)}`;
}

function renderRow(row: Record<string, unknown>): string {
  return Object.keys(row)
    .sort()
    .map((key) => `${key}=${renderValue(row[key])}`)
    .join("");
}

export function inventoryOf(backup: RecoveryBackup): TableInventory[] {
  return backup.tables
    .map((t) => ({ table: t.table, rowCount: t.rows.length, digest: digestRows(t.rows) }))
    .sort((a, b) => a.table.localeCompare(b.table));
}

export interface InventoryDifference {
  table: string;
  /** `missing`: in the backup, absent after the restore. */
  problem: "missing" | "unexpected" | "row_count" | "contents";
  detail: string;
}

/**
 * Compare what was backed up with what came back.
 *
 * A restore is correct when every table returns the same number of rows AND
 * the same contents. Counting alone passes a restore that inserted the right
 * number of wrong rows, which is the failure mode a hand-written column
 * mapping actually produces.
 */
export function compareInventories(
  before: TableInventory[],
  after: TableInventory[],
): InventoryDifference[] {
  const differences: InventoryDifference[] = [];
  const afterByTable = new Map(after.map((t) => [t.table, t]));

  for (const source of before) {
    const restored = afterByTable.get(source.table);
    if (!restored) {
      differences.push({
        table: source.table,
        problem: "missing",
        detail: `${source.rowCount} row(s) backed up; the table is not in the restored database`,
      });
      continue;
    }
    if (restored.rowCount !== source.rowCount) {
      differences.push({
        table: source.table,
        problem: "row_count",
        detail: `${source.rowCount} row(s) backed up, ${restored.rowCount} restored`,
      });
      continue;
    }
    if (restored.digest !== source.digest) {
      differences.push({
        table: source.table,
        problem: "contents",
        detail: `${source.rowCount} row(s) restored, but their contents differ from the backup`,
      });
    }
  }

  for (const restored of after) {
    if (!before.some((t) => t.table === restored.table) && restored.rowCount > 0) {
      differences.push({
        table: restored.table,
        problem: "unexpected",
        detail: `${restored.rowCount} row(s) exist after a restore that backed the table up empty`,
      });
    }
  }

  return differences;
}

/* ------------------------------------------------------------- ordering -- */

export interface ForeignKeyEdge {
  table: string;
  dependsOn: string;
}

export interface RestoreOrder {
  order: string[];
  /**
   * Tables no order can satisfy: those in a foreign-key cycle, and those
   * downstream of one. They are still restored, at the end, but an operator is
   * told, because a cycle is the one shape where insert order alone cannot
   * satisfy every constraint -- the restore defers constraints for those.
   */
  unordered: string[];
}

/**
 * Restore parents before children, from the catalogue rather than from a list.
 *
 * A hand-maintained order is wrong the first time a table is added and nobody
 * notices until a restore fails at 3am. This reads `pg_constraint` at rehearsal
 * time, so a table added next month is ordered correctly the day it is added.
 * Self-references are ignored: a row referencing its own table cannot be fixed
 * by table order, and ordering on it would report every such table as a cycle.
 */
export function restoreOrder(tables: string[], edges: ForeignKeyEdge[]): RestoreOrder {
  const remaining = new Set(tables);
  const dependencies = new Map<string, Set<string>>();
  for (const table of tables) dependencies.set(table, new Set());
  for (const edge of edges) {
    if (edge.table === edge.dependsOn) continue;
    if (!remaining.has(edge.table) || !remaining.has(edge.dependsOn)) continue;
    dependencies.get(edge.table)?.add(edge.dependsOn);
  }

  const order: string[] = [];
  const placed = new Set<string>();
  while (placed.size < tables.length) {
    const ready = tables
      .filter((t) => !placed.has(t))
      .filter((t) => [...(dependencies.get(t) ?? [])].every((d) => placed.has(d)))
      .sort();
    if (ready.length === 0) break;
    for (const table of ready) {
      order.push(table);
      placed.add(table);
    }
  }

  const unordered = tables.filter((t) => !placed.has(t)).sort();
  return { order: [...order, ...unordered], unordered };
}

/* -------------------------------------------------------------- restore -- */

export interface RestoreStatement {
  table: string;
  sql: string;
  params: unknown[];
}

/**
 * The INSERT for one row, with every value bound rather than interpolated.
 *
 * A restore builds SQL out of data, which is the exact shape that makes string
 * concatenation dangerous: a quote inside somebody's message ends the
 * statement and the rest of their sentence is executed. Values go through
 * placeholders; only identifiers are inlined, and they come from the
 * catalogue, never from a row.
 */
export function insertStatementFor(
  table: string,
  row: Record<string, unknown>,
  schema = "public",
): RestoreStatement {
  const columns = Object.keys(row).sort();
  const placeholders = columns.map((_, index) => `$${index + 1}`);
  return {
    table,
    sql:
      `insert into ${quoteIdentifier(schema)}.${quoteIdentifier(table)} ` +
      `(${columns.map(quoteIdentifier).join(", ")}) values (${placeholders.join(", ")})`,
    params: columns.map((column) => normaliseForInsert(row[column])),
  };
}

/** An identifier from the catalogue, quoted so a reserved word still works. */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * A driver hands back `jsonb` as an object and `timestamptz` as a Date. Both
 * go back as text Postgres re-parses, which is what keeps a round trip lossless
 * for a column whose type the exporter never had to know.
 */
function normaliseForInsert(value: unknown): unknown {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

/* --------------------------------------------------------------- report -- */

export type RehearsalStepStatus = "passed" | "failed";

export interface RehearsalStep {
  step: string;
  status: RehearsalStepStatus;
  detail: string;
}

export interface RehearsalReport {
  schemaVersion: 1;
  rehearsedAt: string;
  release: string;
  migrationCount: number;
  /** Counts and digests. Never row contents. */
  inventory: TableInventory[];
  steps: RehearsalStep[];
  recovered: boolean;
}

export function buildReport(input: {
  rehearsedAt: string;
  release: string;
  migrationCount: number;
  inventory: TableInventory[];
  steps: RehearsalStep[];
}): RehearsalReport {
  return {
    schemaVersion: 1,
    ...input,
    recovered: input.steps.length > 0 && input.steps.every((s) => s.status === "passed"),
  };
}

/**
 * Anything that looks like a credential, or like somebody's sentence.
 *
 * Applied to the finished report before it is written. The report is built out
 * of counts and digests, so this should never fire, and that is precisely why
 * it runs: a field added later that carries a row value fails the rehearsal
 * instead of shipping into `release/`.
 */
const FORBIDDEN_IN_EVIDENCE = [
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]+/ },
  { name: "bearer token", re: /\b(?:sk-|ghp_|xox[baprs]-|AIza)[A-Za-z0-9_-]{10,}/ },
  { name: "private key", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "email address", re: /[^\s"@]+@[^\s"@]+\.[A-Za-z]{2,}/ },
  { name: "connection string", re: /postgres(?:ql)?:\/\/[^\s"]+/ },
];

export function evidenceLeaks(report: RehearsalReport): string[] {
  const serialised = JSON.stringify(report);
  return FORBIDDEN_IN_EVIDENCE.filter(({ re }) => re.test(serialised)).map(({ name }) => name);
}

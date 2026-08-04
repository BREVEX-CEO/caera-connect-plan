/**
 * Business-records skill pack — a REAL, executed adapter for the ERP/CRM/HR/
 * supply-chain category.
 *
 * Scope, stated plainly: this pack checks the **exported files** those systems
 * produce, before anyone imports them somewhere else. It does not sign into
 * SAP, Salesforce, Workday or NetSuite, and it never writes a record back.
 * `coverageNote` says so.
 *
 * This is the work that actually goes wrong in a migration: a supplier ID that
 * appears twice, an order pointing at a customer who isn't in the export, a
 * date column that is text in 400 rows and a number in three. Every check here
 * reports **which rows** — a count alone tells someone there's a problem but
 * not where, and they will go looking by hand.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";
import type { DataTable } from "./data-pack";

const CAPABILITIES: SkillCapability[] = [
  {
    id: "records.validate",
    label: "Check an export against the columns it should have",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "records.duplicates",
    label: "Find records that appear more than once",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
  {
    id: "records.orphans",
    label: "Find references pointing at records that aren't there",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
];

export const RECORDS_PACK: SkillPack = {
  appId: "ocade.records",
  displayName: "Business record exports",
  category: "erp_crm_hcm_scm",
  testedVersions: ["1."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
  coverageNote:
    "Checks exported record files before they are imported elsewhere. OCADE cannot sign into SAP, Salesforce, Workday, NetSuite or any other business system, and never creates or changes a record.",
};

export type RecordsOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/* ------------------------------------------------------------ validation -- */

export type FieldType = "text" | "integer" | "decimal" | "date" | "email";

export interface FieldRule {
  column: string;
  type: FieldType;
  required: boolean;
}

export interface FieldProblem {
  /** 1-based row number as the user sees it in a spreadsheet (header is row 1). */
  row: number;
  column: string;
  value: string;
  problem: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// Deliberately conservative: this rejects addresses that are technically legal
// but almost always typos. It is used to flag for review, never to delete.
const EMAIL = /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/;

function typeProblem(value: string, type: FieldType): string | null {
  switch (type) {
    case "text":
      return null;
    case "integer":
      return /^-?\d+$/.test(value) ? null : "should be a whole number";
    case "decimal":
      return /^-?\d+(\.\d+)?$/.test(value) ? null : "should be a number";
    case "date": {
      if (!ISO_DATE.test(value)) return "should be a date as YYYY-MM-DD";
      const [y, m, d] = value.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      // Rejects 2026-02-30, which passes a pattern check and then silently
      // becomes 2 March in almost every downstream system.
      return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
        ? null
        : "isn't a real date";
    }
    case "email":
      return EMAIL.test(value) ? null : "doesn't look like an email address";
  }
}

export interface ValidationResult {
  problems: FieldProblem[];
  missingColumns: string[];
  extraColumns: string[];
  rowsChecked: number;
}

/**
 * Check an export against the shape it is supposed to have.
 *
 * Missing columns are fatal — a validation run against the wrong file would
 * otherwise report "0 problems", which reads as a pass.
 */
export function validateRecords(
  table: DataTable,
  rules: FieldRule[],
): RecordsOutcome<ValidationResult> {
  if (rules.length === 0) {
    return { ok: false, reason: "No rules were given, so there's nothing to check against." };
  }

  const missingColumns = rules
    .filter((r) => !table.columns.includes(r.column))
    .map((r) => r.column);
  if (missingColumns.length > 0) {
    return {
      ok: false,
      reason: `This export is missing ${missingColumns.length} expected column${missingColumns.length === 1 ? "" : "s"}: ${missingColumns.join(", ")}. OCADE won't report it as passing a check it couldn't run.`,
    };
  }

  const ruleColumns = new Set(rules.map((r) => r.column));
  const extraColumns = table.columns.filter((c) => !ruleColumns.has(c));

  const problems: FieldProblem[] = [];
  table.rows.forEach((row, i) => {
    for (const rule of rules) {
      const value = (row[rule.column] ?? "").trim();
      if (value === "") {
        if (rule.required) {
          problems.push({
            row: i + 2,
            column: rule.column,
            value: "",
            problem: "is required but empty",
          });
        }
        continue; // an optional empty value has no type to check
      }
      const p = typeProblem(value, rule.type);
      if (p) problems.push({ row: i + 2, column: rule.column, value, problem: p });
    }
  });

  return {
    ok: true,
    data: { problems, missingColumns, extraColumns, rowsChecked: table.rows.length },
    evidence:
      problems.length === 0
        ? `All ${table.rows.length} rows match the expected columns and types.`
        : `${problems.length} problem${problems.length === 1 ? "" : "s"} across ${new Set(problems.map((p) => p.row)).size} row${new Set(problems.map((p) => p.row)).size === 1 ? "" : "s"} — first at row ${problems[0].row}, ${problems[0].column} ${problems[0].problem}.`,
  };
}

/* ------------------------------------------------------------ duplicates -- */

export interface DuplicateGroup {
  key: string;
  /** 1-based spreadsheet row numbers. */
  rows: number[];
}

/**
 * ASCII unit separator, joining the parts of a composite key.
 *
 * It cannot appear in a CSV field, so no combination of values can be made to
 * collide with a different record's key — which a joiner like "|" or "-" can.
 */
const KEY_SEPARATOR = String.fromCharCode(0x1f);

/**
 * Find keys that appear more than once.
 *
 * Blank keys are reported separately rather than grouped: fifty rows with an
 * empty ID are fifty missing IDs, not one duplicate — and merging them would
 * be a data-loss bug in whatever imports the file next.
 */
export function findDuplicates(
  table: DataTable,
  keyColumns: string[],
): RecordsOutcome<{ duplicates: DuplicateGroup[]; blankKeyRows: number[] }> {
  if (keyColumns.length === 0) {
    return { ok: false, reason: "No key columns were given." };
  }
  const missing = keyColumns.filter((c) => !table.columns.includes(c));
  if (missing.length > 0) {
    return { ok: false, reason: `There's no column called ${missing.join(", ")} in this export.` };
  }

  const seen = new Map<string, number[]>();
  const blankKeyRows: number[] = [];

  table.rows.forEach((row, i) => {
    const parts = keyColumns.map((c) => (row[c] ?? "").trim());
    if (parts.every((p) => p === "")) {
      blankKeyRows.push(i + 2);
      return;
    }
    // Unit separator: a value containing the joiner cannot forge a different
    // key's identity.
    const key = parts.join(KEY_SEPARATOR);
    const rows = seen.get(key);
    if (rows) rows.push(i + 2);
    else seen.set(key, [i + 2]);
  });

  const duplicates = [...seen.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([key, rows]) => ({ key: key.split(KEY_SEPARATOR).join(" · "), rows }));

  const parts: string[] = [];
  parts.push(
    duplicates.length === 0
      ? `No duplicates across ${table.rows.length} rows.`
      : `${duplicates.length} duplicated key${duplicates.length === 1 ? "" : "s"} — e.g. “${duplicates[0].key}” on rows ${duplicates[0].rows.join(", ")}.`,
  );
  if (blankKeyRows.length > 0) {
    parts.push(
      `${blankKeyRows.length} row${blankKeyRows.length === 1 ? " has" : "s have"} no key at all (row${blankKeyRows.length === 1 ? "" : "s"} ${blankKeyRows.slice(0, 5).join(", ")}${blankKeyRows.length > 5 ? "…" : ""}).`,
    );
  }

  return { ok: true, data: { duplicates, blankKeyRows }, evidence: parts.join(" ") };
}

/* --------------------------------------------------------------- orphans -- */

export interface Orphan {
  row: number;
  value: string;
}

/**
 * Find references that point at records which aren't in the other file.
 *
 * The classic migration failure: orders referencing customers that were
 * filtered out of the customer export. The import succeeds, and the orders are
 * silently unattached.
 */
export function findOrphans(
  child: DataTable,
  childColumn: string,
  parent: DataTable,
  parentColumn: string,
): RecordsOutcome<Orphan[]> {
  if (!child.columns.includes(childColumn)) {
    return {
      ok: false,
      reason: `There's no column called “${childColumn}” in the referencing file.`,
    };
  }
  if (!parent.columns.includes(parentColumn)) {
    return {
      ok: false,
      reason: `There's no column called “${parentColumn}” in the referenced file.`,
    };
  }

  const known = new Set(
    parent.rows.map((r) => (r[parentColumn] ?? "").trim()).filter((v) => v !== ""),
  );
  if (known.size === 0) {
    return {
      ok: false,
      reason: `“${parentColumn}” is empty in every row of the referenced file, so every reference would look broken. Check you exported the right file.`,
    };
  }

  const orphans: Orphan[] = [];
  child.rows.forEach((row, i) => {
    const v = (row[childColumn] ?? "").trim();
    if (v === "") return; // an absent reference is a different problem
    if (!known.has(v)) orphans.push({ row: i + 2, value: v });
  });

  return {
    ok: true,
    data: orphans,
    evidence:
      orphans.length === 0
        ? `All ${child.rows.length} references resolve against ${known.size} known record${known.size === 1 ? "" : "s"}.`
        : `${orphans.length} of ${child.rows.length} reference${child.rows.length === 1 ? "" : "s"} point at records that aren't in the other file — first “${orphans[0].value}” on row ${orphans[0].row}.`,
  };
}

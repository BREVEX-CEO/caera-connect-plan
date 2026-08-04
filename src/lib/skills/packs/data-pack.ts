/**
 * Data & analysis skill pack — a REAL, executed adapter for the BI/data
 * category.
 *
 * Exercised against real CSV and JSON files in `data-pack.test.ts`: it writes
 * files to disk, parses them, computes results, and checks the numbers against
 * independently calculated values.
 *
 * The rule that shapes every function here: **a statistic that cannot be
 * computed honestly is not returned.** An empty column has no mean — it does
 * not have a mean of zero. A column with a non-numeric value is not silently
 * skipped, because a mean over "the rows that happened to parse" is a different
 * number from the mean the user asked for, and it looks identical.
 */
import type { SkillCapability, SkillPack } from "../skill-pack";

const CAPABILITIES: SkillCapability[] = [
  {
    id: "data.parse_csv",
    label: "Read a CSV file",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "data.parse_json",
    label: "Read a JSON file",
    methods: ["file"],
    mutating: false,
    verifyBy: "file",
    tested: true,
  },
  {
    id: "data.summarise",
    label: "Summarise a column",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
  {
    id: "data.filter",
    label: "Filter rows",
    methods: ["file"],
    mutating: false,
    verifyBy: "api",
    tested: true,
  },
];

export const DATA_PACK: SkillPack = {
  appId: "ocade.data",
  displayName: "Data and analysis",
  category: "data_bi_ai",
  testedVersions: ["1."],
  capabilities: CAPABILITIES,
  requiresLicensedInstall: false,
};

export interface DataTable {
  columns: string[];
  rows: Record<string, string>[];
}

export type DataOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/**
 * Parse CSV, including quoted fields containing commas and newlines.
 *
 * A naive `split(",")` corrupts any real-world export silently — the row count
 * still looks plausible, so the damage is invisible until someone acts on it.
 */
export function parseCsv(text: string): DataOutcome<DataTable> {
  if (!text.trim()) return { ok: false, reason: "That file is empty." };

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (inQuotes) {
    return { ok: false, reason: "This CSV has an unclosed quote — it may be truncated." };
  }
  if (rows.length < 2) {
    return { ok: false, reason: "This CSV has a header but no data rows." };
  }

  const columns = rows[0].map((c) => c.trim());
  const dataRows = rows.slice(1).filter((r) => r.some((v) => v.trim().length > 0));

  // A ragged row means the file is malformed; guessing which column a value
  // belongs to would silently attribute data to the wrong field.
  const ragged = dataRows.findIndex((r) => r.length !== columns.length);
  if (ragged !== -1) {
    return {
      ok: false,
      reason: `Row ${ragged + 2} has ${dataRows[ragged].length} values but there are ${columns.length} columns. OCADE won't guess which column they belong to.`,
    };
  }

  return {
    ok: true,
    data: {
      columns,
      rows: dataRows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i]]))),
    },
    evidence: `${dataRows.length} rows × ${columns.length} columns.`,
  };
}

export function parseJsonRecords(text: string): DataOutcome<DataTable> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      reason: `That isn't valid JSON: ${e instanceof Error ? e.message : "unreadable"}.`,
    };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, reason: "That JSON isn't a list of records." };
  }
  if (parsed.length === 0) return { ok: false, reason: "That list is empty." };

  const objects = parsed.filter(
    (r): r is Record<string, unknown> => typeof r === "object" && r !== null,
  );
  if (objects.length !== parsed.length) {
    return {
      ok: false,
      reason: "Some entries aren't records, so the columns can't be determined.",
    };
  }

  const columns = [...new Set(objects.flatMap((o) => Object.keys(o)))];
  return {
    ok: true,
    data: {
      columns,
      rows: objects.map((o) =>
        Object.fromEntries(
          columns.map((c) => [c, o[c] === undefined || o[c] === null ? "" : String(o[c])]),
        ),
      ),
    },
    evidence: `${objects.length} records × ${columns.length} fields.`,
  };
}

export interface ColumnSummary {
  column: string;
  count: number;
  numeric: boolean;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  /** Values that could not be read as numbers. */
  unparsed: number;
}

/**
 * Summarise one column.
 *
 * Refuses rather than approximating when any value in a numeric column cannot
 * be parsed: a mean over "the rows that happened to parse" is a different
 * number from the one the user asked for, and it looks identical.
 */
export function summariseColumn(table: DataTable, column: string): DataOutcome<ColumnSummary> {
  if (!table.columns.includes(column)) {
    return {
      ok: false,
      reason: `There's no column called “${column}”. Available: ${table.columns.join(", ")}.`,
    };
  }

  const values = table.rows.map((r) => (r[column] ?? "").trim());
  const nonEmpty = values.filter((v) => v.length > 0);

  if (nonEmpty.length === 0) {
    return {
      ok: true,
      data: { column, count: 0, numeric: false, unparsed: 0 },
      // An empty column has no mean — it does not have a mean of zero.
      evidence: `“${column}” has no values, so there's nothing to average.`,
    };
  }

  const parsed = nonEmpty.map((v) => ({ raw: v, num: Number(v.replace(/,/g, "")) }));
  const unparsed = parsed.filter((p) => !Number.isFinite(p.num));

  if (unparsed.length > 0 && unparsed.length < parsed.length) {
    return {
      ok: false,
      reason: `“${column}” mixes numbers with ${unparsed.length} non-numeric value${unparsed.length === 1 ? "" : "s"} (e.g. “${unparsed[0].raw}”). OCADE won't average part of a column and present it as the whole.`,
    };
  }

  if (unparsed.length === parsed.length) {
    return {
      ok: true,
      data: { column, count: nonEmpty.length, numeric: false, unparsed: unparsed.length },
      evidence: `“${column}” holds text, so only the count (${nonEmpty.length}) is meaningful.`,
    };
  }

  const nums = parsed.map((p) => p.num);
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    ok: true,
    data: {
      column,
      count: nums.length,
      numeric: true,
      min: Math.min(...nums),
      max: Math.max(...nums),
      sum,
      mean: sum / nums.length,
      unparsed: 0,
    },
    evidence: `${nums.length} values, mean ${(sum / nums.length).toFixed(2)}, range ${Math.min(...nums)}–${Math.max(...nums)}.`,
  };
}

/** Filter rows by an exact column value. Reports how many matched. */
export function filterRows(
  table: DataTable,
  column: string,
  value: string,
): DataOutcome<DataTable> {
  if (!table.columns.includes(column)) {
    return { ok: false, reason: `There's no column called “${column}”.` };
  }
  const rows = table.rows.filter((r) => (r[column] ?? "") === value);
  return {
    ok: true,
    data: { columns: table.columns, rows },
    evidence: `${rows.length} of ${table.rows.length} rows match ${column} = “${value}”.`,
  };
}

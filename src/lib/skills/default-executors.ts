/**
 * Default executors - what OCADE can genuinely do right now, in the browser,
 * with no companion and no network.
 *
 * This is deliberately a short list. Most packs describe work that needs the
 * signed companion (files, windows, git, archives) or the browser extension
 * (pages), and neither can run inside the web app itself. Registering those
 * here would produce controls that look available and fail on use.
 *
 * The data pack is different: it is pure computation over text the user has
 * already given us, so it runs anywhere - including offline.
 */
import {
  ExecutorRegistry,
  type ExecutionResult,
  type VerificationResult,
} from "./executor-registry";
import {
  parseCsv,
  parseJsonRecords,
  summariseColumn,
  filterRows,
  type DataTable,
} from "./packs/data-pack";

export interface DataInput {
  text?: string;
  table?: DataTable;
  column?: string;
  value?: string;
}

/**
 * Build a registry of the capabilities that genuinely work here.
 *
 * Execution and verification are registered separately. Each verifier
 * recomputes the expected result from the input instead of accepting the
 * executor's account of its own work.
 */
export function createDefaultExecutors(getInput: () => DataInput | undefined): ExecutorRegistry {
  const registry = new ExecutorRegistry();
  const need = (): DataInput | { missing: string } => getInput() ?? { missing: "no input" };
  const compare = (
    execution: ExecutionResult,
    expectedData: string,
    evidence: string,
  ): VerificationResult =>
    execution.data === expectedData
      ? { verified: true, evidence: `Independent recomputation matched. ${evidence}` }
      : {
          verified: false,
          evidence: "Independent recomputation did not match the executor output.",
        };

  registry.register(
    "ocade.data",
    "data.parse_csv",
    async (): Promise<ExecutionResult> => {
      const input = need();
      if ("missing" in input || !input.text) {
        return { ok: false, evidence: "No CSV text was provided." };
      }
      const result = parseCsv(input.text);
      return result.ok
        ? {
            ok: true,
            evidence: result.evidence,
            data: JSON.stringify({
              columns: result.data.columns,
              rowCount: result.data.rows.length,
            }),
          }
        : { ok: false, evidence: result.reason };
    },
    (_plan, execution) => {
      const input = need();
      if ("missing" in input || !input.text) {
        return { verified: false, evidence: "Independent verification had no CSV input." };
      }
      const checked = parseCsv(input.text);
      if (!checked.ok) return { verified: false, evidence: checked.reason };
      return compare(
        execution,
        JSON.stringify({ columns: checked.data.columns, rowCount: checked.data.rows.length }),
        checked.evidence,
      );
    },
  );

  registry.register(
    "ocade.data",
    "data.parse_json",
    async (): Promise<ExecutionResult> => {
      const input = need();
      if ("missing" in input || !input.text) {
        return { ok: false, evidence: "No JSON text was provided." };
      }
      const result = parseJsonRecords(input.text);
      return result.ok
        ? {
            ok: true,
            evidence: result.evidence,
            data: JSON.stringify({
              columns: result.data.columns,
              rowCount: result.data.rows.length,
            }),
          }
        : { ok: false, evidence: result.reason };
    },
    (_plan, execution) => {
      const input = need();
      if ("missing" in input || !input.text) {
        return { verified: false, evidence: "Independent verification had no JSON input." };
      }
      const checked = parseJsonRecords(input.text);
      if (!checked.ok) return { verified: false, evidence: checked.reason };
      return compare(
        execution,
        JSON.stringify({ columns: checked.data.columns, rowCount: checked.data.rows.length }),
        checked.evidence,
      );
    },
  );

  registry.register(
    "ocade.data",
    "data.summarise",
    async (): Promise<ExecutionResult> => {
      const input = need();
      if ("missing" in input || !input.table || !input.column) {
        return { ok: false, evidence: "No table or column was provided." };
      }
      const result = summariseColumn(input.table, input.column);
      return result.ok
        ? { ok: true, evidence: result.evidence, data: JSON.stringify(result.data) }
        : { ok: false, evidence: result.reason };
    },
    (_plan, execution) => {
      const input = need();
      if ("missing" in input || !input.table || !input.column) {
        return { verified: false, evidence: "Independent verification had no table or column." };
      }
      const checked = summariseColumn(input.table, input.column);
      if (!checked.ok) return { verified: false, evidence: checked.reason };
      return compare(execution, JSON.stringify(checked.data), checked.evidence);
    },
  );

  registry.register(
    "ocade.data",
    "data.filter",
    async (): Promise<ExecutionResult> => {
      const input = need();
      if ("missing" in input || !input.table || !input.column || input.value === undefined) {
        return { ok: false, evidence: "No table, column or value was provided." };
      }
      const result = filterRows(input.table, input.column, input.value);
      return result.ok
        ? { ok: true, evidence: result.evidence, data: String(result.data.rows.length) }
        : { ok: false, evidence: result.reason };
    },
    (_plan, execution) => {
      const input = need();
      if ("missing" in input || !input.table || !input.column || input.value === undefined) {
        return {
          verified: false,
          evidence: "Independent verification had no table, column or filter value.",
        };
      }
      const checked = filterRows(input.table, input.column, input.value);
      if (!checked.ok) return { verified: false, evidence: checked.reason };
      return compare(execution, String(checked.data.rows.length), checked.evidence);
    },
  );

  return registry;
}

export const RUNTIME_REALITY =
  "Reading and analysing data works entirely on this device, including offline. " +
  "Controlling files, windows and other applications needs the CAERA companion app, " +
  "and acting on web pages needs the OCADE browser extension. OCADE says so rather " +
  "than showing a control that would fail.";

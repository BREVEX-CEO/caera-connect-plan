/**
 * THE GOVERNOR AND PILOT FOR WHAT JARVIS CAN DO TODAY (plan.md §4.1, P13, §27.1 Journey 1).
 *
 * One bounded decision per call: read the task's fixed checks and every action
 * so far, then return the next action, a settlement, or an honest blocker. No
 * state lives here between requests — the database holds it — so a request that
 * ends mid-task loses nothing, and two calls with the same history choose the
 * same action under the same idempotency key.
 *
 * Deterministic first: Journey 1 (workbook → reconciliation → editable Word and
 * PDF report) needs no model to choose its steps. Anything it cannot resolve
 * from the workspace itself — no workbook, several, no two comparable sheets —
 * becomes a question for the person, never a guess. Online planning for other
 * outcomes is not wired yet and is refused rather than improvised.
 */
import {
  intent,
  type ActionIntent,
  type ActionReceipt,
  type OutcomeCheck,
  type VerificationResult,
} from "./contracts.ts";

export const JOURNEY_1_CHECKS: OutcomeCheck[] = [
  { id: "original_unchanged", description: "Your original workbook is byte-for-byte unchanged" },
  { id: "rows_accounted", description: "Every row from both sheets is accounted for" },
  { id: "totals_reconcile", description: "Totals and differences recompute independently" },
  {
    id: "formulas_recalculated",
    description: "Formulas were recalculated by a spreadsheet engine",
  },
  { id: "report_docx_sections", description: "The Word report has its summary and exceptions" },
  { id: "report_pdf_renders", description: "The PDF opens and every page renders" },
  { id: "artifacts_bound", description: "The files checked are the files JARVIS wrote" },
];

/** Whether OCADE can take this outcome on today. Everything else is declined plainly. */
export function supportedOutcome(objective: string): boolean {
  return /reconcil/i.test(objective) && /\.xlsx\b|workbook|spreadsheet|excel/i.test(objective);
}

export interface Step {
  intent: ActionIntent;
  status: "queued" | "claimed" | "done" | "failed" | "cancelled" | "blocked" | string;
  receipt: ActionReceipt | null;
}

export type Decision =
  | { kind: "queue"; summary: string; intent: ActionIntent }
  | { kind: "wait" }
  | { kind: "settle"; verification: VerificationResult; summary: string }
  | { kind: "block"; reason: string };

interface SheetInfo {
  name: string;
  headers: string[];
  rows: number;
}

const KEY_HEADER = /\b(id|ref|reference|invoice|key|number|no|code|account)\b/i;
const AMOUNT_HEADER = /\b(amount|total|value|sum|balance|net|gross)\b/i;

/** Two sheets that each have a key column and an amount column. Exactly two, or a question. */
export function pickSides(
  sheets: SheetInfo[],
): { left: Column; right: Column } | { question: string } {
  const usable = sheets.flatMap((sheet) => {
    const key = sheet.headers.find((h) => KEY_HEADER.test(h));
    const amount = sheet.headers.find((h) => AMOUNT_HEADER.test(h));
    return key && amount && sheet.rows > 0 ? [{ sheet: sheet.name, key, amount }] : [];
  });
  if (usable.length === 2) return { left: usable[0], right: usable[1] };
  return {
    question:
      usable.length < 2
        ? "I need two sheets that each have an ID column and an amount column to reconcile."
        : `Several sheets could be reconciled (${usable.map((u) => u.sheet).join(", ")}). Which two should I compare?`,
  };
}

interface Column {
  sheet: string;
  key: string;
  amount: string;
}

function evidenceOf(steps: Step[], operation: string) {
  const step = steps.find((s) => s.intent.operation === operation && s.status === "done");
  return step?.receipt?.evidence as Record<string, unknown> | undefined;
}

const stem = (path: string) => (path.split(/[\\/]/).pop() ?? path).replace(/\.xlsx$/i, "");

export function decide(input: {
  taskId: string;
  objective: string;
  checks: OutcomeCheck[];
  steps: Step[];
  now: Date;
}): Decision {
  const { taskId, objective, steps, now } = input;
  const deadline = new Date(now.getTime() + 10 * 60_000);

  if (steps.some((s) => s.status === "queued" || s.status === "claimed")) return { kind: "wait" };
  const refused = steps.find((s) => s.status === "failed" || s.status === "blocked");
  if (refused) {
    const code = refused.receipt?.errorCode ?? "not_applied";
    return {
      kind: "block",
      reason: `A step could not be done (${code}). Nothing after it was attempted.`,
    };
  }

  // 1. Which workbook? Only names that really exist in the workspace are ever used.
  const listed = evidenceOf(steps, "fs.list");
  const inspected = evidenceOf(steps, "office.inspect_workbook");
  if (!inspected) {
    if (steps.some((s) => s.intent.operation === "office.inspect_workbook"))
      return { kind: "wait" };
    if (!listed) {
      return {
        kind: "queue",
        summary: "Looking in your JARVIS folder",
        intent: intent("fs.list", "list", { path: "." }, deadline),
      };
    }
    const books = ((listed.entries as { name: string; kind: string }[] | undefined) ?? [])
      .filter((e) => e.kind === "file" && /\.xlsx$/i.test(e.name))
      .map((e) => e.name);
    const mentioned = books.filter((name) => objective.toLowerCase().includes(name.toLowerCase()));
    const chosen = mentioned.length === 1 ? mentioned : books;
    if (chosen.length !== 1) {
      return {
        kind: "block",
        reason:
          books.length === 0
            ? "I found no .xlsx workbook in your JARVIS folder."
            : `I found several workbooks (${books.slice(0, 5).join(", ")}). Name the one to reconcile.`,
      };
    }
    return {
      kind: "queue",
      summary: `Reading ${chosen[0]}`,
      intent: intent("office.inspect_workbook", "inspect", { path: chosen[0] }, deadline),
    };
  }

  const source = String(
    steps.find((s) => s.intent.operation === "office.inspect_workbook")!.intent.arguments.path,
  );
  const sides = pickSides((inspected.sheets as SheetInfo[] | undefined) ?? []);
  if ("question" in sides) return { kind: "block", reason: sides.question };
  const folder = `OCADE output/${taskId.slice(0, 8)}`;
  const workbook = `${folder}/${stem(source)} - reconciliation.xlsx`;
  const docx = `${folder}/${stem(source)} - reconciliation report.docx`;
  const pdf = `${folder}/${stem(source)} - reconciliation report.pdf`;

  // 2. Reconcile, 3. report, 4. verify — each once, in order.
  const reconciled = evidenceOf(steps, "office.reconcile_workbook");
  if (!reconciled) {
    return {
      kind: "queue",
      summary: `Reconciling ${sides.left.sheet} against ${sides.right.sheet}`,
      intent: intent(
        "office.reconcile_workbook",
        "reconcile",
        { source, left: sides.left, right: sides.right, output: workbook },
        deadline,
      ),
    };
  }
  const reported = evidenceOf(steps, "office.write_report");
  if (!reported) {
    return {
      kind: "queue",
      summary: "Writing the Word report and PDF",
      intent: intent(
        "office.write_report",
        "report",
        { workbook, docx, pdf, title: `${stem(source)} reconciliation` },
        deadline,
      ),
    };
  }
  const verified = evidenceOf(steps, "verify.reconciliation_report");
  if (!verified) {
    return {
      kind: "queue",
      summary: "Checking the results independently",
      intent: intent(
        "verify.reconciliation_report",
        "verify",
        {
          source,
          sourceSha256: String(inspected.sha256),
          left: sides.left,
          right: sides.right,
          workbook,
          docx,
          pdf,
        },
        deadline,
      ),
    };
  }

  const verification = settle(input.checks, { inspected, reconciled, reported, verified });
  const ok = verification.failed.length === 0 && verification.unverified.length === 0;
  return {
    kind: "settle",
    verification,
    summary: ok
      ? `Reconciled ${String(verified.rows ?? "?")} rows with ${String(verified.exceptions ?? "?")} exceptions. Your report is in ${folder}.`
      : `Not finished: ${[...verification.failed, ...verification.unverified].join(", ")} did not pass.`,
  };
}

/**
 * Settlement from evidence. The verifier's predicates count only for the files
 * the actor actually wrote: its hashes must equal the hashes in the actor's
 * receipts, and the original's hash must equal the one read before any change.
 */
export function settle(
  checks: OutcomeCheck[],
  ev: Record<"inspected" | "reconciled" | "reported" | "verified", Record<string, unknown>>,
): VerificationResult {
  const predicates = (ev.verified.predicates ?? {}) as Record<string, unknown>;
  const hashes = (ev.verified.sha256 ?? {}) as Record<string, unknown>;
  const reportHashes = (ev.reported.sha256 ?? {}) as Record<string, unknown>;
  const bound =
    typeof hashes.workbook === "string" &&
    hashes.workbook === ev.reconciled.sha256 &&
    hashes.docx === reportHashes.docx &&
    hashes.pdf === reportHashes.pdf &&
    hashes.source === ev.inspected.sha256;
  const result: VerificationResult = {
    passed: [],
    failed: [],
    unverified: [],
    evidence: { predicates, sha256: hashes },
    verifierVersion: String(ev.verified.verifierVersion ?? "unknown").slice(0, 40),
  };
  for (const check of checks) {
    const value = check.id === "artifacts_bound" ? bound : predicates[check.id];
    if (value === true) result.passed.push(check.id);
    else if (value === false) result.failed.push(check.id);
    else result.unverified.push(check.id);
  }
  return result;
}

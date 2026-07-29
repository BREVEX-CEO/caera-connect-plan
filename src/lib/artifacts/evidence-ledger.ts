/**
 * OCADE Evidence Ledger (master plan §23.2).
 *
 * Every completed task earns a machine-readable receipt: the state it started
 * from, each action with its timestamp and approval, the outputs, the
 * verification, and — the parts most systems omit — the failures, the retries,
 * and how it recovered. That record is then storable as a first-class artifact
 * so it outlives the session.
 *
 * THE RULE THAT MAKES IT WORTH KEEPING: the overall verdict is COMPUTED from
 * the steps, never supplied. A caller cannot hand in `outcome: "success"`; the
 * ledger decides, and it decides "succeeded" only when every step that ran was
 * verified and none failed unrecovered. A receipt that let the caller assert
 * the conclusion would be a place for false success to hide — which is the
 * precise thing a receipt exists to prevent.
 *
 * Pure and dependency-light: it composes `EvidenceReceipt`s from the skills
 * layer and hands the result to `artifacts/store.ts`.
 */
import type { EvidenceReceipt } from "../skills/skill-pack";
import { saveArtifact, type Artifact, type ArtifactOutcome } from "./store";

/** One executed (or attempted) step, with everything that happened to it. */
export interface LedgerStep {
  /** What the step was meant to do, in the user's words. */
  intent: string;
  /** The step's own evidence receipt, or null if it never ran. */
  receipt: EvidenceReceipt | null;
  /** How the step ended. */
  status: "done" | "failed" | "skipped";
  /** Approval that authorised it, when one was required. */
  approval?: { grantedBy: string; scopeId: string; at: string };
  /** Attempts made, including the successful one. 1 = no retry. */
  attempts: number;
  /** Present when the step failed and something was done about it. */
  recovery?: { action: "undo" | "restore" | "isolate" | "none"; evidence: string };
}

export interface TaskLedgerInput {
  taskId: string;
  intent: string;
  /** A description of the world before the task ran. */
  initialState: string;
  steps: LedgerStep[];
  /** A description of the world after — REQUIRED, and verified below. */
  finalState: string;
  startedAt: string;
  finishedAt: string;
}

export type TaskOutcome = "succeeded" | "partial" | "failed" | "empty";

export interface TaskLedger {
  taskId: string;
  intent: string;
  /** Derived, never supplied. See the module header. */
  outcome: TaskOutcome;
  initialState: string;
  finalState: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  steps: LedgerStep[];
  /** Roll-ups, all computed from `steps`. */
  summary: {
    total: number;
    done: number;
    failed: number;
    skipped: number;
    unverified: number;
    retried: number;
    recovered: number;
  };
  /** One honest sentence for a human. */
  headline: string;
}

export type LedgerOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/**
 * Build a task ledger from its steps.
 *
 * Refuses malformed input rather than papering over it: a "done" step with no
 * receipt is a contradiction (a receipt is what proves it happened), and
 * emitting a ledger from it would launder an unproven claim into an official
 * record.
 */
export function buildTaskLedger(input: TaskLedgerInput): LedgerOutcome<TaskLedger> {
  if (!input.taskId.trim()) return { ok: false, reason: "A task ledger needs a task id." };
  if (!input.finalState.trim()) {
    return {
      ok: false,
      reason:
        "A ledger must record the final state. OCADE won't certify a task whose end state it can't describe.",
    };
  }

  const started = Date.parse(input.startedAt);
  const finished = Date.parse(input.finishedAt);
  if (Number.isNaN(started) || Number.isNaN(finished)) {
    return { ok: false, reason: "The ledger has an unreadable start or finish time." };
  }
  if (finished < started) {
    return {
      ok: false,
      reason: "This ledger finishes before it starts, so its timing can't be trusted.",
    };
  }

  for (const [i, step] of input.steps.entries()) {
    if (!Number.isInteger(step.attempts) || step.attempts < 0) {
      return { ok: false, reason: `Step ${i + 1} has an impossible attempt count.` };
    }
    // A DONE step must have run at least once — that's what "done" means. A
    // step blocked before execution, or skipped, honestly has zero attempts.
    if (step.status === "done" && step.attempts < 1) {
      return { ok: false, reason: `Step ${i + 1} is marked done but was never attempted.` };
    }
    if (step.status === "done" && step.receipt === null) {
      // The contradiction that would launder an unproven claim.
      return {
        ok: false,
        reason: `Step ${i + 1} (“${step.intent}”) is marked done but carries no receipt. A step with no evidence isn't done — OCADE won't record it as such.`,
      };
    }
    if (step.status === "skipped" && step.receipt !== null) {
      return { ok: false, reason: `Step ${i + 1} is marked skipped but carries a receipt.` };
    }
  }

  const ran = input.steps.filter((s) => s.status !== "skipped");
  const done = input.steps.filter((s) => s.status === "done");
  const failed = input.steps.filter((s) => s.status === "failed");
  const skipped = input.steps.filter((s) => s.status === "skipped");
  // A done step whose receipt is unverified counts against the task: the step
  // happened but nothing confirmed the result.
  const unverified = done.filter((s) => s.receipt && !s.receipt.verified);
  const retried = input.steps.filter((s) => s.attempts > 1);
  const recovered = failed.filter((s) => s.recovery && s.recovery.action !== "none");

  const outcome = deriveOutcome({
    total: input.steps.length,
    ran: ran.length,
    failedUnrecovered: failed.length - recovered.length,
    failedRecovered: recovered.length,
    unverified: unverified.length,
  });

  const summary = {
    total: input.steps.length,
    done: done.length,
    failed: failed.length,
    skipped: skipped.length,
    unverified: unverified.length,
    retried: retried.length,
    recovered: recovered.length,
  };

  return {
    ok: true,
    data: {
      taskId: input.taskId,
      intent: input.intent,
      outcome,
      initialState: input.initialState,
      finalState: input.finalState,
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      durationMs: finished - started,
      steps: input.steps,
      summary,
      headline: headlineFor(outcome, summary),
    },
    evidence: `Ledger for ${input.taskId}: ${outcome}, ${summary.done}/${summary.total} steps verified-done.`,
  };
}

function deriveOutcome(x: {
  total: number;
  ran: number;
  failedUnrecovered: number;
  failedRecovered: number;
  unverified: number;
}): TaskOutcome {
  if (x.total === 0 || x.ran === 0) return "empty";
  // An unrecovered failure may have left damage: the whole task is "failed".
  if (x.failedUnrecovered > 0) return "failed";
  // A recovered failure left no damage, but its step's goal was NOT achieved —
  // it was undone. And an unverified success isn't clean enough to certify.
  // Both are honestly "partial", not "succeeded".
  if (x.unverified > 0 || x.failedRecovered > 0) return "partial";
  return "succeeded";
}

function headlineFor(outcome: TaskOutcome, s: TaskLedger["summary"]): string {
  switch (outcome) {
    case "succeeded":
      return `All ${s.done} step${s.done === 1 ? "" : "s"} completed and verified${s.retried > 0 ? `, ${s.retried} after a retry` : ""}.`;
    case "partial": {
      const reasons: string[] = [];
      if (s.unverified > 0) reasons.push(`${s.unverified} couldn't be verified`);
      if (s.recovered > 0) reasons.push(`${s.recovered} failed and recovered`);
      return `${s.done} of ${s.total} steps done — ${reasons.join(", ")}. Treat the result as unconfirmed.`;
    }
    case "failed":
      return `${s.failed} step${s.failed === 1 ? "" : "s"} failed${s.recovered > 0 ? `, ${s.recovered} recovered` : ""}. The task did not complete.`;
    case "empty":
      return "Nothing ran, so there is nothing to certify.";
  }
}

/** Canonical JSON for the receipt artifact. Stable key order, pretty-printed. */
export function serialiseLedger(ledger: TaskLedger): string {
  return JSON.stringify(ledger, null, 2);
}

/**
 * Persist a task ledger as a first-class artifact.
 *
 * The artifact's provenance carries the derived outcome: a `partial` or
 * `failed` ledger is stored `verified: false`, so it is labelled NOT CONFIRMED
 * everywhere the artifact appears — the ledger's own honesty flows through into
 * the store's.
 */
export async function saveLedgerArtifact(ledger: TaskLedger): Promise<ArtifactOutcome<Artifact>> {
  return saveArtifact({
    name: `Receipt — ${ledger.intent || ledger.taskId}`,
    kind: "receipt",
    content: serialiseLedger(ledger),
    provenance: {
      producedBy: `ocade.task:${ledger.taskId}`,
      verified: ledger.outcome === "succeeded",
      evidence: ledger.headline,
    },
  });
}

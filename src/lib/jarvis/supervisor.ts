/**
 * Shared JARVIS decision and verification contracts (plan.md P13/P16).
 *
 * The AI planner chooses the next step for EVERY customer objective. There are
 * deliberately no application-name filters, special journeys or fixed action
 * sequences here. Policy and independently checked evidence settle the task.
 */
import type { ActionIntent, ActionReceipt, OutcomeCheck, VerificationResult } from "./contracts.ts";

export interface Step {
  intent: ActionIntent;
  status: "queued" | "claimed" | "done" | "failed" | "cancelled" | "blocked" | string;
  receipt: ActionReceipt | null;
  /** A minimal durable STOP/crash record can carry unknown without a full device receipt. */
  effectUnknown?: boolean;
}

export type Decision =
  | {
      kind: "queue";
      summary: string;
      intent: ActionIntent;
      /** Independent read-only observations chosen in the same turn, run in order. */
      more?: { summary: string; intent: ActionIntent }[];
    }
  | { kind: "wait" }
  | { kind: "settle"; verification: VerificationResult; summary: string }
  | { kind: "block"; reason: string };

/** Unknown writes cannot be resumed or repeated without a separate resolution. */
export function unresolvedEffect(steps: Step[]): string | null {
  return steps.some(
    (step) =>
      step.intent.risk !== "read" && (step.effectUnknown || step.receipt?.status === "unknown"),
  )
    ? "An earlier action may already have changed your computer. Check its result before starting more work. JARVIS will not repeat it."
    : null;
}

export const open = (step: Step) =>
  ["queued", "claimed", "needs_confirmation"].includes(step.status);

export function evidenceOf(steps: Step[], operation: string) {
  const step = steps.find(
    (candidate) => candidate.intent.operation === operation && candidate.status === "done",
  );
  return step?.receipt?.evidence as Record<string, unknown> | undefined;
}

/** Independent verifier predicates must prove each check; unknown is not success. */
export function settleChecks(
  checks: OutcomeCheck[],
  verified: Record<string, unknown>,
): VerificationResult {
  const predicates = (verified.predicates ?? {}) as Record<string, unknown>;
  const result: VerificationResult = {
    passed: [],
    failed: [],
    unverified: [],
    evidence: { predicates },
    verifierVersion: String(verified.verifierVersion ?? "unknown").slice(0, 40),
  };
  for (const check of checks) {
    const value = predicates[check.id];
    if (value === true) result.passed.push(check.id);
    else if (value === false) result.failed.push(check.id);
    else result.unverified.push(check.id);
  }
  return result;
}

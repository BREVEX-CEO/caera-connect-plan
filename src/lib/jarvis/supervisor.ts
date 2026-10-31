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
}

export type Decision =
  | { kind: "queue"; summary: string; intent: ActionIntent }
  | { kind: "wait" }
  | { kind: "settle"; verification: VerificationResult; summary: string }
  | { kind: "block"; reason: string };

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

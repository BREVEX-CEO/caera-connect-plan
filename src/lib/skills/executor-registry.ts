/**
 * Executor registry — the missing link between a plan and an actual result.
 *
 * `work-session.planStep` decides WHETHER and HOW to act. Until now nothing
 * connected that decision to the code that does the work, so a fully-planned
 * step had no way to run. This maps `appId:capabilityId` to a real function and
 * enforces, at the boundary, the two rules that the whole confidence model
 * rests on:
 *
 *  1. A capability with no registered executor is REFUSED, not simulated. An
 *     agent that quietly does nothing and reports success is worse than one
 *     that fails.
 *  2. Execution and verification are separate functions. An executor cannot
 *     mark its own work as confirmed, and a missing verifier is a failed,
 *     unconfirmed step rather than a plausible-looking success.
 */
import { CONFIDENCE_THRESHOLD, type EvidenceReceipt, type SkillCapability } from "./skill-pack";
import { completeStep, type StepPlan } from "./work-session";

/** What an executor returns. It deliberately has no verification field. */
export interface ExecutionResult {
  ok: boolean;
  /** What happened, in the user's words. Never contains protected input. */
  evidence: string;
  /** Optional payload for read operations. */
  data?: string;
}

export type Executor = (plan: StepPlan) => Promise<ExecutionResult>;

/** Evidence produced by a separate post-execution observation. */
export interface VerificationResult {
  verified: boolean;
  evidence: string;
}

export type Verifier = (
  plan: StepPlan,
  execution: ExecutionResult,
) => Promise<VerificationResult> | VerificationResult;

function keyOf(appId: string, capabilityId: string): string {
  return `${appId}:${capabilityId}`;
}

const SAFE_EXECUTOR_ID = /^[a-z0-9][a-z0-9._-]*$/i;

export class ExecutorRegistry {
  private executors = new Map<string, Executor>();
  private verifiers = new Map<string, Verifier>();

  register(appId: string, capabilityId: string, executor: Executor, verifier?: Verifier): void {
    if (!SAFE_EXECUTOR_ID.test(appId) || !SAFE_EXECUTOR_ID.test(capabilityId)) {
      throw new Error("Executor app and capability ids must be non-empty safe identifiers.");
    }
    const key = keyOf(appId, capabilityId);
    this.executors.set(key, executor);
    if (verifier) this.verifiers.set(key, verifier);
    else this.verifiers.delete(key);
  }

  has(appId: string, capabilityId: string): boolean {
    return this.executors.has(keyOf(appId, capabilityId));
  }

  get(appId: string, capabilityId: string): Executor | null {
    return this.executors.get(keyOf(appId, capabilityId)) ?? null;
  }

  getVerifier(appId: string, capabilityId: string): Verifier | null {
    return this.verifiers.get(keyOf(appId, capabilityId)) ?? null;
  }

  /** Every capability that can genuinely be performed right now. */
  runnable(): string[] {
    return [...this.executors.keys()].sort();
  }
}

export type RunOutcome =
  | { status: "done"; receipt: EvidenceReceipt; data?: string }
  | { status: "failed"; reason: string; receipt: EvidenceReceipt }
  | { status: "unavailable"; reason: string };

/**
 * Run a planned step.
 *
 * The unavailable case is deliberately NOT an error dressed as a result: it
 * returns before anything is attempted and produces no receipt at all, because
 * a receipt implies something happened.
 */
export async function runPlannedStep(
  registry: ExecutorRegistry,
  plan: StepPlan,
  now?: Date,
): Promise<RunOutcome> {
  const validPlan =
    plan.app.appId.trim().length > 0 &&
    plan.capability.id.trim().length > 0 &&
    plan.capability.methods.includes(plan.method) &&
    Number.isFinite(plan.confidence) &&
    plan.confidence >= CONFIDENCE_THRESHOLD &&
    plan.confidence <= 1 &&
    plan.intent.trim().length > 0;
  if (!validPlan) {
    return {
      status: "unavailable",
      reason: "Invalid plan metadata was refused before an executor could run.",
    };
  }

  const executor = registry.get(plan.app.appId, plan.capability.id);
  if (!executor) {
    return {
      status: "unavailable",
      reason: `OCADE can plan “${plan.capability.label}” for ${plan.app.displayName} but has nothing wired up to actually do it. It hasn't pretended to.`,
    };
  }

  let result: ExecutionResult;
  try {
    result = await executor(plan);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "The step failed unexpectedly.";
    return {
      status: "failed",
      reason,
      receipt: completeStep({ plan, verified: false, evidence: reason, now }),
    };
  }

  if (!result.ok) {
    return {
      status: "failed",
      reason: result.evidence,
      receipt: completeStep({ plan, verified: false, evidence: result.evidence, now }),
    };
  }

  if (plan.capability.verifyBy === "none") {
    const reason = `${result.evidence} The capability has no independent verification method.`;
    return {
      status: "failed",
      reason,
      receipt: completeStep({ plan, verified: false, evidence: reason, now }),
    };
  }

  const verifier = registry.getVerifier(plan.app.appId, plan.capability.id);
  if (!verifier) {
    const reason = `${result.evidence} No independent verifier is registered.`;
    return {
      status: "failed",
      reason,
      receipt: completeStep({ plan, verified: false, evidence: reason, now }),
    };
  }

  let verification: VerificationResult;
  try {
    verification = await verifier(plan, result);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "Independent verification failed unexpectedly.";
    return {
      status: "failed",
      reason,
      receipt: completeStep({ plan, verified: false, evidence: reason, now }),
    };
  }

  const receipt = completeStep({
    plan,
    verified: verification.verified,
    evidence: verification.evidence,
    now,
  });
  if (!receipt.verified) {
    return {
      status: "failed",
      reason: verification.evidence,
      receipt,
    };
  }

  return { status: "done", receipt, data: result.data };
}

/**
 * Describe what OCADE can actually DO right now, as opposed to what it can
 * describe. The difference between those two is the entire point.
 */
export function describeRunnable(
  registry: ExecutorRegistry,
  capabilities: { appId: string; capability: SkillCapability }[],
): string {
  const runnable = capabilities.filter((c) => registry.has(c.appId, c.capability.id));
  if (runnable.length === 0) {
    return "OCADE can't perform any of these on this machine yet — it will say so rather than appear to try.";
  }
  return `${runnable.length} of ${capabilities.length} actions can run here. The rest need software or a component that isn't installed.`;
}

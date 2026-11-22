/**
 * Shared JARVIS decision and verification contracts (plan.md P13/P16).
 *
 * The AI planner chooses the next step for EVERY customer objective. There are
 * deliberately no application-name filters, special journeys or fixed action
 * sequences here. Policy and independently checked evidence settle the task.
 */
import { z } from "zod";
import type { ActionIntent, ActionReceipt, OutcomeCheck, VerificationResult } from "./contracts.ts";
import { effectPossible, intent, OPERATIONS } from "./contracts.ts";

export interface Step {
  intent: ActionIntent;
  status: "queued" | "claimed" | "done" | "failed" | "cancelled" | "blocked" | string;
  receipt: ActionReceipt | null;
  /** Controller that admitted this action; old epochs cannot prove a resumed task's state. */
  controller?: string | null;
  completedAt?: string | null;
  /** A minimal durable STOP/crash record can carry unknown without a full device receipt. */
  effectUnknown?: boolean;
  /** Preserve incomplete durable receipts without inventing a validated device observation. */
  unparsedReceipt?: unknown;
  /** The person's answer for a step whose effect was unknown; the step itself never runs again. */
  resolution?: "applied" | "not_applied" | null;
  /** Which agent (lane) runs it (lanes.ts); absent: the first. */
  lane?: number;
}

/** Ordered work selected by the model; checks always refer to the immutable task contract. */
/**
 * The families of operations a planner may offer (the part of an operation name before the dot).
 * Verification and third-party tools are never chosen by the model this way.
 */
export const OPERATION_FAMILIES = [
  ...new Set(Object.keys(OPERATIONS).map((name) => name.split(".")[0]!)),
].filter((family) => family !== "verify" && family !== "mcp") as [string, ...string[]];

export const milestonePlan = z
  .array(
    z
      .object({
        description: z.string().min(1).max(300),
        checks: z.array(z.string().min(1)).min(1).max(10),
        stepBudget: z.number().int().min(1).max(30),
        /**
         * What this milestone's work needs, chosen once at goal time (plan v8 10.3): only these
         * families are offered with their argument schemas; every other operation is still
         * offered by name and receives its schema the moment the model calls it.
         */
        families: z.array(z.enum(OPERATION_FAMILIES)).min(1).max(12).optional(),
      })
      .strict(),
  )
  .min(1)
  .max(6);
export type Milestone = z.infer<typeof milestonePlan>[number];

/** One validator owns the server-side milestone contract, including legacy short tasks. */
export function milestonesFor(checks: OutcomeCheck[], plan: unknown): Milestone[] {
  if (
    plan == null ||
    (Array.isArray(plan) && (plan.length === 0 || plan.every((item) => typeof item === "string")))
  ) {
    return [
      {
        description:
          checks
            .map((check) => check.description)
            .join("; ")
            .slice(0, 300) || "Complete the requested result",
        checks: checks.map((check) => check.id),
        stepBudget: 30,
      },
    ];
  }
  const milestones = milestonePlan.parse(plan);
  const known = new Set(checks.map((check) => check.id));
  const covered = new Set<string>();
  for (const milestone of milestones) {
    if (
      new Set(milestone.checks).size !== milestone.checks.length ||
      milestone.checks.some((id) => !known.has(id))
    ) {
      throw new Error("A milestone refers to an unknown or repeated outcome check.");
    }
    milestone.checks.forEach((id) => covered.add(id));
  }
  if (covered.size !== known.size) throw new Error("Every outcome check needs a milestone.");
  return milestones;
}

/** Progress is durable data, never inferred from the model's conversation or a success message. */
export function milestoneProgress(
  checks: OutcomeCheck[],
  plan: unknown,
  checkpoint: Record<string, unknown> | null,
  totalSteps: number,
) {
  const milestones = milestonesFor(checks, plan);
  const saved = checkpoint?.milestones;
  const cursor = z
    .object({
      index: z.number().int().min(0),
      startStep: z.number().int().min(0),
    })
    .passthrough()
    .parse(saved ?? { index: 0, startStep: 0 });
  if (cursor.index > milestones.length || cursor.startStep > totalSteps) {
    throw new Error("The saved milestone cursor is invalid.");
  }
  const milestone = milestones[cursor.index];
  return {
    ...cursor,
    description: milestone?.description ?? "Recheck the complete result",
    stepBudget: milestone?.stepBudget ?? 30,
    families: milestone?.families,
    checks: milestone ? checks.filter((check) => milestone.checks.includes(check.id)) : checks,
    final: milestone === undefined || milestones.length === 1,
  };
}

export type Decision =
  | {
      kind: "queue";
      summary: string;
      intent: ActionIntent;
      /** Independent read-only observations chosen in the same turn, run in order. */
      more?: { summary: string; intent: ActionIntent }[];
    }
  | { kind: "milestone"; index: number }
  | { kind: "wait"; reason?: string }
  | { kind: "settle"; verification: VerificationResult; summary: string }
  | { kind: "block"; reason: string }
  /** R12-06: the task waits for a few details the person fills in a generated form. */
  | { kind: "form"; reason: string; fields: FormField[] };

export const formField = z.strictObject({
  name: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  label: z.string().min(1).max(120),
  type: z.enum(["text", "number", "date", "choice", "long_text"]),
  options: z
    .array(z.string().min(1).max(80))
    .min(2)
    .max(20)
    .refine((options) => new Set(options).size === options.length)
    .optional(),
  required: z.boolean().optional(),
});
export type FormField = z.infer<typeof formField>;
/** A generated form: 1-12 distinctly named fields, choices with their options. */
export const generatedForm = z
  .array(formField)
  .min(1)
  .max(12)
  .refine((fields) => new Set(fields.map((f) => f.name)).size === fields.length)
  .refine((fields) => fields.every((f) => (f.type === "choice") === Boolean(f.options)));

/** This key space belongs to the supervisor; model-chosen operations use sN. */
export function isJobPoll(step: Step): boolean {
  return (
    step.intent.operation === "job.status" &&
    /^job-poll:[0-9a-f]{16}:[1-9][0-9]*$/.test(step.intent.key) &&
    step.intent.key.startsWith("job-poll:" + step.intent.arguments.jobId + ":")
  );
}

/** Follow an already confirmed command with bounded read-only observations. */
export function followJobs(steps: Step[], now: Date): Decision | undefined {
  for (const [index, started] of steps.entries()) {
    if (started.intent.operation !== "job.start" || started.status !== "done") continue;
    const jobId = started.receipt?.evidence.jobId;
    if (typeof jobId !== "string" || !/^[0-9a-f]{16}$/.test(jobId)) {
      return { kind: "block", reason: "The running command did not return a valid job identity." };
    }
    const observations = steps
      .slice(index + 1)
      .filter(
        (step) =>
          (step.intent.operation === "job.status" || step.intent.operation === "job.cancel") &&
          step.intent.arguments.jobId === jobId,
      );
    const observed = observations.filter(
      (step) =>
        step.status === "done" &&
        step.receipt?.status === "observed" &&
        step.receipt.evidence.jobId === jobId,
    );
    const latest = observed.at(-1) ?? started;
    const evidence = latest.receipt?.evidence;
    const state = evidence?.state;
    if (state === "finished" && Number.isInteger(evidence?.exitCode)) continue;
    if (state === "cancelled" || state === "timed_out") continue;
    if (state !== "running") {
      return {
        kind: "block",
        reason: "The command's result is unknown. Check the computer before retrying it.",
      };
    }

    const polls = observations.filter(isJobPoll);
    const lastAttempt = polls.at(-1) ?? started;
    const attemptedAt = Date.parse(
      lastAttempt.completedAt ?? lastAttempt.receipt?.observedAtUtc ?? "",
    );
    const startedAt = Date.parse(started.completedAt ?? started.receipt?.observedAtUtc ?? "");
    const { timeoutSeconds } = OPERATIONS["job.start"].arguments.parse(started.intent.arguments);
    const unanswered = observations.slice(observations.lastIndexOf(latest) + 1).filter(isJobPoll);
    if (
      !Number.isFinite(attemptedAt) ||
      !Number.isFinite(startedAt) ||
      polls.length >= Math.ceil(timeoutSeconds / 30) + 12 ||
      unanswered.length >= 3 ||
      (polls.length > 0 && attemptedAt > startedAt + (timeoutSeconds + 60) * 1000)
    ) {
      return { kind: "block", reason: "The command stopped reporting progress. Check its result." };
    }
    const interval = Math.min(30, 2 ** Math.max(0, Math.min(polls.length - 1, 5)));
    if (now.getTime() < attemptedAt + interval * 1000) return { kind: "wait" };

    return {
      kind: "queue",
      summary: "Checking progress of the running command",
      intent: intent(
        "job.status",
        "job-poll:" + jobId + ":" + (steps.length + 1),
        { jobId },
        new Date(now.getTime() + 10 * 60_000),
      ),
    };
  }
}

/** Unobserved possible effects cannot be resumed or repeated without a separate resolution. */
export function unresolvedEffect(steps: Step[]): string | null {
  return steps.some((step) => effectInDoubt(step) && !step.resolution)
    ? "An earlier action may already have changed your computer. Check its result before starting more work. JARVIS will not repeat it."
    : null;
}

/** A finished step that may have changed something nobody observed. */
export function effectInDoubt(step: Step): boolean {
  const raw = step.unparsedReceipt;
  const marker = typeof raw === "object" && raw !== null ? raw : null;
  // A malformed receipt cannot prove an observation, even if its raw status claims one.
  const unparsedChange =
    marker !== null && "maybeChanged" in marker && marker.maybeChanged === true;
  const unparsedUnknown = marker !== null && "status" in marker && marker.status === "unknown";
  // A declared read is not proof of no effect when its receipt explicitly admits one.
  return (
    unparsedChange ||
    (step.receipt?.maybeChanged === true && step.receipt.status !== "observed") ||
    (effectPossible(step.intent) &&
      (step.effectUnknown || step.receipt?.status === "unknown" || unparsedUnknown))
  );
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

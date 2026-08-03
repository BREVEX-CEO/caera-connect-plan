/**
 * OCADE Task Rehearsal Mode (master plan §23.1).
 *
 * Before a multi-step task runs, rehearse the whole action graph WITHOUT
 * mutating anything, and report every problem at once: a missing permission, a
 * step the scope never granted, a control method that's currently failing, a
 * resource budget that won't fit, an app that needs inspecting first.
 *
 * The value is in "at once". Executing a ten-step task and discovering on step
 * seven that a permission is missing wastes the six steps before it and leaves
 * the world half-changed. Rehearsal surfaces all seven-and-beyond blockers
 * before step one.
 *
 * TWO RULES KEEP IT HONEST:
 *
 * 1. **It never executes.** It composes `planStep`, which is pure — it decides
 *    and routes but does not act. The scope is threaded forward so later steps
 *    see the step count they really would, but the caller's own scope object is
 *    never mutated.
 *
 * 2. **Passing rehearsal is not a promise of success.** A clear rehearsal means
 *    "nothing OCADE can check ahead of time blocks this" — not "this will
 *    work". The app might still be gone, the file still locked. `allClear`
 *    carries that caveat in `REHEARSAL_REALITY`, so a clear result is never
 *    read as a guarantee.
 */
import { planStep, type StepPlan } from "./work-session";
import type { CompanionAction } from "../native/companion-bridge";
import type { SkillCapability, SkillPack, ControlMethod } from "./skill-pack";
import type { TaskScope } from "./task-scope";
import type { AdapterHealth } from "./adapter-health";
import type { AppIdentity } from "./skill-pack";
import type { RecordingMode } from "./session-recording";

export interface RehearsalStep {
  action: CompanionAction;
  capability: SkillCapability;
  app: AppIdentity;
}

export interface RehearsalContext {
  packs: SkillPack[];
  scope: TaskScope | null;
  health: Map<ControlMethod, AdapterHealth>;
  availableMethods: ControlMethod[];
  recording: RecordingMode;
  now?: Date;
}

export type BlockerKind = "not_permitted" | "needs_inspection" | "over_budget" | "no_method";

export interface StepVerdict {
  index: number;
  intent: string;
  /** "ready" or the blocker kind. */
  status: "ready" | BlockerKind;
  reason: string;
  /** For ready steps: the method it would use and its confidence. */
  method?: ControlMethod;
  confidence?: number;
}

export interface Rehearsal {
  steps: StepVerdict[];
  /** True only when EVERY step rehearsed clear. */
  allClear: boolean;
  blockers: StepVerdict[];
  /** Distinct blocker kinds, so the user can see the shape of what's wrong. */
  blockerKinds: BlockerKind[];
  headline: string;
}

export type RehearsalOutcome =
  { ok: true; data: Rehearsal; evidence: string } | { ok: false; reason: string };

function classify(outcome: ReturnType<typeof planStep>, index: number): StepVerdict {
  switch (outcome.status) {
    case "ready":
      return {
        index,
        intent: outcome.plan.intent,
        status: "ready",
        reason: `Would run via ${outcome.plan.method} at ${(outcome.plan.confidence * 100).toFixed(0)}% confidence.`,
        method: outcome.plan.method,
        confidence: outcome.plan.confidence,
      };
    case "refused":
      return {
        index,
        intent: describeAction(index),
        status: "not_permitted",
        reason: outcome.reason,
      };
    case "needs_inspection":
      return {
        index,
        intent: describeAction(index),
        status: "needs_inspection",
        reason: outcome.reason,
      };
    case "over_budget":
      return {
        index,
        intent: describeAction(index),
        status: "over_budget",
        reason: outcome.reason,
      };
  }
}

function describeAction(index: number): string {
  return `Step ${index + 1}`;
}

/**
 * Rehearse a task's steps in order.
 *
 * The scope is threaded step to step so that, for example, a per-task step
 * budget is rehearsed against the count it really would reach. Because
 * `planStep` returns a fresh scope rather than mutating, the caller's scope is
 * untouched and the rehearsal can be re-run identically.
 */
export function rehearseTask(steps: RehearsalStep[], context: RehearsalContext): RehearsalOutcome {
  if (steps.length === 0) {
    return { ok: false, reason: "There are no steps to rehearse." };
  }

  const verdicts: StepVerdict[] = [];
  // A ready step advances the scope; a blocked step does not (it wouldn't run),
  // so later steps rehearse against the scope as it truly would be.
  let scope = context.scope;
  let readySoFar = 0;

  steps.forEach((step, index) => {
    const outcome = planStep({
      action: step.action,
      capability: step.capability,
      app: step.app,
      packs: context.packs,
      scope,
      health: context.health,
      availableMethods: context.availableMethods,
      recording: context.recording,
      remainingSteps: steps.length - index,
      now: context.now,
    });

    const verdict = classify(outcome, index);
    // Carry the real intent through for ready steps.
    verdicts.push(verdict);

    if (outcome.status === "ready") {
      scope = outcome.plan.scope;
      readySoFar++;
    }
  });

  const blockers = verdicts.filter((v) => v.status !== "ready");
  const blockerKinds = [...new Set(blockers.map((b) => b.status as BlockerKind))];
  const allClear = blockers.length === 0;

  return {
    ok: true,
    data: {
      steps: verdicts,
      allClear,
      blockers,
      blockerKinds,
      headline: headlineFor(allClear, verdicts.length, blockers.length, readySoFar),
    },
    evidence: allClear
      ? `All ${verdicts.length} steps rehearsed clear. Nothing OCADE can check ahead of time blocks this task.`
      : `${blockers.length} of ${verdicts.length} steps are blocked — first: ${blockers[0].reason}`,
  };
}

function headlineFor(allClear: boolean, total: number, blocked: number, ready: number): string {
  if (allClear) {
    return `${total} step${total === 1 ? "" : "s"} ready. Rehearsal found nothing blocking — but it can't promise the apps and files will be as expected when it runs.`;
  }
  return `${blocked} of ${total} steps blocked, ${ready} ready. Fix the blockers before running, or OCADE will stop partway.`;
}

/**
 * What a clear rehearsal is allowed to claim.
 *
 * Kept as a constant so a caller cannot upgrade "rehearsed clear" into
 * "guaranteed". See rule 2 in the module header.
 */
export const REHEARSAL_REALITY =
  "A clear rehearsal means nothing OCADE could check in advance blocks this task — permissions, routes, budgets and known app state. It is not a guarantee: the app may have closed, the file may be locked, the UI may have changed. OCADE still verifies each step as it runs, and stops if reality disagrees.";

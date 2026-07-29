/**
 * The work session — the engine that actually drives software.
 *
 * Everything else in `skills/` is a decision layer. This composes them into the
 * single flow OCADE follows for every step, in an order chosen so that each
 * check happens while it can still prevent harm rather than merely report it:
 *
 *   1. SCOPE     — is this covered by what the user approved?
 *   2. IDENTIFY  — which app, which version, do we have a tested pack?
 *   3. MAP       — do we have a fresh layout map, or must we re-inspect?
 *   4. ASSESS    — confidence, and the most reliable route available
 *   5. HEALTH    — is that route currently working? route around it if not
 *   6. BUDGET    — will this finish inside the limits?
 *   7. ACT       — perform it, recording only what may be recorded
 *   8. VERIFY    — confirm through UI, file or log
 *   9. RECEIPT   — evidence, produced only after verification
 *
 * A step that cannot be verified is reported as unconfirmed, never as done.
 */
import type { CompanionAction } from "@/lib/native/companion-bridge";
import {
  assessAction,
  matchPack,
  buildReceipt,
  methodRank,
  type AppIdentity,
  type ControlMethod,
  type EvidenceReceipt,
  type SkillCapability,
  type SkillPack,
} from "./skill-pack";
import { checkScope, recordStep, type TaskScope } from "./task-scope";
import { findControl, fingerprintApp, lookupAppMap, recordMapUse, type AppMap } from "./app-map";
import {
  chooseHealthyMethod,
  predictBudget,
  type AdapterHealth,
  type ResourceBudget,
  DEFAULT_BUDGET,
} from "./adapter-health";
import { actionStyleFor, type ActionStyle, type RecordingMode } from "./session-recording";

export type StepOutcome =
  | { status: "refused"; reason: string; escalate: boolean }
  | { status: "needs_inspection"; reason: string; previousMap: AppMap | null }
  | { status: "ready"; plan: StepPlan }
  | { status: "over_budget"; reason: string; estimateMs: number };

export interface StepPlan {
  app: AppIdentity;
  capability: SkillCapability;
  method: ControlMethod;
  confidence: number;
  /** Methods skipped because they are currently failing. */
  routedAround: ControlMethod[];
  style: ActionStyle;
  /** Scope with this step counted, for the caller to keep. */
  scope: TaskScope;
  /** Plain-language statement of what is about to happen. */
  intent: string;
}

export interface PlanInput {
  action: CompanionAction;
  capability: SkillCapability;
  app: AppIdentity;
  packs: SkillPack[];
  scope: TaskScope | null;
  health: Map<ControlMethod, AdapterHealth>;
  availableMethods: ControlMethod[];
  recording: RecordingMode;
  /** Observed UI shape, used to decide whether a saved map is still valid. */
  fingerprintInput?: Parameters<typeof fingerprintApp>[0];
  remainingSteps?: number;
  averageStepMs?: number;
  budget?: ResourceBudget;
  now?: Date;
}

/**
 * Decide whether and how to perform one step. Pure — it plans, it never acts,
 * so the caller can show the plan before anything happens.
 */
export function planStep(input: PlanInput): StepOutcome {
  const now = input.now ?? new Date();

  // 1) Scope first: an unapproved step must not even be analysed further.
  const scopeDecision = checkScope(input.action, input.scope, now);
  if (!scopeDecision.allow) {
    return { status: "refused", reason: scopeDecision.reason, escalate: scopeDecision.escalate };
  }

  // 2) Which app, and do we genuinely know it?
  const match = matchPack(input.app, input.packs);
  let capability = input.capability;
  if (match.pack) {
    const declared = match.pack.capabilities.find((candidate) => candidate.id === capability.id);
    if (!declared) {
      return {
        status: "refused",
        reason: `${match.pack.displayName} does not declare the "${capability.id}" capability. OCADE will not infer it from another pack.`,
        escalate: true,
      };
    }
    const sameMethods =
      declared.methods.length === capability.methods.length &&
      declared.methods.every((method) => capability.methods.includes(method));
    if (
      declared.label !== capability.label ||
      declared.mutating !== capability.mutating ||
      declared.verifyBy !== capability.verifyBy ||
      declared.tested !== capability.tested ||
      !sameMethods
    ) {
      return {
        status: "refused",
        reason: `The requested "${capability.id}" metadata does not match the registered skill pack. OCADE will not run altered safety or verification rules.`,
        escalate: true,
      };
    }
    capability = declared;
  }

  // 3) Is our saved layout still valid? A stale map means re-inspect, not guess.
  const fingerprint = fingerprintApp(
    input.fingerprintInput ?? { version: input.app.version ?? null },
  );
  const mapState = lookupAppMap(input.app.appId, fingerprint);
  if (match.confidence !== "verified" && mapState.status !== "fresh") {
    return {
      status: "needs_inspection",
      reason:
        mapState.status === "stale"
          ? mapState.reason
          : `${match.reason} OCADE will look at the app once before acting.`,
      previousMap: mapState.status === "stale" ? mapState.map : null,
    };
  }

  // A map for an unknown app only authorizes the exact structural capability
  // it observed. A different control id or method is unsupported, not a
  // near-match inferred from the fact that some map exists.
  const needsMappedCapability = match.confidence !== "verified" && mapState.status === "fresh";
  const learnedControl = needsMappedCapability ? findControl(mapState.map, capability.id) : null;
  if (needsMappedCapability && !learnedControl) {
    return {
      status: "refused",
      reason: `OCADE inspected ${input.app.displayName}, but its learned map does not contain the exact "${capability.id}" capability. It will not substitute a similar control.`,
      escalate: true,
    };
  }
  const candidateMethods = learnedControl
    ? capability.methods.filter((method) => method === learnedControl.method)
    : capability.methods;
  if (learnedControl && candidateMethods.length === 0) {
    return {
      status: "refused",
      reason: `The learned route for "${input.capability.id}" is not one of the capability's permitted methods.`,
      escalate: true,
    };
  }

  // 4) Route health must be evaluated before confidence. Otherwise a failed API
  //    that falls back to vision inherits the API's confidence and can make a
  //    risky pixel route look safer than it is.
  const routed = chooseHealthyMethod(
    candidateMethods.filter((m) => input.availableMethods.includes(m)),
    input.health,
    methodRank,
  );
  if (!routed.method) {
    return {
      status: "refused",
      reason:
        "Every way OCADE knows to do this is currently failing. It has stopped rather than retry blindly.",
      escalate: true,
    };
  }

  // A fresh structural map is the evidence that promotes an unknown app to
  // learned/probed. It never promotes the app to verified, which still requires
  // a tested pack for this exact version.
  const effectiveConfidence =
    match.confidence === "unknown" && mapState.status === "fresh" ? "probed" : match.confidence;

  // 5) Score the route that will actually run. A fresh map of this exact build
  //    counts as evidence; otherwise inspecting an unknown app is a dead end.
  const assessment = assessAction(
    capability,
    effectiveConfidence,
    [routed.method],
    mapState.status === "fresh" ? { uses: mapState.map.uses } : null,
  );
  if (!assessment.proceed || !assessment.method) {
    return { status: "refused", reason: assessment.reason, escalate: true };
  }

  // 6) Will the remaining work fit?
  const budget = predictBudget(
    input.remainingSteps ?? 1,
    input.averageStepMs ?? 500,
    input.budget ?? DEFAULT_BUDGET,
  );
  if (!budget.withinBudget) {
    return { status: "over_budget", reason: budget.reason, estimateMs: budget.estimateMs };
  }

  return {
    status: "ready",
    plan: {
      app: input.app,
      capability,
      method: routed.method,
      confidence: assessment.confidence,
      routedAround: routed.routedAround,
      style: actionStyleFor(input.recording),
      scope: recordStep(scopeDecision.scope),
      intent: describeIntent(input.app, capability, routed.method, assessment.confidence),
    },
  };
}

/**
 * State the app, version, target, result and confidence before acting — so the
 * user can stop a step that is about to do the wrong thing.
 */
export function describeIntent(
  app: AppIdentity,
  capability: SkillCapability,
  method: ControlMethod,
  confidence: number,
): string {
  const version = app.version ? ` ${app.version}` : "";
  const risk = capability.mutating ? "changes something" : "reads only";
  return `${capability.label} in ${app.displayName}${version} — ${risk}, ${Math.round(confidence * 100)}% confident.`;
}

/**
 * Turn a completed step into a receipt.
 *
 * `verified` must come from a real check by the caller. Passing `true` without
 * one produces exactly the fabricated success this product refuses to emit, so
 * a capability declaring `verifyBy: "none"` can never yield a verified receipt.
 */
export function completeStep(input: {
  plan: StepPlan;
  verified: boolean;
  evidence: string;
  now?: Date;
}): EvidenceReceipt {
  const canVerify = input.plan.capability.verifyBy !== "none";
  const receipt = buildReceipt({
    app: input.plan.app,
    capability: input.plan.capability,
    method: input.plan.method,
    verified: canVerify && input.verified,
    evidence: canVerify
      ? input.evidence
      : `${input.evidence || "action performed"} (this step has no way to be checked)`,
    now: input.now,
  });
  if (receipt.verified) recordMapUse(input.plan.app.appId);
  return receipt;
}

/**
 * What to do when verification does not match what was expected.
 * Stop first: continuing after a mismatch is how one wrong step becomes ten.
 */
export interface MismatchPlan {
  stop: true;
  undo: boolean;
  reDetect: boolean;
  retry: boolean;
  reason: string;
}

export function planMismatch(capability: SkillCapability, attempt: number): MismatchPlan {
  const canUndo = capability.mutating;
  // One retry after a fresh look; beyond that something is wrong that retrying
  // will not fix, and repeating a mutating action risks doing it twice.
  const retry = attempt < 1;
  return {
    stop: true,
    undo: canUndo,
    reDetect: true,
    retry,
    reason: retry
      ? "That didn't do what OCADE expected. It has stopped, undone what it can, and will look at the app again before trying once more."
      : "That didn't do what OCADE expected, and a second attempt didn't help. It has stopped and undone what it can rather than keep going.",
  };
}

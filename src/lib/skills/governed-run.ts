/**
 * OCADE governed task run — the pieces, composed.
 *
 * The §23 systems (Rehearsal, Confidence Governor, Recovery Graph) and the
 * Evidence Ledger each exist and are tested in isolation. This is the pipeline
 * that runs them together, in the order the mutation contract (§9.1) demands,
 * for one task:
 *
 *   plan (preconditions & scope) → govern confidence → require recovery →
 *   execute → verify (receipt) → next step … → emit one Evidence Ledger artifact
 *
 * It is ADDITIVE: it imports the verified modules and modifies none of them.
 *
 * HALT-ON-BLOCK. If a step can't safely run — unplannable, low confidence with
 * no machine remedy, or no adequate recovery — the run STOPS there and every
 * later step is recorded as skipped. It does not press on: reaching a later
 * step means the earlier ones already changed the world, so continuing past a
 * block is how a task ends up half-done with no way back. The stop is honest,
 * recorded, and the ledger says exactly where and why.
 */
import { planStep } from "./work-session";
import { runPlannedStep, type ExecutorRegistry } from "./executor-registry";
import { governConfidence } from "./confidence-governor";
import { assessRecovery, type RecoveryOption, type RiskTier } from "./recovery-graph";
import {
  buildTaskLedger,
  saveLedgerArtifact,
  type LedgerStep,
  type TaskLedger,
} from "../artifacts/evidence-ledger";
import type { CompanionAction } from "../native/companion-bridge";
import type { AppIdentity, ControlMethod, SkillCapability, SkillPack } from "./skill-pack";
import type { TaskScope } from "./task-scope";
import type { AdapterHealth } from "./adapter-health";
import type { RecordingMode } from "./session-recording";
import {
  deriveIdempotencyKey,
  validateOcadeActionRequest,
  type ActionRoute,
  type OcadeActionRequest,
  type RiskLevel,
} from "./action-contract";

export interface GovernedStep {
  action: CompanionAction;
  capability: SkillCapability;
  app: AppIdentity;
  risk: RiskTier;
  /** Recovery options in place for this step, with readiness. */
  recovery: RecoveryOption[];
  /** Whether a weak reading behind this step could be refreshed. */
  canReobserve: boolean;
}

export interface GovernedRunInput {
  taskId: string;
  intent: string;
  initialState: string;
  finalState: string;
  steps: GovernedStep[];
  packs: SkillPack[];
  scope: TaskScope | null;
  health: Map<ControlMethod, AdapterHealth>;
  availableMethods: ControlMethod[];
  recording: RecordingMode;
  registry: ExecutorRegistry;
  now?: Date;
}

export interface GovernedRunResult {
  ledger: TaskLedger;
  /** Where the run stopped, if it did. -1 means every step was reached. */
  haltedAt: number;
  haltReason: string | null;
  receiptRecording:
    | { status: "not_requested" }
    | { status: "saved"; evidence: string }
    | { status: "failed"; reason: string };
}

export type GovernedRunOutcome =
  { ok: true; data: GovernedRunResult; evidence: string } | { ok: false; reason: string };

/**
 * Run a task through the full governed pipeline and produce a ledger.
 *
 * Does not save the ledger artifact itself — `runAndRecord` does that — so this
 * function stays pure enough to test without touching storage.
 */
export async function runGovernedTask(input: GovernedRunInput): Promise<GovernedRunOutcome> {
  if (input.steps.length === 0) return { ok: false, reason: "A task needs at least one step." };

  const startedAt = (input.now ?? new Date()).toISOString();
  const ledgerSteps: LedgerStep[] = [];
  let scope = input.scope;
  let haltedAt = -1;
  let haltReason: string | null = null;

  for (let i = 0; i < input.steps.length; i++) {
    const step = input.steps[i];

    // Once halted, everything after is skipped — not attempted.
    if (haltedAt !== -1) {
      ledgerSteps.push({ intent: labelOf(step), receipt: null, status: "skipped", attempts: 0 });
      continue;
    }

    // 1. Plan: preconditions, scope, method routing.
    const plan = planStep({
      action: step.action,
      capability: step.capability,
      app: step.app,
      packs: input.packs,
      scope,
      health: input.health,
      availableMethods: input.availableMethods,
      recording: input.recording,
      remainingSteps: input.steps.length - i,
      now: input.now,
    });

    if (plan.status !== "ready") {
      haltedAt = i;
      haltReason = plan.reason;
      ledgerSteps.push({ intent: labelOf(step), receipt: null, status: "failed", attempts: 0 });
      continue;
    }

    // The existing governed runner now crosses the same canonical typed
    // boundary as every Stage 2 executor. This preserves its verified planner,
    // scope and registry behavior while preventing a legacy path from becoming
    // an unvalidated bypass around the Director contract.
    const actionContract = governedActionContract(input.taskId, i, step, plan.plan.method);
    const contractIssue = validateOcadeActionRequest(actionContract);
    if (contractIssue) {
      haltedAt = i;
      haltReason = `The canonical action contract refused this step: ${contractIssue}`;
      ledgerSteps.push({
        intent: plan.plan.intent,
        receipt: null,
        status: "failed",
        attempts: 0,
      });
      continue;
    }

    // 2. Confidence governor.
    const decision = governConfidence({
      confidence: plan.plan.confidence,
      mutating: step.capability.mutating,
      verifyBy: step.capability.verifyBy,
      plannedMethod: plan.plan.method,
      // A failing route is not available to the confidence governor. Passing it
      // here could send a vision fallback straight back to the failed API.
      availableMethods: step.capability.methods.filter(
        (method) =>
          input.availableMethods.includes(method) && !plan.plan.routedAround.includes(method),
      ),
      canReobserve: step.canReobserve,
    });
    if (decision.action !== "proceed") {
      haltedAt = i;
      haltReason = decision.reason;
      ledgerSteps.push({ intent: plan.plan.intent, receipt: null, status: "failed", attempts: 0 });
      continue;
    }

    // 3. Recovery must be in place BEFORE the step runs.
    const recovery = assessRecovery({
      intent: plan.plan.intent,
      risk: step.risk,
      verifiable: step.capability.verifyBy !== "none",
      options: step.recovery,
    });
    if (!recovery.ok || !recovery.data.safe) {
      haltedAt = i;
      haltReason = recovery.ok ? recovery.data.reason : recovery.reason;
      ledgerSteps.push({ intent: plan.plan.intent, receipt: null, status: "failed", attempts: 0 });
      continue;
    }

    // 4. Execute and take the receipt.
    const run = await runPlannedStep(input.registry, plan.plan, input.now);
    if (run.status === "unavailable") {
      haltedAt = i;
      haltReason = run.reason;
      ledgerSteps.push({ intent: plan.plan.intent, receipt: null, status: "failed", attempts: 1 });
      continue;
    }
    if (run.status === "failed") {
      haltedAt = i;
      haltReason = run.reason;
      ledgerSteps.push({
        intent: plan.plan.intent,
        receipt: run.receipt,
        status: "failed",
        attempts: 1,
      });
      continue;
    }

    // Done. Advance the scope and record the verified receipt.
    scope = plan.plan.scope;
    ledgerSteps.push({
      intent: plan.plan.intent,
      receipt: run.receipt,
      status: "done",
      attempts: 1,
    });
  }

  const finishedAt = new Date((input.now ?? new Date()).getTime()).toISOString();
  const ledger = buildTaskLedger({
    taskId: input.taskId,
    intent: input.intent,
    initialState: input.initialState,
    // When a run halts, the final state is what the steps that ran left behind,
    // not the state the caller hoped for. Say so rather than assert completion.
    finalState:
      haltedAt === -1
        ? input.finalState
        : `Stopped at step ${haltedAt + 1}. ${describeReached(ledgerSteps)}`,
    steps: ledgerSteps,
    startedAt,
    finishedAt,
  });
  if (!ledger.ok) return { ok: false, reason: ledger.reason };

  return {
    ok: true,
    data: {
      ledger: ledger.data,
      haltedAt,
      haltReason,
      receiptRecording: { status: "not_requested" },
    },
    evidence:
      haltedAt === -1
        ? `Ran ${input.steps.length} steps; ${ledger.data.headline}`
        : `Halted at step ${haltedAt + 1}: ${haltReason}`,
  };
}

/**
 * Run the task and persist its ledger as an Evidence Ledger artifact.
 *
 * The artifact's verified flag follows the ledger's derived outcome, so a
 * halted or partial run is stored NOT CONFIRMED — the honesty flows end to end.
 */
export async function runAndRecord(input: GovernedRunInput): Promise<GovernedRunOutcome> {
  const run = await runGovernedTask(input);
  if (!run.ok) return run;
  const saved = await saveLedgerArtifact(run.data.ledger);
  return {
    ok: true,
    data: {
      ...run.data,
      receiptRecording: saved.ok
        ? { status: "saved", evidence: saved.evidence }
        : { status: "failed", reason: saved.reason },
    },
    evidence: saved.ok
      ? `${run.evidence} Receipt saved: ${saved.evidence}`
      : `${run.evidence} Receipt not saved: ${saved.reason}`,
  };
}

function labelOf(step: GovernedStep): string {
  return step.capability.label;
}

function describeReached(steps: LedgerStep[]): string {
  const done = steps.filter((s) => s.status === "done").length;
  return done === 0
    ? "Nothing was changed."
    : `${done} step${done === 1 ? "" : "s"} completed before the stop.`;
}

function governedActionContract(
  taskId: string,
  index: number,
  step: GovernedStep,
  method: ControlMethod,
): OcadeActionRequest {
  const stepId = `step-${index + 1}`;
  const route: Record<ControlMethod, ActionRoute> = {
    official_api: "api",
    adapter: "plugin",
    accessibility: "accessibility",
    dom: "dom",
    file: "file",
    cli: "cli",
    vision_input: "vision",
  };
  const risk: Record<RiskTier, RiskLevel> = {
    read: "read",
    low: "low",
    high: "high",
    irreversible: "high",
  };
  const arguments_ = step.action as unknown as Record<string, unknown>;
  const postconditionId = `${stepId}:verified`;
  return {
    actionId: `${taskId}:${stepId}`,
    taskId,
    stepId,
    appIdentity: {
      appId: step.app.appId,
      product: step.app.displayName,
      ...(step.app.version ? { version: step.app.version } : {}),
    },
    capability: step.capability.id,
    route: route[method],
    arguments: arguments_,
    risk: risk[step.risk],
    requiredPermission: step.action.kind,
    expectedPostconditions: [
      {
        id: postconditionId,
        kind: step.capability.verifyBy,
        selector: step.capability.id,
        operator: "equals",
        expected: true,
      },
    ],
    verificationPlan: [
      {
        id: `${stepId}:observe`,
        observerId: "executor-registry-verifier",
        route: route[method],
        postconditionIds: [postconditionId],
      },
    ],
    ...(step.recovery.length > 0
      ? {
          rollbackPlan: step.recovery.map((option, recoveryIndex) => ({
            id: `${stepId}:recovery-${recoveryIndex + 1}`,
            kind: option.kind === "none" ? ("cancel" as const) : option.kind,
            description: option.plan,
            ready: option.ready,
          })),
        }
      : {}),
    timeoutMs: 30_000,
    retryBudget: 0,
    idempotencyKey: deriveIdempotencyKey({
      taskId,
      stepId,
      capability: step.capability.id,
      arguments: arguments_,
    }),
  };
}

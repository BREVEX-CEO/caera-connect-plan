/**
 * Shared automation worker lifecycle.
 *
 * This module deliberately owns no database client, timer, or native adapter.
 * Instead it defines the atomic persistence and execution contracts those
 * runtimes must implement. That keeps the state machine testable while making
 * the critical boundary explicit: a queued row is not execution, and an
 * executor's `ok` is not success until an independent verifier confirms it.
 */
import { decideRetry, type RunStatus, type RunStep } from "./ocade-automations";
import { checkDeadline, shouldStartStep, type DeadlineState } from "./skills/deadline";
import {
  redactForAudit,
  type CompanionAction,
  type ExecuteOptions,
} from "./native/companion-bridge";

export interface AutomationStepReceipt {
  runId: string;
  stepIndex: number;
  phase: "execute" | "rollback";
  operationId: string;
  actionKind: CompanionAction["kind"];
  status: "succeeded" | "failed" | "cancelled";
  executionOk: boolean;
  verified: boolean;
  detail: string;
  startedAt: string;
  finishedAt: string;
}

export interface ClaimedAutomationRun {
  id: string;
  /** Opaque compare-and-set token. Only this claimant may mutate the run. */
  claimToken: string;
  steps: RunStep[];
  attempt: number;
  maxAttempts: number;
  /** Successful steps before this index must never be executed again. */
  nextStepIndex: number;
  /** True only after the applicable human approval was recorded. */
  confirmed: boolean;
  /** Hard stop for this run. Null means no deadline was configured. */
  deadlineAt?: string | null;
  /** Expiry of the human approval used for confirm/high-risk steps. */
  approvalExpiresAt?: string | null;
}

export interface CancellationWatch {
  signal: AbortSignal;
  reason(): "requested" | "paused" | "unavailable" | null;
  dispose(): void;
}

export interface AutomationRunCompletion {
  status: Extract<RunStatus, "succeeded" | "failed" | "cancelled">;
  error: string | null;
  finishedAt: string;
}

export interface AutomationRunRetry {
  status: "pending";
  attempt: number;
  nextAttemptAt: string;
  error: string;
}

export interface AutomationRunPause {
  reason: string;
  pausedAt: string;
}

export interface AutomationRunApprovalWait {
  reason: string;
  requestedAt: string;
}

/**
 * Persistence contract. Implementations must enforce `claimToken` on every
 * write, making claim/append/complete/requeue compare-and-set operations.
 */
export interface AutomationWorkerStore {
  claim(input: {
    runId: string;
    workerId: string;
    now: string;
  }): Promise<ClaimedAutomationRun | null>;
  watchCancellation(claim: ClaimedAutomationRun): CancellationWatch;
  heartbeat(claim: ClaimedAutomationRun, now: string): Promise<boolean>;
  appendReceipt(claim: ClaimedAutomationRun, receipt: AutomationStepReceipt): Promise<boolean>;
  complete(claim: ClaimedAutomationRun, completion: AutomationRunCompletion): Promise<boolean>;
  requeue(claim: ClaimedAutomationRun, retry: AutomationRunRetry): Promise<boolean>;
  suspend(claim: ClaimedAutomationRun, pause: AutomationRunPause): Promise<boolean>;
  awaitApproval(claim: ClaimedAutomationRun, wait: AutomationRunApprovalWait): Promise<boolean>;
}

export interface AutomationActionExecutor {
  execute(
    action: CompanionAction,
    opts: ExecuteOptions & { operationId: string },
  ): Promise<{
    ok: boolean;
    detail: string;
  }>;
  cancel(runId: string): Promise<void>;
}

export interface AutomationActionVerifier {
  verify(input: {
    action: CompanionAction;
    executionDetail: string;
    runId: string;
    operationId: string;
  }): Promise<{ verified: boolean; evidence: string }>;
}

export type AutomationWorkerOutcome =
  | { status: "not_claimed"; reason: string }
  | { status: "succeeded"; receipts: AutomationStepReceipt[] }
  | { status: "failed"; reason: string; receipts: AutomationStepReceipt[] }
  | { status: "cancelled"; receipts: AutomationStepReceipt[] }
  | { status: "paused"; reason: string; receipts: AutomationStepReceipt[] }
  | { status: "awaiting_approval"; reason: string; receipts: AutomationStepReceipt[] }
  | {
      status: "deferred";
      reason: string;
      attempt: number;
      nextAttemptAt: string;
      receipts: AutomationStepReceipt[];
    }
  | { status: "lost_claim"; reason: string; receipts: AutomationStepReceipt[] };

export interface RunAutomationWorkerInput {
  runId: string;
  workerId: string;
  store: AutomationWorkerStore;
  executor: AutomationActionExecutor;
  verifier: AutomationActionVerifier;
  now?: () => Date;
}

function operationId(runId: string, stepIndex: number): string {
  return `${runId}:step:${stepIndex}`;
}

async function completeCancellation(
  claim: ClaimedAutomationRun,
  store: AutomationWorkerStore,
  executor: AutomationActionExecutor,
  receipts: AutomationStepReceipt[],
  now: () => Date,
  error: string | null = null,
): Promise<AutomationWorkerOutcome> {
  try {
    await executor.cancel(claim.id);
  } catch {
    // Cancellation remains the terminal direction even when an unavailable
    // adapter has nothing to stop. The failed cancel call is not called success.
  }
  const saved = await store.complete(claim, {
    status: "cancelled",
    error: error ? redactForAudit(error) : null,
    finishedAt: now().toISOString(),
  });
  return saved
    ? { status: "cancelled", receipts }
    : {
        status: "lost_claim",
        reason: "The worker no longer owns this run, so it could not record cancellation.",
        receipts,
      };
}

async function stopForUnavailableCancellationChannel(
  claim: ClaimedAutomationRun,
  store: AutomationWorkerStore,
  executor: AutomationActionExecutor,
  receipts: AutomationStepReceipt[],
  now: () => Date,
): Promise<AutomationWorkerOutcome> {
  try {
    await executor.cancel(claim.id);
  } catch {
    // The failure is recorded below and may be retried; it is never presented
    // as a confirmed cancellation.
  }
  return failOrRetry(
    claim,
    store,
    "Cancellation monitoring became unavailable, so the worker stopped rather than run without an emergency brake.",
    receipts,
    now,
  );
}

async function completePause(
  claim: ClaimedAutomationRun,
  store: AutomationWorkerStore,
  executor: AutomationActionExecutor,
  receipts: AutomationStepReceipt[],
  now: () => Date,
): Promise<AutomationWorkerOutcome> {
  try {
    await executor.cancel(claim.id);
  } catch {
    // A pause remains requested, but the database transition below must prove
    // that this worker still owns the run before ownership is released.
  }
  const reason = "Paused by the user. Resume will continue from the first unverified step.";
  const saved = await store.suspend(claim, {
    reason,
    pausedAt: now().toISOString(),
  });
  return saved
    ? { status: "paused", reason, receipts }
    : {
        status: "lost_claim",
        reason: "The worker no longer owns this run, so it could not record the pause.",
        receipts,
      };
}

function stopForControl(
  claim: ClaimedAutomationRun,
  store: AutomationWorkerStore,
  executor: AutomationActionExecutor,
  receipts: AutomationStepReceipt[],
  now: () => Date,
  reason: ReturnType<CancellationWatch["reason"]>,
): Promise<AutomationWorkerOutcome> {
  if (reason === "unavailable") {
    return stopForUnavailableCancellationChannel(claim, store, executor, receipts, now);
  }
  if (reason === "paused") {
    return completePause(claim, store, executor, receipts, now);
  }
  return completeCancellation(claim, store, executor, receipts, now);
}

async function failOrRetry(
  claim: ClaimedAutomationRun,
  store: AutomationWorkerStore,
  reason: string,
  receipts: AutomationStepReceipt[],
  now: () => Date,
  terminalRecovery?: () => Promise<
    | { status: "recovered"; detail: string }
    | { status: "incomplete"; detail: string }
    | { status: "lost_claim"; reason: string }
  >,
): Promise<AutomationWorkerOutcome> {
  const decision = decideRetry({
    status: "failed",
    attempt: claim.attempt,
    maxAttempts: claim.maxAttempts,
  });
  const safeReason = redactForAudit(reason);

  if (decision.retry) {
    const nextAttemptAt = new Date(now().getTime() + decision.delayMs).toISOString();
    const attempt = claim.attempt + 1;
    const saved = await store.requeue(claim, {
      status: "pending",
      attempt,
      nextAttemptAt,
      error: safeReason,
    });
    return saved
      ? {
          status: "deferred",
          reason: safeReason,
          attempt,
          nextAttemptAt,
          receipts,
        }
      : {
          status: "lost_claim",
          reason: "The worker no longer owns this run, so it could not schedule the retry.",
          receipts,
        };
  }

  let finalReason = safeReason;
  if (terminalRecovery) {
    const recovery = await terminalRecovery();
    if (recovery.status === "lost_claim") {
      return { status: "lost_claim", reason: recovery.reason, receipts };
    }
    finalReason = `${safeReason} Recovery: ${recovery.detail}`;
  }
  const saved = await store.complete(claim, {
    status: "failed",
    error: finalReason,
    finishedAt: now().toISOString(),
  });
  return saved
    ? { status: "failed", reason: finalReason, receipts }
    : {
        status: "lost_claim",
        reason: "The worker no longer owns this run, so it could not record the failure.",
        receipts,
      };
}

async function rollbackCompletedSteps(
  claim: ClaimedAutomationRun,
  throughStepIndex: number,
  store: AutomationWorkerStore,
  executor: AutomationActionExecutor,
  verifier: AutomationActionVerifier,
  receipts: AutomationStepReceipt[],
  now: () => Date,
): Promise<
  | { status: "recovered"; detail: string }
  | { status: "incomplete"; detail: string }
  | { status: "lost_claim"; reason: string }
> {
  let rolledBack = 0;
  const missing: number[] = [];
  const failed: number[] = [];

  for (let stepIndex = throughStepIndex; stepIndex >= 0; stepIndex--) {
    const step = claim.steps[stepIndex];
    if (!step || step.risk === "read_only") continue;
    if (!step.rollbackAction) {
      missing.push(stepIndex + 1);
      continue;
    }

    const operationId = `${claim.id}:rollback:${stepIndex}`;
    const startedAt = now().toISOString();
    let execution: { ok: boolean; detail: string };
    try {
      execution = await executor.execute(step.rollbackAction, {
        runId: claim.id,
        operationId,
        confirmed: true,
      });
    } catch (error) {
      execution = {
        ok: false,
        detail: error instanceof Error ? error.message : "The rollback executor failed.",
      };
    }

    let verification = { verified: false, evidence: execution.detail };
    if (execution.ok) {
      try {
        verification = await verifier.verify({
          action: step.rollbackAction,
          executionDetail: execution.detail,
          runId: claim.id,
          operationId,
        });
      } catch (error) {
        verification = {
          verified: false,
          evidence: error instanceof Error ? error.message : "Rollback verification failed.",
        };
      }
    }
    const verified = execution.ok && verification.verified;
    const receipt: AutomationStepReceipt = {
      runId: claim.id,
      stepIndex,
      phase: "rollback",
      operationId,
      actionKind: step.rollbackAction.kind,
      status: verified ? "succeeded" : "failed",
      executionOk: execution.ok,
      verified,
      detail: redactForAudit(verification.evidence || execution.detail),
      startedAt,
      finishedAt: now().toISOString(),
    };
    if (!(await store.appendReceipt(claim, receipt))) {
      return {
        status: "lost_claim",
        reason: "The worker lost its claim while recording a rollback receipt.",
      };
    }
    receipts.push(receipt);
    if (verified) rolledBack += 1;
    else failed.push(stepIndex + 1);
  }

  if (missing.length === 0 && failed.length === 0) {
    return {
      status: "recovered",
      detail:
        rolledBack > 0
          ? `${rolledBack} prepared inverse ${rolledBack === 1 ? "action was" : "actions were"} independently verified.`
          : "No completed mutating step required rollback.",
    };
  }
  const parts = [];
  if (missing.length > 0) parts.push(`steps without an automatic inverse: ${missing.join(", ")}`);
  if (failed.length > 0) parts.push(`rollback verification failed for steps: ${failed.join(", ")}`);
  return {
    status: "incomplete",
    detail: `${parts.join("; ")}. Manual recovery is required.`,
  };
}

/**
 * Whether the deadline forbids starting the next action.
 *
 * This used to re-implement `skills/deadline` inline, down to the same safety
 * margin of `max(1s, estimate * 10%)`. Two copies of a rule that decides
 * whether to start real, side-effecting automation work is one copy too many —
 * they drift, and the drift is silent. The shared module is also the stricter
 * of the two: it rejects a step budget that overflows the safe numeric range,
 * which the inline version did not check.
 */
function deadlineFailure(claim: ClaimedAutomationRun, now: Date, step?: RunStep): string | null {
  if (!claim.deadlineAt) return null;
  const deadlineMs = Date.parse(claim.deadlineAt);
  if (!Number.isFinite(deadlineMs)) {
    return "The persisted run deadline is invalid, so execution failed closed.";
  }

  /*
   * The worker persists a deadline but no run start time. Only `deadline - now`
   * decides anything here, so the window is anchored just before the deadline:
   * that keeps it well-formed without inventing a start time the run never
   * recorded, and `remainingMs` is identical either way.
   */
  const state: DeadlineState = {
    startedAt: new Date(Math.min(now.getTime(), deadlineMs - 1)),
    deadline: new Date(deadlineMs),
  };

  if (step?.estimatedDurationMs !== undefined) {
    const decision = shouldStartStep(state, now, step.estimatedDurationMs);
    return decision.start ? null : decision.reason;
  }

  const check = checkDeadline(state, now);
  return check.withinDeadline
    ? null
    : "The run deadline passed before the next action could start.";
}

function approvalFailure(claim: ClaimedAutomationRun, now: Date, step: RunStep): string | null {
  if (!step.requiresConfirmation) return null;
  if (!claim.confirmed || !claim.approvalExpiresAt) {
    return "This step requires a current human approval.";
  }
  const expiresMs = Date.parse(claim.approvalExpiresAt);
  if (!Number.isFinite(expiresMs) || expiresMs <= now.getTime()) {
    return "The human approval expired before the next confirm-tier action.";
  }
  return null;
}

async function completeApprovalWait(
  claim: ClaimedAutomationRun,
  store: AutomationWorkerStore,
  reason: string,
  receipts: AutomationStepReceipt[],
  now: () => Date,
): Promise<AutomationWorkerOutcome> {
  const safeReason = redactForAudit(reason);
  const saved = await store.awaitApproval(claim, {
    reason: safeReason,
    requestedAt: now().toISOString(),
  });
  return saved
    ? { status: "awaiting_approval", reason: safeReason, receipts }
    : {
        status: "lost_claim",
        reason: "The worker no longer owns this run, so it could not renew approval.",
        receipts,
      };
}

async function completeDeadlineFailure(
  claim: ClaimedAutomationRun,
  store: AutomationWorkerStore,
  reason: string,
  receipts: AutomationStepReceipt[],
  now: () => Date,
): Promise<AutomationWorkerOutcome> {
  const safeReason = redactForAudit(reason);
  const saved = await store.complete(claim, {
    status: "failed",
    error: safeReason,
    finishedAt: now().toISOString(),
  });
  return saved
    ? { status: "failed", reason: safeReason, receipts }
    : {
        status: "lost_claim",
        reason: "The worker no longer owns this run, so it could not record the deadline failure.",
        receipts,
      };
}

/**
 * Claim and execute one persisted automation run.
 *
 * Successful receipts are appended before the next action starts, so recovery
 * resumes at `nextStepIndex` instead of replaying already-confirmed effects.
 */
export async function runAutomationWorker(
  input: RunAutomationWorkerInput,
): Promise<AutomationWorkerOutcome> {
  const now = input.now ?? (() => new Date());
  const claim = await input.store.claim({
    runId: input.runId,
    workerId: input.workerId,
    now: now().toISOString(),
  });
  if (!claim) {
    return {
      status: "not_claimed",
      reason: "The run is not eligible or another worker already claimed it.",
    };
  }

  const receipts: AutomationStepReceipt[] = [];
  const cancellation = input.store.watchCancellation(claim);

  try {
    for (let stepIndex = claim.nextStepIndex; stepIndex < claim.steps.length; stepIndex++) {
      if (cancellation.signal.aborted) {
        return stopForControl(
          claim,
          input.store,
          input.executor,
          receipts,
          now,
          cancellation.reason(),
        );
      }
      const needsApproval = approvalFailure(claim, now(), claim.steps[stepIndex]);
      if (needsApproval) {
        return completeApprovalWait(claim, input.store, needsApproval, receipts, now);
      }
      const beforeControl = deadlineFailure(claim, now(), claim.steps[stepIndex]);
      if (beforeControl) {
        return completeDeadlineFailure(claim, input.store, beforeControl, receipts, now);
      }
      const ownsClaim = await input.store.heartbeat(claim, now().toISOString());
      if (!ownsClaim) {
        return {
          status: "lost_claim",
          reason: "The worker lost its atomic claim before the next action.",
          receipts,
        };
      }
      const afterHeartbeat = deadlineFailure(claim, now(), claim.steps[stepIndex]);
      if (afterHeartbeat) {
        return completeDeadlineFailure(claim, input.store, afterHeartbeat, receipts, now);
      }
      // The heartbeat is an asynchronous boundary. Cancellation may arrive
      // while it is in flight, so re-check before handing a mutation to an
      // executor that might not inspect AbortSignal until after it starts.
      if (cancellation.signal.aborted) {
        return stopForControl(
          claim,
          input.store,
          input.executor,
          receipts,
          now,
          cancellation.reason(),
        );
      }

      const step = claim.steps[stepIndex];
      const opId = operationId(claim.id, stepIndex);
      const startedAt = now().toISOString();
      let execution: { ok: boolean; detail: string };

      try {
        execution = await input.executor.execute(step.action, {
          runId: claim.id,
          operationId: opId,
          confirmed: claim.confirmed,
          signal: cancellation.signal,
        });
      } catch (error) {
        execution = {
          ok: false,
          detail: error instanceof Error ? error.message : "The action executor failed.",
        };
      }

      if (cancellation.signal.aborted) {
        const controlReason = cancellation.reason();
        if (controlReason === "paused" && !execution.ok) {
          // Do not persist a false failed/cancelled step. A stable operation id
          // lets resume reconcile a lost acknowledgement without mutating twice.
          return completePause(claim, input.store, input.executor, receipts, now);
        }
        const ambiguous = execution.ok;
        const receipt: AutomationStepReceipt = {
          runId: claim.id,
          stepIndex,
          phase: "execute",
          operationId: opId,
          actionKind: step.action.kind,
          status:
            controlReason === "unavailable" || controlReason === "paused" ? "failed" : "cancelled",
          executionOk: execution.ok,
          verified: false,
          detail: ambiguous
            ? "Control arrived after the executor returned success. The action may have changed the computer, was not independently verified, and requires manual recovery."
            : controlReason === "unavailable"
              ? "Cancellation monitoring became unavailable before the failed action could be verified."
              : "Cancelled before the failed action could be verified.",
          startedAt,
          finishedAt: now().toISOString(),
        };
        if (!(await input.store.appendReceipt(claim, receipt))) {
          return {
            status: "lost_claim",
            reason: "The worker lost its claim while recording cancellation.",
            receipts,
          };
        }
        receipts.push(receipt);
        if (ambiguous) {
          try {
            await input.executor.cancel(claim.id);
          } catch {
            // The terminal record below remains explicit about manual recovery.
          }
          const reason =
            "The executor returned success after control was requested, but the effect could not be verified. Automatic replay is disabled; manual recovery is required.";
          return controlReason === "requested"
            ? completeCancellation(claim, input.store, input.executor, receipts, now, reason)
            : completeDeadlineFailure(claim, input.store, reason, receipts, now);
        }
        return controlReason === "unavailable"
          ? stopForUnavailableCancellationChannel(claim, input.store, input.executor, receipts, now)
          : controlReason === "paused"
            ? completePause(claim, input.store, input.executor, receipts, now)
            : completeCancellation(claim, input.store, input.executor, receipts, now);
      }

      let verification = { verified: false, evidence: execution.detail };
      if (execution.ok) {
        try {
          verification = await input.verifier.verify({
            action: step.action,
            executionDetail: execution.detail,
            runId: claim.id,
            operationId: opId,
          });
        } catch (error) {
          verification = {
            verified: false,
            evidence: error instanceof Error ? error.message : "Verification failed.",
          };
        }
      }

      const verified = execution.ok && verification.verified;
      const receipt: AutomationStepReceipt = {
        runId: claim.id,
        stepIndex,
        phase: "execute",
        operationId: opId,
        actionKind: step.action.kind,
        status: verified ? "succeeded" : "failed",
        executionOk: execution.ok,
        verified,
        detail: redactForAudit(verification.evidence || execution.detail),
        startedAt,
        finishedAt: now().toISOString(),
      };

      if (!(await input.store.appendReceipt(claim, receipt))) {
        return {
          status: "lost_claim",
          reason: "The worker lost its atomic claim while recording an action receipt.",
          receipts,
        };
      }
      receipts.push(receipt);

      if (!verified) {
        const reason = execution.ok
          ? `Action ${stepIndex + 1} could not be independently verified: ${receipt.detail}`
          : `Action ${stepIndex + 1} failed: ${receipt.detail}`;
        return failOrRetry(claim, input.store, reason, receipts, now, () =>
          rollbackCompletedSteps(
            claim,
            stepIndex,
            input.store,
            input.executor,
            input.verifier,
            receipts,
            now,
          ),
        );
      }
    }

    const saved = await input.store.complete(claim, {
      status: "succeeded",
      error: null,
      finishedAt: now().toISOString(),
    });
    return saved
      ? { status: "succeeded", receipts }
      : {
          status: "lost_claim",
          reason: "Every action verified, but the worker lost its claim before finalization.",
          receipts,
        };
  } finally {
    cancellation.dispose();
  }
}

export interface StaleAutomationRun {
  status: RunStatus;
  attempt: number;
  maxAttempts: number;
  heartbeatAt: string | null;
  cancelRequestedAt: string | null;
}

export type StaleRecoveryDecision =
  | { action: "ignore"; reason: string }
  | { action: "cancel"; reason: string }
  | { action: "requeue"; attempt: number; nextAttemptAt: string; reason: string }
  | { action: "fail"; reason: string };

/** Decide how a supervisor should recover a worker that stopped heartbeating. */
export function decideStaleRunRecovery(
  run: StaleAutomationRun,
  now: Date,
  staleAfterMs: number,
): StaleRecoveryDecision {
  if (run.status !== "running") {
    return { action: "ignore", reason: "Only running rows can have a stale worker claim." };
  }
  if (run.cancelRequestedAt) {
    return { action: "cancel", reason: "Cancellation was requested while the worker was lost." };
  }
  const heartbeat = run.heartbeatAt ? Date.parse(run.heartbeatAt) : Number.NaN;
  if (Number.isFinite(heartbeat) && now.getTime() - heartbeat < staleAfterMs) {
    return { action: "ignore", reason: "The worker heartbeat is still fresh." };
  }

  const retry = decideRetry({
    status: "failed",
    attempt: run.attempt,
    maxAttempts: run.maxAttempts,
  });
  if (!retry.retry) {
    return {
      action: "fail",
      reason: `The worker claim went stale and ${retry.reason.toLowerCase()}`,
    };
  }
  return {
    action: "requeue",
    attempt: run.attempt + 1,
    nextAttemptAt: new Date(now.getTime() + retry.delayMs).toISOString(),
    reason: "The worker claim went stale; resume from the first unverified step after backoff.",
  };
}

/**
 * A durable, on-disk AutomationWorkerStore.
 *
 * L2 requires that OCADE can be restarted mid-task and resume WITHOUT repeating
 * a completed step. That is only testable if the run state outlives the
 * process, so this keeps everything in a JSON file that is written before each
 * step is acknowledged. An in-memory store would make the restart test
 * meaningless — the state would die with the thing being restarted.
 *
 * The contract in src/lib/automation-worker.ts is explicit that claimToken must
 * be enforced on every write, making claim/append/complete compare-and-set. That
 * is honoured here: a stale claimant's writes are REFUSED rather than ignored,
 * which is what lets `lost_claim` mean something.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type {
  AutomationRunApprovalWait,
  AutomationRunCompletion,
  AutomationRunPause,
  AutomationRunRetry,
  AutomationStepReceipt,
  AutomationWorkerStore,
  CancellationWatch,
  ClaimedAutomationRun,
} from "../../src/lib/automation-worker.ts";
import type { RunStep } from "../../src/lib/ocade-automations.ts";

export interface PersistedRun {
  id: string;
  status: string;
  steps: RunStep[];
  nextStepIndex: number;
  attempt: number;
  maxAttempts: number;
  confirmed: boolean;
  claimToken: string | null;
  claimedBy: string | null;
  heartbeatAt: string | null;
  receipts: AutomationStepReceipt[];
  error: string | null;
  finishedAt: string | null;
  pausedAt: string | null;
  /** Set out-of-band by a supervisor to request pause or cancellation. */
  control: "run" | "pause" | "cancel";
}

export class FileAutomationStore implements AutomationWorkerStore {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
  }

  read(): PersistedRun {
    return JSON.parse(readFileSync(this.path, "utf8"));
  }

  /**
   * Write via a temp file and rename. A process killed mid-write must not be
   * able to leave a half-written run behind — the whole point of the restart
   * test is that the state on disk is trustworthy afterwards.
   */
  write(run: PersistedRun): void {
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(run, null, 2));
    renameSync(tmp, this.path);
  }

  static create(path: string, steps: RunStep[]): FileAutomationStore {
    const store = new FileAutomationStore(path);
    store.write({
      id: `run-${randomUUID()}`,
      status: "pending",
      steps,
      nextStepIndex: 0,
      attempt: 0,
      maxAttempts: 3,
      confirmed: true,
      claimToken: null,
      claimedBy: null,
      heartbeatAt: null,
      receipts: [],
      error: null,
      finishedAt: null,
      pausedAt: null,
      control: "run",
    });
    return store;
  }

  private owns(claim: ClaimedAutomationRun): PersistedRun | null {
    const run = this.read();
    // Compare-and-set: a claimant that no longer holds the token gets nothing.
    return run.claimToken === claim.claimToken ? run : null;
  }

  async claim(input: {
    runId: string;
    workerId: string;
    now: string;
  }): Promise<ClaimedAutomationRun | null> {
    const run = this.read();
    if (run.status === "succeeded" || run.status === "cancelled") return null;
    const claimToken = randomUUID();
    run.claimToken = claimToken;
    run.claimedBy = input.workerId;
    run.heartbeatAt = input.now;
    run.status = "running";
    this.write(run);
    return {
      id: run.id,
      claimToken,
      steps: run.steps,
      attempt: run.attempt,
      maxAttempts: run.maxAttempts,
      // Resumption point. Everything below this index is already done and must
      // never run again.
      nextStepIndex: run.nextStepIndex,
      confirmed: run.confirmed,
      deadlineAt: null,
      approvalExpiresAt: null,
    };
  }

  /**
   * Cancellation and pause are polled from the file, so an external supervisor
   * (or a phone, in the product) can request either while the run is in flight.
   */
  watchCancellation(claim: ClaimedAutomationRun): CancellationWatch {
    const controller = new AbortController();
    let reason: "requested" | "paused" | "unavailable" | null = null;
    const timer = setInterval(() => {
      try {
        const run = this.read();
        if (run.claimToken !== claim.claimToken) {
          reason = "unavailable";
          controller.abort();
        } else if (run.control === "cancel") {
          reason = "requested";
          controller.abort();
        } else if (run.control === "pause") {
          reason = "paused";
          controller.abort();
        }
      } catch {
        /* transient read during rename */
      }
    }, 100);
    return {
      signal: controller.signal,
      reason: () => reason,
      dispose: () => clearInterval(timer),
    } as CancellationWatch;
  }

  async heartbeat(claim: ClaimedAutomationRun, now: string): Promise<boolean> {
    const run = this.owns(claim);
    if (!run) return false;
    run.heartbeatAt = now;
    this.write(run);
    return true;
  }

  async appendReceipt(
    claim: ClaimedAutomationRun,
    receipt: AutomationStepReceipt,
  ): Promise<boolean> {
    const run = this.owns(claim);
    if (!run) return false;
    run.receipts.push(receipt);
    /*
     * Advance the resumption point ONLY for a succeeded execute step, and only
     * forward. This single line is what makes restart-without-repeat true, so
     * it is deliberately conservative: a failed or cancelled step leaves the
     * index where it was and will be retried, which is the safe direction.
     */
    if (receipt.phase === "execute" && receipt.status === "succeeded") {
      run.nextStepIndex = Math.max(run.nextStepIndex, receipt.stepIndex + 1);
    }
    this.write(run);
    return true;
  }

  async complete(
    claim: ClaimedAutomationRun,
    completion: AutomationRunCompletion,
  ): Promise<boolean> {
    const run = this.owns(claim);
    if (!run) return false;
    run.status = completion.status;
    run.error = completion.error;
    run.finishedAt = completion.finishedAt;
    run.claimToken = null;
    this.write(run);
    return true;
  }

  async requeue(claim: ClaimedAutomationRun, retry: AutomationRunRetry): Promise<boolean> {
    const run = this.owns(claim);
    if (!run) return false;
    run.status = retry.status;
    run.attempt = retry.attempt;
    run.error = retry.error;
    run.claimToken = null;
    this.write(run);
    return true;
  }

  async suspend(claim: ClaimedAutomationRun, pause: AutomationRunPause): Promise<boolean> {
    const run = this.owns(claim);
    if (!run) return false;
    run.status = "paused";
    run.pausedAt = pause.pausedAt;
    run.error = pause.reason;
    run.claimToken = null;
    this.write(run);
    return true;
  }

  async awaitApproval(
    claim: ClaimedAutomationRun,
    wait: AutomationRunApprovalWait,
  ): Promise<boolean> {
    const run = this.owns(claim);
    if (!run) return false;
    run.status = "awaiting_approval";
    run.error = wait.reason;
    run.claimToken = null;
    this.write(run);
    return true;
  }
}

/** Every execute() invocation, including replays. Never deduplicated. */
export function appendAttempt(path: string, line: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const prior = existsSync(path) ? readFileSync(path, "utf8") : "";
  writeFileSync(path, prior + line + "\n");
}

/**
 * Apply a side effect AT MOST ONCE, keyed on the operation id.
 *
 * The worker hands every execute() call an `operationId`, and this is what it
 * is for. Execution is at-least-once by nature: a process killed between doing
 * the work and recording the receipt leaves the effect applied and the
 * bookkeeping unaware, so the step is retried. That is unavoidable, and the
 * worker is right to retry rather than silently skip work it cannot prove
 * happened.
 *
 * What must NOT happen is the effect landing twice. Deduplicating on the
 * operation id is what turns at-least-once delivery into exactly-once effect,
 * and an executor that ignores it — as a first version here did — produces
 * duplicate work on every replay.
 *
 * Returns true when the effect was newly applied, false when it was already
 * present and was therefore skipped.
 */
export function applyEffectOnce(path: string, operationId: string, line: string): boolean {
  mkdirSync(dirname(path), { recursive: true });
  const prior = existsSync(path) ? readFileSync(path, "utf8") : "";
  if (prior.split("\n").some((l) => l.startsWith(`${operationId} `))) return false;
  writeFileSync(path, prior + line + "\n");
  return true;
}

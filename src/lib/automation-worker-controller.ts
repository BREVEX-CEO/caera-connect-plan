/**
 * Lifecycle-safe controller for the persisted automation queue.
 *
 * Discovering a row is not an execution attempt. A row counts as claimed only
 * when the supervisor returns an outcome that can occur after an atomic claim,
 * and it counts as successful only when the worker reports verified success.
 */
import { mapWithConcurrency } from "./skills/concurrency";
import type { AutomationSupervisorOutcome } from "./automation-supervisor";
import { redactForAudit } from "@/lib/security/protected-text";

export interface AutomationQueueSource {
  listEligibleRunIds(input: { limit: number; now: string }): Promise<string[]>;
}

export interface AutomationQueueSupervisor {
  run(runId: string): Promise<AutomationSupervisorOutcome>;
  recoverStale(staleAfterMs: number): Promise<{
    paused: number;
    expired: number;
    cancelled: number;
    failed: number;
    requeued: number;
  }>;
}

export type AutomationControllerLifecycle = "stopped" | "polling" | "idle" | "offline" | "error";

export interface AutomationControllerState {
  lifecycle: AutomationControllerLifecycle;
  inFlight: number;
  lastTickAt: string | null;
  lastError: string | null;
}

export interface AutomationControllerRunResult {
  runId: string;
  outcome?: AutomationSupervisorOutcome;
  error?: string;
}

export interface AutomationControllerTick {
  status: "completed" | "offline" | "error";
  discovered: number;
  dispatched: number;
  claimed: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  paused: number;
  awaitingApproval: number;
  deferred: number;
  lostClaim: number;
  notClaimed: number;
  idle: number;
  blocked: number;
  notEligible: number;
  errors: number;
  staleRecovery: {
    paused: number;
    expired: number;
    cancelled: number;
    failed: number;
    requeued: number;
  } | null;
  results: AutomationControllerRunResult[];
  reason?: string;
}

export interface AutomationWorkerControllerInput {
  source: AutomationQueueSource;
  supervisor: AutomationQueueSupervisor;
  isOnline?: () => boolean;
  now?: () => Date;
  maxBatch?: number;
  concurrency?: number;
  pollIntervalMs?: number;
  staleAfterMs?: number;
}

const EMPTY_RECOVERY = { paused: 0, expired: 0, cancelled: 0, failed: 0, requeued: 0 };

function safeInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value) || !value || value < 1) return fallback;
  return Math.min(Math.floor(value), maximum);
}

function emptyTick(
  status: AutomationControllerTick["status"],
  reason?: string,
): AutomationControllerTick {
  return {
    status,
    discovered: 0,
    dispatched: 0,
    claimed: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    paused: 0,
    awaitingApproval: 0,
    deferred: 0,
    lostClaim: 0,
    notClaimed: 0,
    idle: 0,
    blocked: 0,
    notEligible: 0,
    errors: 0,
    staleRecovery: null,
    results: [],
    reason,
  };
}

function claimedOutcome(outcome: AutomationSupervisorOutcome): boolean {
  return [
    "succeeded",
    "failed",
    "cancelled",
    "paused",
    "awaiting_approval",
    "deferred",
    "lost_claim",
  ].includes(outcome.status);
}

function safeErrorDetail(error: unknown, fallback: string): string {
  return redactForAudit(error instanceof Error ? error.message : fallback).replace(
    /\b(token|authorization|api[_-]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi,
    "$1=[REDACTED]",
  );
}

function recordOutcome(tick: AutomationControllerTick, outcome: AutomationSupervisorOutcome): void {
  if (claimedOutcome(outcome)) tick.claimed += 1;
  switch (outcome.status) {
    case "succeeded":
      tick.succeeded += 1;
      break;
    case "failed":
      tick.failed += 1;
      break;
    case "cancelled":
      tick.cancelled += 1;
      break;
    case "paused":
      tick.paused += 1;
      break;
    case "awaiting_approval":
      tick.awaitingApproval += 1;
      break;
    case "deferred":
      tick.deferred += 1;
      break;
    case "lost_claim":
      tick.lostClaim += 1;
      break;
    case "not_claimed":
      tick.notClaimed += 1;
      break;
    case "idle":
      tick.idle += 1;
      break;
    case "blocked":
      tick.blocked += 1;
      break;
    case "not_eligible":
      tick.notEligible += 1;
      break;
  }
}

export class AutomationWorkerController {
  private readonly isOnline: () => boolean;
  private readonly now: () => Date;
  private readonly maxBatch: number;
  private readonly concurrency: number;
  private readonly pollIntervalMs: number;
  private readonly staleAfterMs: number;
  private readonly activeRunIds = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tickPromise: Promise<AutomationControllerTick> | null = null;
  private started = false;
  private state: AutomationControllerState = {
    lifecycle: "stopped",
    inFlight: 0,
    lastTickAt: null,
    lastError: null,
  };

  constructor(private readonly input: AutomationWorkerControllerInput) {
    this.isOnline = input.isOnline ?? (() => true);
    this.now = input.now ?? (() => new Date());
    this.maxBatch = safeInteger(input.maxBatch, 20, 100);
    this.concurrency = safeInteger(input.concurrency, 2, 8);
    this.pollIntervalMs = safeInteger(input.pollIntervalMs, 15_000, 300_000);
    this.staleAfterMs = safeInteger(input.staleAfterMs, 120_000, 86_400_000);
  }

  getState(): AutomationControllerState {
    return { ...this.state };
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.loop();
  }

  async stop(): Promise<void> {
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.tickPromise) await this.tickPromise;
    this.state = {
      ...this.state,
      lifecycle: "stopped",
      inFlight: 0,
    };
  }

  /**
   * Poll once. Concurrent callers receive the same promise, so a slow poll
   * cannot overlap the next timer or duplicate in-process dispatch.
   */
  tick(): Promise<AutomationControllerTick> {
    if (this.tickPromise) return this.tickPromise;
    this.tickPromise = this.performTick().finally(() => {
      this.tickPromise = null;
    });
    return this.tickPromise;
  }

  private async loop(): Promise<void> {
    await this.tick();
    if (!this.started) return;
    this.timer = setTimeout(() => void this.loop(), this.pollIntervalMs);
  }

  private async performTick(): Promise<AutomationControllerTick> {
    const tickAt = this.now().toISOString();
    if (!this.isOnline()) {
      const result = emptyTick("offline", "Automation queue polling is paused while offline.");
      this.state = {
        lifecycle: "offline",
        inFlight: 0,
        lastTickAt: tickAt,
        lastError: null,
      };
      return result;
    }

    this.state = {
      ...this.state,
      lifecycle: "polling",
      lastTickAt: tickAt,
      lastError: null,
    };

    try {
      const staleRecovery = await this.input.supervisor.recoverStale(this.staleAfterMs);
      const listed = await this.input.source.listEligibleRunIds({
        limit: this.maxBatch,
        now: tickAt,
      });
      const runIds = [
        ...new Set(
          listed.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()),
        ),
      ].slice(0, this.maxBatch);
      const result = emptyTick("completed");
      result.staleRecovery = { ...EMPTY_RECOVERY, ...staleRecovery };
      result.discovered = runIds.length;

      /*
       * Bounded dispatch through the shared `mapWithConcurrency`.
       *
       * This was a hand-rolled worker pool with the same cursor-and-workers
       * shape as the shared helper — a second copy of the same concurrency
       * rule. The behaviour is unchanged: this callback captures its own
       * failures and never rejects, so the helper's stop-on-rejection path
       * cannot fire and ONE FAILING RUN STILL DOES NOT ABORT THE BATCH, which
       * is the property that matters for a queue of independent automations.
       */
      await mapWithConcurrency(runIds, this.concurrency, async (runId) => {
        // Already in flight from an overlapping tick: never dispatch twice.
        if (this.activeRunIds.has(runId)) return;
        this.activeRunIds.add(runId);
        this.state = { ...this.state, inFlight: this.activeRunIds.size };
        result.dispatched += 1;
        try {
          const outcome = await this.input.supervisor.run(runId);
          result.results.push({ runId, outcome });
          recordOutcome(result, outcome);
        } catch (error) {
          const detail = safeErrorDetail(error, "Unknown supervisor failure.");
          result.errors += 1;
          result.results.push({ runId, error: detail });
        } finally {
          this.activeRunIds.delete(runId);
          this.state = { ...this.state, inFlight: this.activeRunIds.size };
        }
      });
      this.state = {
        lifecycle: "idle",
        inFlight: 0,
        lastTickAt: tickAt,
        lastError: result.errors > 0 ? `${result.errors} run dispatch(es) failed.` : null,
      };
      return result;
    } catch (error) {
      const detail = safeErrorDetail(error, "Unknown queue polling failure.");
      const result = emptyTick("error", detail);
      result.errors = 1;
      this.state = {
        lifecycle: "error",
        inFlight: 0,
        lastTickAt: tickAt,
        lastError: detail,
      };
      return result;
    }
  }
}

export function describeAutomationControllerState(state: AutomationControllerState): string {
  switch (state.lifecycle) {
    case "stopped":
      return "Automation queue controller stopped. No rows are being polled or claimed.";
    case "offline":
      return "Automation queue controller paused while offline. Queued rows remain pending.";
    case "polling":
      return `Automation queue controller polling; ${state.inFlight} run(s) are currently dispatched.`;
    case "error":
      return `Automation queue controller error: ${state.lastError ?? "unknown failure"}`;
    case "idle":
      return state.lastError
        ? `Automation queue controller idle after an error: ${state.lastError}`
        : "Automation queue controller idle and waiting for eligible work.";
  }
}

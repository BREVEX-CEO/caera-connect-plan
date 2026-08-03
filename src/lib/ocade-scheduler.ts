/**
 * OCADE automation scheduler (Plan §33).
 *
 * `nextRunAt` decides WHEN an automation is due; this module decides WHICH
 * automations may actually start now, and enforces the safety rails around
 * firing them:
 *
 *  - paused and disabled automations never fire;
 *  - an automation with a run already in flight is never started twice;
 *  - concurrency is capped so a burst of due schedules can't saturate the
 *    machine;
 *  - a run still awaiting human approval blocks its automation rather than
 *    piling up more work;
 *  - a failed run only re-fires after its backoff has elapsed.
 *
 * Pure and deterministic: `now` is always injected, so the behaviour is fully
 * testable without timers.
 */
import { decideRetry, type RunStatus } from "./ocade-automations";

/** The subset of an automation row the scheduler needs. */
export interface SchedulableAutomation {
  id: string;
  enabled: boolean;
  paused: boolean;
  maxAttempts: number;
  /** ISO timestamp; null for manual automations. */
  nextRunAt: string | null;
  lastRunAt: string | null;
}

/** The subset of a run the scheduler needs. */
export interface SchedulableRun {
  id: string;
  automationId: string;
  status: RunStatus;
  attempt: number;
  createdAt: string;
  /** ISO timestamp set when a retry is scheduled. */
  nextAttemptAt: string | null;
}

export const DEFAULT_MAX_CONCURRENT = 3;

const ACTIVE: RunStatus[] = ["pending", "running"];

export type SkipReason =
  | "disabled"
  | "paused"
  | "manual"
  | "not_due"
  | "already_running"
  | "awaiting_approval"
  | "backoff"
  | "concurrency_limit"
  | "invalid_schedule"
  | "invalid_run_state";

export interface SchedulerDecision {
  /** Automations that should be started right now. */
  due: string[];
  /** Everything else, with the honest reason it was skipped. */
  skipped: { automationId: string; reason: SkipReason }[];
}

function latestRunFor(runs: SchedulableRun[], automationId: string): SchedulableRun | null {
  const mine = runs
    .filter((r) => r.automationId === automationId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  return mine[0] ?? null;
}

/**
 * Decide what to start. Deterministic and side-effect free — the caller
 * performs the actual starts.
 */
export function selectDueAutomations(
  automations: SchedulableAutomation[],
  runs: SchedulableRun[],
  now: Date = new Date(),
  maxConcurrent: number = DEFAULT_MAX_CONCURRENT,
): SchedulerDecision {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs)) {
    throw new RangeError("Automation scheduling requires a valid clock.");
  }
  const concurrencyLimit =
    Number.isFinite(maxConcurrent) && maxConcurrent >= 0
      ? Math.floor(maxConcurrent)
      : DEFAULT_MAX_CONCURRENT;
  const due: string[] = [];
  const skipped: { automationId: string; reason: SkipReason }[] = [];

  // Anything already in flight counts against the concurrency budget.
  let inFlight = runs.filter((r) => ACTIVE.includes(r.status)).length;

  // Oldest scheduled first, so a long-overdue automation isn't starved.
  const ordered = [...automations].sort((a, b) => {
    const at = a.nextRunAt ? Date.parse(a.nextRunAt) : Number.POSITIVE_INFINITY;
    const bt = b.nextRunAt ? Date.parse(b.nextRunAt) : Number.POSITIVE_INFINITY;
    return at - bt;
  });

  for (const a of ordered) {
    if (!a.enabled) {
      skipped.push({ automationId: a.id, reason: "disabled" });
      continue;
    }
    if (a.paused) {
      skipped.push({ automationId: a.id, reason: "paused" });
      continue;
    }
    if (!a.nextRunAt) {
      // Manual automations have no schedule; they only run on request.
      skipped.push({ automationId: a.id, reason: "manual" });
      continue;
    }
    const scheduledAt = Date.parse(a.nextRunAt);
    if (!Number.isFinite(scheduledAt)) {
      skipped.push({ automationId: a.id, reason: "invalid_schedule" });
      continue;
    }
    if (scheduledAt > nowMs) {
      skipped.push({ automationId: a.id, reason: "not_due" });
      continue;
    }

    const last = latestRunFor(runs, a.id);
    if (last && ACTIVE.includes(last.status)) {
      skipped.push({ automationId: a.id, reason: "already_running" });
      continue;
    }
    if (last && last.status === "awaiting_approval") {
      // Don't queue more work behind a decision the user hasn't made.
      skipped.push({ automationId: a.id, reason: "awaiting_approval" });
      continue;
    }
    if (last && last.status === "failed") {
      const retry = decideRetry({
        status: "failed",
        attempt: last.attempt,
        maxAttempts: a.maxAttempts,
      });
      const readyAt = last.nextAttemptAt
        ? Date.parse(last.nextAttemptAt)
        : Date.parse(last.createdAt) + retry.delayMs;
      if (!Number.isFinite(readyAt)) {
        skipped.push({ automationId: a.id, reason: "invalid_run_state" });
        continue;
      }
      if (retry.retry && readyAt > nowMs) {
        skipped.push({ automationId: a.id, reason: "backoff" });
        continue;
      }
      if (!retry.retry) {
        // Exhausted attempts: fall through to the normal schedule rather than
        // retrying, so the automation resumes on its next scheduled slot.
        if (scheduledAt > nowMs) {
          skipped.push({ automationId: a.id, reason: "not_due" });
          continue;
        }
      }
    }

    if (inFlight >= concurrencyLimit) {
      skipped.push({ automationId: a.id, reason: "concurrency_limit" });
      continue;
    }

    due.push(a.id);
    inFlight++;
  }

  return { due, skipped };
}

/** When the next retry of a failed run becomes eligible. */
export function retryReadyAt(
  run: { attempt: number; createdAt: string },
  maxAttempts: number,
): { retry: boolean; readyAt: Date | null; reason: string } {
  const createdAt = Date.parse(run.createdAt);
  if (!Number.isFinite(createdAt)) {
    return {
      retry: false,
      readyAt: null,
      reason: "Retry timing is unavailable because the persisted run time is invalid.",
    };
  }
  const decision = decideRetry({ status: "failed", attempt: run.attempt, maxAttempts });
  return {
    retry: decision.retry,
    readyAt: decision.retry ? new Date(createdAt + decision.delayMs) : null,
    reason: decision.reason,
  };
}

/** Human-readable explanation used in the run history and audit trail. */
export function describeSkip(reason: SkipReason): string {
  switch (reason) {
    case "disabled":
      return "Turned off.";
    case "paused":
      return "Paused.";
    case "manual":
      return "Runs only when you start it.";
    case "not_due":
      return "Not due yet.";
    case "already_running":
      return "A run is already in progress.";
    case "awaiting_approval":
      return "Waiting for your approval.";
    case "backoff":
      return "Waiting before the next retry.";
    case "concurrency_limit":
      return "Too many runs in progress — it will start shortly.";
    case "invalid_schedule":
      return "The saved schedule is invalid and must be corrected.";
    case "invalid_run_state":
      return "The saved retry state is invalid and must be repaired.";
    default:
      return "Skipped.";
  }
}

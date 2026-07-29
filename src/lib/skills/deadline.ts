/**
 * OCADE task deadlines and time budgets (master plan §8.3 "deadlines",
 * "resource budgets").
 *
 * A task can be given a deadline. This decides, before each step, whether there
 * is enough time left to run it — and if not, stops the task cleanly rather
 * than starting a step it cannot finish.
 *
 * THE RULE: never START what can't finish in time. Beginning a step that will
 * overrun the deadline is how a task ends up half-done and interrupted — the
 * worst outcome, because the work is neither complete nor cleanly abandoned.
 * So `shouldStartStep` says stop BEFORE the last step that would fit, and the
 * reason reports exactly how much time was short. A deadline that only fired
 * after the overrun would be useless.
 *
 * Pure and deterministic — `now` is always passed in, never read from the
 * clock, so the same inputs always give the same decision.
 */

export interface DeadlineState {
  /** When the task's clock started. */
  startedAt: Date;
  /** Hard deadline. The task must be done by this time. */
  deadline: Date;
}

export interface DeadlineCheck {
  /** False when a timestamp is unreadable or the window is not positive. */
  valid: boolean;
  reason?: string;
  /** Milliseconds left until the deadline (negative when already past). */
  remainingMs: number;
  /** True when the deadline has not yet passed. */
  withinDeadline: boolean;
  /** Fraction of the total budget elapsed, 0–1+ (over 1 means past deadline). */
  fractionElapsed: number;
}

export type DeadlineDecision =
  | { start: true; reason: string; remainingMs: number }
  | { start: false; reason: string; remainingMs: number; shortByMs: number };

/**
 * How much time is left, and whether the deadline still holds.
 *
 * Refuses a nonsensical window (deadline before start) by reporting it rather
 * than returning a misleading positive remaining.
 */
export function checkDeadline(state: DeadlineState, now: Date): DeadlineCheck {
  const startedAt = state.startedAt.getTime();
  const deadline = state.deadline.getTime();
  const current = now.getTime();
  const total = deadline - startedAt;
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(deadline) ||
    !Number.isFinite(current) ||
    total <= 0
  ) {
    return {
      valid: false,
      reason: "The deadline window has invalid dates or does not end after it starts.",
      remainingMs: 0,
      withinDeadline: false,
      fractionElapsed: 1,
    };
  }
  const remainingMs = deadline - current;
  return {
    valid: true,
    remainingMs,
    withinDeadline: remainingMs > 0,
    fractionElapsed: (current - startedAt) / total,
  };
}

/**
 * Decide whether to start the next step, given how long it is estimated to take.
 *
 * A safety margin is applied so a step that would finish *just* at the deadline
 * — with no room for the estimate being slightly optimistic — is not started.
 * The margin defaults to 10% of the step estimate, floored at one second.
 */
export function shouldStartStep(
  state: DeadlineState,
  now: Date,
  estimatedStepMs: number,
  marginMs?: number,
): DeadlineDecision {
  if (!Number.isFinite(estimatedStepMs) || estimatedStepMs < 0) {
    return {
      start: false,
      reason:
        "The step has no valid time estimate, so OCADE can't judge whether it fits the deadline.",
      remainingMs: 0,
      shortByMs: 0,
    };
  }

  if (marginMs !== undefined && (!Number.isFinite(marginMs) || marginMs < 0)) {
    return {
      start: false,
      reason: "The deadline safety margin is invalid.",
      remainingMs: 0,
      shortByMs: 0,
    };
  }

  const check = checkDeadline(state, now);
  if (!check.valid) {
    return {
      start: false,
      reason: check.reason ?? "The deadline window is invalid.",
      remainingMs: 0,
      shortByMs: 0,
    };
  }
  const { remainingMs } = check;
  const margin = marginMs ?? Math.max(1000, estimatedStepMs * 0.1);
  const need = estimatedStepMs + margin;
  if (!Number.isSafeInteger(Math.ceil(need))) {
    return {
      start: false,
      reason: "The step time budget exceeds the safe numeric range.",
      remainingMs,
      shortByMs: 0,
    };
  }

  if (remainingMs <= 0) {
    return {
      start: false,
      reason: `The deadline has already passed by ${formatMs(-remainingMs)}. OCADE won't start further steps.`,
      remainingMs,
      shortByMs: need,
    };
  }

  if (need > remainingMs) {
    const shortByMs = need - remainingMs;
    return {
      start: false,
      reason: `This step needs about ${formatMs(estimatedStepMs)} (plus a ${formatMs(margin)} margin) but only ${formatMs(remainingMs)} is left before the deadline — short by ${formatMs(shortByMs)}. OCADE won't start work it can't finish in time; it stops cleanly here instead.`,
      remainingMs,
      shortByMs,
    };
  }

  return {
    start: true,
    reason: `About ${formatMs(remainingMs)} left, enough for this ~${formatMs(estimatedStepMs)} step.`,
    remainingMs,
  };
}

/**
 * Given the remaining steps' estimates, how many will fit before the deadline —
 * so a plan can be trimmed up front rather than stopping mid-run.
 */
export function stepsThatFit(state: DeadlineState, now: Date, stepEstimatesMs: number[]): number {
  const check = checkDeadline(state, now);
  if (
    !check.valid ||
    stepEstimatesMs.some(
      (estimate) =>
        !Number.isFinite(estimate) ||
        estimate < 0 ||
        !Number.isSafeInteger(Math.ceil(estimate * 1.1 + 1000)),
    )
  ) {
    return 0;
  }
  let remaining = check.remainingMs;
  let fit = 0;
  for (const est of stepEstimatesMs) {
    const need = est + Math.max(1000, est * 0.1);
    if (need > remaining) break;
    remaining -= est;
    fit++;
  }
  return fit;
}

function formatMs(ms: number): string {
  const abs = Math.abs(Math.round(ms));
  if (abs < 1000) return `${abs} ms`;
  const s = abs / 1000;
  if (s < 60) return `${s.toFixed(s >= 10 ? 0 : 1)} s`;
  const m = s / 60;
  return `${m.toFixed(m >= 10 ? 0 : 1)} min`;
}

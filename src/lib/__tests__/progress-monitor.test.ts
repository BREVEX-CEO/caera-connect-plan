import { describe, it, expect } from "vitest";
import {
  createProgressState,
  checkProgress,
  describeHalt,
  DEFAULT_PROGRESS_LIMITS,
  type ProgressObservation,
  type ProgressLimits,
} from "../skills/progress-monitor";

/**
 * No-progress detection and loop limits (§8.8, §19.8 "no-progress loops
 * terminate").
 *
 * The control plane already bounded retries for ONE action; nothing bounded the
 * task. These tests pin the four ways a task fails to progress, and — as
 * importantly — that a task which IS progressing is never halted, because a
 * governor that stops real work is worse than none.
 *
 * Everything is deterministic: the monitor has no clock of its own, so a
 * four-hour runaway is reproduced in milliseconds rather than waited for.
 */

const LIMITS: ProgressLimits = {
  maxStalledIterations: 3,
  maxIterations: 10,
  maxElapsedMs: 60_000,
  maxRepeatsOfState: 2,
};

const obs = (over: Partial<ProgressObservation> = {}): ProgressObservation => ({
  iteration: 1,
  completedSteps: 0,
  producedArtifacts: 0,
  verifiedReceipts: 0,
  stateDigest: "state-a",
  elapsedMs: 0,
  ...over,
});

describe("a task that is genuinely progressing is never halted", () => {
  it("continues while steps keep completing", () => {
    const state = createProgressState(LIMITS);
    for (let i = 1; i <= 8; i += 1) {
      const verdict = checkProgress(
        state,
        obs({ iteration: i, completedSteps: i, stateDigest: `state-${i}`, elapsedMs: i * 100 }),
      );
      expect(verdict.action, `iteration ${i}`).toBe("continue");
    }
  });

  it("counts an artifact as progress, not just a completed step", () => {
    const state = createProgressState(LIMITS);
    checkProgress(state, obs({ iteration: 1, stateDigest: "a" }));
    const verdict = checkProgress(
      state,
      obs({ iteration: 2, producedArtifacts: 1, stateDigest: "b" }),
    );
    expect(verdict.action).toBe("continue");
  });

  it("counts a verified receipt as progress", () => {
    const state = createProgressState(LIMITS);
    checkProgress(state, obs({ iteration: 1, stateDigest: "a" }));
    const verdict = checkProgress(
      state,
      obs({ iteration: 2, verifiedReceipts: 1, stateDigest: "b" }),
    );
    expect(verdict.action).toBe("continue");
  });

  it("resets the stall counter as soon as progress resumes", () => {
    const state = createProgressState(LIMITS);
    checkProgress(state, obs({ iteration: 1, stateDigest: "a" }));
    const stalled = checkProgress(state, obs({ iteration: 2, stateDigest: "b" }));
    expect(stalled.action).toBe("warn");

    const resumed = checkProgress(
      state,
      obs({ iteration: 3, completedSteps: 1, stateDigest: "c" }),
    );
    expect(resumed.action).toBe("continue");
    if (resumed.action !== "continue") throw new Error("unreachable");
    expect(resumed.stalledIterations).toBe(0);
  });
});

describe("1. nothing completes", () => {
  it("warns before it halts, so a surface can show the stall", () => {
    const state = createProgressState(LIMITS);
    checkProgress(state, obs({ iteration: 1, stateDigest: "a" }));

    const first = checkProgress(state, obs({ iteration: 2, stateDigest: "b" }));
    expect(first.action).toBe("warn");
    if (first.action !== "warn") throw new Error("unreachable");
    expect(first.reason).toMatch(/1 of 3/);
  });

  it("halts after the allowed number of stalled iterations", () => {
    const state = createProgressState(LIMITS);
    checkProgress(state, obs({ iteration: 1, stateDigest: "a" }));
    checkProgress(state, obs({ iteration: 2, stateDigest: "b" }));
    checkProgress(state, obs({ iteration: 3, stateDigest: "c" }));
    const verdict = checkProgress(state, obs({ iteration: 4, stateDigest: "d" }));

    expect(verdict.action).toBe("halt");
    if (verdict.action !== "halt") throw new Error("unreachable");
    expect(verdict.cause).toBe("no_progress");
    // Partial work must be kept — §8.8 requires partial outputs to survive.
    expect(verdict.reason).toMatch(/work completed so far is kept/i);
  });
});

describe("2. the same state repeats", () => {
  it("halts on a cycle even while the iteration count still rises", () => {
    const state = createProgressState(LIMITS);
    // Progress keeps increasing, so the stall detector would never fire — but
    // returning to the same state cannot produce a new outcome.
    checkProgress(state, obs({ iteration: 1, completedSteps: 1, stateDigest: "loop" }));
    checkProgress(state, obs({ iteration: 2, completedSteps: 2, stateDigest: "loop" }));
    const verdict = checkProgress(
      state,
      obs({ iteration: 3, completedSteps: 3, stateDigest: "loop" }),
    );

    expect(verdict.action).toBe("halt");
    if (verdict.action !== "halt") throw new Error("unreachable");
    expect(verdict.cause).toBe("cycle_detected");
  });

  it("allows a state to recur within the permitted repeat count", () => {
    const state = createProgressState(LIMITS);
    checkProgress(state, obs({ iteration: 1, completedSteps: 1, stateDigest: "x" }));
    const second = checkProgress(state, obs({ iteration: 2, completedSteps: 2, stateDigest: "x" }));
    expect(second.action).toBe("continue");
  });
});

describe("3. too many iterations", () => {
  it("halts at the ceiling even when progress looks healthy", () => {
    const state = createProgressState(LIMITS);
    let verdict = checkProgress(state, obs({ iteration: 1, completedSteps: 1, stateDigest: "s1" }));
    for (let i = 2; i <= 11; i += 1) {
      verdict = checkProgress(
        state,
        obs({ iteration: i, completedSteps: i, stateDigest: `s${i}` }),
      );
    }
    expect(verdict.action).toBe("halt");
    if (verdict.action !== "halt") throw new Error("unreachable");
    expect(verdict.cause).toBe("iteration_limit");
  });
});

describe("4. time runs out", () => {
  it("halts once the wall-clock budget is exceeded", () => {
    const state = createProgressState(LIMITS);
    const verdict = checkProgress(
      state,
      obs({ iteration: 1, completedSteps: 1, stateDigest: "a", elapsedMs: 60_001 }),
    );
    expect(verdict.action).toBe("halt");
    if (verdict.action !== "halt") throw new Error("unreachable");
    expect(verdict.cause).toBe("time_limit");
  });

  it("does not halt exactly at the boundary", () => {
    const state = createProgressState(LIMITS);
    const verdict = checkProgress(
      state,
      obs({ iteration: 1, completedSteps: 1, stateDigest: "a", elapsedMs: 60_000 }),
    );
    expect(verdict.action).toBe("continue");
  });

  it("checks the clock BEFORE granting another iteration", () => {
    // An expired task must not be allowed one more step just because it is
    // otherwise progressing.
    const state = createProgressState(LIMITS);
    const verdict = checkProgress(
      state,
      obs({ iteration: 1, completedSteps: 5, stateDigest: "fresh", elapsedMs: 999_999 }),
    );
    expect(verdict.action).toBe("halt");
  });
});

describe("it refuses to reason about an unreliable observation", () => {
  it("halts when progress moves BACKWARDS", () => {
    const state = createProgressState(LIMITS);
    checkProgress(state, obs({ iteration: 1, completedSteps: 5, stateDigest: "a" }));
    const verdict = checkProgress(
      state,
      obs({ iteration: 2, completedSteps: 2, stateDigest: "b" }),
    );

    expect(verdict.action).toBe("halt");
    if (verdict.action !== "halt") throw new Error("unreachable");
    expect(verdict.cause).toBe("inconsistent_observation");
  });

  it("halts on a repeated or out-of-order iteration number", () => {
    const state = createProgressState(LIMITS);
    checkProgress(state, obs({ iteration: 5, completedSteps: 1, stateDigest: "a" }));
    const verdict = checkProgress(
      state,
      obs({ iteration: 5, completedSteps: 2, stateDigest: "b" }),
    );
    expect(verdict.action).toBe("halt");
  });

  it("halts on a negative elapsed time", () => {
    const state = createProgressState(LIMITS);
    const verdict = checkProgress(state, obs({ iteration: 1, elapsedMs: -1 }));
    expect(verdict.action).toBe("halt");
  });
});

describe("a halt is final", () => {
  it("stays halted when a caller ignores it and asks again", () => {
    const state = createProgressState(LIMITS);
    checkProgress(state, obs({ iteration: 1, stateDigest: "a" }));
    checkProgress(state, obs({ iteration: 2, stateDigest: "b" }));
    checkProgress(state, obs({ iteration: 3, stateDigest: "c" }));
    const halted = checkProgress(state, obs({ iteration: 4, stateDigest: "d" }));
    expect(halted.action).toBe("halt");

    // Ignoring a halt must not buy another iteration, even with real progress.
    const again = checkProgress(
      state,
      obs({ iteration: 5, completedSteps: 99, stateDigest: "new" }),
    );
    expect(again.action).toBe("halt");
    if (again.action !== "halt") throw new Error("unreachable");
    expect(again.cause).toBe("no_progress");
    expect(again.reason).toMatch(/cannot resume without a new plan/i);
  });
});

describe("defaults and descriptions", () => {
  it("ships bounded defaults rather than unlimited ones", () => {
    expect(DEFAULT_PROGRESS_LIMITS.maxIterations).toBeGreaterThan(0);
    expect(DEFAULT_PROGRESS_LIMITS.maxIterations).toBeLessThan(10_000);
    expect(DEFAULT_PROGRESS_LIMITS.maxElapsedMs).toBeGreaterThan(0);
    expect(DEFAULT_PROGRESS_LIMITS.maxStalledIterations).toBeGreaterThan(0);
  });

  it("describes every halt cause in plain language", () => {
    for (const cause of [
      "no_progress",
      "cycle_detected",
      "iteration_limit",
      "time_limit",
      "inconsistent_observation",
    ] as const) {
      const text = describeHalt(cause);
      expect(text).toMatch(/^Halted:/);
      expect(text.length).toBeGreaterThan(20);
    }
  });
});

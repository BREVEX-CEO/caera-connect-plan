import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  HOUR,
  checkLimit,
  emptyLimitState,
  recordUse,
  retryAfterHeader,
  type LimitPolicy,
  type LimitState,
} from "../policy";

/**
 * The limits engine, argued with as arithmetic.
 *
 * "The tightest window wins" and "the warning arrives while there is still time
 * to act" are the sort of claim a comment can make and be wrong about after one
 * edit. Here they are numbers.
 */

const at = (state: LimitState, now: number, cost = 1) => checkLimit(state, { now, cost });

function fill(count: number, now: number, spacingMs = 1000): LimitState {
  let state = emptyLimitState();
  for (let i = 0; i < count; i++) state = recordUse(state, { now: now - (count - i) * spacingMs });
  return state;
}

const NOW = 1_700_000_000_000;

describe("the windows", () => {
  it("nests a session, a day and a rolling day", () => {
    const [burst, day, rolling] = DEFAULT_POLICY.windows;
    expect(burst.durationMs).toBe(5 * HOUR);
    expect(day.durationMs).toBe(8 * HOUR);
    expect(rolling.durationMs).toBe(28 * HOUR);
    // Each window must be roomier than the one inside it, or the outer one can
    // never be the binding constraint and exists for nothing.
    expect(day.quota).toBeGreaterThan(burst.quota);
    expect(rolling.quota).toBeGreaterThan(day.quota);
  });

  it("describes each window in words a person would use", () => {
    for (const window of DEFAULT_POLICY.windows) {
      expect(window.label).not.toMatch(/\d+\s*h\b|window|quota|rolling|ms/i);
    }
  });
});

describe("an ordinary amount of use", () => {
  it("is allowed and says nothing", () => {
    const decision = at(fill(5, NOW), NOW);
    expect(decision.outcome).toBe("allowed");
    expect(decision.message).toBeNull();
    expect(decision.retryAfterSeconds).toBe(0);
  });

  it("reports every window, so a usage screen has something to show", () => {
    const decision = at(fill(5, NOW), NOW);
    expect(decision.windows).toHaveLength(3);
    for (const window of decision.windows) {
      expect(window.utilization).toBeGreaterThan(0);
      expect(window.utilization).toBeLessThanOrEqual(1);
      expect(window.resetsAt).toBeGreaterThan(NOW);
    }
  });
});

describe("running out", () => {
  it("rejects once a window is full", () => {
    const state = fill(DEFAULT_POLICY.windows[0].quota, NOW);
    const decision = at(state, NOW);
    expect(decision.outcome).toBe("rejected");
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("says when, not just no", () => {
    const decision = at(fill(DEFAULT_POLICY.windows[0].quota, NOW), NOW);
    expect(decision.message).toMatch(/Try again/);
    expect(decision.window?.label).toBe("this session");
  });

  it("counts room from the oldest action ageing out, not from the whole window", () => {
    /*
     * The difference between a limit and a ban. Somebody who used their session
     * allowance steadily across the window has a slot opening within seconds —
     * telling them to wait five hours would be false, and is what a
     * reset-the-whole-window implementation would say.
     */
    const window = DEFAULT_POLICY.windows[0];
    // Spread the quota across 99% of the window, so the oldest is inside it but
    // seconds from ageing out. Spreading across 100% would let the oldest fall
    // out already, which is a different (and also correct) answer: allowed.
    const state = fill(window.quota, NOW, Math.floor((window.durationMs * 0.99) / window.quota));
    const decision = at(state, NOW);
    expect(decision.outcome).toBe("rejected");
    // 1% of a five-hour window: three minutes, not five hours.
    expect(decision.retryAfterSeconds).toBeLessThan(5 * 60);
  });

  it("does make a runaway wait, because that is what the limit is for", () => {
    /*
     * The other side of the same rule. A whole session's allowance spent in ten
     * minutes is a loop that got away, not a person working — and the wait it
     * earns is nearly the whole window. That is the intended behaviour, and it
     * is asserted so a later "make retries friendlier" change cannot quietly
     * remove the only protection against a runaway.
     */
    const state = fill(DEFAULT_POLICY.windows[0].quota, NOW, 1000);
    const decision = at(state, NOW);
    expect(decision.outcome).toBe("rejected");
    expect(decision.retryAfterSeconds).toBeGreaterThan(3 * 60 * 60);
  });

  it("reports the window that clears soonest, not the one with the longest wait", () => {
    const policy: LimitPolicy = {
      windows: [
        { id: "burst", durationMs: 1 * HOUR, quota: 2, label: "this session" },
        { id: "rolling", durationMs: 24 * HOUR, quota: 2, label: "the last day" },
      ],
      warnings: {},
    };
    let state = emptyLimitState();
    state = recordUse(state, { now: NOW - 30 * 60 * 1000, policy });
    state = recordUse(state, { now: NOW - 20 * 60 * 1000, policy });
    const decision = checkLimit(state, { now: NOW, policy });
    expect(decision.outcome).toBe("rejected");
    expect(decision.window?.id).toBe("burst");
    expect(decision.retryAfterSeconds).toBeLessThan(60 * 60);
  });

  it("charges an expensive action more than a cheap one", () => {
    const policy: LimitPolicy = {
      windows: [{ id: "burst", durationMs: HOUR, quota: 10, label: "this session" }],
      warnings: {},
    };
    let state = emptyLimitState();
    state = recordUse(state, { now: NOW - 1000, cost: 9, policy });
    expect(checkLimit(state, { now: NOW, cost: 1, policy }).outcome).toBe("allowed");
    expect(checkLimit(state, { now: NOW, cost: 5, policy }).outcome).toBe("rejected");
  });
});

describe("a rolling window, not a bucket that resets on the hour", () => {
  it("does not let a full quota be spent twice across a boundary", () => {
    /*
     * The hole a fixed bucket has: spend everything at 10:59, spend everything
     * again at 11:00. A rolling window costs an array scan and does not.
     */
    const policy: LimitPolicy = {
      windows: [{ id: "burst", durationMs: HOUR, quota: 5, label: "this session" }],
      warnings: {},
    };
    let state = emptyLimitState();
    for (let i = 0; i < 5; i++) state = recordUse(state, { now: NOW - 60_000 + i, policy });
    expect(checkLimit(state, { now: NOW, policy }).outcome).toBe("rejected");
    // An hour and a minute later the whole batch has aged out.
    expect(checkLimit(state, { now: NOW + 61 * 60 * 1000, policy }).outcome).toBe("allowed");
  });

  it("forgets events older than the longest window rather than growing forever", () => {
    let state = emptyLimitState();
    state = recordUse(state, { now: NOW - 40 * HOUR });
    state = recordUse(state, { now: NOW });
    expect(state.events).toHaveLength(1);
  });
});

describe("the early warning", () => {
  it("fires when usage is high AND the window is young", () => {
    /*
     * The donor's rule, and the reason it is worth keeping: 90% used is
     * unremarkable at the end of a window and alarming twenty minutes into one.
     * The warning has to arrive while there is still something to do about it.
     */
    const policy: LimitPolicy = {
      windows: [{ id: "burst", durationMs: 10 * HOUR, quota: 10, label: "this session" }],
      warnings: { burst: [{ utilization: 0.9, timePct: 0.72 }] },
    };
    let state = emptyLimitState();
    for (let i = 0; i < 9; i++) state = recordUse(state, { now: NOW - 60_000 + i, policy });
    const decision = checkLimit(state, { now: NOW, policy });
    expect(decision.outcome).toBe("allowed_warning");
    expect(decision.message).toMatch(/keep working/i);
  });

  it("stays quiet at the same usage when the window is nearly over", () => {
    const policy: LimitPolicy = {
      windows: [{ id: "burst", durationMs: 2 * HOUR, quota: 10, label: "this session" }],
      warnings: { burst: [{ utilization: 0.9, timePct: 0.5 }] },
    };
    let state = emptyLimitState();
    // Oldest action is nearly two hours old, so the window is nearly done.
    for (let i = 0; i < 9; i++)
      state = recordUse(state, { now: NOW - (2 * HOUR - 60_000) + i, policy });
    expect(checkLimit(state, { now: NOW, policy }).outcome).toBe("allowed");
  });

  it("warns without blocking", () => {
    const policy: LimitPolicy = {
      windows: [{ id: "burst", durationMs: 10 * HOUR, quota: 10, label: "this session" }],
      warnings: { burst: [{ utilization: 0.5, timePct: 0.9 }] },
    };
    let state = emptyLimitState();
    for (let i = 0; i < 6; i++) state = recordUse(state, { now: NOW - 60_000 + i, policy });
    const decision = checkLimit(state, { now: NOW, policy });
    expect(decision.outcome).toBe("allowed_warning");
    expect(decision.retryAfterSeconds).toBe(0);
  });
});

describe("what an HTTP endpoint sends back", () => {
  it("sets Retry-After in seconds when it rejects", () => {
    const decision = at(fill(DEFAULT_POLICY.windows[0].quota, NOW), NOW);
    const headers = retryAfterHeader(decision);
    expect(headers["retry-after"]).toMatch(/^\d+$/);
    expect(Number(headers["retry-after"])).toBeGreaterThan(0);
  });

  it("sets no header when nothing is limited", () => {
    expect(retryAfterHeader(at(fill(2, NOW), NOW))).toEqual({});
  });

  it("sends seconds rather than a date, so a wrong clock cannot break the wait", () => {
    const decision = at(fill(DEFAULT_POLICY.windows[0].quota, NOW), NOW);
    expect(retryAfterHeader(decision)["retry-after"]).not.toMatch(/GMT|T\d\d:/);
  });
});

describe("state that arrived from somewhere odd", () => {
  it("clamps utilization when a stored count exceeds a shrunken quota", () => {
    const policy: LimitPolicy = {
      windows: [{ id: "burst", durationMs: HOUR, quota: 2, label: "this session" }],
      warnings: {},
    };
    let state = emptyLimitState();
    for (let i = 0; i < 50; i++) state = recordUse(state, { now: NOW - 1000 + i, policy });
    const decision = checkLimit(state, { now: NOW, policy });
    expect(decision.windows[0].utilization).toBe(1);
  });

  it("treats an empty history as fully available", () => {
    const decision = at(emptyLimitState(), NOW);
    expect(decision.outcome).toBe("allowed");
    expect(decision.windows.every((window) => window.used === 0)).toBe(true);
  });
});

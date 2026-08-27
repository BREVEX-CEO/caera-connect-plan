/**
 * The limit has to survive the tab being closed, and it has to survive the
 * storage it lives in being wrong.
 *
 * A device-local counter is only a limit if it persists — one that resets on
 * reload is a suggestion. And it is only safe if it re-validates what it reads,
 * because a single NaN timestamp from a crash or a clock change makes every
 * later comparison false, which disables the limit silently instead of failing
 * loudly.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { consume, inspect, loadLimitState, saveLimitState } from "../use-limits";
import { DEFAULT_POLICY } from "../policy";

const KEY = "ocade:limits:v1:inference";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
  };
}

let store: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  store = fakeStorage();
  (globalThis as { window?: unknown }).window = { localStorage: store };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("a limit that has to outlive the tab", () => {
  it("writes what it spent, so a reload does not hand back the quota", () => {
    consume("inference", { now: 1_000 });
    consume("inference", { now: 2_000 });

    // Nothing in memory: this is exactly what a fresh page load reads.
    expect(loadLimitState("inference").events).toHaveLength(2);
  });

  it("keeps each bucket's spending separate", () => {
    consume("inference", { now: 1_000 });
    expect(loadLimitState("research").events).toHaveLength(0);
  });

  it("records nothing when it is only being looked at", () => {
    const before = inspect("inference");
    expect(before.outcome).not.toBe("rejected");
    expect(loadLimitState("inference").events).toHaveLength(0);
  });

  it("does not spend the quota on a request it refused", () => {
    const burst = DEFAULT_POLICY.windows[0];
    for (let index = 0; index < burst.quota; index += 1) {
      consume("inference", { now: 1_000 + index });
    }
    const spent = loadLimitState("inference").events.length;

    const refused = consume("inference", { now: 1_000 + burst.quota });
    expect(refused.outcome).toBe("rejected");
    expect(loadLimitState("inference").events).toHaveLength(spent);
  });

  it("carries the wait across a reload rather than starting the window again", () => {
    const burst = DEFAULT_POLICY.windows[0];
    for (let index = 0; index < burst.quota; index += 1) {
      consume("inference", { now: 1_000 + index });
    }
    /*
     * A brand-new page reading the same storage refuses the same next action.
     * Asked with `dryRun`, because the question is "would this be allowed" —
     * `inspect` asks about a zero-cost action, which is never refused and is
     * the right answer to a different question (what a usage screen shows).
     */
    const afterReload = consume("inference", { now: 1_000 + burst.quota, dryRun: true });
    expect(afterReload.outcome).toBe("rejected");
    expect(afterReload.retryAfterSeconds).toBeGreaterThan(0);

    // And the usage screen sees a full window rather than a fresh one.
    const shown = inspect("inference", 1_000 + burst.quota);
    expect(shown.windows[0].used).toBe(burst.quota);
  });
});

describe("storage that cannot be trusted", () => {
  it("ignores a corrupt record instead of disabling the limit", () => {
    store.map.set(KEY, "{not json");
    expect(loadLimitState("inference").events).toEqual([]);
  });

  it("drops events with an unusable timestamp or cost", () => {
    store.map.set(
      KEY,
      JSON.stringify({
        events: [
          { at: Number.NaN, cost: 1 },
          { at: 1_000, cost: Number.POSITIVE_INFINITY },
          { at: 2_000, cost: 1 },
        ],
      }),
    );
    expect(loadLimitState("inference").events).toEqual([{ at: 2_000, cost: 1 }]);
  });

  it("caps an absurd cost rather than trusting what was stored", () => {
    store.map.set(KEY, JSON.stringify({ events: [{ at: 1_000, cost: 10_000_000 }] }));
    expect(loadLimitState("inference").events[0].cost).toBe(1_000);
  });

  it("treats a missing events array as no history", () => {
    store.map.set(KEY, JSON.stringify({ events: "all of them" }));
    expect(loadLimitState("inference").events).toEqual([]);
  });

  it("works at all with no storage — a private window still gets its work done", () => {
    delete (globalThis as { window?: unknown }).window;
    expect(loadLimitState("inference").events).toEqual([]);
    expect(() => saveLimitState("inference", { events: [{ at: 1, cost: 1 }] })).not.toThrow();
    expect(consume("inference", { now: 1_000 }).outcome).not.toBe("rejected");
  });
});

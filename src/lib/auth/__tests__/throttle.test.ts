import { vi } from "vitest";
import { describe, expect, it } from "vitest";
import {
  delayAfter,
  describeWait,
  emptyThrottle,
  loadThrottle,
  recordFailure,
  recordSuccess,
  saveThrottle,
  secondsUntilAllowed,
  throttleKey,
} from "../throttle";

describe("the backoff curve", () => {
  it("costs a typo nothing", () => {
    expect(delayAfter(0)).toBe(0);
    expect(delayAfter(1)).toBe(0);
    expect(delayAfter(2)).toBe(0);
  });

  it("doubles from one second once the free attempts are used", () => {
    expect(delayAfter(3)).toBe(1);
    expect(delayAfter(4)).toBe(2);
    expect(delayAfter(5)).toBe(4);
    expect(delayAfter(6)).toBe(8);
  });

  it("caps at five minutes rather than growing without bound", () => {
    expect(delayAfter(20)).toBe(300);
    expect(delayAfter(1000)).toBe(300);
  });

  it("makes a hundred guesses cost hours rather than seconds", () => {
    let total = 0;
    for (let attempt = 1; attempt <= 100; attempt++) total += delayAfter(attempt);
    expect(total).toBeGreaterThan(60 * 60 * 6);
  });
});

describe("waiting", () => {
  const at = (failures: number, lastFailureAt: number) => ({ failures, lastFailureAt });

  it("counts down and then allows the attempt", () => {
    const state = at(4, 1_000_000);
    expect(secondsUntilAllowed(state, 1_000_000)).toBe(2);
    expect(secondsUntilAllowed(state, 1_001_000)).toBe(1);
    expect(secondsUntilAllowed(state, 1_002_000)).toBe(0);
  });

  it("does not grant free attempts to a clock that moved backwards", () => {
    // A timestamp in the future would otherwise produce a negative elapsed time
    // and read as "the wait is over" — which is a free retry for anyone who can
    // change their own clock.
    expect(secondsUntilAllowed(at(6, 5_000_000), 1_000_000)).toBe(8);
  });

  it("never asks for longer than the cap, whatever is stored", () => {
    expect(secondsUntilAllowed(at(64, 1_000_000), 1_000_000)).toBe(300);
  });
});

describe("recording", () => {
  it("accumulates failures", () => {
    let state = emptyThrottle();
    state = recordFailure(state, 1000);
    state = recordFailure(state, 2000);
    expect(state.failures).toBe(2);
    expect(state.lastFailureAt).toBe(2000);
  });

  it("a success clears the history", () => {
    const state = recordFailure(recordFailure(emptyThrottle(), 1000), 2000);
    expect(recordSuccess().failures).toBe(0);
    expect(state.failures).toBe(2);
  });
});

describe("what the person is told", () => {
  it("says how long, without saying how many attempts remain", () => {
    expect(describeWait(1)).toBe("Try again in 1 second.");
    expect(describeWait(8)).toBe("Try again in 8 seconds.");
    expect(describeWait(300)).toBe("Try again in about 5 minutes.");
    for (const seconds of [1, 8, 60, 300]) {
      expect(describeWait(seconds)).not.toMatch(/attempt|remaining|left|account|exists/i);
    }
  });

  it("says nothing at all when there is no wait", () => {
    expect(describeWait(0)).toBe("");
  });
});

describe("storage", () => {
  it("keys per action and per identifier, so one address does not lock another", () => {
    expect(throttleKey("otp_verify", "a@example.com")).not.toBe(
      throttleKey("otp_verify", "b@example.com"),
    );
    expect(throttleKey("otp_verify", "a@example.com")).not.toBe(
      throttleKey("password_signin", "a@example.com"),
    );
  });

  it("treats an address case-insensitively, as the provider does", () => {
    expect(throttleKey("otp_verify", "A@Example.com ")).toBe(
      throttleKey("otp_verify", "a@example.com"),
    );
  });

  it("does not store the address in readable form", () => {
    expect(throttleKey("otp_verify", "someone@example.com")).not.toContain("someone");
    expect(throttleKey("otp_verify", "someone@example.com")).not.toContain("example.com");
  });

  it("round-trips through storage and clears on success", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    });
    saveThrottle("otp_verify", "a@example.com", { failures: 4, lastFailureAt: 1000 });
    expect(loadThrottle("otp_verify", "a@example.com")).toEqual({
      failures: 4,
      lastFailureAt: 1000,
    });
    saveThrottle("otp_verify", "a@example.com", recordSuccess());
    expect(loadThrottle("otp_verify", "a@example.com").failures).toBe(0);
    vi.unstubAllGlobals();
  });

  it("survives corrupt stored data without locking anyone out", () => {
    const store = new Map<string, string>([
      [throttleKey("otp_verify", "a@example.com"), "{not json"],
    ]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: () => {},
        removeItem: () => {},
      },
    });
    expect(loadThrottle("otp_verify", "a@example.com")).toEqual(emptyThrottle());
    vi.unstubAllGlobals();
  });

  it("clamps an absurd stored failure count", () => {
    const store = new Map<string, string>([
      [throttleKey("otp_verify", "a@example.com"), JSON.stringify({ failures: 1e9 })],
    ]);
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: () => {},
        removeItem: () => {},
      },
    });
    expect(loadThrottle("otp_verify", "a@example.com").failures).toBe(64);
    vi.unstubAllGlobals();
  });
});

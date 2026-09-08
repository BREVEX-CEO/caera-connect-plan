import { describe, expect, it } from "vitest";
import {
  formatRemaining,
  formatTimeUntil,
  hasTrustedClockStorage,
  observeNow,
} from "@/lib/time/trusted-clock";

/** A durable store standing in for `localStorage`. */
function memoryStore(): Pick<Storage, "getItem" | "setItem"> & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
}

/** A store that refuses to write, as private browsing can. */
function readOnlyStore(): Pick<Storage, "getItem" | "setItem"> {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage is unavailable");
    },
  };
}

describe("the trusted clock", () => {
  it("reports the clock unchanged while it only moves forward", () => {
    const store = memoryStore();
    expect(observeNow(1_000, store)).toBe(1_000);
    expect(observeNow(2_000, store)).toBe(2_000);
    expect(observeNow(3_000, store)).toBe(3_000);
  });

  it("refuses a clock that moved backwards", () => {
    const store = memoryStore();
    observeNow(10_000_000, store);
    expect(observeNow(10_000_000 - 20 * 60_000, store)).toBe(10_000_000);
  });

  it("keeps refusing it, so rolling back repeatedly buys nothing", () => {
    const store = memoryStore();
    observeNow(5_000_000, store);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(observeNow(1_000, store)).toBe(5_000_000);
    }
    // And the mark is unchanged, so a later honest reading still advances.
    expect(observeNow(6_000_000, store)).toBe(6_000_000);
  });

  it("accepts a clock that jumped forward, because a shut laptop looks the same", () => {
    const store = memoryStore();
    observeNow(1_000, store);
    expect(observeNow(1_000 + 60 * 60_000, store)).toBe(1_000 + 60 * 60_000);
    // Permanently: the jump cannot be undone by winding back.
    expect(observeNow(1_000, store)).toBe(1_000 + 60 * 60_000);
  });

  it("persists the mark across readers, not just within one call", () => {
    const store = memoryStore();
    observeNow(9_000, store);
    const second = { getItem: store.getItem, setItem: store.setItem };
    expect(observeNow(4_000, second)).toBe(9_000);
  });

  it("uses the clock as given when there is nothing to remember with", () => {
    // No bound is possible, so no bound is claimed. Callers that need one ask
    // `hasTrustedClockStorage` and fail closed themselves.
    expect(observeNow(1_000, readOnlyStore())).toBe(1_000);
    expect(hasTrustedClockStorage(readOnlyStore())).toBe(false);
    expect(hasTrustedClockStorage(memoryStore())).toBe(true);
  });

  it("does not lose an existing mark when asked whether storage works", () => {
    const store = memoryStore();
    observeNow(7_000, store);
    expect(hasTrustedClockStorage(store)).toBe(true);
    expect(observeNow(1_000, store)).toBe(7_000);
  });
});

describe("durations as a person reads them", () => {
  it("counts a future instant down in hours and minutes", () => {
    const now = 0;
    expect(formatTimeUntil(null, now)).toBe("now");
    expect(formatTimeUntil(-1, now)).toBe("now");
    expect(formatTimeUntil(60_000, now)).toBe("1 minute");
    expect(formatTimeUntil(2 * 60_000, now)).toBe("2 minutes");
    expect(formatTimeUntil(60 * 60_000, now)).toBe("1 hour");
    expect(formatTimeUntil(90 * 60_000, now)).toBe("1 hour 30 minutes");
    expect(formatTimeUntil(2 * 60 * 60_000, now)).toBe("2 hours");
  });

  it("shows seconds only once the end is close", () => {
    expect(formatRemaining(20 * 60_000)).toBe("20 min left");
    expect(formatRemaining(10 * 60_000)).toBe("10 min left");
    expect(formatRemaining(9 * 60_000 + 30_000)).toBe("9:30 left");
    expect(formatRemaining(65_000)).toBe("1:05 left");
    expect(formatRemaining(0)).toBe("0:00 left");
    expect(formatRemaining(-5_000)).toBe("0:00 left");
  });
});

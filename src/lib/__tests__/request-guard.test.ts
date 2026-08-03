import { describe, it, expect, vi } from "vitest";
import {
  SingleFlight,
  TtlCache,
  withTimeout,
  abortable,
  guardedRead,
  isAbortError,
  isTimeoutError,
  RequestTimeoutError,
} from "../request-guard";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SingleFlight", () => {
  it("coalesces concurrent calls into ONE underlying call", async () => {
    const flight = new SingleFlight();
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);

    const a = flight.run("k", fn);
    const b = flight.run("k", fn);
    const c = flight.run("k", fn);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(flight.size).toBe(1);

    d.resolve("value");
    await expect(Promise.all([a, b, c])).resolves.toEqual(["value", "value", "value"]);
  });

  it("releases the key after settling so the next call runs fresh", async () => {
    const flight = new SingleFlight();
    const fn = vi.fn(async () => "x");
    await flight.run("k", fn);
    expect(flight.has("k")).toBe(false);
    await flight.run("k", fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("keeps different keys independent", async () => {
    const flight = new SingleFlight();
    const fn = vi.fn(async () => "x");
    await Promise.all([flight.run("a", fn), flight.run("b", fn)]);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("releases the key when the call REJECTS, and shares the rejection", async () => {
    const flight = new SingleFlight();
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);
    const a = flight.run("k", fn);
    const b = flight.run("k", fn);
    d.reject(new Error("boom"));
    await expect(a).rejects.toThrow("boom");
    await expect(b).rejects.toThrow("boom");
    expect(flight.has("k")).toBe(false);
  });

  it("does not let an older cleared call evict a newer call with the same key", async () => {
    const flight = new SingleFlight();
    const old = deferred<string>();
    const current = deferred<string>();

    const first = flight.run("k", () => old.promise);
    flight.clear();
    const second = flight.run("k", () => current.promise);

    old.resolve("old");
    await expect(first).resolves.toBe("old");
    expect(flight.has("k")).toBe(true);

    current.resolve("current");
    await expect(second).resolves.toBe("current");
    expect(flight.has("k")).toBe(false);
  });

  it("refuses malformed keys and unique work past its in-flight capacity", async () => {
    const flight = new SingleFlight(1);
    const active = deferred<string>();
    const first = flight.run("one", () => active.promise);

    await expect(flight.run("   ", async () => "invalid")).rejects.toThrow(/key/i);
    await expect(flight.run("two", async () => "overflow")).rejects.toThrow(/capacity/i);

    active.resolve("done");
    await first;
  });
});

describe("withTimeout", () => {
  it("resolves normally when fast enough", async () => {
    await expect(withTimeout(Promise.resolve(7), 1000)).resolves.toBe(7);
  });

  it("rejects with a typed timeout error when the budget elapses", async () => {
    vi.useFakeTimers();
    const never = new Promise<number>(() => {});
    const p = withTimeout(never, 50);
    const assertion = expect(p).rejects.toBeInstanceOf(RequestTimeoutError);
    await vi.advanceTimersByTimeAsync(60);
    await assertion;
    vi.useRealTimers();
  });

  it("refuses a non-positive or non-finite budget instead of silently disabling the timeout", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 0)).rejects.toThrow(/timeout budget/i);
    await expect(withTimeout(Promise.resolve("ok"), Number.POSITIVE_INFINITY)).rejects.toThrow(
      /timeout budget/i,
    );
  });

  it("isTimeoutError recognises it", () => {
    expect(isTimeoutError(new RequestTimeoutError(5))).toBe(true);
    expect(isTimeoutError(new Error("other"))).toBe(false);
  });
});

describe("abortable", () => {
  it("fails fast when the signal is already aborted", async () => {
    const ctrl = new AbortController();
    ctrl.abort();
    const fn = vi.fn(async () => "never");
    await expect(abortable(ctrl.signal, fn)).rejects.toSatisfy(isAbortError);
    expect(fn).not.toHaveBeenCalled();
  });

  it("rejects promptly when aborted mid-flight", async () => {
    const ctrl = new AbortController();
    const p = abortable(ctrl.signal, () => new Promise<string>(() => {}));
    ctrl.abort();
    await expect(p).rejects.toSatisfy(isAbortError);
  });

  it("runs normally without a signal", async () => {
    await expect(abortable(undefined, async () => "ok")).resolves.toBe("ok");
  });

  it("isAbortError only matches abort errors", () => {
    const e = new Error("x");
    e.name = "AbortError";
    expect(isAbortError(e)).toBe(true);
    expect(isAbortError(new Error("plain"))).toBe(false);
  });
});

describe("TtlCache", () => {
  it("refuses invalid expiry and capacity settings", () => {
    expect(() => new TtlCache<string>(0)).toThrow(/ttl/i);
    expect(() => new TtlCache<string>(1000, 0)).toThrow(/capacity/i);
  });

  it("returns a value before expiry and drops it after", () => {
    const c = new TtlCache<string>(1000);
    c.set("k", "v", 0);
    expect(c.get("k", 500)).toBe("v");
    expect(c.get("k", 1500)).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it("evicts the least recently used entry past the cap", () => {
    const c = new TtlCache<number>(10_000, 2);
    c.set("a", 1, 0);
    c.set("b", 2, 0);
    c.get("a", 1); // refresh a → b is now least recent
    c.set("c", 3, 1);
    expect(c.size).toBe(2);
    expect(c.get("b", 1)).toBeUndefined();
    expect(c.get("a", 1)).toBe(1);
  });
});

describe("guardedRead", () => {
  it("serves from cache without calling the function", async () => {
    const cache = new TtlCache<string>(1000);
    cache.set("k", "cached");
    const fn = vi.fn(async () => "fresh");
    await expect(guardedRead({ key: "k", fn, cache })).resolves.toBe("cached");
    expect(fn).not.toHaveBeenCalled();
  });

  it("de-duplicates and then caches the result", async () => {
    const cache = new TtlCache<string>(1000);
    const flight = new SingleFlight();
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);

    const a = guardedRead({ key: "k", fn, cache, flight });
    const b = guardedRead({ key: "k", fn, cache, flight });
    expect(fn).toHaveBeenCalledTimes(1);

    d.resolve("value");
    await Promise.all([a, b]);
    expect(cache.get("k")).toBe("value");
  });
});

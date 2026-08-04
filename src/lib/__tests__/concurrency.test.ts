import { describe, it, expect } from "vitest";
import { SingleFlight, Limiter, mapWithConcurrency } from "../skills/concurrency";

/** A deferred promise, so tests control exactly when async work settles. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("SingleFlight deduplicates in-flight work", () => {
  it("runs one operation for concurrent calls with the same key", async () => {
    const sf = new SingleFlight<number>();
    let calls = 0;
    const d = deferred<number>();
    const fn = () => {
      calls++;
      return d.promise;
    };

    const a = sf.run("k", fn);
    const b = sf.run("k", fn);
    const c = sf.run("k", fn);
    expect(calls).toBe(1); // coalesced
    expect(sf.size).toBe(1);

    d.resolve(42);
    expect(await a).toBe(42);
    expect(await b).toBe(42);
    expect(await c).toBe(42);
  });

  it("runs different keys independently", async () => {
    const sf = new SingleFlight<string>();
    let calls = 0;
    const fn = (v: string) => () => {
      calls++;
      return Promise.resolve(v);
    };
    const [a, b] = await Promise.all([sf.run("x", fn("x")), sf.run("y", fn("y"))]);
    expect([a, b]).toEqual(["x", "y"]);
    expect(calls).toBe(2);
  });

  /**
   * A key must be freed on settle so a genuinely later call starts fresh — not
   * join a promise that already resolved.
   */
  it("frees the key after it settles, so a later call re-runs", async () => {
    const sf = new SingleFlight<number>();
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.resolve(calls);
    };

    expect(await sf.run("k", fn)).toBe(1);
    expect(sf.size).toBe(0); // freed
    expect(await sf.run("k", fn)).toBe(2); // a real second run
    expect(calls).toBe(2);
  });

  /**
   * The wedge case: a coalesced failure must reject every waiter AND free the
   * key. A dedup that cached a failure forever would break the key permanently.
   */
  it("propagates a rejection to all waiters and frees the key for retry", async () => {
    const sf = new SingleFlight<number>();
    const d = deferred<number>();
    let calls = 0;
    const failing = () => {
      calls++;
      return d.promise;
    };

    const a = sf.run("k", failing);
    const b = sf.run("k", failing);
    expect(calls).toBe(1);

    d.reject(new Error("boom"));
    await expect(a).rejects.toThrow("boom");
    await expect(b).rejects.toThrow("boom");
    expect(sf.size).toBe(0); // freed despite failure

    // A retry genuinely re-runs — same counter, so a fresh execution is proven.
    const ok = await sf.run("k", () => {
      calls++;
      return Promise.resolve(99);
    });
    expect(ok).toBe(99);
    expect(calls).toBe(2);
  });
});

describe("Limiter caps concurrency and applies backpressure", () => {
  it("never runs more than the limit at once", async () => {
    const limiter = new Limiter(2);
    const deferreds = Array.from({ length: 5 }, () => deferred<void>());
    let peak = 0;
    let active = 0;

    const runs = deferreds.map((d, i) =>
      limiter.run(async () => {
        active++;
        peak = Math.max(peak, active);
        await d.promise;
        active--;
        return i;
      }),
    );

    // Only 2 should be running; 3 queued.
    await Promise.resolve();
    expect(limiter.active).toBe(2);
    expect(limiter.waiting).toBe(3);

    // Release them one at a time; peak must never exceed 2.
    for (const d of deferreds) {
      d.resolve();
      await Promise.resolve();
    }
    await Promise.all(runs);
    expect(peak).toBe(2);
  });

  it("runs work in submission order (FIFO), so a burst can't starve arrivals", async () => {
    const limiter = new Limiter(1);
    const order: number[] = [];
    const runs = [0, 1, 2, 3].map((i) => limiter.run(async () => void order.push(i)));
    await Promise.all(runs);
    expect(order).toEqual([0, 1, 2, 3]);
  });

  /**
   * A rejected operation must free its slot exactly like a success, or the pool
   * shrinks permanently on the first error.
   */
  it("frees a slot when an operation rejects", async () => {
    const limiter = new Limiter(1);
    await expect(limiter.run(() => Promise.reject(new Error("x")))).rejects.toThrow("x");
    // The slot is back; the next op runs.
    expect(await limiter.run(() => Promise.resolve("ok"))).toBe("ok");
    expect(limiter.active).toBe(0);
  });

  it("rejects an invalid concurrency", () => {
    expect(() => new Limiter(0)).toThrow();
    expect(() => new Limiter(-1)).toThrow();
    expect(() => new Limiter(1.5)).toThrow();
  });

  it("bounds the waiting queue and rejects excess work with backpressure", async () => {
    const limiter = new Limiter(1, 1);
    const active = deferred<void>();
    const first = limiter.run(async () => {
      await active.promise;
      return 1;
    });
    const second = limiter.run(async () => 2);
    const third = limiter.run(async () => 3);

    await Promise.resolve();
    expect(limiter.waiting).toBe(1);
    active.resolve();
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    await expect(third).rejects.toThrow(/backpressure|queue.*full/i);
  });

  it("removes cancelled work from the waiting queue before it starts", async () => {
    const limiter = new Limiter(1);
    const active = deferred<void>();
    const first = limiter.run(async () => active.promise);
    const controller = new AbortController();
    let started = false;
    const waiting = limiter.run(async () => {
      started = true;
    }, controller.signal);

    controller.abort();
    active.resolve();
    await first;
    await expect(waiting).rejects.toMatchObject({ name: "AbortError" });
    expect(started).toBe(false);
    expect(limiter.waiting).toBe(0);
  });
});

describe("mapWithConcurrency", () => {
  it("collects results in input order regardless of finish order", async () => {
    const out = await mapWithConcurrency([30, 10, 20], 2, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it("bounds concurrency across the whole batch", async () => {
    let active = 0;
    let peak = 0;
    await mapWithConcurrency(
      Array.from({ length: 10 }, (_, i) => i),
      3,
      async () => {
        active++;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active--;
      },
    );
    expect(peak).toBeLessThanOrEqual(3);
  });

  /**
   * A failed read must surface, not be silently dropped — otherwise partial
   * data reads as complete.
   */
  it("rejects if any operation rejects rather than hiding it", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("read failed");
        return n;
      }),
    ).rejects.toThrow("read failed");
  });

  it("refuses a batch past the explicit item budget before starting work", async () => {
    let calls = 0;
    await expect(
      mapWithConcurrency(
        [1, 2, 3],
        2,
        async (n) => {
          calls++;
          return n;
        },
        { maxItems: 2 },
      ),
    ).rejects.toThrow(/item budget/i);
    expect(calls).toBe(0);
  });
});

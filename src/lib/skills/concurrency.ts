/**
 * OCADE concurrency primitives (master plan §21 request deduplication &
 * backpressure, §18 concurrency control, §8.3 safe parallel reads).
 *
 * Two small, exact tools the orchestrator needs so that "do these in parallel"
 * and "don't hammer the same thing twice" are guarantees, not hopes:
 *
 *  - `SingleFlight` coalesces concurrent calls that share a key into ONE
 *    in-flight operation. Fire the same read five times before the first
 *    returns, and it runs once; all five get that one result. This is request
 *    deduplication (§21).
 *
 *  - `Limiter` caps how many operations run at once and queues the rest. It is
 *    backpressure and concurrency control (§21, §18): a hundred queued reads
 *    never become a hundred simultaneous ones.
 *
 * THE CORRECTNESS RULE that both must honour: a failure is never swallowed and
 * never leaks a slot. If a coalesced call rejects, every waiter sees the
 * rejection AND the key is freed so a later call can genuinely retry — a dedup
 * that cached a failure forever, or a limiter that lost a slot on error, would
 * wedge the whole system quietly. These are the cases the tests target.
 */

/**
 * Coalesces concurrent calls with the same key into a single operation.
 *
 * Deliberately does NOT cache completed results — it deduplicates work that is
 * IN FLIGHT, nothing more. Result caching with expiry is a different concern
 * (see the research cache) and conflating them here would serve a stale value
 * to a call that wanted a fresh one.
 */
export class SingleFlight<T> {
  private inFlight = new Map<string, Promise<T>>();

  /** Number of operations currently running. Exposed for tests/metrics. */
  get size(): number {
    return this.inFlight.size;
  }

  /**
   * Run `fn` for `key`, or join the in-flight call if one exists.
   *
   * The slot is cleared when the promise settles — success OR failure — so the
   * next call for the same key starts fresh rather than joining a dead promise.
   */
  run(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    // Start the work, then clear the slot on settle. `finally` runs on both
    // resolve and reject, which is what frees a failed key for retry.
    const promise = (async () => fn())().finally(() => {
      // Only delete if it's still THIS promise — a slot cleared and refilled by
      // a later call must not be wiped by an earlier one settling.
      if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }
}

/**
 * Runs at most `maxConcurrent` operations at once; the rest wait in order.
 *
 * FIFO: queued work runs in the order it was submitted, so a burst can't starve
 * the first arrivals. A rejected operation frees its slot exactly like a
 * successful one, so one failure can't permanently shrink the pool.
 */
export class Limiter {
  private running = 0;
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    signal?: AbortSignal;
    onAbort?: () => void;
  }> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueued: number = 1_000,
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      throw new Error("Limiter needs a concurrency of at least 1.");
    }
    if (!Number.isInteger(maxQueued) || maxQueued < 0) {
      throw new Error("Limiter queue capacity must be a non-negative integer.");
    }
  }

  /** How many are running right now. */
  get active(): number {
    return this.running;
  }

  /** How many are waiting for a slot. */
  get waiting(): number {
    return this.queue.length;
  }

  /**
   * Acquire a slot (waiting if full), run `fn`, and release the slot whatever
   * happens. The result — or rejection — is passed straight through.
   */
  async run<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    await this.acquire(signal);
    if (signal?.aborted) {
      this.release();
      throw abortError();
    }
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(abortError());
    if (this.running < this.maxConcurrent) {
      this.running++;
      return Promise.resolve();
    }
    if (this.queue.length >= this.maxQueued) {
      return Promise.reject(
        new Error(
          `Limiter backpressure: the waiting queue is full at ${this.maxQueued} operation(s).`,
        ),
      );
    }

    return new Promise<void>((resolve, reject) => {
      const entry: (typeof this.queue)[number] = { resolve, reject, signal };
      if (signal) {
        entry.onAbort = () => {
          const index = this.queue.indexOf(entry);
          if (index >= 0) this.queue.splice(index, 1);
          reject(abortError());
        };
        signal.addEventListener("abort", entry.onAbort, { once: true });
      }
      this.queue.push(entry);
    });
  }

  private release(): void {
    this.running--;
    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) return;
      if (next.onAbort) next.signal?.removeEventListener("abort", next.onAbort);
      if (next.signal?.aborted) {
        next.reject(abortError());
        continue;
      }
      this.running++;
      next.resolve();
      return;
    }
  }
}

function abortError(): Error {
  const error = new Error("Cancelled before a concurrency slot became available.");
  error.name = "AbortError";
  return error;
}

/**
 * Run many operations with bounded concurrency, collecting every result in
 * input order.
 *
 * Uses a `Limiter`, so at most `maxConcurrent` run at once. A rejection is
 * surfaced (the returned promise rejects) rather than hidden — a "parallel
 * reads" helper that silently dropped a failed read would report partial data
 * as complete.
 */
export async function mapWithConcurrency<I, O>(
  items: I[],
  maxConcurrent: number,
  fn: (item: I, index: number) => Promise<O>,
  options: { maxItems?: number; signal?: AbortSignal } = {},
): Promise<O[]> {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error("A concurrency of at least 1 is required.");
  }
  const maxItems = options.maxItems ?? 10_000;
  if (!Number.isInteger(maxItems) || maxItems < 0) {
    throw new Error("The item budget must be a non-negative integer.");
  }
  if (items.length > maxItems) {
    throw new Error(`The batch exceeds its ${maxItems}-item budget.`);
  }
  if (options.signal?.aborted) throw abortError();

  const results = new Array<O>(items.length);
  let cursor = 0;
  let stopped = false;
  const worker = async (): Promise<void> => {
    while (!stopped) {
      if (options.signal?.aborted) {
        stopped = true;
        throw abortError();
      }
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = await fn(items[index], index);
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
  };

  const workerCount = Math.min(maxConcurrent, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

/**
 * Request hardening (Plan §39).
 *
 * Three problems this solves, all of which cause real user-visible damage:
 *  1. DUPLICATE REQUESTS — a panel that mounts twice, or a user double-clicking,
 *     fires the same call repeatedly. `singleFlight` coalesces concurrent
 *     identical calls into one.
 *  2. HANGS — a call that never settles leaves a spinner forever.
 *     `withTimeout` bounds it and reports honestly.
 *  3. LEAKS — a component unmounts while a call is in flight and then sets
 *     state. `abortable` + `isAbortError` make cancellation explicit.
 *
 * Pure and dependency-free so it is unit-testable without a DOM.
 */

/** Error thrown when a guarded call exceeds its budget. */
export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`This took longer than ${ms}ms and was stopped.`);
    this.name = "RequestTimeoutError";
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && (e.name === "AbortError" || e.name === "CanceledError");
}

export function isTimeoutError(e: unknown): boolean {
  return e instanceof RequestTimeoutError;
}

/* --------------------------------------------------------- single flight -- */

type Pending<T> = { promise: Promise<T>; startedAt: number };
const DEFAULT_MAX_INFLIGHT = 100;
const MAX_REQUEST_KEY_CHARACTERS = 256;

function validRequestKey(key: string): boolean {
  return (
    typeof key === "string" && key.trim().length > 0 && key.length <= MAX_REQUEST_KEY_CHARACTERS
  );
}

/**
 * Coalesces concurrent calls sharing a key into ONE underlying call.
 *
 * Deliberately does not cache results: once a call settles the key is released,
 * so the next call runs fresh. This removes duplicate work without introducing
 * stale data.
 */
export class SingleFlight {
  private inflight = new Map<string, Pending<unknown>>();

  constructor(private readonly maxInflight: number = DEFAULT_MAX_INFLIGHT) {
    if (!Number.isInteger(maxInflight) || maxInflight < 1) {
      throw new Error("Single-flight capacity must be a positive integer.");
    }
  }

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!validRequestKey(key)) {
      return Promise.reject(
        new Error(`A request key must contain 1-${MAX_REQUEST_KEY_CHARACTERS} characters.`),
      );
    }
    const existing = this.inflight.get(key) as Pending<T> | undefined;
    if (existing) return existing.promise;
    if (this.inflight.size >= this.maxInflight) {
      return Promise.reject(
        new Error(
          `Single-flight capacity (${this.maxInflight}) is full; apply backpressure before starting more unique work.`,
        ),
      );
    }

    const promise = (async () => fn())().finally(() => {
      const current = this.inflight.get(key);
      if (current?.promise === promise) this.inflight.delete(key);
    });

    this.inflight.set(key, { promise, startedAt: Date.now() } as Pending<unknown>);
    return promise;
  }

  /** How many calls are currently in flight (used in tests and diagnostics). */
  get size(): number {
    return this.inflight.size;
  }

  has(key: string): boolean {
    return this.inflight.has(key);
  }

  clear(): void {
    this.inflight.clear();
  }
}

export const globalSingleFlight = new SingleFlight();

export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return globalSingleFlight.run(key, fn);
}

/* ---------------------------------------------------------------- timeout -- */

/**
 * Bound a promise. Rejects with RequestTimeoutError if the budget elapses.
 * The timer is always cleared, so a fast success leaves nothing pending.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) {
    return Promise.reject(
      new Error("The request timeout budget must be a positive finite number."),
    );
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new RequestTimeoutError(ms)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}

/* ------------------------------------------------------------- abortable -- */

/**
 * Wrap a signal-aware call so an already-aborted signal fails fast and a later
 * abort rejects promptly rather than leaving the caller hanging.
 */
export function abortable<T>(
  signal: AbortSignal | undefined,
  fn: (s?: AbortSignal) => Promise<T>,
): Promise<T> {
  if (!signal) return fn();
  if (signal.aborted) return Promise.reject(makeAbortError());

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(makeAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    fn(signal)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

function makeAbortError(): Error {
  const e = new Error("Cancelled.");
  e.name = "AbortError";
  return e;
}

/* ------------------------------------------------------------- TTL cache -- */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Small bounded cache for READ-ONLY lookups (capability probes, device lists).
 * Bounded size prevents unbounded growth; entries expire so data can't go stale
 * indefinitely. Never used for anything the user mutates.
 */
export class TtlCache<T> {
  private map = new Map<string, Entry<T>>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs: number, maxEntries = 50) {
    if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) {
      throw new Error("Cache TTL must be a positive safe integer.");
    }
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new Error("Cache capacity must be a positive integer.");
    }
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string, now: number = Date.now()): T | undefined {
    this.assertKeyAndClock(key, now);
    const hit = this.map.get(key);
    if (!hit) return undefined;
    if (now >= hit.expiresAt) {
      this.map.delete(key);
      return undefined;
    }
    // Refresh recency for a simple LRU eviction order.
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }

  set(key: string, value: T, now: number = Date.now()): void {
    this.assertKeyAndClock(key, now);
    const expiresAt = now + this.ttlMs;
    if (!Number.isSafeInteger(expiresAt)) {
      throw new Error("Cache expiry exceeds the safe clock range.");
    }
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { value, expiresAt });
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  private assertKeyAndClock(key: string, now: number): void {
    if (!validRequestKey(key)) {
      throw new Error(`A cache key must contain 1-${MAX_REQUEST_KEY_CHARACTERS} characters.`);
    }
    if (!Number.isSafeInteger(now) || now < 0) {
      throw new Error("Cache time must be a non-negative safe integer.");
    }
  }
}

/**
 * Convenience: de-duplicated, timed-out, optionally cached read.
 * Cache is consulted first, then a single in-flight call is shared.
 */
export async function guardedRead<T>(options: {
  key: string;
  fn: () => Promise<T>;
  timeoutMs?: number;
  cache?: TtlCache<T>;
  flight?: SingleFlight;
}): Promise<T> {
  const { key, fn, timeoutMs = 10_000, cache, flight = globalSingleFlight } = options;
  const cached = cache?.get(key);
  if (cached !== undefined) return cached;

  const value = await flight.run(key, () => withTimeout(fn(), timeoutMs));
  cache?.set(key, value);
  return value;
}

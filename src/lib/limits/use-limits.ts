/**
 * The limits engine, attached to the device it is protecting.
 *
 * WHY THE STATE IS LOCAL
 * ----------------------
 * OCADE's expensive work happens on the user's own machine: a model turn, a
 * research retrieval, a screen capture. Nobody is billed for any of it, and
 * there is no server that could count it accurately anyway — an offline session
 * is still a session. So the counter lives where the work does.
 *
 * That makes it a resource governor rather than a paywall, and it is honest
 * about which: a person who clears their browser storage resets it, and that is
 * fine, because what it protects against is a loop that got away rather than a
 * person determined to use their own computer.
 *
 * The server-side half — the endpoints that DO cost something, like OAuth
 * refresh and the payment routes — enforces its own limits with `Retry-After`,
 * from the same policy, in `limits/server.ts`.
 */

import {
  DEFAULT_POLICY,
  checkLimit,
  emptyLimitState,
  recordUse,
  type LimitDecision,
  type LimitPolicy,
  type LimitState,
} from "./policy";

/** What is being limited. Kept separate so one runaway cannot starve the rest. */
export type LimitBucket =
  /** Model turns — the expensive one. */
  | "inference"
  /** Reaching the network for current information. */
  | "research"
  /** Actions that touch the machine. */
  | "control";

const KEY_PREFIX = "ocade:limits:v1:";

interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadLimitState(bucket: LimitBucket): LimitState {
  const store = storage();
  if (!store) return emptyLimitState();
  try {
    const raw = store.getItem(`${KEY_PREFIX}${bucket}`);
    if (!raw) return emptyLimitState();
    const parsed = JSON.parse(raw) as Partial<LimitState>;
    if (!Array.isArray(parsed.events)) return emptyLimitState();
    /*
     * Every field is re-validated. This is device-local storage, so the values
     * are whatever survived a crash, a clock change or another tab — and a NaN
     * timestamp in here would make every later comparison false, silently
     * disabling the limit rather than loudly failing.
     */
    const events = parsed.events
      .filter(
        (event): event is { at: number; cost: number } =>
          !!event &&
          typeof event === "object" &&
          Number.isFinite((event as { at?: unknown }).at) &&
          Number.isFinite((event as { cost?: unknown }).cost),
      )
      .map((event) => ({ at: event.at, cost: Math.max(0, Math.min(1_000, event.cost)) }));
    return { events };
  } catch {
    return emptyLimitState();
  }
}

export function saveLimitState(bucket: LimitBucket, state: LimitState): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(`${KEY_PREFIX}${bucket}`, JSON.stringify(state));
  } catch {
    /* A blocked or full store must not stop the work the user asked for. */
  }
}

/**
 * Ask whether an action may run, and record it when it does.
 *
 * Returns the decision so a caller can show a warning without blocking. A
 * `rejected` decision carries both the wait and a sentence to show; callers
 * must not invent their own wording, or the same limit reads differently in
 * three places.
 */
export function consume(
  bucket: LimitBucket,
  options: { cost?: number; now?: number; policy?: LimitPolicy; dryRun?: boolean } = {},
): LimitDecision {
  const policy = options.policy ?? DEFAULT_POLICY;
  const state = loadLimitState(bucket);
  const decision = checkLimit(state, {
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.cost === undefined ? {} : { cost: options.cost }),
    policy,
  });
  if (decision.outcome !== "rejected" && !options.dryRun) {
    saveLimitState(
      bucket,
      recordUse(state, {
        ...(options.now === undefined ? {} : { now: options.now }),
        ...(options.cost === undefined ? {} : { cost: options.cost }),
        policy,
      }),
    );
  }
  return decision;
}

/** Read the current position without recording anything. For a usage screen. */
export function inspect(bucket: LimitBucket, now?: number): LimitDecision {
  return checkLimit(loadLimitState(bucket), {
    ...(now === undefined ? {} : { now }),
    cost: 0,
  });
}

/**
 * Rate limiting for the endpoints that cost somebody something.
 *
 * WHY THIS EXISTS ALONGSIDE THE DEVICE-LOCAL GOVERNOR
 * ---------------------------------------------------
 * `use-limits.ts` protects the user's own machine from a loop that got away,
 * and it is honest that clearing browser storage resets it. That is fine for
 * work the user's device does for the user.
 *
 * It is not fine for work that leaves the device. An outbound web search, a
 * payment endpoint and an OAuth refresh all consume something the user does not
 * own — a third party's quota, a provider's fraud budget, a mail sender's
 * reputation — and a limit somebody can reset by clearing a cookie is not a
 * limit on those at all.
 *
 * So these run server-side, keyed by account, in the Worker's memory.
 *
 * WHAT THAT DOES AND DOES NOT BUY, STATED PLAINLY
 * -----------------------------------------------
 * A Cloudflare Worker isolate is not a shared store. Two isolates hold two
 * counters, and an isolate can be recycled between requests. So this raises the
 * cost of hammering an endpoint from one account and does not make it
 * impossible.
 *
 * That is worth having and it is not a security boundary, which is why the
 * things that MUST NOT be brute-forced do not rely on it: Supabase enforces
 * auth attempts, the payment provider verifies its own webhook signatures, and
 * the webhook handler is idempotent by event id. This layer sits in front of
 * those as the cheap first refusal, and says so rather than implying more.
 *
 * A durable counter belongs in KV or D1. When one is provisioned, `stores`
 * below is the only thing that changes.
 */

import {
  HOUR,
  checkLimit,
  emptyLimitState,
  recordUse,
  retryAfterHeader,
  type LimitDecision,
  type LimitPolicy,
  type LimitState,
} from "./policy";

/**
 * The endpoints worth limiting, and what each one costs somebody.
 *
 * Quotas are per account and deliberately far above ordinary use: the point is
 * to stop a script, not to ration a feature. A person who trips one of these
 * was not using the product.
 */
export type ServerLimitKind =
  /** Anything that could begin a purchase, including a provider webhook. */
  | "billing_write"
  /** Password reset and one-time-code sends. Consumes sender reputation. */
  | "auth_mail";

const POLICIES: Record<ServerLimitKind, LimitPolicy> = {
  billing_write: {
    /*
     * Deliberately tight. Nothing legitimate starts twenty purchases in five
     * hours, and while OCADE is free nothing legitimate starts one — but the
     * limit is set for the day checkout opens rather than for today, so it does
     * not have to be remembered then.
     */
    windows: [
      { id: "burst", durationMs: 5 * HOUR, quota: 20, label: "this session" },
      { id: "rolling", durationMs: 28 * HOUR, quota: 40, label: "the last day" },
    ],
    warnings: {},
  },
  auth_mail: {
    windows: [
      { id: "burst", durationMs: 5 * HOUR, quota: 10, label: "this session" },
      { id: "day", durationMs: 8 * HOUR, quota: 14, label: "today" },
      { id: "rolling", durationMs: 28 * HOUR, quota: 20, label: "the last day" },
    ],
    warnings: {},
  },
};

const stores = new Map<string, LimitState>();

/**
 * How many accounts are tracked before the oldest are dropped.
 *
 * A Map keyed by account id grows with traffic, and an isolate that never
 * evicts is an isolate that eventually falls over — which would take the
 * endpoint down rather than limit it. Eviction weakens the limit for whoever
 * gets dropped; running out of memory removes it for everybody.
 */
const MAX_TRACKED = 10_000;

function keyFor(kind: ServerLimitKind, accountId: string): string {
  return `${kind}:${accountId}`;
}

export interface ServerLimitResult {
  allowed: boolean;
  decision: LimitDecision;
  /** Headers to merge into the response. Empty when allowed. */
  headers: Record<string, string>;
}

export function checkServerLimit(
  kind: ServerLimitKind,
  accountId: string,
  options: { now?: number; cost?: number } = {},
): ServerLimitResult {
  const policy = POLICIES[kind];
  const key = keyFor(kind, accountId);
  const state = stores.get(key) ?? emptyLimitState();

  const decision = checkLimit(state, {
    policy,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.cost === undefined ? {} : { cost: options.cost }),
  });

  if (decision.outcome === "rejected") {
    return { allowed: false, decision, headers: retryAfterHeader(decision) };
  }

  if (stores.size >= MAX_TRACKED && !stores.has(key)) {
    const oldest = stores.keys().next().value;
    if (oldest !== undefined) stores.delete(oldest);
  }
  stores.set(
    key,
    recordUse(state, {
      policy,
      ...(options.now === undefined ? {} : { now: options.now }),
      ...(options.cost === undefined ? {} : { cost: options.cost }),
    }),
  );
  return { allowed: true, decision, headers: {} };
}

/**
 * Refuse a server function, in the shape its caller already handles.
 *
 * The message is the policy engine's, so the same limit reads identically
 * whether it was hit in the browser or at the endpoint.
 */
export function limitError(result: ServerLimitResult): Error {
  const error = new Error(
    result.decision.message ?? "That has been asked for too many times. Try again shortly.",
  ) as Error & { retryAfterSeconds?: number };
  error.retryAfterSeconds = result.decision.retryAfterSeconds;
  return error;
}

/** Test seam. Never called in production. */
export function resetServerLimits(): void {
  stores.clear();
}

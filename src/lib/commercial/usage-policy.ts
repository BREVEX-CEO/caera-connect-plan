/**
 * ONE SUCCESSFUL REQUEST IS ONE USE, ON EVERY TIER.
 *
 * Pure and deterministic: no clock of its own, no storage, no network. Every
 * function takes the instant it should reason about, so a window boundary, a
 * weekly rollover and an exhausted allowance are all reachable from a test
 * without waiting six and a half hours.
 *
 * THIS IS THE POLICY. It is not the ledger and it is not the gate. The ledger
 * records what was spent; the gate decides whether a request may start and
 * finalises or releases what it reserved. Both read their numbers from here, so
 * there is one place where "how much is a Pro session" is answered.
 *
 * WHAT THIS REPLACED, AND WHY IT IS GONE. Free counted uses and the paid tiers
 * counted "Standard Work Equivalents": input tokens over four thousand, plus
 * output over one thousand, plus read batches over eight, plus side effects
 * over four, plus a media schedule, floored at a quarter and rounded up in
 * hundredths — and then shown to the customer as a percentage, because the unit
 * was not one anybody could convert into their own work.
 *
 * Two counting models meant two answers to "how much have I used", a browser
 * that had to measure its own tokens and be clamped for it, a ledger storing
 * hundredths of a unit nobody could name, and a Pro customer who could not tell
 * you what a long question would cost. `PLAN.md` Phase 5 replaces all of it with
 * the rule a person can hold in their head: a successful answer costs one, a
 * failure costs nothing, and OCADE's own retries and fallbacks cost nothing.
 *
 * WINDOWS ARE ANCHORED TO THE ACCOUNT, NOT TO THE CLOCK. A fixed UTC boundary
 * gives every account in the world the same reset instant, which is unfair in
 * exactly one direction — it lands mid-morning for some people and mid-sleep
 * for others — and it makes the reset a stampede. Anchoring to the account's
 * own creation spreads them out and gives each person a boundary that falls in
 * the same place in their own day.
 */
import type { PlanTier } from "@/lib/payments/pricing";

/**
 * The session window: six hours and twenty-eight minutes.
 *
 * The one place it is decided. Every surface — the usage screen, the gate, the
 * reset countdown — derives from this, so the product cannot describe one
 * window and enforce another.
 */
export const SESSION_WINDOW_MS = (6 * 60 + 28) * 60 * 1000;

/** The weekly window, for the plans that have one. */
export const WEEK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type UsageWindowKind = "session" | "week";

export interface TierAllowance {
  /** Successful requests allowed per session window. */
  session: number;
  /** Successful requests allowed per week, or null where the tier has none. */
  week: number | null;
}

/**
 * The allowances, as approved.
 *
 * Max is exactly ten times Pro, and it is written as a multiplication rather
 * than as four more literals so that it cannot drift into approximately ten
 * times Pro after somebody edits one line.
 */
const PRO_SESSION = 140;
const PRO_WEEK = 700;
export const MAX_MULTIPLE_OF_PRO = 10;

export const ALLOWANCES: Record<PlanTier, TierAllowance> = {
  free: {
    session: 28,
    // No weekly limit on Free. Null rather than a large number: a limit
    // nobody can reach is still a limit that has to be explained.
    week: null,
  },
  pro: { session: PRO_SESSION, week: PRO_WEEK },
  max: { session: PRO_SESSION * MAX_MULTIPLE_OF_PRO, week: PRO_WEEK * MAX_MULTIPLE_OF_PRO },
};

/** What one successful request costs. One, on every tier, always. */
export const ONE_USE = 1;

/* ------------------------------------------------------------- the window -- */

export interface UsageWindow {
  kind: UsageWindowKind;
  /** Inclusive start of the window this instant falls in. */
  startsAt: number;
  /** Exclusive end. Also when the allowance returns. */
  endsAt: number;
}

/**
 * The window an instant falls in, for an account anchored at `anchoredAt`.
 *
 * Anchoring matters and is easy to get subtly wrong: the boundary must be a
 * whole number of windows from the anchor, computed by flooring rather than by
 * repeatedly adding, so an account that has existed for two years lands on the
 * same boundary whichever instant is asked about.
 */
export function windowFor(kind: UsageWindowKind, anchoredAt: number, now: number): UsageWindow {
  const length = kind === "session" ? SESSION_WINDOW_MS : WEEK_WINDOW_MS;
  /*
   * An instant BEFORE the anchor is not an error to throw on — a clock can
   * disagree with a server by a few seconds — so it resolves to the first
   * window rather than to a negative one.
   */
  const elapsed = Math.max(0, now - anchoredAt);
  const index = Math.floor(elapsed / length);
  const startsAt = anchoredAt + index * length;
  return { kind, startsAt, endsAt: startsAt + length };
}

/** How long until this window resets. Never negative. */
export function millisecondsUntilReset(window: UsageWindow, now: number): number {
  return Math.max(0, window.endsAt - now);
}

/* ------------------------------------------------------------- the answer -- */

export interface WindowUsage {
  kind: UsageWindowKind;
  /** Successful requests already spent in this window. */
  used: number;
  /** The allowance for this window, or null where there is none. */
  allowance: number | null;
  window: UsageWindow;
}

export type UsageVerdict =
  | { allowed: true; remaining: number | null }
  | {
      allowed: false;
      /** Which window ran out. Named, so the message can say when it returns. */
      exhausted: UsageWindowKind;
      resetsAt: number;
    };

/**
 * May one more request start right now?
 *
 * EVERY WINDOW IS CHECKED AND THE TIGHTEST ANSWER WINS. A session allowance
 * with room left means nothing if the week is spent, and answering from the
 * session alone is how an account spends a week's allowance in a day.
 *
 * The comparison is `used + 1 > allowance`, so the request that exactly
 * exhausts the allowance is ALLOWED. Refusing it would make the last one
 * unusable and turn an allowance of 28 into an allowance of 27.
 */
export function checkAllowance(windows: WindowUsage[]): UsageVerdict {
  let tightestRemaining: number | null = null;

  for (const entry of windows) {
    if (entry.allowance === null) continue;
    const remaining = entry.allowance - entry.used;
    if (entry.used + ONE_USE > entry.allowance) {
      return { allowed: false, exhausted: entry.kind, resetsAt: entry.window.endsAt };
    }
    if (tightestRemaining === null || remaining < tightestRemaining) {
      tightestRemaining = remaining;
    }
  }

  return { allowed: true, remaining: tightestRemaining };
}

/**
 * What the customer is shown for one window.
 *
 * Exact counts on every tier, which `PLAN.md` Phase 5 spells out as
 * "18 of 28 left · resets in 2h 14m". Pro and Max used to be shown a
 * percentage, because the unit behind it was not one anybody could convert
 * into their own work; the unit is now a request, so there is nothing left to
 * hide behind a proportion.
 */
export interface UsageDisplay {
  kind: UsageWindowKind;
  used: number;
  remaining: number;
  allowance: number;
  resetsInMs: number;
}

export function describeUsage(entry: WindowUsage, now: number): UsageDisplay | null {
  // A window with no allowance has nothing to report. Free's week is not
  // "100% remaining"; it does not exist.
  if (entry.allowance === null) return null;

  return {
    kind: entry.kind,
    used: Math.min(entry.allowance, Math.max(0, Math.round(entry.used))),
    remaining: Math.max(0, entry.allowance - Math.round(entry.used)),
    allowance: entry.allowance,
    resetsInMs: millisecondsUntilReset(entry.window, now),
  };
}

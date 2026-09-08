/**
 * WHAT ONE REQUEST COSTS, AND HOW MUCH OF IT AN ACCOUNT HAS LEFT.
 *
 * Pure and deterministic: no clock of its own, no storage, no network. Every
 * function takes the instant it should reason about, so a window boundary, a
 * weekly rollover and an exhausted allowance are all reachable from a test
 * without waiting six and a half hours.
 *
 * THIS IS THE POLICY. It is not the ledger and it is not the gate. The ledger
 * (`ocade_cloud_usage`, server-side) records what was spent; the gate decides
 * whether a request may start and finalises or releases what it reserved. Both
 * read their numbers from here, so there is one place where "how much is a
 * Pro session" is answered.
 *
 * TWO COUNTING MODELS, AND THE DIFFERENCE IS DELIBERATE.
 *
 *   FREE counts USES. Twenty-eight successful logical AI uses per window, each
 *   worth exactly one, whatever it cost to serve. A free plan whose allowance
 *   shrank when a question happened to be long would be impossible for anybody
 *   to reason about, and the raw numbers are shown to the person precisely so
 *   they CAN reason about it.
 *
 *   PRO AND MAX count WEIGHTED WORK, in Standard Work Equivalents, because at
 *   that volume the difference between a one-line answer and an afternoon of
 *   tool use is the whole story. The customer sees percentages rather than
 *   equivalents: a number nobody can convert into anything is not information,
 *   and quoting it would invite people to optimise against a unit rather than
 *   do their work.
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
  /**
   * Session allowance, in the unit this tier counts.
   *
   * Uses for Free; Standard Work Equivalents for Pro and Max.
   */
  session: number;
  /** Weekly allowance, or null where the tier has none. */
  week: number | null;
  /**
   * What the customer is shown.
   *
   * `raw` shows used and remaining as whole numbers, because on Free those
   * numbers are small, exact, and the person needs to plan around them.
   * `percentage` shows proportion only.
   */
  display: "raw" | "percentage";
  /** Whether this tier's cost is weighted, or one per logical request. */
  counting: "uses" | "weighted";
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
    display: "raw",
    counting: "uses",
  },
  pro: {
    session: PRO_SESSION,
    week: PRO_WEEK,
    display: "percentage",
    counting: "weighted",
  },
  max: {
    session: PRO_SESSION * MAX_MULTIPLE_OF_PRO,
    week: PRO_WEEK * MAX_MULTIPLE_OF_PRO,
    display: "percentage",
    counting: "weighted",
  },
};

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

/* --------------------------------------------------------- weighted work -- */

/**
 * What one logical request consumed, before weighting.
 *
 * Every field is a MEASUREMENT. Nothing here is estimated, and nothing is
 * counted that the customer did not receive: internal tool loops, internal
 * subagents, retries after a failure and replayed fallbacks are all invisible
 * to this, because charging for OCADE's own retries would make a slow day cost
 * more than a fast one through no choice of the person's.
 */
export interface WorkMeasurement {
  /** Input tokens OCADE is willing to bill for, after its own deduplication. */
  billableInputTokens: number;
  /** Output tokens the customer actually received. */
  visibleOutputTokens: number;
  /** Distinct verified read batches. Re-reading the same thing is one batch. */
  readToolBatches: number;
  /** Distinct verified actions that changed something outside OCADE. */
  sideEffectActions: number;
  /**
   * Non-text media work, already expressed in equivalents by the versioned
   * media schedule. Passed in rather than derived here, because the schedule
   * changes on its own cadence and must be versioned with the record.
   */
  mediaWork?: number;
}

/** The floor. No successful request costs less than a quarter equivalent. */
export const MINIMUM_WORK = 0.25;

/**
 * Standard Work Equivalents for one logical request.
 *
 *   work = billable_input / 4000
 *        + visible_output / 1000
 *        + read_batches / 8
 *        + side_effects / 4
 *        + media_work
 *
 *   final = round_up_to_0.01(max(0.25, work))
 *
 * ROUNDED UP, AND IN HUNDREDTHS. Rounding down would let a long series of
 * small requests cost nothing at all; doing the arithmetic in floating point
 * would make the total depend on the order things were added. So the result is
 * computed as an integer number of hundredths and converted once.
 */
export function weighWork(measurement: WorkMeasurement): number {
  const raw =
    measurement.billableInputTokens / 4000 +
    measurement.visibleOutputTokens / 1000 +
    measurement.readToolBatches / 8 +
    measurement.sideEffectActions / 4 +
    (measurement.mediaWork ?? 0);

  const floored = Math.max(MINIMUM_WORK, Number.isFinite(raw) ? raw : 0);
  // `+ 1e-9` absorbs the representation error in values like 0.1 + 0.2, which
  // would otherwise round a clean 0.30 up to 0.31.
  return Math.ceil(floored * 100 - 1e-9) / 100;
}

/**
 * What a single request costs on this tier.
 *
 * Free pays one per logical request regardless of the measurement; the
 * measurement is still taken, because it is what the account's own usage
 * screen and any later upgrade decision are built from.
 */
export function costOf(tier: PlanTier, measurement: WorkMeasurement): number {
  return ALLOWANCES[tier].counting === "uses" ? 1 : weighWork(measurement);
}

/* ------------------------------------------------------------- the answer -- */

export interface WindowUsage {
  kind: UsageWindowKind;
  /** Already spent in this window. */
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
 * May a request costing `cost` start right now?
 *
 * EVERY WINDOW IS CHECKED AND THE TIGHTEST ANSWER WINS. A session allowance
 * with room left means nothing if the week is spent, and answering from the
 * session alone is how an account spends a week's allowance in a day.
 *
 * The comparison is `used + cost > allowance`, so a request that exactly
 * exhausts the allowance is ALLOWED. Refusing it would make the last unit
 * unusable and turn an allowance of 28 into an allowance of 27.
 */
export function checkAllowance(windows: WindowUsage[], cost: number): UsageVerdict {
  let tightestRemaining: number | null = null;

  for (const entry of windows) {
    if (entry.allowance === null) continue;
    const remaining = entry.allowance - entry.used;
    if (entry.used + cost > entry.allowance) {
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
 * The tier decides the SHAPE of the answer, not just its wording: Free gets
 * exact counts because it has to plan around twenty-eight of something, and
 * Pro and Max get a proportion because an equivalent is not a unit anybody can
 * convert into their own work.
 */
export interface UsageDisplay {
  kind: UsageWindowKind;
  display: "raw" | "percentage";
  /** Present only on a `raw` tier. */
  used?: number;
  remaining?: number;
  allowance?: number;
  /** Present only on a `percentage` tier. 0–100, rounded to a whole number. */
  usedPercent?: number;
  resetsInMs: number;
}

export function describeUsage(
  tier: PlanTier,
  entry: WindowUsage,
  now: number,
): UsageDisplay | null {
  // A window with no allowance has nothing to report. Free's week is not
  // "100% remaining"; it does not exist.
  if (entry.allowance === null) return null;

  const resetsInMs = millisecondsUntilReset(entry.window, now);
  if (ALLOWANCES[tier].display === "raw") {
    return {
      kind: entry.kind,
      display: "raw",
      used: entry.used,
      remaining: Math.max(0, entry.allowance - entry.used),
      allowance: entry.allowance,
      resetsInMs,
    };
  }
  return {
    kind: entry.kind,
    display: "percentage",
    // Clamped, because a request may finalise slightly above its reservation
    // and "103% used" reads as a fault rather than as a full allowance.
    usedPercent: Math.min(100, Math.max(0, Math.round((entry.used / entry.allowance) * 100))),
    resetsInMs,
  };
}

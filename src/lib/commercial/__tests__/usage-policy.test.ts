import { describe, expect, it } from "vitest";
import {
  ALLOWANCES,
  MAX_MULTIPLE_OF_PRO,
  ONE_USE,
  SESSION_WINDOW_MS,
  WEEK_WINDOW_MS,
  checkAllowance,
  describeUsage,
  millisecondsUntilReset,
  windowFor,
  type WindowUsage,
} from "@/lib/commercial/usage-policy";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe("the allowances are the approved ones", () => {
  it("gives Free exactly 28 uses per session and no weekly limit", () => {
    expect(ALLOWANCES.free.session).toBe(28);
    // Null, not a large number: a limit nobody can reach still has to be
    // explained to somebody.
    expect(ALLOWANCES.free.week).toBeNull();
  });

  it("gives Pro 140 per session and 700 per week", () => {
    expect(ALLOWANCES.pro.session).toBe(140);
    expect(ALLOWANCES.pro.week).toBe(700);
  });

  it("makes Max exactly ten times Pro, not approximately", () => {
    expect(MAX_MULTIPLE_OF_PRO).toBe(10);
    expect(ALLOWANCES.max.session).toBe(ALLOWANCES.pro.session * 10);
    expect(ALLOWANCES.max.week).toBe(ALLOWANCES.pro.week! * 10);
    expect(ALLOWANCES.max.session).toBe(1400);
    expect(ALLOWANCES.max.week).toBe(7000);
  });

  /*
   * ONE COUNTING MODEL, AND THAT IS THE POINT OF PHASE 5.
   *
   * Free counted uses; Pro and Max counted a weighted "Standard Work
   * Equivalent" built from input tokens, output tokens, read batches, side
   * effects and a media schedule — a unit the customer was shown as a
   * percentage because it was not one anybody could convert into their own
   * work. Two models meant two answers to "how much have I used".
   */
  it("costs one use on every tier, with no second counting model", () => {
    expect(ONE_USE).toBe(1);
    for (const allowance of Object.values(ALLOWANCES)) {
      expect(Object.keys(allowance).sort()).toEqual(["session", "week"]);
    }
  });
});

describe("the session window is six hours and twenty-eight minutes", () => {
  it("is exactly that, once", () => {
    expect(SESSION_WINDOW_MS).toBe(6 * HOUR + 28 * MINUTE);
    expect(WEEK_WINDOW_MS).toBe(7 * 24 * HOUR);
  });

  it("is anchored to the account, so two accounts reset at different instants", () => {
    /*
     * A fixed UTC boundary gives every account the same reset instant, which
     * lands mid-morning for some people and mid-sleep for others, and makes
     * the reset a stampede.
     */
    const first = windowFor("session", 0, 5 * HOUR);
    const second = windowFor("session", 3 * HOUR, 5 * HOUR);
    expect(first.startsAt).not.toBe(second.startsAt);
    expect(second.startsAt).toBe(3 * HOUR);
  });

  it("lands on the same boundary however far from the anchor it is asked", () => {
    // Computed by flooring rather than by repeatedly adding, so an account two
    // years old is not a slightly different answer from one two hours old.
    const anchor = 1_700_000_000_000;
    const twoYears = anchor + 2 * 365 * 24 * HOUR;
    const window = windowFor("session", anchor, twoYears);
    expect((window.startsAt - anchor) % SESSION_WINDOW_MS).toBe(0);
    expect(window.startsAt).toBeLessThanOrEqual(twoYears);
    expect(window.endsAt).toBeGreaterThan(twoYears);
  });

  it("puts an instant exactly on a boundary in the NEW window", () => {
    const boundary = windowFor("session", 0, SESSION_WINDOW_MS);
    expect(boundary.startsAt).toBe(SESSION_WINDOW_MS);
    // The previous window's end and this one's start are the same instant, and
    // it belongs to exactly one of them.
    expect(windowFor("session", 0, SESSION_WINDOW_MS - 1).endsAt).toBe(boundary.startsAt);
  });

  it("resolves an instant before the anchor to the first window rather than a negative one", () => {
    // A client clock a few seconds behind the server is not an error to throw
    // on.
    const window = windowFor("session", 1000, 0);
    expect(window.startsAt).toBe(1000);
  });

  it("counts down to the reset and never past it", () => {
    const window = windowFor("session", 0, 0);
    expect(millisecondsUntilReset(window, 0)).toBe(SESSION_WINDOW_MS);
    expect(millisecondsUntilReset(window, SESSION_WINDOW_MS)).toBe(0);
    expect(millisecondsUntilReset(window, SESSION_WINDOW_MS + HOUR)).toBe(0);
  });
});

describe("whether a request may start", () => {
  const session = windowFor("session", 0, 0);
  const week = windowFor("week", 0, 0);

  const windows = (used: number, weekUsed = 0): WindowUsage[] => [
    { kind: "session", used, allowance: 140, window: session },
    { kind: "week", used: weekUsed, allowance: 700, window: week },
  ];

  it("allows a request with room to spare", () => {
    const verdict = checkAllowance(windows(10));
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.remaining).toBe(130);
  });

  it("allows the request that exactly exhausts the allowance", () => {
    /*
     * Refusing it would make the last unit unusable and quietly turn an
     * allowance of 140 into an allowance of 139.
     */
    const verdict = checkAllowance(windows(139));
    expect(verdict.allowed).toBe(true);
  });

  it("refuses the one after that, and says when it returns", () => {
    const verdict = checkAllowance(windows(140));
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.exhausted).toBe("session");
      expect(verdict.resetsAt).toBe(session.endsAt);
    }
  });

  it("refuses on the WEEK even when the session has room", () => {
    /*
     * Answering from the session alone is how an account spends a week's
     * allowance in a day.
     */
    const verdict = checkAllowance(windows(0, 700));
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.exhausted).toBe("week");
      expect(verdict.resetsAt).toBe(week.endsAt);
    }
  });

  it("reports the TIGHTEST remaining, not the most generous", () => {
    const verdict = checkAllowance([
      { kind: "session", used: 100, allowance: 140, window: session },
      { kind: "week", used: 695, allowance: 700, window: week },
    ]);
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.remaining).toBe(5);
  });

  it("ignores a window with no allowance, as Free's week has none", () => {
    const verdict = checkAllowance([
      { kind: "session", used: 27, allowance: 28, window: session },
      { kind: "week", used: 1_000_000, allowance: null, window: week },
    ]);
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.remaining).toBe(1);
  });
});

describe("what the customer is shown", () => {
  const session = windowFor("session", 0, 0);
  const week = windowFor("week", 0, 0);

  it("gives every tier exact numbers, which is the sentence the plan names", () => {
    // "18 of 28 left · resets in 2h 14m" — PLAN.md Phase 5.
    expect(describeUsage({ kind: "session", used: 10, allowance: 28, window: session }, 0)).toEqual(
      { kind: "session", used: 10, remaining: 18, allowance: 28, resetsInMs: SESSION_WINDOW_MS },
    );
  });

  it("gives Pro and Max the same shape, not a percentage", () => {
    expect(
      describeUsage({ kind: "session", used: 70, allowance: 140, window: session }, 0),
    ).toMatchObject({ used: 70, remaining: 70, allowance: 140 });
  });

  it("never reports more than a full allowance, or a negative remainder", () => {
    const shown = describeUsage(
      { kind: "session", used: 1450, allowance: 1400, window: session },
      0,
    );
    expect(shown).toMatchObject({ used: 1400, remaining: 0 });
  });

  it("says nothing at all about a window that has no allowance", () => {
    // Free's week is not "100% remaining". It does not exist.
    expect(describeUsage({ kind: "week", used: 0, allowance: null, window: week }, 0)).toBeNull();
  });

  it("counts down to the reset", () => {
    const shown = describeUsage({ kind: "session", used: 0, allowance: 28, window: session }, HOUR);
    expect(shown?.resetsInMs).toBe(SESSION_WINDOW_MS - HOUR);
  });
});

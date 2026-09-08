import { describe, expect, it } from "vitest";
import {
  ALLOWANCES,
  MAX_MULTIPLE_OF_PRO,
  MINIMUM_WORK,
  SESSION_WINDOW_MS,
  WEEK_WINDOW_MS,
  checkAllowance,
  costOf,
  describeUsage,
  millisecondsUntilReset,
  weighWork,
  windowFor,
  type WindowUsage,
  type WorkMeasurement,
} from "@/lib/commercial/usage-policy";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** A measurement that weighs nothing, so each test can add one dimension. */
const nothing: WorkMeasurement = {
  billableInputTokens: 0,
  visibleOutputTokens: 0,
  readToolBatches: 0,
  sideEffectActions: 0,
};

describe("the allowances are the approved ones", () => {
  it("gives Free exactly 28 uses per session and no weekly limit", () => {
    expect(ALLOWANCES.free.session).toBe(28);
    // Null, not a large number: a limit nobody can reach still has to be
    // explained to somebody.
    expect(ALLOWANCES.free.week).toBeNull();
    expect(ALLOWANCES.free.counting).toBe("uses");
    expect(ALLOWANCES.free.display).toBe("raw");
  });

  it("gives Pro 140 per session and 700 per week", () => {
    expect(ALLOWANCES.pro.session).toBe(140);
    expect(ALLOWANCES.pro.week).toBe(700);
    expect(ALLOWANCES.pro.counting).toBe("weighted");
  });

  it("makes Max exactly ten times Pro, not approximately", () => {
    expect(MAX_MULTIPLE_OF_PRO).toBe(10);
    expect(ALLOWANCES.max.session).toBe(ALLOWANCES.pro.session * 10);
    expect(ALLOWANCES.max.week).toBe(ALLOWANCES.pro.week! * 10);
    expect(ALLOWANCES.max.session).toBe(1400);
    expect(ALLOWANCES.max.week).toBe(7000);
  });

  it("shows raw numbers on Free and percentages on the paid tiers", () => {
    expect(ALLOWANCES.free.display).toBe("raw");
    expect(ALLOWANCES.pro.display).toBe("percentage");
    expect(ALLOWANCES.max.display).toBe("percentage");
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

describe("weighted work", () => {
  it("weighs each dimension at its stated rate", () => {
    expect(weighWork({ ...nothing, billableInputTokens: 4000 })).toBe(1);
    expect(weighWork({ ...nothing, visibleOutputTokens: 1000 })).toBe(1);
    expect(weighWork({ ...nothing, readToolBatches: 8 })).toBe(1);
    expect(weighWork({ ...nothing, sideEffectActions: 4 })).toBe(1);
    expect(weighWork({ ...nothing, mediaWork: 1 })).toBe(1);
  });

  it("adds the dimensions together", () => {
    expect(
      weighWork({
        billableInputTokens: 8000,
        visibleOutputTokens: 2000,
        readToolBatches: 8,
        sideEffectActions: 8,
        mediaWork: 0.5,
      }),
    ).toBe(2 + 2 + 1 + 2 + 0.5);
  });

  it("never charges less than a quarter equivalent for a successful request", () => {
    expect(weighWork(nothing)).toBe(MINIMUM_WORK);
    expect(weighWork({ ...nothing, visibleOutputTokens: 1 })).toBe(MINIMUM_WORK);
  });

  it("rounds UP to the nearest hundredth, so many small requests are not free", () => {
    // 1001 output tokens is 1.001 equivalents. Rounded down, a thousand such
    // requests would cost a thousand rather than 1010.
    expect(weighWork({ ...nothing, visibleOutputTokens: 1001 })).toBe(1.01);
    expect(weighWork({ ...nothing, visibleOutputTokens: 1000.5 })).toBe(1.01);
  });

  it("does not round a clean total up because of floating point", () => {
    // 0.1 + 0.2 is 0.30000000000000004 in IEEE 754, and a naive ceil would
    // charge 0.31 for it.
    const clean = weighWork({ ...nothing, visibleOutputTokens: 100, mediaWork: 0.2 });
    expect(clean).toBe(0.3);
  });

  it("survives a measurement that is not a number rather than charging NaN", () => {
    expect(weighWork({ ...nothing, visibleOutputTokens: Number.NaN })).toBe(MINIMUM_WORK);
    expect(weighWork({ ...nothing, billableInputTokens: Number.POSITIVE_INFINITY })).toBe(
      MINIMUM_WORK,
    );
  });
});

describe("what a request costs on each tier", () => {
  const heavy: WorkMeasurement = {
    billableInputTokens: 40_000,
    visibleOutputTokens: 10_000,
    readToolBatches: 80,
    sideEffectActions: 40,
  };

  it("charges Free exactly one use, however heavy the request", () => {
    /*
     * A free allowance that shrank when a question happened to be long would
     * be impossible for anybody to plan around — and the raw numbers are shown
     * to Free precisely so that it CAN be planned around.
     */
    expect(costOf("free", heavy)).toBe(1);
    expect(costOf("free", nothing)).toBe(1);
  });

  it("charges Pro and Max the weighted work", () => {
    expect(costOf("pro", heavy)).toBe(weighWork(heavy));
    expect(costOf("max", heavy)).toBe(weighWork(heavy));
    expect(costOf("pro", heavy)).toBeGreaterThan(1);
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
    const verdict = checkAllowance(windows(10), 1);
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.remaining).toBe(130);
  });

  it("allows the request that exactly exhausts the allowance", () => {
    /*
     * Refusing it would make the last unit unusable and quietly turn an
     * allowance of 140 into an allowance of 139.
     */
    const verdict = checkAllowance(windows(139), 1);
    expect(verdict.allowed).toBe(true);
  });

  it("refuses the one after that, and says when it returns", () => {
    const verdict = checkAllowance(windows(140), 1);
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
    const verdict = checkAllowance(windows(0, 700), 1);
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) {
      expect(verdict.exhausted).toBe("week");
      expect(verdict.resetsAt).toBe(week.endsAt);
    }
  });

  it("reports the TIGHTEST remaining, not the most generous", () => {
    const verdict = checkAllowance(
      [
        { kind: "session", used: 100, allowance: 140, window: session },
        { kind: "week", used: 695, allowance: 700, window: week },
      ],
      1,
    );
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.remaining).toBe(5);
  });

  it("ignores a window with no allowance, as Free's week has none", () => {
    const verdict = checkAllowance(
      [
        { kind: "session", used: 27, allowance: 28, window: session },
        { kind: "week", used: 1_000_000, allowance: null, window: week },
      ],
      1,
    );
    expect(verdict.allowed).toBe(true);
    if (verdict.allowed) expect(verdict.remaining).toBe(1);
  });

  it("refuses a request larger than the whole allowance rather than part-serving it", () => {
    expect(checkAllowance(windows(0), 141).allowed).toBe(false);
  });
});

describe("what the customer is shown", () => {
  const session = windowFor("session", 0, 0);
  const week = windowFor("week", 0, 0);

  it("gives Free exact numbers, because it has 28 of something to plan around", () => {
    const shown = describeUsage(
      "free",
      { kind: "session", used: 5, allowance: 28, window: session },
      0,
    );
    expect(shown).toMatchObject({ display: "raw", used: 5, remaining: 23, allowance: 28 });
    expect(shown?.usedPercent).toBeUndefined();
  });

  it("gives Pro and Max a percentage, and never the equivalents themselves", () => {
    /*
     * An equivalent is not a unit anybody can convert into their own work, and
     * quoting it would invite people to optimise against the unit.
     */
    const shown = describeUsage(
      "pro",
      { kind: "session", used: 70, allowance: 140, window: session },
      0,
    );
    expect(shown).toMatchObject({ display: "percentage", usedPercent: 50 });
    expect(shown?.used).toBeUndefined();
    expect(shown?.remaining).toBeUndefined();
    expect(shown?.allowance).toBeUndefined();
  });

  it("never reports more than a full allowance", () => {
    // A request may finalise slightly above what it reserved; "103% used"
    // reads as a fault rather than as a full allowance.
    const shown = describeUsage(
      "max",
      { kind: "session", used: 1450, allowance: 1400, window: session },
      0,
    );
    expect(shown?.usedPercent).toBe(100);
  });

  it("says nothing at all about a window that has no allowance", () => {
    // Free's week is not "100% remaining". It does not exist.
    expect(
      describeUsage("free", { kind: "week", used: 0, allowance: null, window: week }, 0),
    ).toBeNull();
  });

  it("counts down to the reset", () => {
    const shown = describeUsage(
      "free",
      { kind: "session", used: 0, allowance: 28, window: session },
      HOUR,
    );
    expect(shown?.resetsInMs).toBe(SESSION_WINDOW_MS - HOUR);
  });
});

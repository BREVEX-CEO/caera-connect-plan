import { describe, it, expect } from "vitest";
import {
  PLANS,
  CLOUD_ALLOWANCE,
  CLOUD_WINDOW_MS,
  checkPrice,
  describePrice,
  planById,
  priceFor,
  currencyForRegion,
  missingProductIds,
  type CurrencyCode,
} from "../payments/pricing";
import {
  DEMO_SESSION_MS,
  DEMO_WARNING_MS,
  sessionState,
  startSession,
  endSession,
  readDeadline,
  formatRemaining,
  warningMessage,
} from "../demo/session";

/* ------------------------------------------------------------------ pricing */

describe("the pricing rule is enforced, not remembered", () => {
  const CURRENCIES: CurrencyCode[] = ["USD", "EUR", "GBP", "INR"];

  it("every configured price passes the validator", () => {
    const failures: string[] = [];
    for (const plan of PLANS) {
      for (const price of plan.prices) {
        const check = checkPrice(price.amount);
        if (!check.valid) failures.push(`${plan.id}/${price.currency}: ${check.reason}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("every plan carries every supported currency", () => {
    for (const plan of PLANS) {
      const have = plan.prices.map((p) => p.currency).sort();
      expect(have, `${plan.id} is missing a currency`).toEqual([...CURRENCIES].sort());
    }
  });

  it("accepts the four documented forms", () => {
    expect(checkPrice(28).valid).toBe(true); // ends in 28
    expect(checkPrice(9928).valid).toBe(true); // four digits, digit total 28
    expect(checkPrice(350).valid).toBe(true); // three digits, digit total 8
    expect(checkPrice(8).valid).toBe(true); // fallback: ends in 8, total 8
  });

  it("rejects a four-digit price whose digits do not total 28", () => {
    // 2828 is the obvious "looks right" price and it is wrong: 2+8+2+8 = 20.
    const check = checkPrice(2828);
    expect(check.valid).toBe(false);
    expect(check.reason).toContain("digit total of 20");
  });

  it("rejects a three-digit price whose digits do not total 8", () => {
    // 128 ends in 28 and still fails, which is why rule 1 is a preference: no
    // three-digit number ending in 28 can total 8.
    expect(checkPrice(128).valid).toBe(false);
    expect(checkPrice(228).valid).toBe(false);
  });

  it("rejects a short price that ends in neither 8 nor 28", () => {
    expect(checkPrice(25).valid).toBe(false);
    expect(checkPrice(10).valid).toBe(false);
  });

  it("treats free as valid, because a signature on zero means nothing", () => {
    expect(checkPrice(0).valid).toBe(true);
    expect(describePrice({ currency: "USD", amount: 0 })).toBe("Free");
  });

  it("REFUSES TO RENDER an invalid price rather than falling back", () => {
    /*
     * The assertion this module exists for. A silent fallback would put the
     * exact price the rule forbids in front of a paying customer, quietly.
     */
    expect(() => describePrice({ currency: "USD", amount: 2828 })).toThrow(
      /Refusing to display an invalid price/,
    );
  });

  it("formats a valid price with the right symbol", () => {
    expect(describePrice({ currency: "USD", amount: 28 })).toBe("$28");
    expect(describePrice({ currency: "INR", amount: 3889 })).toBe("₹3,889");
  });

  it("orders the paid plans by price within each currency", () => {
    // A longer plan costing less than a shorter one is a pricing bug that no
    // amount of digit-sum validation would catch.
    for (const currency of CURRENCIES) {
      const paid = PLANS.filter((p) => p.id !== "demo");
      const amounts = paid.map((p) => priceFor(p, currency).amount);
      expect(
        [...amounts].sort((a, b) => a - b),
        `${currency} plans are out of order`,
      ).toEqual(amounts);
    }
  });

  it("gives a longer plan a better rate than the monthly one", () => {
    const month = priceFor(planById("month_1m")!, "USD").amount;
    const year = priceFor(planById("year_1y")!, "USD").amount;
    expect(year).toBeLessThan(month * 12);
  });

  it("meters only cloud use, and never local processing", () => {
    expect(CLOUD_ALLOWANCE).toBe(28);
    expect(CLOUD_WINDOW_MS).toBe(8 * 60 * 60 * 1000);
    // The demo has no cloud allowance at all: it runs on the device or not.
    expect(planById("demo")!.cloudAllowance).toBe(0);
    for (const plan of PLANS.filter((p) => p.id !== "demo")) {
      expect(plan.cloudAllowance).toBe(CLOUD_ALLOWANCE);
    }
  });

  it("keeps payment product ids out of source", () => {
    const source = JSON.stringify(PLANS);
    // Only the env var NAME may appear; a value that looks like a provider id
    // must not.
    expect(source).not.toMatch(/\bprice_[A-Za-z0-9]{10,}/);
    expect(source).not.toMatch(/\bprod_[A-Za-z0-9]{10,}/);
    for (const plan of PLANS.filter((p) => p.id !== "demo")) {
      expect(plan.productIdEnv).toMatch(/^OCADE_PRODUCT_ID_/);
    }
  });

  it("reports missing product ids instead of throwing", () => {
    expect(missingProductIds({})).toHaveLength(4);
    expect(
      missingProductIds({
        OCADE_PRODUCT_ID_TRIAL_2D: "a",
        OCADE_PRODUCT_ID_STD_8D: "b",
        OCADE_PRODUCT_ID_MONTH_1M: "c",
        OCADE_PRODUCT_ID_YEAR_1Y: "d",
      }),
    ).toEqual([]);
  });

  it("picks a currency by region and falls back to USD", () => {
    expect(currencyForRegion("IN")).toBe("INR");
    expect(currencyForRegion("GB")).toBe("GBP");
    expect(currencyForRegion("DE")).toBe("EUR");
    expect(currencyForRegion("US")).toBe("USD");
    // Unknown region: a familiar dollar figure beats a guess.
    expect(currencyForRegion(null)).toBe("USD");
    expect(currencyForRegion("ZZ")).toBe("USD");
  });
});

/* ------------------------------------------------------------- demo session */

describe("the 8-minute demo session", () => {
  const T0 = 1_700_000_000_000;

  /** In-memory storage so nothing touches the real sessionStorage. */
  function fakeStore() {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      _map: map,
    };
  }

  it("runs for exactly 8 minutes and warns with 3 to go", () => {
    // The number the copy promises, pinned against the number the timer uses.
    expect(DEMO_SESSION_MS).toBe(8 * 60 * 1000);
    expect(DEMO_WARNING_MS).toBe(3 * 60 * 1000);
  });

  it("reports idle before anything starts", () => {
    const state = sessionState(null, T0);
    expect(state.phase).toBe("idle");
    expect(state.remainingMs).toBe(0);
  });

  it("moves active -> ending -> expired at the right moments", () => {
    const deadline = T0 + DEMO_SESSION_MS;
    expect(sessionState(deadline, T0).phase).toBe("active");
    // One millisecond before the warning window opens.
    expect(sessionState(deadline, deadline - DEMO_WARNING_MS - 1).phase).toBe("active");
    // Exactly on the boundary counts as ending: the warning should be early
    // rather than late.
    expect(sessionState(deadline, deadline - DEMO_WARNING_MS).phase).toBe("ending");
    expect(sessionState(deadline, deadline - 1).phase).toBe("ending");
    expect(sessionState(deadline, deadline).phase).toBe("expired");
    expect(sessionState(deadline, deadline + 60_000).phase).toBe("expired");
  });

  it("never reports negative time remaining", () => {
    const deadline = T0 + DEMO_SESSION_MS;
    const state = sessionState(deadline, deadline + 10 * 60_000);
    expect(state.remainingMs).toBe(0);
    expect(state.elapsedFraction).toBe(1);
  });

  it("expires a session the laptop slept through", () => {
    /*
     * The reason the deadline is absolute rather than a ticking counter. A
     * counter driven by setInterval stops when the tab is backgrounded or the
     * machine sleeps, and would hand back time the visitor never spent.
     */
    const store = fakeStore();
    const deadline = startSession(T0, store);
    const afterSleep = T0 + 3 * 60 * 60 * 1000;
    expect(sessionState(deadline, afterSleep).phase).toBe("expired");
  });

  it("does not restart a session that is already running", () => {
    // A second tab, or a reload, must not grant a fresh 8 minutes.
    const store = fakeStore();
    const first = startSession(T0, store);
    const second = startSession(T0 + 5 * 60_000, store);
    expect(second).toBe(first);
  });

  it("starts a new session once the previous one has expired", () => {
    const store = fakeStore();
    const first = startSession(T0, store);
    const later = startSession(first + 1000, store);
    expect(later).toBeGreaterThan(first);
  });

  it("clears the deadline when the session ends", () => {
    const store = fakeStore();
    startSession(T0, store);
    expect(readDeadline(store)).not.toBeNull();
    endSession(store);
    expect(readDeadline(store)).toBeNull();
  });

  it("still starts when storage is unavailable", () => {
    // Private browsing with storage denied must not refuse the demo outright.
    const denied = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const deadline = startSession(T0, denied);
    expect(deadline).toBe(T0 + DEMO_SESSION_MS);
    expect(sessionState(deadline, T0).phase).toBe("active");
  });

  it("shows whole minutes early and seconds only near the end", () => {
    // Above ten minutes the seconds are noise; below it they are the point.
    // An eight-minute session lives entirely in the second branch, which is
    // why the clock on the demo badge always ticks.
    expect(formatRemaining(28 * 60_000)).toBe("28 min left");
    expect(formatRemaining(11 * 60_000)).toBe("11 min left");
    expect(formatRemaining(8 * 60_000)).toBe("8:00 left");
    expect(formatRemaining(9 * 60_000 + 5_000)).toBe("9:05 left");
    expect(formatRemaining(65_000)).toBe("1:05 left");
    expect(formatRemaining(0)).toBe("0:00 left");
  });

  it("warns in words that say what happens to the user's work", () => {
    const message = warningMessage(2 * 60_000);
    expect(message).toMatch(/ends in about 2 minutes/);
    // The part that matters: what they lose and how to keep it.
    expect(message).toMatch(/temporary/);
    expect(message).toMatch(/create an account/i);
  });

  it("says minute, singular, with one minute left", () => {
    expect(warningMessage(45_000)).toMatch(/about 1 minute\b/);
  });
});

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
  DEMO_RESET_MS,
  DEMO_WARNING_MS,
  sessionState,
  startSession,
  endSession,
  readDeadline,
  readNextEligibleAt,
  formatResetRemaining,
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
        const check = checkPrice(price.amountMinor, price.currency);
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

  it("accepts prices whose rendered value ends in 8 or 28", () => {
    expect(checkPrice(428, "USD").valid).toBe(true); // $4.28
    expect(checkPrice(2_800, "USD").valid).toBe(true); // $28
    expect(checkPrice(12_800, "USD").valid).toBe(true); // $128
    expect(checkPrice(28_800, "INR").valid).toBe(true); // ₹288
  });

  it("rejects a price whose rendered value does not end in 8 or 28", () => {
    const check = checkPrice(2_500, "USD");
    expect(check.valid).toBe(false);
    expect(check.reason).toContain("must end in 8 or 28");
  });

  it("treats free as valid, because a signature on zero means nothing", () => {
    expect(checkPrice(0).valid).toBe(true);
    expect(describePrice({ currency: "USD", amountMinor: 0 })).toBe("Free");
  });

  it("REFUSES TO RENDER an invalid price rather than falling back", () => {
    /*
     * The assertion this module exists for. A silent fallback would put the
     * exact price the rule forbids in front of a paying customer, quietly.
     */
    expect(() => describePrice({ currency: "USD", amountMinor: 2_500 })).toThrow(
      /Refusing to display an invalid price/,
    );
  });

  it("formats a valid price with the right symbol", () => {
    expect(describePrice({ currency: "USD", amountMinor: 428 })).toBe("$4.28");
    expect(describePrice({ currency: "INR", amountMinor: 588_800 })).toBe("₹5,888");
  });

  it("orders the paid plans by price within each currency", () => {
    // A longer plan costing less than a shorter one is a pricing bug that no
    // amount of digit-sum validation would catch.
    for (const currency of CURRENCIES) {
      const paid = PLANS.filter((p) => p.publiclyAvailable);
      const amounts = paid.map((p) => priceFor(p, currency).amountMinor);
      expect(
        [...amounts].sort((a, b) => a - b),
        `${currency} plans are out of order`,
      ).toEqual(amounts);
    }
  });

  it("gives a longer plan a better rate than the monthly one", () => {
    const month = priceFor(planById("month_1m")!, "USD").amountMinor;
    const year = priceFor(planById("year_1y")!, "USD").amountMinor;
    expect(year).toBeLessThan(month * 12);
  });

  it("sells no cloud requests, because there is no cloud to spend them on", () => {
    /*
     * THIS TEST USED TO PIN THE PHANTOM.
     *
     * It asserted that std_8d granted 28 cloud requests, month_1m 56, year_1y
     * 128 — and the plans advertised exactly that, as their headline benefit.
     * OCADE answers on the device; there is no metered upstream service, so
     * those requests could never have been delivered. Nothing displayed them
     * while FREE_LAUNCH_MODE was on, which is precisely why they survived, and
     * the whole point of keeping the payment system dormant rather than
     * deleting it is that switching it back on must be safe.
     *
     * Asserted at zero for EVERY plan, so re-adding one to any of them fails
     * here rather than being discovered by a customer who paid for it.
     */
    expect(CLOUD_WINDOW_MS).toBe(8 * 60 * 60 * 1000);
    for (const plan of PLANS) {
      expect(plan.cloudAllowance, `${plan.id} still sells cloud requests`).toBe(0);
    }
  });

  it("advertises no benefit that depends on a service OCADE does not run", () => {
    for (const plan of PLANS) {
      for (const benefit of plan.benefits) {
        expect(benefit, `${plan.id} advertises: ${benefit}`).not.toMatch(/cloud/i);
      }
      expect(plan.summary, `${plan.id} summary`).not.toMatch(/cloud|allowance/i);
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
    expect(missingProductIds({})).toHaveLength(3);
    expect(
      missingProductIds({
        OCADE_PRODUCT_ID_STD_8D: "a",
        OCADE_PRODUCT_ID_MONTH_1M: "b",
        OCADE_PRODUCT_ID_YEAR_1Y: "c",
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

describe("the 28-minute demo session", () => {
  const T0 = 1_700_000_000_000;

  /** In-memory storage so nothing touches the real localStorage. */
  function fakeStore() {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      _map: map,
    };
  }

  it("runs for exactly 28 minutes, resets after 28 hours, and warns with 3 to go", () => {
    // The number the copy promises, pinned against the number the timer uses.
    expect(DEMO_SESSION_MS).toBe(28 * 60 * 1000);
    expect(DEMO_RESET_MS).toBe(28 * 60 * 60 * 1000);
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
    const deadline = startSession(T0, store)!;
    const afterSleep = T0 + 3 * 60 * 60 * 1000;
    expect(sessionState(deadline, afterSleep).phase).toBe("expired");
  });

  it("does not restart a session that is already running", () => {
    // A second tab, or a reload, must not grant a fresh 28 minutes.
    const store = fakeStore();
    const first = startSession(T0, store);
    const second = startSession(T0 + 5 * 60_000, store);
    expect(second).toBe(first);
  });

  it("does not start a second demo until the 28-hour reset has elapsed", () => {
    const store = fakeStore();
    const first = startSession(T0, store)!;
    expect(startSession(first + 1000, store)).toBeNull();
    expect(readNextEligibleAt(store)).toBe(T0 + DEMO_RESET_MS);
    const later = startSession(T0 + DEMO_RESET_MS, store);
    expect(later).toBe(T0 + DEMO_RESET_MS + DEMO_SESSION_MS);
  });

  it("clears the deadline when the session ends", () => {
    const store = fakeStore();
    startSession(T0, store);
    expect(readDeadline(store)).not.toBeNull();
    endSession(store);
    expect(readDeadline(store)).toBeNull();
  });

  it("fails closed when durable storage is unavailable", () => {
    // Without durable state, refreshes could create unlimited demo sessions.
    const denied = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    };
    const deadline = startSession(T0, denied);
    expect(deadline).toBeNull();
    expect(sessionState(deadline, T0).phase).toBe("idle");
  });

  it("shows whole minutes early and seconds only near the end", () => {
    // Above ten minutes the seconds are noise; below it they are the point.
    // A 28-minute session uses both branches: calm whole minutes first, then a
    // precise second-by-second clock near the end.
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

  it("describes the remaining reset window for the forced sign-in handoff", () => {
    expect(formatResetRemaining(T0 + DEMO_RESET_MS, T0)).toBe("28 hours");
    expect(formatResetRemaining(T0 + 65 * 60_000, T0)).toBe("1 hour 5 minutes");
    expect(formatResetRemaining(T0, T0)).toBe("now");
  });
});

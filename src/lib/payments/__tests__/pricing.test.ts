import { describe, expect, it } from "vitest";
import {
  PLANS,
  currencyForRegion,
  describePrice,
  priceFor,
  type CurrencyCode,
  type PlanId,
} from "../pricing";
import { ALLOWANCES, MAX_MULTIPLE_OF_PRO } from "@/lib/commercial/usage-policy";

/**
 * THE APPROVED TABLE, WRITTEN OUT ONCE MORE ON PURPOSE.
 *
 * Restating it here is duplication, and that is the point: a test that read the
 * catalogue to check the catalogue would pass whatever the catalogue said. This
 * is `PLAN.md` and `CLAUDE.md` copied by hand, so a price that changes without
 * an owner decision fails here and nowhere else notices.
 */
const APPROVED: Record<Exclude<PlanId, "free">, Record<CurrencyCode, string>> = {
  pro_weekly: { USD: "$8", EUR: "€8", GBP: "£8", INR: "₹288" },
  pro_monthly: { USD: "$28", EUR: "€28", GBP: "£28", INR: "₹1,888" },
  max_weekly: { USD: "$28", EUR: "€28", GBP: "£28", INR: "₹1,888" },
  max_monthly: { USD: "$88", EUR: "€88", GBP: "£88", INR: "₹5,888" },
};

const CURRENCIES: CurrencyCode[] = ["USD", "EUR", "GBP", "INR"];

describe("the catalogue is the approved catalogue", () => {
  it("shows every paid plan at the price the owner approved", () => {
    for (const [id, expected] of Object.entries(APPROVED)) {
      const plan = PLANS.find((entry) => entry.id === id)!;
      for (const currency of CURRENCIES) {
        expect(describePrice(priceFor(plan, currency)), `${id} in ${currency}`).toBe(
          expected[currency],
        );
      }
    }
  });

  it("prices Free at nothing, in every currency", () => {
    const free = PLANS.find((plan) => plan.id === "free")!;
    for (const currency of CURRENCIES) {
      expect(describePrice(priceFor(free, currency))).toBe("Free");
    }
  });

  it("carries every currency on every plan, so no price falls back to dollars", () => {
    for (const plan of PLANS) {
      expect(plan.prices.map((price) => price.currency).sort()).toEqual([...CURRENCIES].sort());
    }
  });

  it("offers exactly one plan per tier and cadence", () => {
    expect(PLANS.map((plan) => plan.id)).toEqual([
      "free",
      "pro_weekly",
      "pro_monthly",
      "max_weekly",
      "max_monthly",
    ]);
  });
});

describe("the price signature", () => {
  it("refuses to display an amount that breaks it", () => {
    /*
     * The rule is enforced by making an invalid price impossible to SHOW. A
     * silent fallback would put exactly the number this module exists to
     * prevent in front of a customer, and would do it quietly.
     */
    expect(() => describePrice({ currency: "USD", amountMinor: 1_500 })).toThrow(/end in 8 or 28/);
    expect(() => describePrice({ currency: "USD", amountMinor: -100 })).toThrow(/whole/);
  });

  it("accepts every amount the catalogue actually carries", () => {
    for (const plan of PLANS) {
      for (const price of plan.prices) expect(() => describePrice(price)).not.toThrow();
    }
  });
});

describe("what the page sells is what the gate enforces", () => {
  it("makes Max exactly ten times Pro", () => {
    expect(ALLOWANCES.max.session).toBe(ALLOWANCES.pro.session * MAX_MULTIPLE_OF_PRO);
    expect(ALLOWANCES.max.week).toBe(ALLOWANCES.pro.week! * MAX_MULTIPLE_OF_PRO);
  });

  it("gives Free no weekly limit to explain", () => {
    expect(ALLOWANCES.free.week).toBeNull();
  });
});

describe("currency follows the region, and falls back rather than guessing", () => {
  it("reads the regions the catalogue is quoted in", () => {
    expect(currencyForRegion("IN")).toBe("INR");
    expect(currencyForRegion("GB")).toBe("GBP");
    expect(currencyForRegion("DE")).toBe("EUR");
    expect(currencyForRegion("US")).toBe("USD");
  });

  it("shows dollars rather than a plausible wrong currency", () => {
    // Showing a European price to somebody whose region could not be read is
    // worse than a familiar dollar figure they can convert themselves.
    expect(currencyForRegion(null)).toBe("USD");
    expect(currencyForRegion("ZZ")).toBe("USD");
  });
});

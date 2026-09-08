import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ARCHIVED_PLAN_IDS,
  CATALOGUE_VERSION,
  PLANS,
  checkPrice,
  describePrice,
  isArchivedPlanId,
  isPlanId,
  planById,
  priceFor,
  currencyForRegion,
  missingProductIds,
  tierOf,
  type CurrencyCode,
  type PlanId,
} from "../payments/pricing";
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

  it("charges the approved anchors, exactly", () => {
    /*
     * THE TABLE AS APPROVED. Written out rather than derived, because a
     * derivation would pass whatever the catalogue happens to say — which is
     * the thing being checked. USD, EUR and GBP carry the same figure by
     * decision: these are anchors, not conversions.
     */
    const anchors: Record<string, Record<string, number>> = {
      pro_weekly: { USD: 800, EUR: 800, GBP: 800, INR: 28_800 },
      pro_monthly: { USD: 2_800, EUR: 2_800, GBP: 2_800, INR: 188_800 },
      max_weekly: { USD: 2_800, EUR: 2_800, GBP: 2_800, INR: 188_800 },
      max_monthly: { USD: 8_800, EUR: 8_800, GBP: 8_800, INR: 588_800 },
    };
    for (const [planId, byCurrency] of Object.entries(anchors)) {
      for (const [currency, amountMinor] of Object.entries(byCurrency)) {
        expect(
          priceFor(planById(planId as PlanId)!, currency as CurrencyCode).amountMinor,
          `${planId}/${currency}`,
        ).toBe(amountMinor);
      }
    }
  });

  it("is exactly Free, Pro and Max, on weekly and monthly cadences", () => {
    expect(PLANS.map((plan) => plan.id)).toEqual([
      "free",
      "pro_weekly",
      "pro_monthly",
      "max_weekly",
      "max_monthly",
    ]);
    // The retired catalogue is not on sale, under any name.
    for (const retired of ARCHIVED_PLAN_IDS) {
      expect(PLANS.some((plan) => plan.id === (retired as string))).toBe(false);
      expect(isArchivedPlanId(retired)).toBe(true);
      expect(isPlanId(retired)).toBe(false);
    }
  });

  it("costs Max exactly what the approved table says relative to Pro", () => {
    // Max weekly is the Pro monthly figure, and Max monthly is not a multiple
    // of anything — both are approved anchors, so they are asserted, not
    // computed.
    expect(priceFor(planById("max_weekly")!, "USD").amountMinor).toBe(
      priceFor(planById("pro_monthly")!, "USD").amountMinor,
    );
    expect(priceFor(planById("max_monthly")!, "USD").amountMinor).toBeGreaterThan(
      priceFor(planById("max_weekly")!, "USD").amountMinor,
    );
  });

  it("gives Free a real account plan rather than a lapsing trial", () => {
    const free = planById("free")!;
    expect(free.tier).toBe("free");
    expect(free.cadence).toBeNull();
    // Null, not a far-future date: a free account must never expire.
    expect(free.periodMs).toBeNull();
    expect(free.productIdEnv).toBeNull();
    for (const price of free.prices) expect(price.amountMinor).toBe(0);
  });

  it("describes every plan as local-only and unmetered by the network", () => {
    for (const plan of PLANS) {
      expect(plan).not.toHaveProperty("cloudAllowance");
      expect(plan.benefits.join(" ")).not.toMatch(/cloud requests/i);
    }
  });

  it("keeps payment product ids out of source", () => {
    const source = JSON.stringify(PLANS);
    // Only the env var NAME may appear; a value that looks like a provider id
    // must not.
    expect(source).not.toMatch(/\bprice_[A-Za-z0-9]{10,}/);
    expect(source).not.toMatch(/\bprod_[A-Za-z0-9]{10,}/);
    // Free has nothing to charge, so it has no provider product.
    for (const plan of PLANS.filter((p) => p.id !== "free")) {
      expect(plan.productIdEnv).toMatch(/^OCADE_PRODUCT_ID_/);
    }
  });

  it("reports missing product ids instead of throwing", () => {
    expect(missingProductIds({})).toEqual([
      "OCADE_PRODUCT_ID_PRO_WEEKLY",
      "OCADE_PRODUCT_ID_PRO_MONTHLY",
      "OCADE_PRODUCT_ID_MAX_WEEKLY",
      "OCADE_PRODUCT_ID_MAX_MONTHLY",
    ]);
    expect(
      missingProductIds({
        OCADE_PRODUCT_ID_PRO_WEEKLY: "a",
        OCADE_PRODUCT_ID_PRO_MONTHLY: "b",
        OCADE_PRODUCT_ID_MAX_WEEKLY: "c",
        OCADE_PRODUCT_ID_MAX_MONTHLY: "d",
      }),
    ).toEqual([]);
    // Whitespace is not configuration.
    expect(missingProductIds({ OCADE_PRODUCT_ID_PRO_WEEKLY: "   " })).toContain(
      "OCADE_PRODUCT_ID_PRO_WEEKLY",
    );
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

describe("the catalogue names the version its records were written under", () => {
  it("stamps a dated version", () => {
    /*
     * Stamped on checkout intents and payment records so a later price change
     * cannot retroactively reinterpret what somebody already bought, and so an
     * event naming an unknown catalogue can be rejected rather than guessed at.
     */
    expect(CATALOGUE_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("keeps every current plan resolvable to a tier", () => {
    for (const plan of PLANS) {
      expect(["free", "pro", "max"]).toContain(tierOf(plan.id));
      expect(tierOf(plan.id)).toBe(plan.tier);
    }
  });

  it("keeps retired ids readable but unsellable", () => {
    // A payment record naming a retired plan is a financial fact; a database
    // that rejects it cannot store its own history.
    expect([...ARCHIVED_PLAN_IDS]).toEqual(["demo", "trial_2d", "std_8d", "month_1m", "year_1y"]);
    expect(isPlanId("std_8d")).toBe(false);
    expect(isArchivedPlanId("pro_weekly")).toBe(false);
  });
});

describe("no public surface quotes a price OCADE does not charge", () => {
  /*
   * A STALE PRICE IS A FALSE CLAIM, NOT A STALE LABEL.
   *
   * The comparison page carried "$4.28 / $28 / $128 planned" — the figures of a
   * retired catalogue — long enough to be published. Nothing failed, because
   * nothing checked: the catalogue module was correct and the marketing copy
   * quoted numbers by hand.
   *
   * So this reads the product's own source and refuses any figure that is not
   * in the catalogue. It is deliberately about RETIRED figures rather than all
   * numbers: prose legitimately contains "28 uses" and "6h28m".
   */
  const RETIRED_FIGURES = [
    /\$4\.28\b/,
    /\$128\b/,
    /₹1?2,?800\b/,
    /\$12\.?8\b/,
    /\b128\b\s*(?:USD|EUR|GBP)/,
  ];

  function publicSources(root = "src"): string[] {
    const found: string[] = [];
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__") continue;
        found.push(...publicSources(path));
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        found.push(path);
      }
    }
    return found;
  }

  it("quotes no figure from the retired catalogue", () => {
    // Comments stripped: what matters is what the product RENDERS, and the
    // comment explaining this fix necessarily quotes the figure it removed.
    for (const file of publicSources()) {
      const source = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");
      for (const pattern of RETIRED_FIGURES) {
        expect(source, `${file} quotes a retired price ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("still quotes the current anchors where it quotes a price at all", () => {
    // Proves the scan above is looking at files that really do contain prices,
    // rather than passing because it found none.
    const compare = readFileSync("src/routes/compare.tsx", "utf8");
    expect(compare).toMatch(/\$8\/week/);
    expect(compare).toMatch(/\$28\/week/);
  });
});

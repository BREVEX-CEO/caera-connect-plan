import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { billingEnabled, FREE_LAUNCH_MODE, paidEntitlementRequired } from "@/lib/launch-mode";

/**
 * Nobody can be charged while OCADE is free.
 *
 * The plans stay visible and priced — hiding them would answer "what will this
 * cost?" with silence, which is the question the pricing page exists for. What
 * is removed is every path from looking at a plan to paying for one.
 *
 * Three independent gates are asserted, and the redundancy is the point: the
 * button is never offered, the checkout hook refuses, and the server function
 * refuses. Any one of them alone is a single edit away from taking money.
 */

const PLAN_COMPARISON = readFileSync("src/components/settings/PlanComparison.tsx", "utf8");
const CHECKOUT_HOOK = readFileSync("src/hooks/usePaddleCheckout.ts", "utf8");
const PAYMENT_FN = readFileSync("src/utils/payments.functions.ts", "utf8");
const PADDLE = readFileSync("src/lib/paddle.ts", "utf8");

describe("the launch position", () => {
  it("is free, and every derived answer agrees", () => {
    expect(FREE_LAUNCH_MODE).toBe(true);
    expect(billingEnabled()).toBe(false);
    expect(paidEntitlementRequired()).toBe(false);
  });
});

describe("the purchase button", () => {
  it("is replaced by a coming-soon gate rather than left enabled", () => {
    expect(PLAN_COMPARISON).toContain("Coming soon");
    expect(PLAN_COMPARISON).toContain("const comingSoon = FREE_LAUNCH_MODE");
  });

  it("cannot be offered while the launch is free, whatever the deployment configures", () => {
    /*
     * The check that matters. `checkoutConfigured` used to depend only on the
     * environment, so a deployment with product ids set would have rendered a
     * live Choose button that the hook then refused — a click that fails is a
     * worse answer than a control that never invited the click.
     */
    expect(PLAN_COMPARISON).toMatch(
      /checkoutConfigured\s*=\s*\n?\s*!comingSoon\s*&&\s*missing\.length === 0/,
    );
  });

  it("still shows the price of every plan", () => {
    expect(PLAN_COMPARISON).toContain("describePrice(price)");
  });

  it("does not tell a working deployment it is misconfigured", () => {
    expect(PLAN_COMPARISON).toContain("!comingSoon && deploymentDetails");
  });
});

describe("the gates below the button", () => {
  it("stops the checkout hook", () => {
    expect(CHECKOUT_HOOK).toContain("billingEnabled()");
  });

  it("stops the provider client, on both entry points", () => {
    expect((PADDLE.match(/billingEnabled\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("stops the server function, so a crafted request cannot start a purchase", () => {
    expect(PAYMENT_FN).toContain("billingEnabled");
  });
});

describe("the payment code itself is preserved", () => {
  it("is inert, not deleted — re-enabling is a flag change, not a rebuild", () => {
    /*
     * Payment history is a financial record and the provider implementation is
     * months of work. Deleting either to express "we are free right now" would
     * be destroying an asset to make a statement.
     */
    expect(PADDLE.length).toBeGreaterThan(500);
    expect(PAYMENT_FN.length).toBeGreaterThan(500);
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkoutAvailability } from "@/lib/payments/checkout-availability";

/**
 * Nobody can be charged on a deployment that cannot take a payment.
 *
 * The plans stay visible and priced — hiding them would answer "what will this
 * cost?" with silence, which is the question the pricing page exists for. What
 * is removed is every path from looking at a plan to paying for one.
 *
 * THREE INDEPENDENT GATES, and the redundancy is the point: the button is never
 * offered, the checkout hook refuses, and the server function refuses. Any one
 * of them alone is a single edit away from taking money.
 *
 * They are no longer keyed on a hand-set flag. Each one asks whether the
 * deployment is configured, so the gates cannot disagree with reality — or with
 * each other — the way a constant and a credential can.
 */

const PLAN_COMPARISON = readFileSync("src/components/settings/PlanComparison.tsx", "utf8");
const CHECKOUT_HOOK = readFileSync("src/hooks/usePaddleCheckout.ts", "utf8");
const PAYMENT_FN = readFileSync("src/utils/payments.functions.ts", "utf8");
const PADDLE = readFileSync("src/lib/paddle.ts", "utf8");

describe("the position this deployment is actually in", () => {
  it("cannot take a payment, and every derived answer agrees", () => {
    const availability = checkoutAvailability({}, undefined);
    expect(availability.available).toBe(false);
    expect(availability.missing.length).toBeGreaterThan(0);
  });
});

describe("the purchase button", () => {
  it("is not offered unless the deployment is configured", () => {
    /*
     * `checkoutConfigured` gates the Choose button. A deployment missing any
     * product id renders an explanation instead — a click that fails is a worse
     * answer than a control that never invited the click.
     */
    expect(PLAN_COMPARISON).toMatch(
      /checkoutConfigured\s*=\s*\n?\s*missing\.length === 0 && typeof onChoose === "function"/,
    );
    expect(PLAN_COMPARISON).toContain("checkoutConfigured ? (");
  });

  it("says so plainly when there is nothing to buy", () => {
    expect(PLAN_COMPARISON).toContain("CHECKOUT_UNAVAILABLE_NOTICE");
  });

  it("never offers a checkout for the free plan", () => {
    // A "Choose Free" button would be a checkout for nothing.
    expect(PLAN_COMPARISON).toMatch(/plan\.publiclyAvailable && plan\.tier !== "free"/);
  });

  it("still shows the price of every plan", () => {
    expect(PLAN_COMPARISON).toContain("describePrice(price)");
  });

  it("names the missing configuration only to an operator", () => {
    // The variable names help whoever can fix it; they are behind
    // `deploymentDetails` rather than shown to every customer.
    expect(PLAN_COMPARISON).toContain("deploymentDetails && !checkoutConfigured");
  });
});

describe("the gates below the button", () => {
  it("stops the checkout hook", () => {
    expect(CHECKOUT_HOOK).toContain("isCheckoutConfigured()");
  });

  it("stops the provider client, on both entry points", () => {
    // `initializePaddle` and `getPaddlePriceId`, plus the definition itself.
    expect((PADDLE.match(/isCheckoutConfigured\(\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("stops the server function, so a crafted request cannot start a purchase", () => {
    /*
     * The browser's gates protect an honest caller. This one protects against a
     * request that skipped them — which is why it checks the SERVER's
     * credentials rather than the browser's token.
     */
    expect(PAYMENT_FN).toContain("serverCheckoutConfigured");
    expect(PAYMENT_FN.indexOf("serverCheckoutConfigured")).toBeLessThan(
      PAYMENT_FN.indexOf("gatewayFetch("),
    );
  });
});

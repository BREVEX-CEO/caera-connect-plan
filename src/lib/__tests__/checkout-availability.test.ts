import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  browserCheckoutConfigured,
  checkoutAvailability,
  serverCheckoutConfigured,
} from "@/lib/payments/checkout-availability";
import { initializePaddle, isCheckoutConfigured } from "@/lib/paddle";
import { PLANS } from "@/lib/payments/pricing";

/**
 * NOBODY IS OFFERED A CHECKOUT THIS DEPLOYMENT CANNOT COMPLETE.
 *
 * This replaces the `FREE_LAUNCH_MODE` boundary. The old flag was a hand-set
 * constant asserting that nobody could be charged; it was true, but it did not
 * measure anything, so turning it off on a deployment with no credentials would
 * have opened a checkout that could not complete — and leaving it on with
 * credentials present would have hidden a working one.
 *
 * Availability is now derived from configuration, so these tests assert the
 * DERIVATION rather than the answer. The answer on this deployment is still
 * "unavailable", and the last block proves it.
 */

/** Every product id the catalogue requires, so the fixture cannot drift. */
function allProductIds(): Record<string, string> {
  return Object.fromEntries(
    PLANS.filter((plan) => plan.publiclyAvailable && plan.productIdEnv !== null).map((plan) => [
      plan.productIdEnv!,
      "configured",
    ]),
  );
}

const SANDBOX_PAIR = {
  PAYMENTS_SANDBOX_API_KEY: "key",
  PAYMENTS_SANDBOX_WEBHOOK_SECRET: "secret",
};

describe("the server half of checkout availability", () => {
  it("is unavailable with no configuration at all", () => {
    const missing = serverCheckoutConfigured({});
    expect(missing).toContain("a complete sandbox or live provider credential pair");
    for (const key of Object.keys(allProductIds())) expect(missing).toContain(key);
  });

  it("accepts a sandbox-only deployment, which is how the matrix is proven", () => {
    /*
     * Requiring BOTH environments would make a sandbox deployment
     * indistinguishable from an unconfigured one — and sandbox-only is exactly
     * the state the payment matrix has to be proven in before live credentials
     * are ever created.
     */
    expect(serverCheckoutConfigured({ ...SANDBOX_PAIR, ...allProductIds() })).toEqual([]);
  });

  it("accepts a live-only deployment on the same terms", () => {
    expect(
      serverCheckoutConfigured({
        PAYMENTS_LIVE_API_KEY: "key",
        PAYMENTS_LIVE_WEBHOOK_SECRET: "secret",
        ...allProductIds(),
      }),
    ).toEqual([]);
  });

  it("refuses a half-configured credential pair", () => {
    /*
     * An API key with no webhook secret can take money and cannot verify that
     * it was taken. That is the worst of the two failure modes, so it fails
     * closed rather than counting as configured.
     */
    expect(
      serverCheckoutConfigured({ PAYMENTS_LIVE_API_KEY: "key", ...allProductIds() }),
    ).toContain("a complete sandbox or live provider credential pair");
    expect(
      serverCheckoutConfigured({ PAYMENTS_SANDBOX_WEBHOOK_SECRET: "s", ...allProductIds() }),
    ).toContain("a complete sandbox or live provider credential pair");
  });

  it("names every sellable plan whose product id is missing", () => {
    // A catalogue gap would let somebody reach a checkout for a plan the server
    // cannot price.
    const ids = allProductIds();
    const [first, ...rest] = Object.keys(ids);
    const partial = Object.fromEntries(rest.map((key) => [key, "configured"]));
    const missing = serverCheckoutConfigured({ ...SANDBOX_PAIR, ...partial });
    expect(missing).toEqual([first]);
  });

  it("does not count whitespace as configuration", () => {
    expect(
      serverCheckoutConfigured({
        PAYMENTS_SANDBOX_API_KEY: "  ",
        PAYMENTS_SANDBOX_WEBHOOK_SECRET: "  ",
        ...allProductIds(),
      }),
    ).toContain("a complete sandbox or live provider credential pair");
  });

  it("asks nothing of Free, which has nothing to charge", () => {
    const free = PLANS.find((plan) => plan.tier === "free")!;
    expect(free.productIdEnv).toBeNull();
    expect(serverCheckoutConfigured({ ...SANDBOX_PAIR, ...allProductIds() })).toEqual([]);
  });
});

describe("the browser half, and the two together", () => {
  it("needs the public client token", () => {
    expect(browserCheckoutConfigured({})).toBe(false);
    expect(browserCheckoutConfigured({ VITE_PAYMENTS_CLIENT_TOKEN: "   " })).toBe(false);
    expect(browserCheckoutConfigured({ VITE_PAYMENTS_CLIENT_TOKEN: "live_abc" })).toBe(true);
  });

  it("requires both halves before a checkout may be offered", () => {
    const serverReady = { ...SANDBOX_PAIR, ...allProductIds() };
    expect(checkoutAvailability(serverReady, undefined).available).toBe(false);
    expect(checkoutAvailability(serverReady, undefined).missing).toEqual([
      "VITE_PAYMENTS_CLIENT_TOKEN",
    ]);
    expect(checkoutAvailability({}, "test_abc").available).toBe(false);
    expect(checkoutAvailability(serverReady, "test_abc").available).toBe(true);
  });

  it("tells a customer the truth without naming the deployment's gaps", () => {
    const result = checkoutAvailability({}, undefined);
    expect(result.customerNotice).toMatch(/not available for purchase yet/i);
    expect(result.customerNotice).toMatch(/nothing has been charged/i);
    // The operator detail must never leak into the customer sentence.
    for (const key of result.missing) {
      expect(result.customerNotice).not.toContain(key);
    }
  });
});

describe("on THIS deployment, nobody can be charged", () => {
  it("refuses checkout below the UI layer", async () => {
    expect(isCheckoutConfigured()).toBe(false);
    await expect(initializePaddle()).rejects.toThrow(/not configured/i);
  });

  it("gates provider price resolution in the server function, before any call out", () => {
    const source = readFileSync("src/utils/payments.functions.ts", "utf8");
    expect(source).toContain("serverCheckoutConfigured(");
    expect(source.indexOf("serverCheckoutConfigured(")).toBeLessThan(
      source.indexOf("gatewayFetch("),
    );
  });

  it("keeps the retired launch flag from coming back", () => {
    /*
     * The specific regression: a boolean that says "nobody may be charged"
     * while measuring nothing. If one reappears, the availability derivation
     * above stops being the authority and the two can disagree.
     *
     * Comments are stripped first. The availability module's own documentation
     * names the flag it replaced, which is the reason to keep that sentence,
     * not a reason to fail.
     */
    const code = (path: string) =>
      readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\/\/[^\n]*/g, " ");

    for (const file of [
      "src/lib/payments/checkout-availability.ts",
      "src/lib/paddle.ts",
      "src/hooks/usePaddleCheckout.ts",
      "src/components/settings/PlanComparison.tsx",
      "src/routes/_authenticated/settings.billing.tsx",
      "src/routes/checkout.success.tsx",
      "src/utils/payments.functions.ts",
      "src/lib/capabilities/registry.ts",
      "src/routes/download.tsx",
      "src/routes/_authenticated/settings.usage.tsx",
    ]) {
      expect(code(file), file).not.toMatch(
        /FREE_LAUNCH_MODE|billingEnabled|paidEntitlementRequired/,
      );
    }

    // And the module itself is gone, not merely unreferenced.
    expect(() => readFileSync("src/lib/launch-mode.ts", "utf8")).toThrow();
  });
});

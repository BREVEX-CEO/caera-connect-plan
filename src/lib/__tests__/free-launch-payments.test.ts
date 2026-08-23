import { describe, expect, it } from "vitest";
import { billingEnabled, FREE_LAUNCH_MODE, paidEntitlementRequired } from "@/lib/launch-mode";
import { initializePaddle, isCheckoutConfigured } from "@/lib/paddle";
import { readFileSync } from "node:fs";

describe("free launch payment boundary", () => {
  it("keeps billing and paid entitlement gates disabled", () => {
    expect(FREE_LAUNCH_MODE).toBe(true);
    expect(billingEnabled()).toBe(false);
    expect(paidEntitlementRequired()).toBe(false);
  });

  it("refuses checkout below the UI layer", async () => {
    expect(isCheckoutConfigured()).toBe(false);
    await expect(initializePaddle()).rejects.toThrow(/free launch mode/i);
  });

  it("also blocks provider price resolution in the server function", () => {
    const source = readFileSync("src/utils/payments.functions.ts", "utf8");
    expect(source).toContain("if (!billingEnabled())");
    expect(source).toContain("Price resolution is disabled while OCADE is in free launch mode.");
    expect(source.indexOf("if (!billingEnabled())")).toBeLessThan(source.indexOf("gatewayFetch("));
  });
});

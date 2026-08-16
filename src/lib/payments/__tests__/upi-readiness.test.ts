/**
 * The distinction this module exists to protect: an operator fault must never
 * be presented to a customer as "wrong region", and a correctly configured
 * system must never look broken to a buyer who simply lives elsewhere.
 */
import { describe, expect, it } from "vitest";
import { deriveUpiState, summariseUpiReadiness, type UpiReadiness } from "../upi-readiness";

const readiness = (over: Partial<UpiReadiness>): UpiReadiness => ({
  environment: "sandbox",
  currency: "USD",
  state: "available",
  reasons: [],
  catalogue: [],
  checkedAt: new Date().toISOString(),
  ...over,
});

describe("UPI readiness reasoning", () => {
  it("treats a non-INR buyer as ineligible, not as a fault", () => {
    expect(deriveUpiState(["region_not_eligible"])).toBe("region_not_eligible");
  });

  it("reports setup required when the catalogue lacks a rupee price", () => {
    expect(deriveUpiState(["catalogue_missing_inr_price"])).toBe("setup_required");
  });

  it("lets an operator fault outrank the buyer's region", () => {
    expect(deriveUpiState(["region_not_eligible", "provider_account_not_approved"])).toBe(
      "setup_required",
    );
  });

  it("says nothing when UPI is genuinely available", () => {
    expect(summariseUpiReadiness(readiness({ currency: "INR" }))).toBeNull();
  });

  it("names the buyer's currency when explaining a hidden UPI option", () => {
    const text = summariseUpiReadiness(
      readiness({ state: "region_not_eligible", reasons: ["region_not_eligible"], currency: "EUR" }),
    );
    expect(text).toContain("EUR");
  });

  it("explains an approval problem without blaming the buyer", () => {
    const text = summariseUpiReadiness(
      readiness({
        currency: "INR",
        state: "setup_required",
        reasons: ["provider_account_not_approved"],
      }),
    )!;
    expect(text).toMatch(/not approved/i);
    expect(text).not.toMatch(/your region/i);
  });
});

import { describe, it, expect } from "vitest";
import {
  PLANS,
  entitlementState,
  expiryOf,
  canRegisterDevice,
  offlineEntitlementValid,
} from "../ocade-allowance";

const at = (iso: string) => new Date(iso);

describe("entitlements", () => {
  it("derives expiry from plan duration", () => {
    const e = { planId: "std_8d" as const, startedAt: at("2026-07-01T00:00:00Z") };
    expect(expiryOf(e).toISOString()).toBe("2026-07-09T00:00:00.000Z");
  });

  it.each(["trial_2d", "std_8d", "month_1m", "year_1y"] as const)(
    "%s grants the common device limits",
    (id) => {
    expect(PLANS[id].desktopDevices).toBe(2);
    expect(PLANS[id].mobileDevices).toBe(2);
    },
  );

  it("keeps local available after expiry and disables only cloud/premium", () => {
    const s = entitlementState(
      { planId: "trial_2d", startedAt: at("2026-07-01T00:00:00Z") },
      at("2026-07-20T00:00:00Z"),
    );
    expect(s.active).toBe(false);
    // Never locked out of your own device or data.
    expect(s.localInferenceAvailable).toBe(true);
    expect(s.localDataAvailable).toBe(true);
    expect(s.localExportAvailable).toBe(true);
  });

  it("treats no subscription as local-only, never as locked out", () => {
    const s = entitlementState(null, at("2026-07-22T00:00:00Z"));
    expect(s.localInferenceAvailable).toBe(true);
    expect(s.localDataAvailable).toBe(true);
  });

  it("is active before expiry", () => {
    const s = entitlementState(
      { planId: "year_1y", startedAt: at("2026-07-01T00:00:00Z") },
      at("2026-07-22T00:00:00Z"),
    );
    expect(s.active).toBe(true);
  });
});

describe("device limits", () => {
  const s = entitlementState(
    { planId: "month_1m", startedAt: at("2026-07-20T00:00:00Z") },
    at("2026-07-22T00:00:00Z"),
  );

  it("allows up to 2 desktop and 2 mobile", () => {
    expect(
      canRegisterDevice({ kind: "desktop", currentDesktop: 1, currentMobile: 0, state: s }).allowed,
    ).toBe(true);
    expect(
      canRegisterDevice({ kind: "mobile", currentDesktop: 2, currentMobile: 1, state: s }).allowed,
    ).toBe(true);
  });

  it("refuses beyond the limit with a clear reason", () => {
    const r = canRegisterDevice({ kind: "desktop", currentDesktop: 2, currentMobile: 0, state: s });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/limit of 2 desktop/i);
  });

  it("does not allow malformed device counts to bypass the limit", () => {
    expect(
      canRegisterDevice({
        kind: "mobile",
        currentDesktop: 0,
        currentMobile: Number.NaN,
        state: s,
      }).allowed,
    ).toBe(false);
  });
});

describe("offline entitlement grace", () => {
  it("stays valid within the grace period", () => {
    expect(offlineEntitlementValid(at("2026-07-20T00:00:00Z"), at("2026-07-22T00:00:00Z"))).toBe(
      true,
    );
  });
  it("expires after the grace period", () => {
    expect(offlineEntitlementValid(at("2026-07-01T00:00:00Z"), at("2026-07-22T00:00:00Z"))).toBe(
      false,
    );
  });
  it("rejects invalid or future verification timestamps", () => {
    expect(offlineEntitlementValid(at("2027-01-01T00:00:00Z"), at("2026-07-22T00:00:00Z"))).toBe(
      false,
    );
    expect(offlineEntitlementValid(new Date(Number.NaN), at("2026-07-22T00:00:00Z"))).toBe(false);
  });
});

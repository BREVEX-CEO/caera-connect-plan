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
  it("derives a weekly period's expiry from the plan", () => {
    const e = { planId: "pro_weekly" as const, startedAt: at("2026-07-01T00:00:00Z") };
    expect(expiryOf(e)?.toISOString()).toBe("2026-07-08T00:00:00.000Z");
  });

  it("derives a monthly period's expiry from the plan", () => {
    const e = { planId: "max_monthly" as const, startedAt: at("2026-07-01T00:00:00Z") };
    expect(expiryOf(e)?.toISOString()).toBe("2026-07-31T00:00:00.000Z");
  });

  it("gives Free no expiry at all, rather than a distant one", () => {
    /*
     * Null, not a far-future date. A sentinel date eventually arrives, and
     * arriving is exactly what a free account must never do.
     */
    const e = { planId: "free" as const, startedAt: at("2026-07-01T00:00:00Z") };
    expect(expiryOf(e)).toBeNull();
    expect(entitlementState(e, at("2099-01-01T00:00:00Z")).active).toBe(true);
  });

  it.each(["pro_weekly", "pro_monthly", "max_weekly", "max_monthly"] as const)(
    "%s grants the common paid device limits",
    (id) => {
      expect(PLANS[id].desktopDevices).toBe(2);
      expect(PLANS[id].mobileDevices).toBe(2);
    },
  );

  it("keeps local available after a paid period ends", () => {
    const s = entitlementState(
      { planId: "pro_weekly", startedAt: at("2026-07-01T00:00:00Z") },
      at("2026-07-20T00:00:00Z"),
    );
    expect(s.active).toBe(false);
    // Never locked out of your own device or data.
    expect(s.localInferenceAvailable).toBe(true);
    expect(s.localDataAvailable).toBe(true);
    expect(s.localExportAvailable).toBe(true);
  });

  it("treats no subscription as a Free account, not as a lapsed one", () => {
    /*
     * This used to report `active: false` and hand out a PAID plan's device
     * allowance to somebody with no subscription at all — free access on paid
     * limits, and a screen that called a healthy account inactive.
     */
    const s = entitlementState(null, at("2026-07-22T00:00:00Z"));
    expect(s.active).toBe(true);
    expect(s.expiresAt).toBeNull();
    expect(s.desktopDevices).toBe(PLANS.free.desktopDevices);
    expect(s.mobileDevices).toBe(PLANS.free.mobileDevices);
    expect(s.localInferenceAvailable).toBe(true);
    expect(s.localDataAvailable).toBe(true);
  });

  it("is active before expiry", () => {
    const s = entitlementState(
      { planId: "pro_monthly", startedAt: at("2026-07-01T00:00:00Z") },
      at("2026-07-22T00:00:00Z"),
    );
    expect(s.active).toBe(true);
  });
});

describe("device limits", () => {
  const s = entitlementState(
    { planId: "pro_monthly", startedAt: at("2026-07-20T00:00:00Z") },
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

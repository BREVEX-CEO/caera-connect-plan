import { describe, it, expect } from "vitest";
import {
  CLOUD_ALLOWANCE,
  PLANS,
  currentWindow,
  allowanceState,
  consumesAllowance,
  canUseCloud,
  entitlementState,
  expiryOf,
  canRegisterDevice,
  offlineEntitlementValid,
  describeAllowance,
} from "../ocade-allowance";

const at = (iso: string) => new Date(iso);

describe("windowing", () => {
  it("uses fixed 8-hour windows aligned to UTC midnight", () => {
    const w = currentWindow(at("2026-07-22T09:30:00Z"));
    expect(w.start.toISOString()).toBe("2026-07-22T08:00:00.000Z");
    expect(w.end.toISOString()).toBe("2026-07-22T16:00:00.000Z");
  });

  it("rolls to the next window at the boundary", () => {
    expect(currentWindow(at("2026-07-22T16:00:00Z")).start.toISOString()).toBe(
      "2026-07-22T16:00:00.000Z",
    );
  });
});

describe("allowance state", () => {
  it("reports remaining and reset time", () => {
    const s = allowanceState(3, at("2026-07-22T09:00:00Z"));
    expect(s.limit).toBe(CLOUD_ALLOWANCE);
    expect(s.used).toBe(3);
    expect(s.remaining).toBe(25);
    expect(s.exhausted).toBe(false);
    expect(s.resetsAt.toISOString()).toBe("2026-07-22T16:00:00.000Z");
  });

  it("clamps and marks exhaustion at the limit", () => {
    const s = allowanceState(99, at("2026-07-22T09:00:00Z"));
    expect(s.used).toBe(CLOUD_ALLOWANCE);
    expect(s.remaining).toBe(0);
    expect(s.exhausted).toBe(true);
  });
});

describe("what consumes allowance", () => {
  it("never charges local, whatever the outcome", () => {
    for (const o of ["success", "failed", "cancelled", "system_retry"] as const) {
      expect(consumesAllowance("local", o)).toBe(false);
    }
  });

  it("charges cloud only on success", () => {
    expect(consumesAllowance("cloud", "success")).toBe(true);
    expect(consumesAllowance("cloud", "failed")).toBe(false);
    expect(consumesAllowance("cloud", "cancelled")).toBe(false);
    expect(consumesAllowance("cloud", "system_retry")).toBe(false);
  });
});

describe("cloud gating", () => {
  const fresh = allowanceState(0, at("2026-07-22T09:00:00Z"));
  const spent = allowanceState(CLOUD_ALLOWANCE, at("2026-07-22T09:00:00Z"));

  it("allows cloud with an active plan and remaining allowance", () => {
    expect(canUseCloud({ entitlementActive: true, state: fresh })).toEqual({ allowed: true });
  });

  it("blocks when the allowance is spent but points at unlimited local", () => {
    const d = canUseCloud({ entitlementActive: true, state: spent });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.code).toBe("allowance_exhausted");
      expect(d.reason).toMatch(/local is still unlimited/i);
      expect(d.resetsAt).toBeInstanceOf(Date);
    }
  });

  it("blocks when the plan has expired, without blocking local", () => {
    const d = canUseCloud({ entitlementActive: false, state: fresh });
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.code).toBe("subscription_expired");
      expect(d.reason).toMatch(/local still works/i);
    }
  });
});

describe("entitlements", () => {
  it("derives expiry from plan duration", () => {
    const e = { planId: "std_8d" as const, startedAt: at("2026-07-01T00:00:00Z") };
    expect(expiryOf(e).toISOString()).toBe("2026-07-09T00:00:00.000Z");
  });

  it.each(["trial_2d", "std_8d", "month_1m", "year_1y"] as const)(
    "%s grants the same allowance and device limits",
    (id) => {
      expect(PLANS[id].cloudAllowancePerWindow).toBe(CLOUD_ALLOWANCE);
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
    expect(s.cloudAvailable).toBe(false);
    expect(s.premiumAvailable).toBe(false);
    // Never locked out of your own device or data.
    expect(s.localInferenceAvailable).toBe(true);
    expect(s.localDataAvailable).toBe(true);
    expect(s.localExportAvailable).toBe(true);
  });

  it("treats no subscription as local-only, never as locked out", () => {
    const s = entitlementState(null, at("2026-07-22T00:00:00Z"));
    expect(s.cloudAvailable).toBe(false);
    expect(s.localInferenceAvailable).toBe(true);
    expect(s.localDataAvailable).toBe(true);
  });

  it("is active before expiry", () => {
    const s = entitlementState(
      { planId: "year_1y", startedAt: at("2026-07-01T00:00:00Z") },
      at("2026-07-22T00:00:00Z"),
    );
    expect(s.active).toBe(true);
    expect(s.cloudAvailable).toBe(true);
  });
});

describe("device limits", () => {
  const s = entitlementState({ planId: "month_1m", startedAt: at("2026-07-20T00:00:00Z") }, at("2026-07-22T00:00:00Z"));

  it("allows up to 2 desktop and 2 mobile", () => {
    expect(canRegisterDevice({ kind: "desktop", currentDesktop: 1, currentMobile: 0, state: s }).allowed).toBe(true);
    expect(canRegisterDevice({ kind: "mobile", currentDesktop: 2, currentMobile: 1, state: s }).allowed).toBe(true);
  });

  it("refuses beyond the limit with a clear reason", () => {
    const r = canRegisterDevice({ kind: "desktop", currentDesktop: 2, currentMobile: 0, state: s });
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/limit of 2 desktop/i);
  });
});

describe("offline entitlement grace", () => {
  it("stays valid within the grace period", () => {
    expect(offlineEntitlementValid(at("2026-07-20T00:00:00Z"), at("2026-07-22T00:00:00Z"))).toBe(true);
  });
  it("expires after the grace period", () => {
    expect(offlineEntitlementValid(at("2026-07-01T00:00:00Z"), at("2026-07-22T00:00:00Z"))).toBe(false);
  });
});

describe("describeAllowance", () => {
  it("shows remaining requests", () => {
    expect(describeAllowance(allowanceState(5, at("2026-07-22T09:00:00Z")))).toMatch(/23 of 28/);
  });
  it("explains exhaustion and points at unlimited local", () => {
    const msg = describeAllowance(allowanceState(28, at("2026-07-22T09:00:00Z")));
    expect(msg).toMatch(/resets at 16:00 UTC/);
    expect(msg).toMatch(/Local is unlimited/i);
  });
});

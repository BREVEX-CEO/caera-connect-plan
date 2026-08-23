import { describe, expect, it } from "vitest";
import { allCapabilityReports, capabilityReport, worstStatus } from "../registry";
import { isUsable } from "../types";

describe("capability registry", () => {
  it("never reports READY for a capability with no observed signal", () => {
    /*
     * The load-bearing rule. If a probe has not run, the honest answer is
     * "not set up", never "ready" — a false READY is the one failure mode the
     * whole system exists to prevent.
     */
    const reports = allCapabilityReports({});
    for (const report of reports) {
      expect(isUsable(report.status), `${report.id} claimed usable with no signal`).toBe(false);
    }
  });

  it("reports the local engine as ready only when it is reachable with models", () => {
    expect(
      capabilityReport("localAI", { localEngine: { reachable: false, modelCount: 0 } }).status,
    ).toBe("NOT_CONFIGURED");
    expect(
      capabilityReport("localAI", { localEngine: { reachable: true, modelCount: 0 } }).status,
    ).toBe("DEGRADED");
    expect(
      capabilityReport("localAI", { localEngine: { reachable: true, modelCount: 2 } }).status,
    ).toBe("READY");
  });

  it("does not call sync a failure when the user chose local-only storage", () => {
    const report = capabilityReport("privateSync", {
      sync: { signedIn: true, mode: "browser_only" },
    });
    expect(report.status).toBe("UNAVAILABLE");
    expect(report.detail).toMatch(/choice, not a fault/i);
  });

  it("says monitors are not running when no runner polls them", () => {
    const report = capabilityReport("monitors", {
      monitors: { configuredCount: 3, runnerAvailable: false },
    });
    expect(report.status).toBe("NOT_CONFIGURED");
    expect(report.detail).toMatch(/no checks are running/i);
  });

  it("requires approval when the companion is connected but unpermitted", () => {
    expect(
      capabilityReport("computerControl", { companion: { connected: true, approved: false } })
        .status,
    ).toBe("NEEDS_APPROVAL");
    expect(
      capabilityReport("computerControl", { companion: { connected: true, approved: true } })
        .status,
    ).toBe("READY");
  });

  it("degrades voice when only one half of speech is supported", () => {
    const report = capabilityReport("voice", {
      speech: { inputSupported: true, outputSupported: false },
    });
    expect(report.status).toBe("DEGRADED");
  });

  it("summarises with the worst status present", () => {
    expect(
      worstStatus([
        { id: "localAI", label: "a", status: "READY", detail: "" },
        { id: "localAI", label: "b", status: "FAILED", detail: "" },
      ]),
    ).toBe("FAILED");
  });
});

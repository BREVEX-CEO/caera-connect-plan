import { describe, expect, it } from "vitest";
import { cloudWouldWorkAfterApproval, resolveEngine } from "../resolve";

const base = {
  preference: "auto" as const,
  privacyMode: "browser_only" as const,
  deviceMode: "pc_web" as const,
  localAvailable: true,
  localLabel: "OCADE Browser (shared)",
  localVision: false,
  visionRequired: false,
  online: true,
};

describe("OCADE local-only engine authority", () => {
  it("always chooses a ready local engine", () => {
    const result = resolveEngine(base);
    expect(result.ok).toBe(true);
    expect(result.target).toEqual({ kind: "local", label: "OCADE Browser (shared)" });
    expect(result.consumesAllowance).toBe(false);
  });

  it("fails closed instead of falling back when no local engine exists", () => {
    const result = resolveEngine({ ...base, localAvailable: false });
    expect(result.ok).toBe(false);
    expect(result.target).toBeNull();
    expect(result.code).toBe("local_only_and_no_local_engine");
    expect(result.reason).toMatch(/will not fall back to a cloud model/i);
  });

  it("rejects a stale cloud-only preference rather than reviving remote routing", () => {
    const result = resolveEngine({ ...base, preference: "cloud_only" });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("cloud_routing_removed");
    expect(result.target).toBeNull();
  });

  it("never makes cloud possible through an approval flag", () => {
    expect(cloudWouldWorkAfterApproval(base)).toBe(false);
  });

  it("refuses image requests when no local vision engine exists", () => {
    const result = resolveEngine({ ...base, visionRequired: true, localVision: false });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("vision_unavailable_locally");
    expect(result.reason).toMatch(/will not send the image to a cloud model/i);
  });
});

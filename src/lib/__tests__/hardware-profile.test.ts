import { describe, it, expect } from "vitest";
import { recommendProfile, type LocalProfile } from "../skills/hardware-profile";
import type { HardwareSnapshot } from "../skills/resource-governor";

const GB = 1024 ** 3;

const profile = (over: Partial<LocalProfile> = {}): LocalProfile => ({
  id: "small",
  label: "Compact",
  minRamBytes: 2 * GB,
  installBytes: 1 * GB,
  downloadBytes: 1 * GB,
  requiresGpu: false,
  installed: true,
  tier: 1,
  ...over,
});

const hw = (over: Partial<HardwareSnapshot> = {}): HardwareSnapshot => ({
  totalRamBytes: 16 * GB,
  availableRamBytes: 12 * GB,
  freeStorageBytes: 50 * GB,
  hasGpu: false,
  ...over,
});

describe("picking a local profile", () => {
  it("recommends the most capable installed profile that fits", () => {
    const r = recommendProfile(hw(), [
      profile({ id: "small", label: "Compact", tier: 1, minRamBytes: 2 * GB, installed: true }),
      profile({ id: "mid", label: "Standard", tier: 2, minRamBytes: 6 * GB, installed: true }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.ready?.id).toBe("mid");
    expect(r.data.needsCloud).toBe(false);
  });

  it("excludes a profile that needs more RAM than is safely available", () => {
    const r = recommendProfile(hw({ availableRamBytes: 4 * GB }), [
      profile({ id: "big", label: "Large", tier: 3, minRamBytes: 12 * GB, installed: true }),
      profile({ id: "small", label: "Compact", tier: 1, minRamBytes: 2 * GB, installed: true }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.ready?.id).toBe("small");
    expect(r.data.excluded.map((e) => e.profile.id)).toContain("big");
    expect(r.data.excluded[0].reason).toMatch(/needs .* of RAM/i);
  });

  it("excludes a GPU-only profile on a machine with no GPU", () => {
    const r = recommendProfile(hw({ hasGpu: false }), [
      profile({ id: "gpu", label: "GPU", tier: 3, requiresGpu: true, installed: true }),
      profile({ id: "cpu", label: "CPU", tier: 1, requiresGpu: false, installed: true }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.ready?.id).toBe("cpu");
    expect(r.data.excluded[0].reason).toMatch(/needs a GPU/i);
  });

  it("uses a GPU profile when a GPU is present", () => {
    const r = recommendProfile(hw({ hasGpu: true }), [
      profile({ id: "gpu", label: "GPU", tier: 3, requiresGpu: true, installed: true }),
      profile({ id: "cpu", label: "CPU", tier: 1, requiresGpu: false, installed: true }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.ready?.id).toBe("gpu");
  });
});

/**
 * The rule stated in bold in §6.3: never auto-download. A fitting but absent
 * profile is offered for approval, not selected as ready.
 */
describe("never auto-downloads a large component", () => {
  it("surfaces a fitting-but-uninstalled profile as installable, not ready", () => {
    const r = recommendProfile(hw(), [
      profile({ id: "small", label: "Compact", tier: 1, installed: true }),
      profile({
        id: "mid",
        label: "Standard",
        tier: 2,
        minRamBytes: 6 * GB,
        installed: false,
        downloadBytes: 4 * GB,
      }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    // The better profile fits but isn't installed — it must NOT be "ready".
    expect(r.data.ready?.id).toBe("small");
    expect(r.data.installable?.id).toBe("mid");
    expect(r.data.recommendation).toMatch(/will not start without your approval/i);
    expect(r.data.recommendation).toMatch(/4\.0 GB download/);
  });

  it("recommends installation with approval when nothing is installed yet", () => {
    const r = recommendProfile(hw(), [
      profile({
        id: "mid",
        label: "Standard",
        tier: 2,
        minRamBytes: 6 * GB,
        installed: false,
        downloadBytes: 4 * GB,
      }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.ready).toBeNull();
    expect(r.data.installable?.id).toBe("mid");
    expect(r.data.recommendation).toMatch(/will not download it without your approval/i);
  });

  it("excludes an uninstalled profile when there's no disk for it", () => {
    const r = recommendProfile(hw({ freeStorageBytes: 1 * GB }), [
      profile({ id: "mid", label: "Standard", tier: 2, installed: false, installBytes: 10 * GB }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.excluded[0].reason).toMatch(/free disk to install/i);
    expect(r.data.needsCloud).toBe(true);
  });
});

/**
 * When nothing local fits, be honest — recommend cloud, don't pretend a profile
 * will run.
 */
describe("when nothing local fits", () => {
  it("recommends cloud rather than running something that won't load", () => {
    const r = recommendProfile(hw({ availableRamBytes: 1 * GB }), [
      profile({ id: "mid", label: "Standard", minRamBytes: 6 * GB, installed: true }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.needsCloud).toBe(true);
    expect(r.data.ready).toBeNull();
    expect(r.data.recommendation).toMatch(/cloud option \(with your consent\)/i);
    expect(r.data.recommendation).toMatch(/rather than starting something that won't load/i);
  });

  it("refuses with no profiles to choose from", () => {
    expect(recommendProfile(hw(), []).ok).toBe(false);
  });
});

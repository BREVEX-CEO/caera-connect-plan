import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  selectTier,
  consentLine,
  QUARANTINED_TAGS,
  GPU_REQUIRED_TAGS,
  MOBILE_TAG,
  type TierManifest,
} from "../local/tier-policy";
import type { HardwareProfile } from "../hardware/detect";

/**
 * Tier selection, checked against the REAL manifest B1 resolved rather than a
 * fixture — a fixture would let the manifest and the policy drift apart, which
 * is the exact failure this module exists to prevent.
 */
const manifest = JSON.parse(
  readFileSync("release/OCADE_LOCAL_ENGINE_MODEL_MANIFEST.json", "utf8"),
) as TierManifest;

function profile(over: Partial<HardwareProfile> = {}): HardwareProfile {
  return {
    totalRamGib: 16,
    availableRamGib: 8,
    freeStorageGib: 200,
    cpuCount: 8,
    hasDiscreteGpu: false,
    gpuCertain: true,
    gpuSummary: "integrated only",
    isMobile: false,
    platform: "win32",
    ...over,
  };
}

describe("the manifest it reads is the real one", () => {
  it("carries all five resolved tiers with real digests", () => {
    const resolved = manifest.tiers.filter((t) => t.resolved);
    expect(resolved).toHaveLength(5);
    for (const t of resolved) {
      expect(t.tag).toMatch(/^qwen3/);
      expect(t.expectedStorageBytes).toBeGreaterThan(0);
      expect(t.licence?.identifierGuess).toBe("Apache-2.0");
    }
  });
});

describe("mobile always gets the smallest tier, whatever the phone can do", () => {
  it("chooses 1.7B on a modest phone", () => {
    const r = selectTier(profile({ isMobile: true, totalRamGib: 4 }), manifest);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.tier.tag).toBe(MOBILE_TAG);
  });

  it("STILL chooses 1.7B on a phone with plenty of memory and a GPU", () => {
    // The point of the rule: capability must not talk mobile into a big model,
    // because the binding constraint there is the user's storage.
    const r = selectTier(
      profile({ isMobile: true, totalRamGib: 24, hasDiscreteGpu: true, freeStorageGib: 500 }),
      manifest,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.tier.tag).toBe(MOBILE_TAG);
    expect(r.because).toMatch(/storage rather than speed/i);
  });
});

describe("desktop selection follows measured reality, not the prose matrix", () => {
  it("picks 8B for 16 GB with no dedicated GPU — this project's own host", () => {
    const r = selectTier(profile({ totalRamGib: 15.65 }), manifest);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(r.tier.tag).toBe("qwen3:8b");
  });

  it("skips 14B and 30B without a GPU, and says why in measured terms", () => {
    const r = selectTier(profile({ totalRamGib: 15.65 }), manifest);
    if (!r.ok) throw new Error(r.reason);
    const skippedTags = r.skipped.map((s) => s.tag);
    expect(skippedTags).toContain("qwen3:14b");
    expect(skippedTags).toContain("qwen3:30b-a3b");
    expect(r.skipped.find((s) => s.tag === "qwen3:14b")?.why).toMatch(/graphics card/i);
  });

  it("allows 14B once a real GPU is present", () => {
    const r = selectTier(profile({ totalRamGib: 32, hasDiscreteGpu: true }), manifest);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error(r.reason);
    expect(GPU_REQUIRED_TAGS.has(r.tier.tag)).toBe(true);
  });

  it("treats an unconfirmed GPU as no GPU, and says so distinctly", () => {
    const r = selectTier(profile({ totalRamGib: 32, gpuCertain: false }), manifest);
    if (!r.ok) throw new Error(r.reason);
    expect(GPU_REQUIRED_TAGS.has(r.tier.tag)).toBe(false);
    expect(r.skipped.find((s) => s.tag === "qwen3:14b")?.why).toMatch(/could not be confirmed/i);
  });
});

describe("the quarantined tier is never selected automatically", () => {
  it("never returns 4B, even on a machine sized exactly for it", () => {
    const r = selectTier(profile({ totalRamGib: 6, freeStorageGib: 50 }), manifest);
    if (r.ok) {
      expect(r.tier.tag).not.toBe("qwen3:4b");
      expect(r.skipped.map((s) => s.tag)).toContain("qwen3:4b");
    }
  });

  it("records the real reason it is withheld", () => {
    expect(QUARANTINED_TAGS["qwen3:4b"]).toMatch(/leaks its own reasoning/i);
  });
});

describe("refusals name the binding constraint", () => {
  it("refuses when no model fits in memory", () => {
    const r = selectTier(profile({ totalRamGib: 1, freeStorageGib: 500 }), manifest);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("insufficient_ram");
    expect(r.reason).toMatch(/1 GB of memory/);
  });

  it("refuses when the disk is too full, and says how much is free", () => {
    const r = selectTier(profile({ totalRamGib: 32, freeStorageGib: 0.5 }), manifest);
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("insufficient_storage");
    expect(r.reason).toMatch(/0\.5 GB is free/);
  });

  it("refuses an empty manifest rather than inventing a tier", () => {
    const r = selectTier(profile(), { tiers: [] });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.failure).toBe("no_manifest");
  });
});

describe("what the user is told", () => {
  it("discloses the real download size and never names the raw model", () => {
    const r = selectTier(profile({ totalRamGib: 15.65 }), manifest);
    if (!r.ok) throw new Error(r.reason);
    const line = consentLine(r);
    expect(line).toMatch(/4\.87 GB/);
    expect(line).toMatch(/privately on this device/i);
    expect(line).not.toMatch(/qwen/i);
    expect(r.because).not.toMatch(/qwen/i);
  });
});

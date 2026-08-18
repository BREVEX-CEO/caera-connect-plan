import { describe, it, expect } from "vitest";
import {
  chooseBrowserTier,
  formatSize,
  tiersFor,
  PROMOTION_LATENCY_CEILING_MS,
  resolvedFor,
  sha256For,
  ggufUrl,
  storageKeyFor,
  WEBGPU_TIERS,
  WASM_TIERS,
} from "../brain/browser-catalogue";

const MB = 1024 * 1024;

describe("browser tiers are ordered and complete", () => {
  it("keeps every WebGPU tier's download smaller than the memory it needs", () => {
    for (const tier of WEBGPU_TIERS) expect(tier.requiredMemoryBytes).toBeGreaterThan(tier.downloadBytes);
  });

  it("gives every tier a readable OCADE capability label", () => {
    for (const tier of [...WEBGPU_TIERS, ...WASM_TIERS]) {
      expect(tier.because.length).toBeGreaterThan(40);
      expect(tier.label).toMatch(/^OCADE/);
      expect(tier.label).not.toMatch(/qwen|q4f16|gguf/i);
    }
  });

  it("offers one conservative WebAssembly compatibility tier", () => {
    expect(WASM_TIERS).toHaveLength(1);
  });
});

describe("choosing a tier for a device", () => {
  it("starts every unmeasured device on the smallest engine", () => {
    const choice = chooseBrowserTier("webgpu", null);
    expect(choice.tier.rank).toBe(0);
    expect(choice.skipped[0].why).toMatch(/smaller engine/i);
  });

  it("does NOT promote on a generous memory ceiling alone", () => {
    expect(chooseBrowserTier("webgpu", 2048 * MB, null).tier.rank).toBe(0);
  });

  it("promotes after the smaller tier actually proved acceptable latency", () => {
    const larger = WEBGPU_TIERS.find((t) => t.rank === 1)!;
    const promoted = chooseBrowserTier("webgpu", larger.requiredMemoryBytes, {
      // This is the important regression: rank 0 evidence unlocks rank 1.
      provenRank: 0,
      firstTokenMs: 800,
    });
    expect(promoted.tier.rank).toBe(1);
  });

  it("refuses promotion when the smaller engine was already too slow", () => {
    const larger = WEBGPU_TIERS.find((t) => t.rank === 1)!;
    const choice = chooseBrowserTier("webgpu", larger.requiredMemoryBytes, {
      provenRank: 0,
      firstTokenMs: PROMOTION_LATENCY_CEILING_MS + 1,
    });
    expect(choice.tier.rank).toBe(0);
    expect(choice.skipped.some((s) => /to start answering/i.test(s.why))).toBe(true);
  });

  it("lets the allocation ceiling veto a promotion", () => {
    const larger = WEBGPU_TIERS.find((t) => t.rank === 1)!;
    const choice = chooseBrowserTier("webgpu", larger.requiredMemoryBytes - 1, {
      provenRank: 0,
      firstTokenMs: 500,
    });
    expect(choice.tier.rank).toBe(0);
    expect(choice.skipped.some((s) => /one allocation/i.test(s.why))).toBe(true);
  });

  it("ignores zero/nonsense ceilings rather than treating them as full", () => {
    expect(chooseBrowserTier("webgpu", 0, { provenRank: 0, firstTokenMs: 500 }).tier.rank).toBe(1);
    expect(chooseBrowserTier("webgpu", -1, { provenRank: 0, firstTokenMs: 500 }).tier.rank).toBe(1);
  });

  it("returns the compatibility tier for WASM", () => {
    expect(chooseBrowserTier("wasm", null).tier.label).toMatch(/compatibility/i);
  });

  it("never returns a tier outside its own catalogue", () => {
    for (const kind of ["webgpu", "wasm"] as const) {
      expect(tiersFor(kind)).toContain(
        chooseBrowserTier(kind, 2048 * MB, { provenRank: 99, firstTokenMs: 100 }).tier,
      );
    }
  });
});

describe("sizes and downloadable metadata", () => {
  it("formats MB and GB", () => {
    expect(formatSize(340 * MB)).toBe("340 MB");
    expect(formatSize(2 * 1024 * MB)).toBe("2.00 GB");
  });

  it("resolves a reviewed digest for every WASM tier", () => {
    for (const tier of WASM_TIERS) {
      const entry = resolvedFor(tier);
      expect(entry).not.toBeNull();
      expect(entry!.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(sha256For(tier)).toBe(entry!.sha256);
      expect(ggufUrl(tier)).toMatch(/^https:\/\//);
      expect(storageKeyFor(tier)).toMatch(/^wasm\//);
      const drift = Math.abs(tier.downloadBytes - entry!.sizeBytes) / entry!.sizeBytes;
      expect(drift).toBeLessThan(0.05);
    }
  });

  it("does not invent file-level verification facts for WebGPU shards", () => {
    for (const tier of WEBGPU_TIERS) {
      expect(resolvedFor(tier)).toBeNull();
      expect(sha256For(tier)).toBeUndefined();
      expect(ggufUrl(tier)).toBeNull();
    }
  });
});

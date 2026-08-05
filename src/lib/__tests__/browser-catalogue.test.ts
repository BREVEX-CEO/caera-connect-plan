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

/**
 * Which model a browser gets.
 *
 * The rule that matters is the conservative one: an unknown device gets the
 * SMALLEST engine. Guessing upwards on hardware that would not report itself
 * is how a phone loads a model that crashes the tab, and it is the exact
 * mistake that a "pick the best available" instinct produces.
 */

const MB = 1024 * 1024;

describe("browser tiers are ordered and complete", () => {
  it("keeps every WebGPU tier's download smaller than the memory it needs", () => {
    // Weights compress on disk but must be resident to run. A tier claiming to
    // need less memory than it downloads would be a typo with consequences.
    for (const tier of WEBGPU_TIERS) {
      expect(tier.requiredMemoryBytes).toBeGreaterThan(tier.downloadBytes);
    }
  });

  it("gives every tier a reason a person could read", () => {
    for (const tier of [...WEBGPU_TIERS, ...WASM_TIERS]) {
      expect(tier.because.length).toBeGreaterThan(40);
      expect(tier.label).toMatch(/^OCADE/);
    }
  });

  it("offers only one WebAssembly tier, deliberately", () => {
    // A larger model on the CPU produces a first token slowly enough that the
    // page looks hung. The fallback exists to work, not to match WebGPU.
    expect(WASM_TIERS).toHaveLength(1);
  });

  it("never exposes a raw model id as the user-facing label", () => {
    for (const tier of [...WEBGPU_TIERS, ...WASM_TIERS]) {
      expect(tier.label).not.toMatch(/qwen|q4f16|gguf/i);
    }
  });
});

describe("choosing a tier for a device", () => {
  it("starts every unmeasured device on the smallest engine", () => {
    const choice = chooseBrowserTier("webgpu", null);
    expect(choice.tier.rank).toBe(0);
    expect(choice.skipped[0].why).toMatch(/has not yet run a smaller engine/i);
  });

  /*
   * The defect this guards against, in one test.
   *
   * Browsers report a flat 2 GB `maxBufferSize` on almost everything — the
   * integrated Intel Iris Xe this was measured on reports exactly that.
   * Treated as capacity it promoted nearly every device to the larger model.
   * Plenty of headroom is NOT evidence and must not promote on its own.
   */
  it("does NOT promote on a generous memory ceiling alone", () => {
    expect(chooseBrowserTier("webgpu", 2048 * MB, null).tier.rank).toBe(0);
  });

  it("promotes only once this device has actually run the smaller engine quickly", () => {
    const larger = WEBGPU_TIERS.find((t) => t.rank === 1)!;
    const promoted = chooseBrowserTier("webgpu", larger.requiredMemoryBytes, {
      provenRank: 1,
      firstTokenMs: 800,
    });
    expect(promoted.tier.rank).toBe(1);
  });

  it("refuses to promote when the smaller engine was already too slow here", () => {
    const larger = WEBGPU_TIERS.find((t) => t.rank === 1)!;
    const choice = chooseBrowserTier("webgpu", larger.requiredMemoryBytes, {
      provenRank: 1,
      firstTokenMs: PROMOTION_LATENCY_CEILING_MS + 1,
    });
    expect(choice.tier.rank).toBe(0);
    expect(choice.skipped.some((s) => /to start answering/i.test(s.why))).toBe(true);
  });

  it("lets the ceiling veto a tier even when the benchmark would allow it", () => {
    const larger = WEBGPU_TIERS.find((t) => t.rank === 1)!;
    const choice = chooseBrowserTier("webgpu", larger.requiredMemoryBytes - 1, {
      provenRank: 1,
      firstTokenMs: 500,
    });
    expect(choice.tier.rank).toBe(0);
    expect(choice.skipped.some((s) => /in one allocation/i.test(s.why))).toBe(true);
  });

  it("ignores a zero or nonsense ceiling rather than treating it as full", () => {
    expect(chooseBrowserTier("webgpu", 0, { provenRank: 1, firstTokenMs: 500 }).tier.rank).toBe(1);
    expect(chooseBrowserTier("webgpu", -1, { provenRank: 1, firstTokenMs: 500 }).tier.rank).toBe(1);
  });

  it("returns the single compatibility tier for WebAssembly regardless of memory", () => {
    expect(chooseBrowserTier("wasm", null).tier.label).toMatch(/compatibility/i);
    expect(chooseBrowserTier("wasm", 64 * 1024 * MB).tier.label).toMatch(/compatibility/i);
  });

  it("never returns a tier outside its own catalogue", () => {
    for (const kind of ["webgpu", "wasm"] as const) {
      const choice = chooseBrowserTier(kind, 2048 * MB, { provenRank: 99, firstTokenMs: 100 });
      expect(tiersFor(kind)).toContain(choice.tier);
    }
  });

  it("exposes the same tiers it chooses from", () => {
    expect(tiersFor("webgpu")).toBe(WEBGPU_TIERS);
    expect(tiersFor("wasm")).toBe(WASM_TIERS);
  });
});

describe("sizes are readable before a download starts", () => {
  it("uses MB below a gigabyte and GB above it", () => {
    expect(formatSize(340 * MB)).toBe("340 MB");
    expect(formatSize(2 * 1024 * MB)).toBe("2.00 GB");
  });
});

/*
 * The catalogue is what makes a download verifiable at all. Before it existed
 * every browser engine was stored as UNVERIFIED, because there was no digest
 * to check against and inventing one would have been worse than none.
 */
describe("downloadable tiers carry a reviewed digest", () => {
  it("resolves a real size and digest for every tier OCADE fetches itself", () => {
    for (const tier of WASM_TIERS) {
      const entry = resolvedFor(tier);
      expect(entry, `${tier.label} has no catalogue entry`).not.toBeNull();
      expect(entry!.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry!.sizeBytes).toBeGreaterThan(0);
      expect(sha256For(tier)).toBe(entry!.sha256);
    }
  });

  it("declares a size within a few percent of the published one", () => {
    // A declared size wildly apart from reality makes the storage pre-check
    // meaningless — it would refuse or allow on a number that is not the file.
    for (const tier of WASM_TIERS) {
      const entry = resolvedFor(tier)!;
      const drift = Math.abs(tier.downloadBytes - entry.sizeBytes) / entry.sizeBytes;
      expect(drift, `${tier.label} declared size drifts ${(drift * 100).toFixed(1)}%`).toBeLessThan(
        0.05,
      );
    }
  });

  it("fetches weights over https from the publisher, never over plain http", () => {
    for (const tier of WASM_TIERS) {
      expect(ggufUrl(tier)).toMatch(/^https:\/\//);
    }
  });

  it("gives each downloadable tier a storage key that cannot collide", () => {
    const keys = WASM_TIERS.map((t) => storageKeyFor(t));
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) expect(key).toMatch(/^wasm\//);
  });

  it("claims nothing for WebGPU tiers, which fetch their own shards", () => {
    // WebLLM manages its own cache, so OCADE has no file to verify and must
    // not imply that it does.
    for (const tier of WEBGPU_TIERS) {
      expect(resolvedFor(tier)).toBeNull();
      expect(sha256For(tier)).toBeUndefined();
      expect(ggufUrl(tier)).toBeNull();
    }
  });
});

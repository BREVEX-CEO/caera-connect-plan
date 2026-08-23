/**
 * PROMOTION MUST BE REACHABLE.
 *
 * The gate read `benchmark.provenRank < t.rank` -> skip. To be OFFERED rank 1
 * a device had to have already PROVEN rank 1 — and `recordBenchmark` only ever
 * records a rank the device was allowed to run. A device that starts on rank 0
 * records rank 0, which is less than 1, so it is skipped forever.
 *
 * No device could ever be promoted. The evidence rule was written as "you must
 * have proven THIS tier" when what it meant was "you must have proven the tier
 * below it".
 */
import { describe, it, expect } from "vitest";
import {
  chooseBrowserTier,
  tiersFor,
  PROMOTION_LATENCY_CEILING_MS,
  type TierBenchmark,
} from "../browser-catalogue";

const GB = 1024 * 1024 * 1024;
const proven = (rank: number, firstTokenMs = 800): TierBenchmark => ({
  provenRank: rank,
  firstTokenMs,
});

describe("a brand-new device", () => {
  it("starts on the smallest tier", () => {
    expect(chooseBrowserTier("webgpu", null, null).tier.rank).toBe(0);
  });

  it("is not promoted by an optimistic memory number alone", () => {
    // WebGPU reports a flat 2 GB maxBufferSize on almost everything, so the
    // ceiling may only ever EXCLUDE a tier, never justify one.
    expect(chooseBrowserTier("webgpu", 8 * GB, null).tier.rank).toBe(0);
  });
});

describe("promotion is reachable", () => {
  it("offers the next tier to a device that proved the one below it", () => {
    const choice = chooseBrowserTier("webgpu", 8 * GB, proven(0, 700));
    expect(choice.tier.rank).toBe(1);
  });

  it("does not skip a tier: proving rank 0 does not unlock rank 2", () => {
    const tiers = tiersFor("webgpu");
    if (tiers.length < 3) return; // only meaningful once a third tier exists
    expect(chooseBrowserTier("webgpu", 8 * GB, proven(0)).tier.rank).toBe(1);
  });

  it("still refuses when the device is already too slow at the smaller tier", () => {
    const slow = proven(0, PROMOTION_LATENCY_CEILING_MS + 1);
    const choice = chooseBrowserTier("webgpu", 8 * GB, slow);
    expect(choice.tier.rank).toBe(0);
    expect(choice.skipped.some((s) => /already takes/.test(s.why))).toBe(true);
  });

  it("still refuses when the tier cannot be allocated on this device", () => {
    const choice = chooseBrowserTier("webgpu", 512 * 1024 * 1024, proven(0, 500));
    expect(choice.tier.rank).toBe(0);
    expect(choice.skipped.some((s) => /one allocation/.test(s.why))).toBe(true);
  });

  it("explains the refusal in terms of the tier below, not the tier asked for", () => {
    const choice = chooseBrowserTier("webgpu", 8 * GB, null);
    expect(choice.skipped[0]?.why).toMatch(/smaller engine/i);
  });
});

describe("a tier that failed here is not offered again", () => {
  it("respects a recorded ceiling from a crash or an out-of-memory", () => {
    // The device proved rank 0 quickly, so it would normally be promoted —
    // but rank 1 already failed here once, and repeating that is a loop.
    const choice = chooseBrowserTier("webgpu", 8 * GB, { ...proven(0, 500), failedRank: 1 });
    expect(choice.tier.rank).toBe(0);
    expect(choice.skipped.some((s) => /did not run properly/i.test(s.why))).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import {
  estimateJob,
  governResources,
  LONG_JOB_MS,
  LOW_BATTERY_PERCENT,
  RAM_HEADROOM,
  type JobSpec,
  type HardwareSnapshot,
} from "../skills/resource-governor";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

const job = (over: Partial<JobSpec> = {}): JobSpec => ({
  kind: "local_inference",
  workUnits: 1000,
  bytesPerUnit: 1 * MB,
  msPerUnit: 1,
  ...over,
});

const hw = (over: Partial<HardwareSnapshot> = {}): HardwareSnapshot => ({
  totalRamBytes: 16 * GB,
  availableRamBytes: 8 * GB,
  freeStorageBytes: 100 * GB,
  hasGpu: true,
  ...over,
});

describe("estimation is bounded and honest", () => {
  it("estimates memory, duration and storage from the spec", () => {
    const r = estimateJob(
      job({ workUnits: 2000, bytesPerUnit: MB, msPerUnit: 2, outputBytes: 50 * MB }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.peakMemoryBytes).toBe(2000 * MB);
    expect(r.data.durationMs).toBe(4000);
    expect(r.data.storageBytes).toBe(50 * MB);
  });

  it("adds fixed overhead (e.g. model weights) to peak memory", () => {
    const r = estimateJob(job({ workUnits: 100, bytesPerUnit: MB, fixedMemoryBytes: 2 * GB }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.peakMemoryBytes).toBe(2 * GB + 100 * MB);
  });

  /**
   * The estimate must never masquerade as a measurement — callers key off this
   * to phrase results honestly.
   */
  it("marks the estimate approximate and states its basis", () => {
    const r = estimateJob(job());
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.approximate).toBe(true);
    expect(r.data.basis).toMatch(/estimate, not a measurement/i);
  });

  it("refuses to estimate from nonsense inputs rather than returning zero", () => {
    expect(estimateJob(job({ workUnits: 0 })).ok).toBe(false);
    expect(estimateJob(job({ workUnits: -5 })).ok).toBe(false);
    expect(estimateJob(job({ bytesPerUnit: NaN })).ok).toBe(false);
    expect(estimateJob(job({ msPerUnit: -1 })).ok).toBe(false);
  });

  it("refuses negative optional costs and overflowing estimates", () => {
    expect(estimateJob(job({ outputBytes: -1 })).ok).toBe(false);
    expect(estimateJob(job({ fixedMemoryBytes: -1 })).ok).toBe(false);
    expect(
      estimateJob(
        job({
          workUnits: Number.MAX_SAFE_INTEGER,
          bytesPerUnit: Number.MAX_SAFE_INTEGER,
        }),
      ).ok,
    ).toBe(false);
  });
});

describe("a job that fits is cleared", () => {
  it("proceeds when memory, storage and time are all comfortable", () => {
    const r = governResources(job({ workUnits: 100, bytesPerUnit: MB, msPerUnit: 1 }), hw());
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("proceed");
  });
});

/**
 * Insufficient resources must REFUSE, not start on hope. This is the OOM /
 * disk-full the governor exists to prevent.
 */
describe("hard limits refuse rather than proceed", () => {
  it("refuses malformed or internally inconsistent hardware snapshots", () => {
    expect(governResources(job(), hw({ freeStorageBytes: -1 })).ok).toBe(false);
    expect(
      governResources(job(), hw({ totalRamBytes: 4 * GB, availableRamBytes: 8 * GB })).ok,
    ).toBe(false);
    expect(governResources(job(), hw({ batteryPercent: 101 })).ok).toBe(false);
    expect(governResources(job(), hw({ thermalState: "forged" as never })).ok).toBe(false);
  });

  it("refuses when the output won't fit on disk", () => {
    const r = governResources(job({ outputBytes: 200 * GB }), hw({ freeStorageBytes: 10 * GB }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("refuse");
    expect(r.data.reason).toMatch(/Free up space/i);
  });

  it("refuses when even the fixed overhead doesn't fit in memory", () => {
    const r = governResources(
      job({ workUnits: 10, bytesPerUnit: MB, fixedMemoryBytes: 20 * GB }),
      hw({ availableRamBytes: 4 * GB }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("refuse");
    expect(r.data.reason).toMatch(/won't start it/i);
  });

  /**
   * The useful middle ground: too big at full size, but a smaller run fits, so
   * recommend the ceiling instead of a bare no.
   */
  it("recommends a downgrade size when the full job is too big", () => {
    // 8 GB available × 0.85 headroom ≈ 6.8 GB usable. At 1 MB/unit, ~6963 units fit.
    const r = governResources(job({ workUnits: 20000, bytesPerUnit: MB, msPerUnit: 0.01 }), hw());
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("downgrade");
    if (r.data.action !== "downgrade") throw new Error("unreachable");
    expect(r.data.suggestedWorkUnits).toBeGreaterThan(0);
    expect(r.data.suggestedWorkUnits).toBeLessThan(20000);
    // The suggested size must actually fit under the ceiling.
    const usable = 8 * GB * RAM_HEADROOM;
    expect(r.data.suggestedWorkUnits * MB).toBeLessThanOrEqual(usable);
  });
});

describe("environment blocks come before fit", () => {
  it("defers a heavy job when the machine is critically hot", () => {
    const r = governResources(job(), hw({ thermalState: "critical" }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("defer");
    expect(r.data.reason).toMatch(/thermal shutdown/i);
  });

  it("defers a compute-heavy job when merely hot", () => {
    const r = governResources(job({ kind: "render" }), hw({ thermalState: "hot" }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("defer");
  });

  it("defers when battery is low and unplugged", () => {
    const r = governResources(job(), hw({ batteryPercent: LOW_BATTERY_PERCENT - 1 }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("defer");
    expect(r.data.reason).toMatch(/plug in first/i);
  });

  it("does not defer on battery when plugged in (no battery reported)", () => {
    const r = governResources(job({ workUnits: 50 }), hw({ batteryPercent: undefined }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("proceed");
  });
});

describe("long jobs must be checkpointed, not run in one shot", () => {
  it("requires a checkpoint when the estimate exceeds the long-job threshold", () => {
    // Duration just over LONG_JOB_MS, memory comfortable.
    const units = Math.ceil(LONG_JOB_MS / 1) + 1000;
    const r = governResources(job({ workUnits: units, bytesPerUnit: 1, msPerUnit: 1 }), hw());
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("checkpoint_first");
    expect(r.data.reason).toMatch(/pause, resume/i);
  });

  it("does not demand a checkpoint for a short job", () => {
    const r = governResources(job({ workUnits: 10, msPerUnit: 1 }), hw());
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.action).toBe("proceed");
  });
});

describe("the recommendation always carries the estimate", () => {
  it("attaches the estimate to every recommendation kind", () => {
    const proceed = governResources(job({ workUnits: 10 }), hw());
    const refuse = governResources(job({ outputBytes: 500 * GB }), hw({ freeStorageBytes: GB }));
    for (const r of [proceed, refuse]) {
      if (!r.ok) throw new Error("unreachable");
      expect(r.data.estimate.approximate).toBe(true);
      expect(r.data.estimate.peakMemoryBytes).toBeGreaterThan(0);
    }
  });
});

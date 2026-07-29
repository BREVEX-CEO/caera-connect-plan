import { describe, it, expect } from "vitest";
import { planLocalJob } from "../skills/local-job-plan";
import type { LocalProfile } from "../skills/hardware-profile";
import type { JobSpec, HardwareSnapshot } from "../skills/resource-governor";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

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
  freeStorageBytes: 100 * GB,
  hasGpu: false,
  ...over,
});

const job = (over: Partial<JobSpec> = {}): JobSpec => ({
  kind: "local_inference",
  workUnits: 100,
  bytesPerUnit: MB,
  msPerUnit: 1,
  ...over,
});

describe("composing profile fit and resource governance", () => {
  it("runs locally when a profile is ready and the job fits", () => {
    const r = planLocalJob(job(), hw(), [profile({ installed: true })]);
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.where).toBe("local");
    if (r.data.where !== "local") throw new Error("unreachable");
    expect(r.data.profileLabel).toBe("Compact");
  });

  /** No local profile fits → cloud, not a forced local run. */
  it("recommends cloud when nothing local fits the machine", () => {
    const r = planLocalJob(job(), hw({ availableRamBytes: 1 * GB }), [
      profile({ minRamBytes: 8 * GB }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.where).toBe("cloud");
  });

  /** A fitting-but-uninstalled profile needs approval first — never auto-run. */
  it("routes to needs_install when the best fit isn't installed", () => {
    const r = planLocalJob(job(), hw(), [profile({ installed: false, downloadBytes: 3 * GB })]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.where).toBe("needs_install");
  });

  /**
   * The governor's refusal must pass through unchanged — the planner never
   * softens an over-budget or too-hot verdict into a local run.
   */
  it("passes the governor's block through when the job is too big", () => {
    const r = planLocalJob(job({ workUnits: 100000, bytesPerUnit: MB }), hw(), [
      profile({ installed: true }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.where).toBe("blocked");
    if (r.data.where !== "blocked") throw new Error("unreachable");
    expect(["downgrade", "refuse"]).toContain(r.data.recommendation.action);
  });

  it("passes a thermal defer through", () => {
    const r = planLocalJob(job(), hw({ thermalState: "critical" }), [profile({ installed: true })]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.where).toBe("blocked");
    if (r.data.where !== "blocked") throw new Error("unreachable");
    expect(r.data.recommendation.action).toBe("defer");
  });

  it("allows a long job locally but flags it for checkpointing", () => {
    // 6 minutes of work, memory comfortable.
    const r = planLocalJob(job({ workUnits: 360000, bytesPerUnit: 1, msPerUnit: 1 }), hw(), [
      profile({ installed: true }),
    ]);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.where).toBe("local");
    if (r.data.where !== "local") throw new Error("unreachable");
    expect(r.data.recommendation.action).toBe("checkpoint_first");
  });

  it("refuses when there are no profiles at all", () => {
    expect(planLocalJob(job(), hw(), []).ok).toBe(false);
  });
});

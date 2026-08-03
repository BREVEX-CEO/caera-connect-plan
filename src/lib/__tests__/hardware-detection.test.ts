import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { totalmem } from "node:os";
import { recommendProfile } from "../skills/hardware-profile";

/**
 * Hardware detection — RUNTIME evidence (spec §3.5, §19.2 "hardware detection
 * works").
 *
 * `recommendProfile` already chose a tier, but it TAKES a HardwareSnapshot, so
 * nothing had ever produced one from a real machine. `scripts/detect-hardware.mjs`
 * does, and this suite runs it against the machine the tests are running on.
 *
 * This item was never externally blocked — measuring RAM, CPU and disk needs no
 * model weights, GPU or credentials. Only DOWNLOADING and RUNNING a model does.
 * It had been recorded as blocked along with the rest of §19.2, which was an
 * inaccurate readiness claim.
 */

const report = JSON.parse(
  execFileSync(process.execPath, ["scripts/detect-hardware.mjs", "--json"], {
    encoding: "utf8",
    timeout: 60_000,
  }),
) as {
  machine: { platform: string; arch: string; cpuModel: string; cpuCores: number };
  memory: { totalBytes: number; availableBytes: number };
  storage: { freeBytes: number | null };
  gpu: { present: boolean | "unknown"; reason: string };
  snapshot: {
    totalRamBytes: number;
    availableRamBytes: number;
    freeStorageBytes: number;
    hasGpu: boolean;
  };
  recommendation: { best: string | null; fits: string[]; advice: string; caveat: string };
  note: string;
};

describe("it measures the real machine", () => {
  it("reports a plausible CPU", () => {
    expect(report.machine.cpuCores).toBeGreaterThan(0);
    expect(report.machine.cpuModel.length).toBeGreaterThan(0);
    expect(report.machine.cpuModel).not.toBe("unknown");
  });

  it("reports memory that matches what the OS reports", () => {
    // Measured, not estimated from the platform name.
    expect(report.memory.totalBytes).toBe(totalmem());
    expect(report.memory.availableBytes).toBeGreaterThan(0);
    expect(report.memory.availableBytes).toBeLessThanOrEqual(report.memory.totalBytes);
  });

  it("reports free storage or says it is unavailable", () => {
    if (report.storage.freeBytes !== null) {
      expect(report.storage.freeBytes).toBeGreaterThan(0);
    } else {
      expect(report).toHaveProperty("storage.unavailable");
    }
  });

  it("names the platform and architecture", () => {
    expect(report.machine.platform).toBe(process.platform);
    expect(report.machine.arch).toBe(process.arch);
  });
});

describe("it never guesses a GPU into existence", () => {
  it("uses only true, false or unknown", () => {
    expect([true, false, "unknown"]).toContain(report.gpu.present);
  });

  it("always explains the verdict", () => {
    expect(report.gpu.reason.length).toBeGreaterThan(0);
  });

  it("treats UNKNOWN as absent in the snapshot, never as present", () => {
    // Assuming a GPU that is not there would recommend a tier the machine
    // cannot run — the failure direction that actually hurts a user.
    if (report.gpu.present !== true) {
      expect(report.snapshot.hasGpu).toBe(false);
    }
    expect(report.note).toMatch(/unknown/i);
  });
});

describe("the snapshot drives the real recommender", () => {
  it("is shaped for recommendProfile and produces a decision", () => {
    const GiB = 1024 ** 3;
    const outcome = recommendProfile(report.snapshot, [
      {
        id: "small",
        label: "Small",
        minRamBytes: 2 * GiB,
        installBytes: GiB,
        downloadBytes: 0,
        requiresGpu: false,
        installed: true,
        tier: 1,
      },
      {
        id: "gpu-only",
        label: "GPU only",
        minRamBytes: 2 * GiB,
        installBytes: GiB,
        downloadBytes: 0,
        requiresGpu: true,
        installed: true,
        tier: 9,
      },
    ]);

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) throw new Error("unreachable");
    // Without a detected GPU the GPU-only profile must be excluded, not chosen.
    if (!report.snapshot.hasGpu) {
      expect(outcome.data.excluded.some((e) => e.profile.id === "gpu-only")).toBe(true);
      expect(outcome.data.ready?.id).not.toBe("gpu-only");
    }
  });

  it("recommends a tier that fits, or says cloud is the honest fallback", () => {
    if (report.recommendation.best) {
      expect(report.recommendation.fits).toContain(report.recommendation.best);
      expect(report.recommendation.advice).toMatch(/can run/i);
    } else {
      expect(report.recommendation.advice).toMatch(/cloud is the honest fallback/i);
    }
  });

  it("never recommends a tier that did not fit", () => {
    const notFitting = ["chat-1b", "general-3b", "reasoning-7b", "advanced-14b"].filter(
      (t) => !report.recommendation.fits.includes(t),
    );
    expect(notFitting).not.toContain(report.recommendation.best);
  });
});

describe("it does not overstate what a tier table means", () => {
  it("says the tiers are planning defaults, not benchmarked choices", () => {
    // Spec §3.5 says exactly this; the output must not read as a measured
    // model recommendation.
    expect(report.recommendation.caveat).toMatch(/planning defaults/i);
    expect(report.recommendation.caveat).toMatch(/not benchmarked/i);
  });

  it("is exposed as an npm script", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["hardware:detect"]).toContain("detect-hardware.mjs");
  });
});

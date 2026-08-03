import { describe, it, expect } from "vitest";
import { profileFrom, unknownSnapshot, type HardwareSnapshot } from "../hardware/detect";

/**
 * The rule under test is the one that decides which model a user gets:
 * "we could not tell whether there is a GPU" must never become "there is one".
 */

const GIB = 1024 ** 3;

function snapshot(over: Partial<HardwareSnapshot> = {}): HardwareSnapshot {
  return {
    totalRamBytes: 16 * GIB,
    availableRamBytes: 8 * GIB,
    freeStorageBytes: 100 * GIB,
    cpuCount: 8,
    cpuModel: "Test CPU",
    arch: "x64",
    platform: "win32",
    gpuPresent: false,
    gpuAdapters: [],
    gpuDiscrete: [],
    gpuReason: "only integrated adapters reported",
    isMobile: false,
    measuredAt: new Date().toISOString(),
    ...over,
  };
}

describe("unknown GPU is treated as absent, never as present", () => {
  it("resolves an unknown probe to no-GPU", () => {
    const p = profileFrom(snapshot({ gpuPresent: "unknown", gpuReason: "lspci unavailable" }));
    expect(p.hasDiscreteGpu).toBe(false);
  });

  it("marks the answer as uncertain so a UI can explain itself", () => {
    const p = profileFrom(snapshot({ gpuPresent: "unknown" }));
    expect(p.gpuCertain).toBe(false);
    expect(p.gpuSummary).toMatch(/could not determine/i);
    expect(p.gpuSummary).toMatch(/safe direction/i);
  });

  it("distinguishes 'no GPU' from 'could not tell'", () => {
    expect(profileFrom(snapshot({ gpuPresent: false })).gpuCertain).toBe(true);
    expect(profileFrom(snapshot({ gpuPresent: "unknown" })).gpuCertain).toBe(false);
    // Both reach the same decision, and that is the point — but they say
    // different things to the user.
    expect(profileFrom(snapshot({ gpuPresent: false })).hasDiscreteGpu).toBe(false);
    expect(profileFrom(snapshot({ gpuPresent: "unknown" })).hasDiscreteGpu).toBe(false);
  });
});

describe("integrated graphics do not count as acceleration", () => {
  it("names the integrated adapter and refuses to call it a GPU", () => {
    const p = profileFrom(
      snapshot({
        gpuPresent: false,
        gpuAdapters: ["Intel(R) Iris(R) Xe Graphics"],
        gpuReason: "only integrated adapters reported",
      }),
    );
    expect(p.hasDiscreteGpu).toBe(false);
    expect(p.gpuSummary).toMatch(/integrated graphics only/i);
    expect(p.gpuSummary).toMatch(/does not accelerate/i);
  });

  it("reports a discrete adapter as acceleration", () => {
    const p = profileFrom(
      snapshot({
        gpuPresent: true,
        gpuAdapters: ["NVIDIA GeForce RTX 4070"],
        gpuDiscrete: ["NVIDIA GeForce RTX 4070"],
      }),
    );
    expect(p.hasDiscreteGpu).toBe(true);
    expect(p.gpuCertain).toBe(true);
    expect(p.gpuSummary).toMatch(/discrete graphics detected/i);
    expect(p.gpuSummary).toMatch(/RTX 4070/);
  });
});

describe("sizes are converted, not invented", () => {
  it("reports RAM and storage in GiB to two places", () => {
    const p = profileFrom(
      snapshot({
        totalRamBytes: 16_777_216_000,
        availableRamBytes: 4 * GIB,
        freeStorageBytes: 250 * GIB,
      }),
    );
    expect(p.totalRamGib).toBeCloseTo(15.62, 1);
    expect(p.availableRamGib).toBe(4);
    expect(p.freeStorageGib).toBe(250);
  });

  it("carries the CPU count and platform through unchanged", () => {
    const p = profileFrom(snapshot({ cpuCount: 4, platform: "darwin" }));
    expect(p.cpuCount).toBe(4);
    expect(p.platform).toBe("darwin");
  });
});

describe("a failed measurement lands on the safest answer", () => {
  it("reports zeroes and an unknown GPU rather than plausible defaults", () => {
    const p = profileFrom(unknownSnapshot("linux", "statfs unavailable"));
    expect(p.totalRamGib).toBe(0);
    expect(p.availableRamGib).toBe(0);
    expect(p.freeStorageGib).toBe(0);
    expect(p.cpuCount).toBe(0);
    expect(p.hasDiscreteGpu).toBe(false);
    expect(p.gpuCertain).toBe(false);
    expect(p.gpuSummary).toMatch(/statfs unavailable/);
  });
});

describe("mobile is declared by the shell, not guessed", () => {
  it("carries the mobile flag through", () => {
    expect(profileFrom(snapshot({ isMobile: true })).isMobile).toBe(true);
    expect(profileFrom(snapshot({ isMobile: false })).isMobile).toBe(false);
  });
});

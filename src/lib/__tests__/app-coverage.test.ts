import { describe, it, expect } from "vitest";
import {
  AppCoverageRegistry,
  type AppProber,
  type AppProbeResult,
} from "../providers/app-coverage-registry";

/**
 * Application coverage — the registry must never claim support it cannot show.
 *
 * The previous version of this suite asserted `detected === true` and
 * `coverageLevel === 'FULL'` for Blender. It passed because the module
 * hardcoded that answer, inventing version 4.0.2 and the evidence string "Found
 * executable" without probing anything. Blender is not installed on the machine
 * that ran it. The test was pinning a fabrication in place.
 *
 * What follows pins the opposite property: every published field must come from
 * a probe, and anything the registry has not been told is BLOCKED rather than
 * guessed in either direction.
 */

const probeReturning = (result: AppProbeResult): AppProber => async () => result;

describe("nothing is claimed without a probe", () => {
  it("reports BLOCKED, not UNSUPPORTED, when no prober is available", async () => {
    // The browser case. "I cannot look" must never be published as "absent".
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("app.blender", "Blender 3D");

    await registry.runCoverageScan();

    const blender = registry.getAppCoverage("app.blender");
    expect(blender?.coverageLevel).toBe("BLOCKED");
    expect(blender?.detected).toBe(false);
    expect(blender?.version).toBeNull();
    expect(blender?.evidence.join(" ")).toMatch(/could not be determined/i);
  });

  it("a freshly registered app is BLOCKED until something looks", () => {
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("app.chrome", "Chrome");

    const chrome = registry.getAppCoverage("app.chrome");
    expect(chrome?.coverageLevel).toBe("BLOCKED");
    expect(chrome?.evidence.join(" ")).toMatch(/not yet scanned/i);
  });

  it("invents no version, action or evidence of its own", async () => {
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("app.blender", "Blender 3D");
    await registry.runCoverageScan();

    const blob = JSON.stringify(registry.getCoverageReport());
    // The exact fabrications the old implementation emitted.
    expect(blob).not.toContain("4.0.2");
    expect(blob).not.toContain("123.0");
    expect(blob).not.toContain("Found executable");
    expect(blob).not.toContain("Verified python API script");
  });

  it("refuses an id or name that is empty", () => {
    const registry = new AppCoverageRegistry();
    expect(() => registry.registerAppProfile("", "Blender")).toThrow(/non-empty/i);
    expect(() => registry.registerAppProfile("app.x", "   ")).toThrow(/non-empty/i);
  });
});

describe("a probe that cannot answer is unknown, never absent", () => {
  it("records a THROWING probe as BLOCKED and keeps the reason", async () => {
    // The distinction that matters: a failed lookup must not be published as a
    // finding that the application is missing.
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("app.freecad", "FreeCAD");

    const exploding: AppProber = async () => {
      throw new Error("PATH lookup was denied");
    };
    await registry.runCoverageScan(exploding);

    const app = registry.getAppCoverage("app.freecad");
    expect(app?.coverageLevel).toBe("BLOCKED");
    expect(app?.detected).toBe(false);
    expect(app?.evidence.join(" ")).toContain("PATH lookup was denied");
  });

  it("records a probe reporting absence as UNSUPPORTED", async () => {
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("app.maya", "Maya");

    await registry.runCoverageScan(
      probeReturning({ detected: false, evidence: ["Not present on PATH or in the registry."] }),
    );

    const app = registry.getAppCoverage("app.maya");
    expect(app?.coverageLevel).toBe("UNSUPPORTED");
    expect(app?.version).toBeNull();
  });
});

describe("a claim may not outrun its evidence", () => {
  it("REFUSES detection that comes with no evidence", async () => {
    // A probe asserting presence without saying how it knows is not a finding.
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("app.blender", "Blender 3D");

    await registry.runCoverageScan(
      probeReturning({
        detected: true,
        version: "4.0.2",
        supportedActions: ["render"],
        evidence: [],
      }),
    );

    const app = registry.getAppCoverage("app.blender");
    expect(app?.coverageLevel).toBe("BLOCKED");
    expect(app?.detected).toBe(false);
    expect(app?.version).toBeNull();
    expect(app?.evidence.join(" ")).toMatch(/no evidence/i);
  });

  it("downgrades a detected app with no usable action to PARTIAL", async () => {
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("app.blender", "Blender 3D");

    await registry.runCoverageScan(
      probeReturning({
        detected: true,
        version: "4.0.2",
        supportedActions: [],
        evidence: ["blender --version returned 4.0.2"],
      }),
    );

    const app = registry.getAppCoverage("app.blender");
    expect(app?.coverageLevel).toBe("PARTIAL");
    expect(app?.evidence.join(" ")).toMatch(/no supported action/i);
  });

  it("marks a limited application PARTIAL and keeps the limitation visible", async () => {
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("app.chrome", "Chrome");

    await registry.runCoverageScan(
      probeReturning({
        detected: true,
        version: "123.0",
        supportedActions: ["navigate"],
        evidence: ["chrome --version returned 123.0"],
        limitations: ["The extension is not paired, so DOM inspection is unavailable."],
      }),
    );

    const app = registry.getAppCoverage("app.chrome");
    expect(app?.coverageLevel).toBe("PARTIAL");
    expect(app?.evidence.join(" ")).toMatch(/extension is not paired/i);
  });

  it("publishes FULL only for a detected app with evidence and no limitation", async () => {
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("app.blender", "Blender 3D");

    await registry.runCoverageScan(
      probeReturning({
        detected: true,
        version: "4.0.2",
        supportedActions: ["open", "render"],
        evidence: ["blender --version returned 4.0.2"],
      }),
    );

    const app = registry.getAppCoverage("app.blender");
    expect(app?.coverageLevel).toBe("FULL");
    expect(app?.supportedActions).toContain("render");
    // The version is published because a probe supplied it, not because the
    // registry knew it.
    expect(app?.version).toBe("4.0.2");
  });

  it("records when the scan ran, so a stale report is detectable", async () => {
    const registry = new AppCoverageRegistry();
    expect(registry.lastScanned).toBeNull();
    await registry.runCoverageScan();
    expect(registry.lastScanned).toBeInstanceOf(Date);
  });
});

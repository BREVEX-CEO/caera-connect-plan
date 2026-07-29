import { describe, it, expect } from "vitest";
import { AppCoverageRegistry, globalCoverageRegistry } from "../providers/app-coverage-registry";

/**
 * Stage 2 Phase 37 — universal application coverage run.
 *
 * This suite previously asserted that a dry run with nothing to probe with
 * yielded UNSUPPORTED. That conflated two different answers: "nothing looked"
 * and "it is not installed". The registry now keeps them apart, and this pins
 * both halves of that distinction.
 */

describe("Stage 2 Phase 37: Universal application coverage run", () => {
  it("has app-coverage-registry module available", () => {
    expect(globalCoverageRegistry).toBeDefined();
  });

  it("reports BLOCKED for a scan with no prober, because nothing looked", async () => {
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("sys.terminal", "Terminal");
    registry.registerAppProfile("sys.browser", "Browser");

    const results = await registry.runCoverageScan();
    expect(results).toHaveLength(2);

    // No probe host exists here, so presence is UNKNOWN — not absent.
    expect(registry.getAppCoverage("sys.terminal")?.coverageLevel).toBe("BLOCKED");
    expect(registry.getAppCoverage("sys.browser")?.coverageLevel).toBe("BLOCKED");
  });

  it("reports UNSUPPORTED only when a probe actually looked and found nothing", async () => {
    const registry = new AppCoverageRegistry();
    registry.registerAppProfile("sys.terminal", "Terminal");

    await registry.runCoverageScan(async () => ({
      detected: false,
      evidence: ["Searched PATH and the application registry; no executable found."],
    }));

    const terminal = registry.getAppCoverage("sys.terminal");
    expect(terminal?.coverageLevel).toBe("UNSUPPORTED");
    expect(terminal?.evidence.join(" ")).toMatch(/no executable found/i);
  });
});

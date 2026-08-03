import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The Stage 2 gate verifies developer-machine state, not repository state.
 *
 * `scripts/check-stage2-baseline.mjs` reads `.claude/OCADE_STAGE_2_SPEC_HASHES.json`,
 * which is gitignored, and that file pins ABSOLUTE paths on one machine
 * (`C:\\Users\\haans\\Downloads\\...`) and asserts each still exists and hashes
 * to a recorded value. None of that can be true in a fresh checkout, so this
 * test failed in CI on every run while passing for whoever wrote it.
 *
 * Skipping when the local-only input is absent is the honest outcome: the gate
 * has nothing to verify there. It is NOT weakened where it applies — when the
 * file exists the assertions run in full, unchanged. The remaining tests in
 * this file read `release/OCADE_STAGE_2_BASELINE.json`, which is tracked, so
 * they run everywhere.
 */
const SPEC_HASHES = ".claude/OCADE_STAGE_2_SPEC_HASHES.json";
const hasLocalSpecHashes = existsSync(SPEC_HASHES);

interface Stage2Baseline {
  phaseScores: Array<{ phase: number; score: number; classification: string; gap: string }>;
  readiness: Record<string, number>;
  implementationPhasesRemaining: number;
  externalValidationTracksRemaining: number;
  firstIncompleteDependency: { phase: number; name: string };
}

const baseline = JSON.parse(
  readFileSync("release/OCADE_STAGE_2_BASELINE.json", "utf8"),
) as Stage2Baseline;

describe("Stage 2 exact transition baseline", () => {
  it.skipIf(!hasLocalSpecHashes)("passes the persisted-spec, checkpoint and readiness gate", () => {
    const output = execFileSync(process.execPath, ["scripts/check-stage2-baseline.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("OCADE Stage 2 baseline gate:");
    expect(output).toContain("SOURCE 30% | RUNTIME 0% | APP COVERAGE 0% | PRODUCTION 15%");
  });

  it("scores every implementation phase exactly once without runtime credit", () => {
    expect(baseline.phaseScores.map((entry) => entry.phase)).toEqual(
      Array.from({ length: 19 }, (_, index) => index + 21),
    );
    expect(baseline.readiness.stage2Source).toBe(30);
    expect(baseline.readiness.stage2SourceRemaining).toBe(70);
    expect(baseline.readiness.stage2Runtime).toBe(0);
    expect(baseline.readiness.stage2ApplicationCoverage).toBe(0);
    expect(baseline.readiness.stage2Production).toBe(15);
  });

  it("names the dependency-safe continuation and the remaining work counts", () => {
    expect(baseline.firstIncompleteDependency).toMatchObject({
      phase: 21,
      name: "Canonical model-to-tool control plane",
    });
    expect(baseline.implementationPhasesRemaining).toBe(19);
    expect(baseline.externalValidationTracksRemaining).toBe(8);
  });
});

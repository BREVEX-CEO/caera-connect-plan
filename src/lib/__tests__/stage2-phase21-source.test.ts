import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ledger = JSON.parse(readFileSync("release/OCADE_STAGE_2_PHASE_21.json", "utf8")) as {
  classification: string;
  sourceScore: number;
  runtimeScore: number;
  stage2Readiness: Record<string, number>;
  implementationPhasesRemaining: number;
  nextDependency: { phase: number };
  runtimeClaims: Record<string, boolean>;
};

describe("Stage 2 Phase 21 source gate", () => {
  it("passes the canonical control-plane source audit", () => {
    const output = execFileSync(process.execPath, ["scripts/check-stage2-phase21.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("OCADE Stage 2 Phase 21 gate:");
    expect(output).toContain("PHASE 21: SOURCE 92% | RUNTIME 0%");
  });

  it("keeps source completeness separate from runtime proof", () => {
    expect(ledger.classification).toBe("SOURCE-COMPLETE BUT RUNTIME-BLOCKED");
    expect(ledger.sourceScore).toBe(92);
    expect(ledger.runtimeScore).toBe(0);
    expect(Object.values(ledger.runtimeClaims).every((claim) => claim === false)).toBe(true);
  });

  it("publishes the exact dependency-safe continuation", () => {
    expect(ledger.stage2Readiness).toMatchObject({
      source: 32,
      sourceRemaining: 68,
      runtime: 0,
      verifiedApplicationCoverage: 0,
      production: 16,
    });
    expect(ledger.implementationPhasesRemaining).toBe(18);
    expect(ledger.nextDependency.phase).toBe(22);
  });
});

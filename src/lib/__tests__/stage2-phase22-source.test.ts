import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ledger = JSON.parse(readFileSync("release/OCADE_STAGE_2_PHASE_22.json", "utf8")) as {
  classification: string;
  sourceScore: number;
  controlledHttpRuntimeScore: number;
  liveInstalledProviderRuntimeScore: number;
  providers: string[];
  stage2Readiness: Record<string, number>;
  runtimeClaims: Record<string, boolean>;
  nextDependency: { phase: number };
};

describe("Stage 2 Phase 22 source gate", () => {
  it("passes the provider-fabric source and evidence audit", () => {
    const output = execFileSync(process.execPath, ["scripts/check-stage2-phase22.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
    expect(output).toContain("OCADE Stage 2 Phase 22 gate:");
    expect(output).toContain("SOURCE 94% | CONTROLLED HTTP 60%");
  });

  it("covers nine required providers without converting fixtures into live claims", () => {
    expect(ledger.providers).toHaveLength(9);
    expect(new Set(ledger.providers).size).toBe(9);
    expect(ledger.controlledHttpRuntimeScore).toBe(60);
    expect(ledger.liveInstalledProviderRuntimeScore).toBe(0);
    expect(Object.values(ledger.runtimeClaims).every((claim) => claim === false)).toBe(true);
  });

  it("publishes honest readiness and the dependency-safe next phase", () => {
    expect(ledger.classification).toBe("SOURCE-COMPLETE BUT RUNTIME-BLOCKED");
    expect(ledger.sourceScore).toBe(94);
    expect(ledger.stage2Readiness).toMatchObject({
      source: 36,
      sourceRemaining: 64,
      runtime: 0,
      production: 18,
    });
    expect(ledger.nextDependency.phase).toBe(23);
  });
});

import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ReadinessCancelledError,
  buildReadinessRecoveryPlan,
  createReadinessPublication,
  evaluateRequirementReadiness,
  validateProductionClaim,
} from "../../../scripts/readiness-engine.mjs";

const completeRow = {
  id: "REQ-01",
  area: "Test area",
  status: "REAL TARGET RUNTIME VERIFIED",
  weight: 1,
  evidence: "Executed acceptance receipt with an independently verified postcondition.",
  resolvedInPhase: "P29",
};
const makeSnapshot = (requirements: Array<Record<string, unknown>>, over = {}) => ({
  generatedAt: "2026-07-30T12:00:00.000Z",
  head: "abc1234+p29-worktree",
  counts: Object.fromEntries(
    requirements.map((row) => [
      String(row.status),
      requirements.filter((candidate) => candidate.status === row.status).length,
    ]),
  ),
  readiness: {
    expanded: {
      numerator: requirements.reduce((sum, row) => sum + Number(row.weight), 0),
    },
  },
  requirements,
  ...over,
});
const options = {
  expectedRequirementCount: 1,
  expectedHead: "abc123456789",
  expectedTargetVersion: "1.0.0",
  targetVersion: "1.0.0",
  now: new Date("2026-07-30T13:00:00.000Z"),
};

describe("final readiness evidence accounting", () => {
  it("accepts a fresh, source-bound, requirement-specific real-runtime receipt", () => {
    const result = evaluateRequirementReadiness(makeSnapshot([completeRow]), options);
    expect(result).toMatchObject({
      denominator: 1,
      declared: { numerator: 1, percent: 100 },
      evidenceBound: { numerator: 1, percent: 100 },
      productionReady: true,
      issues: [],
    });
  });

  it("does not convert an unsupported declaration into evidence", () => {
    const result = evaluateRequirementReadiness(
      makeSnapshot([{ ...completeRow, evidence: undefined, resolvedInPhase: undefined }]),
      options,
    );
    expect(result.declared.numerator).toBe(1);
    expect(result.evidenceBound.numerator).toBe(0);
    expect(result.productionReady).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "evidence_unbound", requirementId: "REQ-01" }),
    );
  });

  it("fails closed on stale, future, source-drifted, and target-drifted evidence", () => {
    const stale = evaluateRequirementReadiness(makeSnapshot([completeRow]), {
      ...options,
      now: new Date("2026-08-08T13:00:00.000Z"),
    });
    const future = evaluateRequirementReadiness(makeSnapshot([completeRow]), {
      ...options,
      now: new Date("2026-07-29T13:00:00.000Z"),
    });
    const drifted = evaluateRequirementReadiness(makeSnapshot([completeRow]), {
      ...options,
      expectedHead: "different-revision",
      targetVersion: "2.0.0",
    });
    expect(stale.issues.map((entry) => entry.code)).toContain("snapshot_stale");
    expect(future.issues.map((entry) => entry.code)).toContain("snapshot_from_future");
    expect(drifted.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["source_revision_drift", "target_version_drift"]),
    );
    expect([stale, future, drifted].every((result) => result.evidenceBound.numerator === 0)).toBe(
      true,
    );
  });

  it("invalidates proof when its environment, dependency lock, or verification rule drifts", () => {
    const boundSnapshot = makeSnapshot([completeRow], {
      evidenceBindings: {
        environment: "windows-x64-node22+",
        dependencyLockSha256: "expected-lock",
        verificationRuleVersion: "p29-v1",
      },
    });
    const result = evaluateRequirementReadiness(boundSnapshot, {
      ...options,
      expectedEvidenceBindings: {
        environment: "windows-x64-node22+",
        dependencyLockSha256: "changed-lock",
        verificationRuleVersion: "p29-v2",
      },
    });
    expect(result.evidenceBound.numerator).toBe(0);
    expect(result.issues.filter((entry) => entry.code === "evidence_binding_drift")).toHaveLength(
      2,
    );
  });

  it("refuses malformed rows, duplicate IDs, and stale published claims", () => {
    const malformed = evaluateRequirementReadiness(
      makeSnapshot([completeRow, { ...completeRow, status: "UNIT TESTED", weight: 1 }]),
      { ...options, expectedRequirementCount: 2 },
    );
    expect(malformed.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["requirement_id_duplicate", "weight_mismatch"]),
    );
    const valid = evaluateRequirementReadiness(makeSnapshot([completeRow]), options);
    expect(
      validateProductionClaim(
        {
          ...createReadinessPublication(valid),
          evidenceBoundNumerator: 0,
          productionReady: true,
        },
        valid,
      ).map((entry) => entry.code),
    ).toContain("published_score_stale");
  });

  it("supports cancellation and supplies deterministic, non-mutating recovery instructions", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      evaluateRequirementReadiness(makeSnapshot([completeRow]), {
        ...options,
        signal: controller.signal,
      }),
    ).toThrow(ReadinessCancelledError);

    const incomplete = evaluateRequirementReadiness(
      makeSnapshot([{ ...completeRow, evidence: undefined, resolvedInPhase: undefined }]),
      options,
    );
    expect(buildReadinessRecoveryPlan(incomplete)).toContainEqual(
      expect.objectContaining({ code: "evidence_unbound" }),
    );
  });

  it("recalculates the tracked 510-row snapshot without trusting its headline", () => {
    const tracked = JSON.parse(
      readFileSync("release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json", "utf8"),
    );
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const result = evaluateRequirementReadiness(tracked, {
      expectedRequirementCount: 510,
      expectedHead: head,
      expectedTargetVersion: packageJson.version,
      targetVersion: packageJson.version,
      now: new Date("2026-07-30T18:30:00.000Z"),
    });
    expect(result.declared).toEqual({ numerator: 262, denominator: 510, percent: 51.4 });
    expect(result.evidenceBound).toEqual({ numerator: 111.9, denominator: 510, percent: 21.9 });
    expect(result.issues.filter((entry) => entry.code === "evidence_unbound")).toHaveLength(319);
    expect(result.productionReady).toBe(false);
  });

  it("makes the executable publication gate reject a falsified score", () => {
    const directory = mkdtempSync(join(tmpdir(), "ocade-readiness-"));
    const honest = JSON.parse(readFileSync("release/OCADE_P29_FINAL_READINESS.json", "utf8"));
    const falsifiedPath = join(directory, "falsified.json");
    writeFileSync(
      falsifiedPath,
      JSON.stringify({ ...honest, evidenceBoundNumerator: honest.evidenceBoundNumerator + 1 }),
      "utf8",
    );
    const run = spawnSync(process.execPath, ["scripts/check-final-readiness.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, OCADE_FINAL_READINESS: falsifiedPath },
    });
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("published_score_stale");
  });
});

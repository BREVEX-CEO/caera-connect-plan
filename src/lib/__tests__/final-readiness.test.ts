import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ReadinessCancelledError,
  buildReadinessRecoveryPlan,
  createReadinessPublication,
  effectiveBoundRevision,
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

  /**
   * Evaluate the tracked snapshot with its evidence treated as current.
   *
   * The snapshot's `head` is deliberately NOT compared against live HEAD here.
   * A file cannot record the hash of the commit that contains it, so the final
   * re-bind commit always moves HEAD one ahead of the recorded revision — which
   * would make every run of this test see stale evidence and a zero score, and
   * would say nothing about whether the arithmetic is right. Revision drift is
   * a real check, but it belongs to the readiness GATE (`readiness:check`,
   * which reports `source_revision_drift`), and is asserted separately below.
   * This test owns the arithmetic.
   */
  function evaluateTracked() {
    const tracked = JSON.parse(
      readFileSync("release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json", "utf8"),
    );
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const generatedAt = Date.parse(tracked.generatedAt);
    return {
      tracked,
      result: evaluateRequirementReadiness(tracked, {
        expectedRequirementCount: 510,
        expectedHead: tracked.head,
        expectedTargetVersion: packageJson.version,
        targetVersion: packageJson.version,
        // Anchored to the snapshot's own timestamp rather than a frozen
        // literal, so regenerating it does not put the age check in the past.
        now: new Date(generatedAt + 60_000),
      }),
    };
  }

  it("recalculates the tracked 510-row snapshot without trusting its headline", () => {
    const { tracked, result } = evaluateTracked();

    // The headline is a claim stored in a separate field; the engine derives
    // its own total from the 510 rows. Comparing the two is what makes the
    // headline untrusted. A hard-coded literal would only catch drift at the
    // moment someone remembered to update it.
    expect(result.declared).toEqual(tracked.readiness.expanded);
    expect(result.counts).toEqual(tracked.counts);

    // Every row must name the evidence and the phase that observed it. This
    // was 319 unbound; it is the property the whole register depends on.
    expect(result.issues.filter((entry) => entry.code === "evidence_unbound")).toHaveLength(0);

    // Evidence-bound can never exceed declared: you cannot prove more than you
    // claim. This holds regardless of what either number happens to be.
    expect(result.evidenceBound.numerator).toBeLessThanOrEqual(result.declared.numerator);

    expect(result.productionReady).toBe(false);
  });

  it("treats the tracked snapshot as stale when it is not bound to the revision under test", () => {
    const tracked = JSON.parse(
      readFileSync("release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json", "utf8"),
    );
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const head = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const foreignRevision = head === "0".repeat(40) ? "1".repeat(40) : "0".repeat(40);

    const result = evaluateRequirementReadiness(tracked, {
      expectedRequirementCount: 510,
      expectedHead: foreignRevision,
      expectedTargetVersion: packageJson.version,
      targetVersion: packageJson.version,
      now: new Date(Date.parse(tracked.generatedAt) + 60_000),
    });

    // Readiness evidence describes a specific tree. Pointed at a different
    // revision, every bound row must lose its weight rather than carry a score
    // forward onto source it was never observed against.
    expect(result.evidenceBound.numerator).toBe(0);
    expect(result.issues.map((entry) => entry.code)).toContain("source_revision_drift");
    expect(result.productionReady).toBe(false);
  });

  describe("the binding commit is tolerated, and nothing else is", () => {
    const RECORDED = "a".repeat(40);
    const HEAD = "b".repeat(40);
    const SNAPSHOT = "release/OCADE_REQUIREMENT_STATUS_SNAPSHOT.json";
    const PUBLICATION = "release/OCADE_P29_FINAL_READINESS.json";

    it("judges evidence against the recorded revision when only binding files moved", () => {
      // The commit that writes the binding cannot contain its own hash, so this
      // one-commit gap is structural rather than a sign of stale evidence.
      expect(effectiveBoundRevision(RECORDED, HEAD, [SNAPSHOT, PUBLICATION])).toBe(RECORDED);
      expect(effectiveBoundRevision(RECORDED, HEAD, [SNAPSHOT])).toBe(RECORDED);
    });

    it("tolerates a progress note that no script reads", () => {
      // CHECKPOINT.md is narrative. Invalidating every bound row because it
      // moved failed the readiness gate on every CI push while the code it
      // describes had not changed at all.
      expect(effectiveBoundRevision(RECORDED, HEAD, ["CHECKPOINT.md"])).toBe(RECORDED);
      expect(effectiveBoundRevision(RECORDED, HEAD, ["CHECKPOINT.md", SNAPSHOT])).toBe(RECORDED);
    });

    it("falls back to HEAD as soon as any evidence-bearing file moved", () => {
      // These are the cases that must never be forgiven: if source, tests or
      // gate scripts changed, the recorded evidence describes a different tree.
      expect(effectiveBoundRevision(RECORDED, HEAD, [SNAPSHOT, "src/lib/ocade-local.ts"])).toBe(
        HEAD,
      );
      expect(effectiveBoundRevision(RECORDED, HEAD, ["scripts/readiness-engine.mjs"])).toBe(HEAD);
      expect(effectiveBoundRevision(RECORDED, HEAD, ["package-lock.json"])).toBe(HEAD);
    });

    it("does not forgive an undeterminable or empty diff", () => {
      expect(effectiveBoundRevision(RECORDED, HEAD, null)).toBe(HEAD);
      expect(effectiveBoundRevision(RECORDED, HEAD, [])).toBe(HEAD);
    });

    it("returns HEAD when there is nothing to reconcile", () => {
      expect(effectiveBoundRevision(HEAD, HEAD, [])).toBe(HEAD);
      expect(effectiveBoundRevision(undefined, HEAD, [])).toBe(HEAD);
    });
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

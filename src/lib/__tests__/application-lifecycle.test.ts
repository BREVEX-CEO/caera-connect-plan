import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  MemoryLifecycleEvidenceStore,
  coordinateLifecycleReview,
  evaluateApplicationDrift,
  evaluateSecurityPatch,
  validateLifecyclePolicy,
  type ApplicationLifecycleState,
  type LifecyclePolicy,
  type SecurityAdvisory,
} from "../../../scripts/lifecycle-policy.mjs";
import { RevocationList, versionsCompatible } from "../skills/skill-trust";

const NOW = new Date("2026-07-30T18:00:00.000Z");
const policy = JSON.parse(
  readFileSync("release/OCADE_APP_DRIFT_SECURITY_POLICY.json", "utf8"),
) as LifecyclePolicy;
const baseline: ApplicationLifecycleState = {
  appId: "cad.example",
  version: "1.2.3",
  fingerprint: "uat1:12345678",
  capabilityDigest: "a".repeat(64),
  layoutRevision: "layout-7",
  plugins: ["core", "export"],
  observedAt: NOW.toISOString(),
};
const advisory: SecurityAdvisory = {
  id: "CVE-2026-0042",
  appId: baseline.appId,
  severity: "critical",
  affectedVersions: [baseline.version],
  fixedVersion: "1.2.4",
  sourceUrl: "https://nvd.nist.gov/vuln/detail/CVE-2026-0042",
  advisorySha256: "b".repeat(64),
  signatureVerified: true,
  observedAt: NOW.toISOString(),
};
const completePatchEvidence = {
  ownerApproved: true,
  safeRehearsalPassed: true,
  knownGoodRollbackVersion: "1.2.2",
  observedArtifactSha256: "c".repeat(64),
  independentPostInstallVerification: true,
};

describe("application lifecycle policy", () => {
  it("accepts the tracked policy and rejects dishonest fail-open variants", () => {
    expect(validateLifecyclePolicy(policy)).toEqual({ ok: true, issues: [] });
    for (const changed of [
      { ...policy, automaticPatchApplication: true },
      { ...policy, trustedAdvisoryHosts: ["*.example.com"] },
      { ...policy, invalidatePrivateRecipesOnDrift: false },
      {
        ...policy,
        severityActions: { ...policy.severityActions, critical: "monitor" },
      },
      {
        ...policy,
        currentRuntime: { ...policy.currentRuntime, patchApplied: true },
      },
    ]) {
      expect(validateLifecyclePolicy(changed).ok).toBe(false);
    }
  });

  it("retains a patch-compatible adapter only when structural evidence is unchanged and fresh", () => {
    const observation = { ...baseline, version: "1.2.4" };
    expect(versionsCompatible(baseline.version, observation.version)).toBe(true);
    expect(evaluateApplicationDrift(policy, baseline, observation, { now: NOW })).toMatchObject({
      valid: true,
      executionAllowed: true,
      invalidated: false,
      action: "retain_version_bound_adapter",
    });
  });

  it.each([
    ["version", { version: "1.3.0" }, "version"],
    ["fingerprint", { fingerprint: "uat1:87654321" }, "fingerprint"],
    ["capabilities", { capabilityDigest: "d".repeat(64) }, "capabilityDigest"],
    ["layout", { layoutRevision: "layout-8" }, "layoutRevision"],
    ["plug-ins", { plugins: ["core"] }, "plugins"],
    ["freshness", { observedAt: "2026-01-01T00:00:00.000Z" }, "staleObservation"],
  ])("invalidates on %s drift", (_label, change, expectedReason) => {
    const result = evaluateApplicationDrift(
      policy,
      baseline,
      { ...baseline, ...change },
      { now: NOW },
    );
    expect(result).toMatchObject({ executionAllowed: false, invalidated: true });
    expect(result.reasons).toContain(expectedReason);
    expect(result.recovery).toMatch(/Disable the adapter/);
  });

  it("blocks an affected critical application and never equates staging with application", () => {
    expect(
      evaluateSecurityPatch(policy, advisory, baseline.version, completePatchEvidence, {
        now: NOW,
      }),
    ).toMatchObject({
      valid: true,
      affected: true,
      executionBlocked: true,
      stagingReady: true,
      applied: false,
      action: "block_and_stage_patch",
    });
  });

  it.each([
    ["HTTP advisory", { sourceUrl: "http://nvd.nist.gov/vuln/CVE-2026-0042" }],
    ["untrusted origin", { sourceUrl: "https://attacker.invalid/CVE-2026-0042" }],
    ["missing digest", { advisorySha256: "" }],
    ["unverified signature", { signatureVerified: false }],
    ["stale observation", { observedAt: "2026-01-01T00:00:00.000Z" }],
    ["non-newer fix", { fixedVersion: "1.2.3" }],
  ])("refuses untrusted patch evidence: %s", (_label, change) => {
    const result = evaluateSecurityPatch(
      policy,
      { ...advisory, ...change },
      baseline.version,
      completePatchEvidence,
      { now: NOW },
    );
    expect(result.valid).toBe(false);
    expect(result.stagingReady).toBe(false);
    expect(result.applied).toBe(false);
  });

  it.each([
    ["owner approval", { ownerApproved: false }],
    ["safe rehearsal", { safeRehearsalPassed: false }],
    ["rollback", { knownGoodRollbackVersion: "" }],
    ["older rollback", { knownGoodRollbackVersion: "9.9.9" }],
    ["observed artifact digest", { observedArtifactSha256: "" }],
    ["independent post-install verification", { independentPostInstallVerification: false }],
  ])("keeps staging closed without %s", (_label, change) => {
    const result = evaluateSecurityPatch(
      policy,
      advisory,
      baseline.version,
      { ...completePatchEvidence, ...change },
      { now: NOW },
    );
    expect(result.valid).toBe(true);
    expect(result.executionBlocked).toBe(true);
    expect(result.stagingReady).toBe(false);
    expect(result.applied).toBe(false);
  });

  it("does not block an unaffected installed version", () => {
    expect(
      evaluateSecurityPatch(policy, advisory, "1.2.2", completePatchEvidence, { now: NOW }),
    ).toMatchObject({
      affected: false,
      executionBlocked: false,
      stagingReady: false,
      applied: false,
      action: "no_patch_required",
    });
  });

  it("coordinates revocation, an immutable receipt copy and recovery state", async () => {
    const revocations = new RevocationList();
    const store = new MemoryLifecycleEvidenceStore();
    const result = await coordinateLifecycleReview({
      policy,
      baseline,
      observation: { ...baseline, layoutRevision: "layout-8" },
      advisory,
      patchEvidence: completePatchEvidence,
      skillIds: ["cad.export", "cad.draw"],
      revocations,
      store,
      receiptId: "receipt-az442-443",
      sourceRevision: "19d3414",
      now: NOW,
    });
    expect(result.receipt).toMatchObject({
      drift: { invalidated: true },
      patch: { executionBlocked: true, applied: false },
      revokedSkillIds: ["cad.export", "cad.draw"],
      recoveryRequired: true,
    });
    expect(revocations.isRevoked("cad.export", "1.0.0")).toBe(true);
    const stored = store.all();
    expect(stored).toHaveLength(1);
    result.receipt.revokedSkillIds = [];
    expect(store.all()[0]).toMatchObject({ revokedSkillIds: ["cad.export", "cad.draw"] });
  });

  it("supports cancellation before any receipt or revocation is written", async () => {
    const controller = new AbortController();
    const revocations = new RevocationList();
    const store = new MemoryLifecycleEvidenceStore();
    controller.abort();
    await expect(
      coordinateLifecycleReview({
        policy,
        baseline,
        observation: baseline,
        advisory,
        patchEvidence: completePatchEvidence,
        skillIds: ["cad.export"],
        revocations,
        store,
        receiptId: "cancelled",
        sourceRevision: "19d3414",
        now: NOW,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(store.all()).toEqual([]);
    expect(revocations.all()).toEqual([]);
  });

  it("refuses malformed receipt and source bindings before side effects", async () => {
    for (const [receiptId, sourceRevision] of [
      ["", "19d3414"],
      ["receipt-1", "not-a-revision"],
    ]) {
      const revocations = new RevocationList();
      const store = new MemoryLifecycleEvidenceStore();
      await expect(
        coordinateLifecycleReview({
          policy,
          baseline,
          observation: baseline,
          advisory,
          patchEvidence: completePatchEvidence,
          skillIds: ["cad.export"],
          revocations,
          store,
          receiptId,
          sourceRevision,
          now: NOW,
        }),
      ).rejects.toThrow(/bounded ID and source revision/);
      expect(store.all()).toEqual([]);
      expect(revocations.all()).toEqual([]);
    }
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  evaluateLaunchAuthority,
  validateLaunchAuthorityPolicy,
} from "../../../scripts/launch-authority.mjs";

const policy = JSON.parse(readFileSync("release/OCADE_LAUNCH_AUTHORITY_POLICY.json", "utf8"));
const NOW = new Date("2026-07-30T17:50:00.000Z");
const sourceRevision = "abcdef1234567890";

function completeEvidence() {
  return {
    signing: {
      trustedProductionIdentity: true,
      placeholderIdentity: false,
      artifactSha256: "a".repeat(64),
      sourceRevision,
      cryptographicVerification: true,
      platformTrust: true,
      observedAt: "2026-07-30T17:45:00.000Z",
    },
    deployment: {
      authorizedProductionEnvironment: true,
      healthUrl: "https://ocade.example/api/health",
      healthObserved: true,
      deployerId: "release-owner",
      verifierId: "independent-verifier",
      rollbackVersion: "1234567abc",
      observedAt: "2026-07-30T17:46:00.000Z",
    },
    support_readiness: {
      namedOnCall: true,
      escalationRouteVerified: true,
      alertDeliveryObserved: true,
      incidentDrillPassed: true,
      restoreDrillPassed: true,
      privacyContactAssigned: true,
      observedAt: "2026-07-30T17:47:00.000Z",
    },
    announcement: {
      finalProductionReadinessGatePassed: true,
      ownerApproved: true,
      targetVersion: "1.0.0",
      sourceRevision,
      supportUrl: "https://ocade.example/support",
      rollbackUrl: "https://status.ocade.example/rollback",
      approvedAt: "2026-07-30T17:48:00.000Z",
    },
  };
}

describe("production launch authority", () => {
  it("validates the dependency-ordered source policy", () => {
    expect(validateLaunchAuthorityPolicy(policy)).toEqual({ ok: true, issues: [] });
  });

  it("records the current source-only state as four external blockers", () => {
    const result = evaluateLaunchAuthority(policy, {}, { now: NOW });
    expect(result.ready).toBe(false);
    expect(Object.values(result.stages)).toHaveLength(4);
    expect(
      Object.values(result.stages).every((value) => value.classification === "EXTERNALLY_BLOCKED"),
    ).toBe(true);
  });

  it("rejects a policy that claims authority the repository does not possess", () => {
    const dishonest = structuredClone(policy);
    dishonest.currentAuthority.productionDeploymentObserved = true;
    expect(validateLaunchAuthorityPolicy(dishonest)).toMatchObject({ ok: false });
  });

  it.each([
    ["placeholder identity", { placeholderIdentity: true }],
    ["bad artifact digest", { artifactSha256: "bad" }],
    ["missing platform trust", { platformTrust: false }],
    ["stale observation", { observedAt: "2026-01-01T00:00:00.000Z" }],
  ])("keeps signing blocked for %s", (_label, override) => {
    const evidence = completeEvidence();
    evidence.signing = { ...evidence.signing, ...override };
    expect(evaluateLaunchAuthority(policy, evidence, { now: NOW }).stages.signing.ready).toBe(
      false,
    );
  });

  it("accepts production signing evidence without implying deployment", () => {
    const evidence = completeEvidence();
    const result = evaluateLaunchAuthority(policy, { signing: evidence.signing }, { now: NOW });
    expect(result.stages.signing.ready).toBe(true);
    expect(result.stages.deployment.ready).toBe(false);
    expect(result.ready).toBe(false);
  });

  it.each([
    ["HTTP health", { healthUrl: "http://ocade.example/api/health" }],
    ["self verification", { verifierId: "release-owner" }],
    ["missing rollback", { rollbackVersion: "" }],
    ["unobserved health", { healthObserved: false }],
  ])("keeps deployment blocked for %s", (_label, override) => {
    const evidence = completeEvidence();
    evidence.deployment = { ...evidence.deployment, ...override };
    expect(evaluateLaunchAuthority(policy, evidence, { now: NOW }).stages.deployment.ready).toBe(
      false,
    );
  });

  it("refuses deployment even with a health receipt when signing is absent", () => {
    const evidence = completeEvidence();
    expect(
      evaluateLaunchAuthority(policy, { deployment: evidence.deployment }, { now: NOW }).stages
        .deployment.ready,
    ).toBe(false);
  });

  it.each([
    ["no on-call", { namedOnCall: false }],
    ["no alert proof", { alertDeliveryObserved: false }],
    ["no incident drill", { incidentDrillPassed: false }],
    ["no restore drill", { restoreDrillPassed: false }],
  ])("keeps support readiness blocked for %s", (_label, override) => {
    const evidence = completeEvidence();
    evidence.support_readiness = { ...evidence.support_readiness, ...override };
    expect(
      evaluateLaunchAuthority(policy, evidence, { now: NOW }).stages.support_readiness.ready,
    ).toBe(false);
  });

  it("refuses announcement before the final readiness gate or with source drift", () => {
    for (const announcement of [
      { ...completeEvidence().announcement, finalProductionReadinessGatePassed: false },
      { ...completeEvidence().announcement, sourceRevision: "7654321" },
      { ...completeEvidence().announcement, ownerApproved: false },
    ]) {
      const evidence = completeEvidence();
      evidence.announcement = announcement;
      expect(
        evaluateLaunchAuthority(policy, evidence, { now: NOW }).stages.announcement.ready,
      ).toBe(false);
    }
  });

  it("can pass only when all four real authority stages are present", () => {
    const result = evaluateLaunchAuthority(policy, completeEvidence(), { now: NOW });
    expect(result.ready).toBe(true);
    expect(
      Object.values(result.stages).every(
        (value) => value.classification === "REAL_TARGET_RUNTIME_VERIFIED",
      ),
    ).toBe(true);
  });

  it("honours cancellation before evaluating authority", () => {
    const controller = new AbortController();
    controller.abort();
    expect(() =>
      evaluateLaunchAuthority(policy, completeEvidence(), {
        now: NOW,
        signal: controller.signal,
      }),
    ).toThrow(/cancelled/i);
  });
});

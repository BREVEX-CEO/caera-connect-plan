import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SHA256 = /^[a-f0-9]{64}$/;
const REF = /^[a-f0-9]{7,64}$/;
const stage = (ready, reason) => ({
  ready,
  classification: ready ? "REAL_TARGET_RUNTIME_VERIFIED" : "EXTERNALLY_BLOCKED",
  reason,
});
const fresh = (value, now) => {
  const observed = Date.parse(value ?? "");
  return (
    Number.isFinite(observed) &&
    observed <= now.getTime() + 5 * 60_000 &&
    now.getTime() - observed <= 30 * 24 * 60 * 60_000
  );
};

export function validateLaunchAuthorityPolicy(policy) {
  const issues = [];
  if (policy?.schemaVersion !== 1 || !policy?.owner) issues.push("schema and owner are required");
  if (
    JSON.stringify(policy?.orderedStages) !==
    JSON.stringify(["signing", "deployment", "support_readiness", "announcement"])
  ) {
    issues.push("launch stages must remain dependency ordered");
  }
  if (
    Object.values(policy?.currentAuthority ?? {}).some((value) => value !== false) ||
    Object.values(policy?.forbidden ?? {}).some((value) => value !== true)
  ) {
    issues.push("current authority and false-success prohibitions are dishonest");
  }
  for (const name of policy?.orderedStages ?? []) {
    if (!policy?.externalActions?.[name] || (policy?.requirements?.[name]?.length ?? 0) < 5) {
      issues.push(`${name} lacks prerequisites or one explicit external action`);
    }
  }
  return { ok: issues.length === 0, issues };
}

export function evaluateLaunchAuthority(policy, evidence = {}, options = {}) {
  if (options.signal?.aborted) {
    const error = new Error("Launch-authority evaluation cancelled.");
    error.name = "AbortError";
    throw error;
  }
  const policyValidation = validateLaunchAuthorityPolicy(policy);
  if (!policyValidation.ok) {
    return { ready: false, issues: policyValidation.issues, stages: {} };
  }
  const now = options.now ?? new Date();
  const signingEvidence = evidence.signing ?? {};
  const signingReady =
    signingEvidence.trustedProductionIdentity === true &&
    signingEvidence.placeholderIdentity !== true &&
    SHA256.test(signingEvidence.artifactSha256 ?? "") &&
    REF.test(signingEvidence.sourceRevision ?? "") &&
    signingEvidence.cryptographicVerification === true &&
    signingEvidence.platformTrust === true &&
    fresh(signingEvidence.observedAt, now);
  const signing = stage(
    signingReady,
    signingReady ? "Production artifact trust observed." : policy.externalActions.signing,
  );

  const deploymentEvidence = evidence.deployment ?? {};
  const deploymentReady =
    signingReady &&
    deploymentEvidence.authorizedProductionEnvironment === true &&
    /^https:\/\/[^/]+\/api\/health(?:\?.*)?$/.test(deploymentEvidence.healthUrl ?? "") &&
    deploymentEvidence.healthObserved === true &&
    deploymentEvidence.deployerId &&
    deploymentEvidence.verifierId &&
    deploymentEvidence.deployerId !== deploymentEvidence.verifierId &&
    REF.test(deploymentEvidence.rollbackVersion ?? "") &&
    fresh(deploymentEvidence.observedAt, now);
  const deployment = stage(
    Boolean(deploymentReady),
    deploymentReady
      ? "Production health and rollback observed."
      : policy.externalActions.deployment,
  );

  const supportEvidence = evidence.support_readiness ?? {};
  const supportReady =
    supportEvidence.namedOnCall === true &&
    supportEvidence.escalationRouteVerified === true &&
    supportEvidence.alertDeliveryObserved === true &&
    supportEvidence.incidentDrillPassed === true &&
    supportEvidence.restoreDrillPassed === true &&
    supportEvidence.privacyContactAssigned === true &&
    fresh(supportEvidence.observedAt, now);
  const support_readiness = stage(
    supportReady,
    supportReady
      ? "Staffing, alerts, incident and restore drills observed."
      : policy.externalActions.support_readiness,
  );

  const announcementEvidence = evidence.announcement ?? {};
  const announcementReady =
    deploymentReady &&
    supportReady &&
    announcementEvidence.finalProductionReadinessGatePassed === true &&
    announcementEvidence.ownerApproved === true &&
    announcementEvidence.targetVersion &&
    announcementEvidence.sourceRevision === signingEvidence.sourceRevision &&
    announcementEvidence.supportUrl?.startsWith("https://") &&
    announcementEvidence.rollbackUrl?.startsWith("https://") &&
    fresh(announcementEvidence.approvedAt, now);
  const announcement = stage(
    Boolean(announcementReady),
    announcementReady
      ? "Version-bound launch communication approved."
      : policy.externalActions.announcement,
  );

  return {
    ready: Boolean(signingReady && deploymentReady && supportReady && announcementReady),
    issues: [],
    stages: { signing, deployment, support_readiness, announcement },
  };
}

function runCli() {
  const policy = JSON.parse(
    readFileSync(new URL("../release/OCADE_LAUNCH_AUTHORITY_POLICY.json", import.meta.url), "utf8"),
  );
  const result = evaluateLaunchAuthority(policy);
  if (result.issues.length > 0) {
    console.error(`Launch-authority gate failed:\n- ${result.issues.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  if (result.ready) {
    console.error(
      "Launch-authority gate failed: source-only invocation cannot be production ready.",
    );
    process.exitCode = 1;
    return;
  }
  console.log("Launch-authority gate: four dependency-ordered stages remain externally blocked.");
  for (const [name, value] of Object.entries(result.stages)) {
    console.log(`- ${name}: ${value.classification}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runCli();

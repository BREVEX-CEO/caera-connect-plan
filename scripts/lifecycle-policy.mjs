const SHA256 = /^[a-f0-9]{64}$/;
const REVISION = /^[a-f0-9]{7,64}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{0,127}$/i;
const SEVERITIES = ["critical", "high", "medium", "low"];
const DRIFT_SIGNALS = ["version", "fingerprint", "capabilityDigest", "layoutRevision", "plugins"];

const clone = (value) => JSON.parse(JSON.stringify(value));
const parseVersion = (value) => {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(value ?? "");
  return match ? match.slice(1).map(Number) : null;
};
const compareVersions = (left, right) => {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
};
const versionsCompatible = (learned, observed) => {
  const a = parseVersion(learned);
  const b = parseVersion(observed);
  return a && b ? a[0] === b[0] && a[1] === b[1] : learned === observed;
};
const sorted = (values) => [...(values ?? [])].sort();
const sameArray = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
const fresh = (value, now, maximumAgeMs) => {
  const observed = Date.parse(value ?? "");
  return (
    Number.isFinite(observed) &&
    observed <= now.getTime() + 5 * 60_000 &&
    now.getTime() - observed <= maximumAgeMs
  );
};
const trustedUrl = (value, hosts) => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.hash &&
      hosts.includes(url.hostname)
    );
  } catch {
    return false;
  }
};

export function validateLifecyclePolicy(policy) {
  const issues = [];
  if (policy?.schemaVersion !== 1 || !SAFE_ID.test(policy?.owner ?? "")) {
    issues.push("schema and bounded owner are required");
  }
  if (
    !Number.isInteger(policy?.maximumObservationAgeMs) ||
    policy.maximumObservationAgeMs < 60_000
  ) {
    issues.push("a positive observation freshness window is required");
  }
  if (JSON.stringify(policy?.driftSignals) !== JSON.stringify(DRIFT_SIGNALS)) {
    issues.push("all five application-drift signals are required in dependency order");
  }
  if (
    !Array.isArray(policy?.trustedAdvisoryHosts) ||
    policy.trustedAdvisoryHosts.length === 0 ||
    policy.trustedAdvisoryHosts.some(
      (host) => typeof host !== "string" || host.includes("/") || host.includes("*"),
    )
  ) {
    issues.push("explicit advisory hosts are required; wildcards are forbidden");
  }
  if (
    policy?.severityActions?.critical !== "block_and_stage_patch" ||
    policy?.severityActions?.high !== "block_and_stage_patch" ||
    policy?.severityActions?.medium !== "degrade_and_review" ||
    policy?.severityActions?.low !== "monitor"
  ) {
    issues.push("severity actions must fail closed for critical and high advisories");
  }
  if (
    Object.values(policy?.patchRequirements ?? {}).length !== 7 ||
    Object.values(policy.patchRequirements).some((value) => value !== true)
  ) {
    issues.push("all seven patch trust, verification and recovery requirements are mandatory");
  }
  if (
    policy?.automaticPatchApplication !== false ||
    policy?.invalidatePrivateRecipesOnDrift !== true ||
    policy?.revokeAffectedSkillsOnCriticalOrHigh !== true ||
    Object.values(policy?.currentRuntime ?? {}).some((value) => value !== false) ||
    typeof policy?.externalBoundary !== "string"
  ) {
    issues.push("source/runtime boundary or false-success protections are dishonest");
  }
  return { ok: issues.length === 0, issues };
}

export function evaluateApplicationDrift(policy, baseline, observation, options = {}) {
  if (options.signal?.aborted) {
    const error = new Error("Application-drift evaluation cancelled.");
    error.name = "AbortError";
    throw error;
  }
  const validation = validateLifecyclePolicy(policy);
  if (!validation.ok) {
    return { valid: false, executionAllowed: false, invalidated: true, reasons: validation.issues };
  }
  const now = options.now ?? new Date();
  const reasons = [];
  if (!baseline || !observation || baseline.appId !== observation.appId) {
    reasons.push("application identity changed");
  } else {
    if (!versionsCompatible(baseline.version, observation.version)) reasons.push("version");
    if (baseline.fingerprint !== observation.fingerprint) reasons.push("fingerprint");
    if (baseline.capabilityDigest !== observation.capabilityDigest) {
      reasons.push("capabilityDigest");
    }
    if (baseline.layoutRevision !== observation.layoutRevision) reasons.push("layoutRevision");
    if (!sameArray(baseline.plugins, observation.plugins)) reasons.push("plugins");
  }
  if (!fresh(observation?.observedAt, now, policy.maximumObservationAgeMs)) {
    reasons.push("staleObservation");
  }
  const invalidated = reasons.length > 0;
  return {
    valid: true,
    executionAllowed: !invalidated,
    invalidated,
    reasons,
    action: invalidated ? "invalidate_rehearse_relearn" : "retain_version_bound_adapter",
    recovery: invalidated
      ? "Disable the adapter and its private recipes; route to an approved fallback until re-probed, rehearsed and independently verified."
      : "No recovery required.",
  };
}

export function evaluateSecurityPatch(
  policy,
  advisory,
  installedVersion,
  evidence = {},
  options = {},
) {
  if (options.signal?.aborted) {
    const error = new Error("Security-patch evaluation cancelled.");
    error.name = "AbortError";
    throw error;
  }
  const validation = validateLifecyclePolicy(policy);
  if (!validation.ok) {
    return {
      valid: false,
      affected: true,
      executionBlocked: true,
      stagingReady: false,
      applied: false,
      reasons: validation.issues,
    };
  }
  const now = options.now ?? new Date();
  const reasons = [];
  if (
    !advisory ||
    !SAFE_ID.test(advisory.id ?? "") ||
    !SAFE_ID.test(advisory.appId ?? "") ||
    !SEVERITIES.includes(advisory.severity)
  ) {
    reasons.push("advisory identity or severity is invalid");
  }
  if (!trustedUrl(advisory?.sourceUrl, policy.trustedAdvisoryHosts)) {
    reasons.push("advisory source is not an approved HTTPS origin");
  }
  if (!SHA256.test(advisory?.advisorySha256 ?? "") || advisory?.signatureVerified !== true) {
    reasons.push("advisory authenticity is unverified");
  }
  if (!fresh(advisory?.observedAt, now, policy.maximumObservationAgeMs)) {
    reasons.push("advisory observation is stale");
  }
  const fixedComparison = compareVersions(advisory?.fixedVersion, installedVersion);
  if (fixedComparison !== 1) reasons.push("fixed version is absent, invalid or not newer");

  const affected =
    Array.isArray(advisory?.affectedVersions) &&
    advisory.affectedVersions.includes(installedVersion);
  const executionBlocked =
    affected && (advisory?.severity === "critical" || advisory?.severity === "high");
  const stagingReady =
    affected &&
    reasons.length === 0 &&
    evidence.ownerApproved === true &&
    evidence.safeRehearsalPassed === true &&
    compareVersions(evidence.knownGoodRollbackVersion, advisory.fixedVersion) === -1 &&
    SHA256.test(evidence.observedArtifactSha256 ?? "") &&
    evidence.independentPostInstallVerification === true;

  return {
    valid: reasons.length === 0,
    affected,
    executionBlocked,
    stagingReady,
    applied: false,
    action: !affected
      ? "no_patch_required"
      : executionBlocked
        ? "block_and_stage_patch"
        : policy.severityActions[advisory.severity],
    reasons,
    externalAction: affected
      ? "An approved host must acquire and hash real bytes, rehearse, install, verify the target application, and preserve rollback."
      : null,
  };
}

export class MemoryLifecycleEvidenceStore {
  #receipts = [];

  save(receipt) {
    this.#receipts.push(clone(receipt));
  }

  all() {
    return clone(this.#receipts);
  }
}

export async function coordinateLifecycleReview(input) {
  if (input.signal?.aborted) {
    const error = new Error("Application lifecycle review cancelled.");
    error.name = "AbortError";
    throw error;
  }
  if (!SAFE_ID.test(input.receiptId ?? "") || !REVISION.test(input.sourceRevision ?? "")) {
    throw new Error("Lifecycle receipts require a bounded ID and source revision.");
  }
  const drift = evaluateApplicationDrift(input.policy, input.baseline, input.observation, {
    now: input.now,
    signal: input.signal,
  });
  const patch = evaluateSecurityPatch(
    input.policy,
    input.advisory,
    input.observation.version,
    input.patchEvidence,
    { now: input.now, signal: input.signal },
  );
  const revokedSkillIds = drift.invalidated || patch.executionBlocked ? [...input.skillIds] : [];
  for (const skillId of revokedSkillIds) {
    input.revocations.revokeAllVersions(
      skillId,
      patch.executionBlocked ? `Security advisory ${input.advisory.id}` : "Application drift",
      input.now.toISOString(),
    );
  }
  const receipt = {
    schemaVersion: 1,
    receiptId: input.receiptId,
    appId: input.observation.appId,
    sourceRevision: input.sourceRevision,
    observedAt: input.now.toISOString(),
    drift: { invalidated: drift.invalidated, reasons: drift.reasons },
    patch: {
      advisoryId: input.advisory.id,
      affected: patch.affected,
      executionBlocked: patch.executionBlocked,
      stagingReady: patch.stagingReady,
      applied: false,
    },
    revokedSkillIds,
    recoveryRequired: drift.invalidated || patch.executionBlocked,
  };
  input.store.save(receipt);
  return { drift, patch, receipt: clone(receipt) };
}

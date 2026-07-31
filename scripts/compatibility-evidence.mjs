import { createHash, sign as signBytes, verify as verifyBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SHA256 = /^[a-f0-9]{64}$/;
const PROTECTED_PATTERNS = [
  /\b(?:\d[ -]*?){13,19}\b/g,
  /\b\d{6}\b/g,
  /\b(?:password|passcode|otp|token|secret|api[-_ ]?key)\b\s*[:=]?\s*\S+/gi,
  /(?:[a-z]:\\|\/(?:users|home)\/)[^\s]+/gi,
];

export class CompatibilityEvidenceCancelledError extends Error {
  constructor() {
    super("Compatibility evidence operation cancelled.");
    this.name = "CompatibilityEvidenceCancelledError";
  }
}

const stopIfCancelled = (signal) => {
  if (signal?.aborted) throw new CompatibilityEvidenceCancelledError();
};
const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : Buffer.from(value))
    .digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
};
const canonicalBytes = (payload) => Buffer.from(JSON.stringify(canonical(payload)));

export function signEvidencePayload(payload, privateKey) {
  return {
    payload,
    signature: signBytes(null, canonicalBytes(payload), privateKey).toString("base64"),
  };
}

export function verifyEvidenceEnvelope(envelope, publicKey) {
  if (!envelope?.payload || typeof envelope?.signature !== "string") return false;
  try {
    return verifyBytes(
      null,
      canonicalBytes(envelope.payload),
      publicKey,
      Buffer.from(envelope.signature, "base64"),
    );
  } catch {
    return false;
  }
}

export function validateCompatibilityPolicy(policy) {
  const issues = [];
  const add = (code, message) => issues.push({ code, message });
  if (policy?.schemaVersion !== 1) add("schema", "schemaVersion must be 1.");
  if (typeof policy?.owner !== "string" || policy.owner.length < 3) {
    add("owner", "A compatibility evidence owner is required.");
  }
  if (!Array.isArray(policy?.allowedProbeIds) || policy.allowedProbeIds.length === 0) {
    add("probes", "At least one bounded probe is required.");
  }
  if (!Array.isArray(policy?.allowedFaults) || policy.allowedFaults.length !== 9) {
    add("faults", "Every declared hardware fault class must be explicit.");
  }
  if (
    policy?.lab?.lowRiskOnly !== true ||
    policy?.lab?.rehearsalRequired !== true ||
    policy?.lab?.publicationConsentDefault !== false ||
    policy?.lab?.localOnlyDefault !== true ||
    !Number.isInteger(policy?.lab?.maxActions) ||
    policy.lab.maxActions < 1 ||
    policy.lab.maxActions > 20
  ) {
    add("lab_scope", "Lab mode must be low-risk, rehearsed, local-first and tightly budgeted.");
  }
  if (
    policy?.support?.directControl !== false ||
    policy?.support?.localApprovalRequiredForMutation !== true ||
    policy?.support?.protectedContentVisibleByDefault !== false ||
    policy?.support?.maximumSessionMinutes > 60
  ) {
    add("support_scope", "Support must not grant direct, protected or unbounded control.");
  }
  if (
    policy?.offlinePack?.signatureRequired !== true ||
    policy?.offlinePack?.licenceNoticeRequired !== true ||
    policy?.offlinePack?.rollbackRequired !== true ||
    policy?.offlinePack?.replayProtection !== true ||
    policy?.offlinePack?.tenantBindingRequired !== true
  ) {
    add(
      "offline_trust",
      "Offline packs require signature, licences, rollback, replay and tenant binding.",
    );
  }
  return { ok: issues.length === 0, issues };
}

export function verifyHardwareAttestation(input) {
  stopIfCancelled(input.signal);
  const { policy, signedPlan, signedAttestation, planPublicKey, testerPublicKey, seenReceiptIds } =
    input;
  const issues = [];
  const add = (code, message) => issues.push({ code, message });
  if (!verifyEvidenceEnvelope(signedPlan, planPublicKey))
    add("plan_signature", "Test plan signature is invalid.");
  if (!verifyEvidenceEnvelope(signedAttestation, testerPublicKey)) {
    add("attestation_signature", "Tester attestation signature is invalid.");
  }
  const plan = signedPlan?.payload ?? {};
  const attestation = signedAttestation?.payload ?? {};
  const now = (input.now ?? new Date()).getTime();
  const expires = Date.parse(String(plan.expiresAt ?? ""));
  if (!Number.isFinite(expires) || expires < now) add("plan_expired", "Test plan is expired.");
  if (plan.consentRequired !== true || attestation.consentGranted !== true) {
    add("consent", "Explicit compatibility-test consent is required.");
  }
  for (const field of ["planId", "buildDigest", "applicationVersion", "deviceClass"]) {
    if (attestation[field] !== plan[field])
      add(`${field}_mismatch`, `${field} differs from the plan.`);
  }
  if (attestation.benchmarkDigest !== plan.benchmarkDigest) {
    add("benchmark_mismatch", "Benchmark binary differs from the signed plan.");
  }
  if (seenReceiptIds?.has(attestation.receiptId)) add("duplicate", "Receipt was already accepted.");
  const plannedProbes = new Set(plan.probes ?? []);
  const allowedProbes = new Set(policy?.allowedProbeIds ?? []);
  for (const result of attestation.results ?? []) {
    if (!plannedProbes.has(result.probeId) || !allowedProbes.has(result.probeId)) {
      add("probe_scope", `Probe ${result.probeId ?? "unknown"} was not authorized.`);
    }
    if (
      result.probeId === "cpu.logical-cores" &&
      (!Number.isInteger(result.value) || result.value < 1 || result.value > 1024)
    ) {
      add("impossible_claim", "Logical core count is outside the accepted range.");
    }
    if (
      result.probeId === "memory.total-mib" &&
      (!Number.isFinite(result.value) || result.value < 128 || result.value > 16_777_216)
    ) {
      add("impossible_claim", "Memory claim is outside the accepted range.");
    }
  }
  const keys = JSON.stringify(attestation);
  for (const field of policy?.forbiddenEvidenceFields ?? []) {
    if (keys.includes(`"${field}"`)) add("privacy_field", `Forbidden field ${field} is present.`);
  }
  if (!SHA256.test(String(attestation.environmentFingerprint ?? ""))) {
    add("fingerprint", "Environment fingerprint must be a privacy-preserving SHA-256 digest.");
  }
  return {
    ok: issues.length === 0,
    issues,
    receipt:
      issues.length === 0
        ? {
            receiptId: attestation.receiptId,
            planId: plan.planId,
            buildDigest: plan.buildDigest,
            applicationVersion: plan.applicationVersion,
            deviceClass: plan.deviceClass,
            environmentFingerprint: attestation.environmentFingerprint,
            capabilityDigest: digest(JSON.stringify(attestation.results ?? [])),
            evidenceClass: "REAL TARGET CANDIDATE - INDEPENDENT REVIEW REQUIRED",
          }
        : null,
  };
}

export function redactCompatibilityEvidence(input) {
  stopIfCancelled(input.signal);
  const originalDigest = digest(input.originalBytes);
  if (input.containsScreenshot && input.maskAppliedBeforeCapture !== true) {
    return {
      ok: false,
      code: "masking_unverified",
      message: "Screenshot evidence was refused because local pre-capture masking is unverified.",
      originalDigest,
    };
  }
  const protectedValues = (input.protectedValues ?? []).filter(Boolean);
  const safeFields = {};
  let redactions = 0;
  for (const [key, raw] of Object.entries(input.structuredFields ?? {})) {
    let value = String(raw);
    for (const protectedValue of protectedValues) {
      if (value.includes(protectedValue)) {
        value = value.split(protectedValue).join("[redacted]");
        redactions += 1;
      }
    }
    for (const pattern of PROTECTED_PATTERNS) {
      value = value.replace(pattern, () => {
        redactions += 1;
        return "[redacted]";
      });
    }
    safeFields[key] = value;
  }
  const serialized = JSON.stringify(safeFields);
  if (protectedValues.some((value) => serialized.includes(value))) {
    return {
      ok: false,
      code: "redaction_failed",
      message: "Protected content remains.",
      originalDigest,
    };
  }
  const localOnly = Number(input.redactionCoverage ?? 0) > 0.75;
  return {
    ok: true,
    originalDigest,
    safeFields,
    redactions,
    policyVersion: input.policyVersion,
    publishable: !localOnly,
    classification: localOnly ? "LOCALLY VERIFIED ONLY" : "REDACTED EVIDENCE",
  };
}

export function authorizeCompatibilityLab(policy, request, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  if (request?.lowRisk !== true)
    issues.push({ code: "risk", message: "Only low-risk tasks are allowed." });
  if (request?.rehearsalPassed !== true)
    issues.push({ code: "rehearsal", message: "Rehearsal is required." });
  if (request?.permissionGranted !== true)
    issues.push({ code: "permission", message: "Scoped permission is required." });
  if (
    !Number.isInteger(request?.actionBudget) ||
    request.actionBudget < 1 ||
    request.actionBudget > policy.lab.maxActions
  ) {
    issues.push({ code: "budget", message: "Action budget is outside the lab limit." });
  }
  if (request?.publish === true && request?.publicationConsent !== true) {
    issues.push({ code: "publication", message: "Publication needs separate explicit consent." });
  }
  return {
    ok: issues.length === 0,
    issues,
    mode: request?.publish === true ? "publish-after-independent-review" : "local-only",
  };
}

export function authorizeSupportOperation(policy, request, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  const now = (options.now ?? new Date()).getTime();
  if (!request?.supporterId || !request?.sessionId)
    issues.push({ code: "identity", message: "Support identity is required." });
  if (Date.parse(String(request?.expiresAt ?? "")) < now)
    issues.push({ code: "expired", message: "Support scope expired." });
  if (request?.emergencyStop === true || request?.revoked === true)
    issues.push({ code: "revoked", message: "Support scope is revoked." });
  if (request?.protectedContentRequested === true)
    issues.push({ code: "protected", message: "Protected content cannot be exposed." });
  const unapproved = policy.support.allowedUnapprovedOperations.includes(request?.operation);
  if (!unapproved && request?.localApproval !== true) {
    issues.push({ code: "approval", message: "A consequential operation needs local approval." });
  }
  if (request?.directControl === true)
    issues.push({ code: "direct_control", message: "Direct remote control is prohibited." });
  return { ok: issues.length === 0, issues };
}

export function verifyFaultRecovery(policy, trace, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  if (!policy.allowedFaults.includes(trace?.fault))
    issues.push({ code: "fault_scope", message: "Fault is undeclared." });
  if (trace?.testShim !== true)
    issues.push({
      code: "production_injection",
      message: "Faults may run only through test shims.",
    });
  if (!trace?.checkpointPreserved)
    issues.push({ code: "checkpoint", message: "Checkpoint was not preserved." });
  if ((trace?.retryCount ?? 0) > 1)
    issues.push({ code: "retry", message: "Retry bound exceeded." });
  if (!trace?.userVisibleReason)
    issues.push({ code: "reason", message: "User-visible refusal reason is missing." });
  if (!trace?.rollbackVerified)
    issues.push({ code: "rollback", message: "Rollback was not independently verified." });
  if (new Set(trace?.mutationIds ?? []).size !== (trace?.mutationIds ?? []).length) {
    issues.push({ code: "duplicate_mutation", message: "Fault recovery duplicated a mutation." });
  }
  return { ok: issues.length === 0, issues, evidenceClass: "SIMULATED FAULT ONLY" };
}

export function createCompatibilityPack(payload, privateKey) {
  const components = (payload.components ?? []).map((component) => ({
    id: component.id,
    version: component.version,
    sha256: digest(component.bytes),
    licenceNotice: component.licenceNotice,
  }));
  return signEvidencePayload(
    {
      schemaVersion: 1,
      packId: payload.packId,
      tenantId: payload.tenantId,
      targetPlatform: payload.targetPlatform,
      version: payload.version,
      rollbackVersion: payload.rollbackVersion,
      expiresAt: payload.expiresAt,
      components,
    },
    privateKey,
  );
}

export function verifyCompatibilityPack(input) {
  stopIfCancelled(input.signal);
  const issues = [];
  const payload = input.envelope?.payload ?? {};
  if (!verifyEvidenceEnvelope(input.envelope, input.publicKey)) {
    issues.push({ code: "signature", message: "Offline pack signature is invalid." });
  }
  if (payload.targetPlatform !== input.targetPlatform)
    issues.push({ code: "platform", message: "Pack targets another platform." });
  if (payload.tenantId !== input.tenantId)
    issues.push({ code: "tenant", message: "Pack belongs to another tenant." });
  if (Date.parse(String(payload.expiresAt ?? "")) < (input.now ?? new Date()).getTime()) {
    issues.push({ code: "expired", message: "Pack expired." });
  }
  if (input.seenPackIds?.has(payload.packId))
    issues.push({ code: "replay", message: "Pack was already imported." });
  if (
    String(payload.version).localeCompare(String(input.installedVersion), undefined, {
      numeric: true,
    }) < 0
  ) {
    issues.push({ code: "downgrade", message: "Unapproved downgrade refused." });
  }
  const supplied = new Map((input.components ?? []).map((entry) => [entry.id, entry]));
  for (const component of payload.components ?? []) {
    const bytes = supplied.get(component.id)?.bytes;
    if (!bytes || digest(bytes) !== component.sha256)
      issues.push({ code: "component", message: `${component.id} is missing or modified.` });
    if (!component.licenceNotice)
      issues.push({ code: "licence", message: `${component.id} has no licence notice.` });
  }
  if (!payload.rollbackVersion)
    issues.push({ code: "rollback", message: "Pack has no rollback version." });
  return { ok: issues.length === 0, issues };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const policy = JSON.parse(readFileSync("release/OCADE_COMPATIBILITY_LAB_POLICY.json", "utf8"));
  const result = validateCompatibilityPolicy(policy);
  if (!result.ok) {
    console.error(`Compatibility evidence gate failed (${result.issues.length}):`);
    for (const entry of result.issues) console.error(`- ${entry.code}: ${entry.message}`);
    process.exit(1);
  }
  console.log(
    `Compatibility evidence gate: ${policy.allowedProbeIds.length} probes, ${policy.allowedFaults.length} faults, action budget ${policy.lab.maxActions}.`,
  );
  console.log("Direct support control: REFUSED; publication consent default: OFF.");
}

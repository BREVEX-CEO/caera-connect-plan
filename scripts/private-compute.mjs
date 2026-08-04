import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { pathToFileURL } from "node:url";

import { verifyEvidenceEnvelope } from "./compatibility-evidence.mjs";

const SHA256 = /^[a-f0-9]{64}$/;
const digest = (value) => createHash("sha256").update(value).digest("hex");
const issue = (code, message) => ({ code, message });
const stopIfCancelled = (signal) => {
  if (signal?.aborted) {
    const error = new Error("Private-compute operation cancelled.");
    error.name = "PrivateComputeCancelledError";
    throw error;
  }
};
const isExpired = (value, now) =>
  !Number.isFinite(Date.parse(String(value))) || Date.parse(String(value)) < now;

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168)
    );
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }
  return false;
}

export function validatePrivateComputePolicy(policy) {
  const issues = [];
  if (policy?.schemaVersion !== 1) issues.push(issue("schema", "schemaVersion must be 1."));
  if (typeof policy?.owner !== "string" || policy.owner.length < 3) {
    issues.push(issue("owner", "A production owner is required."));
  }
  if (
    policy?.burst?.protectedDataAllowed !== false ||
    policy?.burst?.explicitConsentRequired !== true ||
    policy?.burst?.minimumPayloadRequired !== true ||
    policy?.burst?.encryptionRequired !== true ||
    policy?.burst?.retentionDisclosureRequired !== true ||
    policy?.burst?.maximumRetries !== 1 ||
    policy?.burst?.localFallbackRequired !== true
  ) {
    issues.push(
      issue(
        "burst",
        "Burst consent, minimisation, encryption, retention and recovery are incomplete.",
      ),
    );
  }
  if (
    policy?.mesh?.signedJobsRequired !== true ||
    policy?.mesh?.measuredCapabilitiesRequired !== true ||
    policy?.mesh?.tenantAndUserBindingRequired !== true ||
    policy?.mesh?.maximumRetries !== 1 ||
    policy?.mesh?.duplicateProtectionRequired !== true ||
    policy?.mesh?.instantRevocationRequired !== true
  ) {
    issues.push(
      issue(
        "mesh",
        "Mesh identity, capability, retry, duplicate and revocation controls are incomplete.",
      ),
    );
  }
  if (
    policy?.lanOnly?.externalDnsAllowed !== false ||
    policy?.lanOnly?.publicAddressAllowed !== false ||
    policy?.lanOnly?.relayAllowed !== false ||
    policy?.lanOnly?.mutualAuthenticationRequired !== true ||
    policy?.lanOnly?.localCertificateRequired !== true ||
    policy?.lanOnly?.certificateRotationRequired !== true ||
    policy?.lanOnly?.networkScopeIndicatorRequired !== true ||
    policy?.lanOnly?.emergencyStopRequired !== true
  ) {
    issues.push(
      issue(
        "lan",
        "LAN-only authentication, address, rotation, indicator and stop controls are incomplete.",
      ),
    );
  }
  return { ok: issues.length === 0, issues };
}

export function authorizeBurstCompute(policy, request, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  const now = (options.now ?? new Date()).getTime();
  if (!request?.tenantId || !request?.userId || !request?.jobId) {
    issues.push(issue("identity", "Tenant, user and job identity are required."));
  }
  if (!policy.burst.approvedProviders.includes(request?.providerId)) {
    issues.push(issue("provider", "Burst provider is not approved."));
  }
  if (request?.dataClass === "protected" || request?.containsProtectedData === true) {
    issues.push(issue("protected", "Protected data cannot leave the device."));
  }
  if (request?.consentGranted !== true || isExpired(request?.consentExpiresAt, now)) {
    issues.push(issue("consent", "Fresh explicit burst-compute consent is required."));
  }
  if (request?.payloadMinimized !== true || request?.transformedWorkload !== true) {
    issues.push(
      issue("minimisation", "Only the minimum transformed workload may leave the device."),
    );
  }
  if (!request?.retentionDisclosure || !request?.pricingDisclosure) {
    issues.push(issue("disclosure", "Provider retention and pricing disclosures are required."));
  }
  if (
    !Number.isInteger(request?.timeoutMilliseconds) ||
    request.timeoutMilliseconds < 1 ||
    request.timeoutMilliseconds > policy.burst.maximumJobMilliseconds ||
    (request?.retryCount ?? 0) > policy.burst.maximumRetries
  ) {
    issues.push(issue("limits", "Burst timeout or retry limit exceeds policy."));
  }
  if (request?.emergencyStop === true || request?.revoked === true) {
    issues.push(issue("revoked", "Burst job was stopped or revoked."));
  }
  return {
    ok: issues.length === 0,
    issues,
    plan:
      issues.length === 0
        ? {
            tenantId: request.tenantId,
            userId: request.userId,
            jobId: request.jobId,
            providerId: request.providerId,
            inputDigest: request.inputDigest,
            outputContractDigest: request.outputContractDigest,
            localFallbackId: request.localFallbackId,
            evidenceClass: policy.evidenceClasses.burst,
          }
        : {
            localFallbackId: request?.localFallbackId,
            outcome: "REFUSED_USE_LOCAL_FALLBACK",
          },
  };
}

export function sealBurstPayload(plan, payload, key, options = {}) {
  stopIfCancelled(options.signal);
  if (!plan?.jobId || !Buffer.isBuffer(payload) || !Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error("Burst encryption needs a valid plan, byte payload and 256-bit session key.");
  }
  if (digest(payload) !== plan.inputDigest)
    throw new Error("Burst payload differs from the authorised input digest.");
  const nonce = options.nonce ?? randomBytes(12);
  const aad = Buffer.from(`${plan.tenantId}:${plan.jobId}:${plan.providerId}`);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  return {
    algorithm: "AES-256-GCM",
    nonce: nonce.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    aadDigest: digest(aad),
    plaintextDigest: plan.inputDigest,
  };
}

export function openBurstPayload(plan, envelope, key) {
  const nonce = Buffer.from(envelope.nonce, "base64");
  const aad = Buffer.from(`${plan.tenantId}:${plan.jobId}:${plan.providerId}`);
  if (digest(aad) !== envelope.aadDigest) throw new Error("Burst associated-data binding differs.");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(aad);
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  if (digest(plaintext) !== envelope.plaintextDigest)
    throw new Error("Burst plaintext digest differs.");
  return plaintext;
}

export function verifyBurstResult(policy, plan, signedResult, providerPublicKey, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  const result = signedResult?.payload ?? {};
  if (!verifyEvidenceEnvelope(signedResult, providerPublicKey)) {
    issues.push(issue("signature", "Burst result signature is invalid."));
  }
  for (const field of ["tenantId", "jobId", "providerId", "inputDigest", "outputContractDigest"]) {
    if (result[field] !== plan?.[field])
      issues.push(issue(`${field}_mismatch`, `${field} differs from the plan.`));
  }
  if (
    result.status !== "complete" ||
    result.partial === true ||
    !SHA256.test(String(result.outputDigest ?? ""))
  ) {
    issues.push(
      issue("incomplete", "Burst result is partial, unavailable or lacks a valid output digest."),
    );
  }
  if (result.retentionApplied !== "as-disclosed") {
    issues.push(issue("retention", "Provider retention does not match the disclosed policy."));
  }
  return {
    ok: issues.length === 0,
    issues,
    receipt:
      issues.length === 0
        ? {
            jobId: plan.jobId,
            providerId: plan.providerId,
            inputDigest: result.inputDigest,
            outputDigest: result.outputDigest,
            evidenceClass: policy.evidenceClasses.burst,
          }
        : {
            outcome: "PROVIDER_RESULT_REFUSED_USE_LOCAL_FALLBACK",
            localFallbackId: plan?.localFallbackId,
          },
  };
}

export function verifyMeshNode(policy, signedNode, publicKey, input = {}) {
  stopIfCancelled(input.signal);
  const issues = [];
  const node = signedNode?.payload ?? {};
  if (!verifyEvidenceEnvelope(signedNode, publicKey))
    issues.push(issue("signature", "Node attestation signature is invalid."));
  if (!node.nodeId || !node.tenantId || !node.userId)
    issues.push(issue("identity", "Node identity is incomplete."));
  if (node.revoked || node.online !== true || input.emergencyStop === true) {
    issues.push(issue("unavailable", "Node is offline, revoked or stopped."));
  }
  if (isExpired(node.expiresAt, (input.now ?? new Date()).getTime()))
    issues.push(issue("expired", "Node attestation expired."));
  if (
    !Number.isInteger(node.logicalCores) ||
    node.logicalCores < 1 ||
    node.logicalCores > policy.mesh.maximumLogicalCores ||
    !Number.isFinite(node.memoryMiB) ||
    node.memoryMiB < 128 ||
    node.memoryMiB > policy.mesh.maximumMemoryMiB
  ) {
    issues.push(issue("malicious_claim", "Node hardware claim is impossible or unmeasured."));
  }
  if (!policy.mesh.allowedTransports.includes(node.transport))
    issues.push(issue("transport", "Node transport is not allowed."));
  if (node.transport === "lan-mutual-tls" && !isPrivateAddress(node.address)) {
    issues.push(issue("network_isolation", "LAN node address is not private."));
  }
  return {
    ok: issues.length === 0,
    issues,
    node:
      issues.length === 0
        ? {
            ...node,
            identityBinding: digest(`${node.nodeId}:${node.certificateFingerprint}`),
            addressMutable: true,
            evidenceClass: policy.evidenceClasses.mesh,
          }
        : null,
  };
}

export function authorizeMeshJob(policy, node, signedJob, requesterPublicKey, input = {}) {
  stopIfCancelled(input.signal);
  const issues = [];
  const job = signedJob?.payload ?? {};
  if (!verifyEvidenceEnvelope(signedJob, requesterPublicKey))
    issues.push(issue("signature", "Mesh job signature is invalid."));
  if (!node || node.revoked || node.online !== true || input.emergencyStop === true) {
    issues.push(issue("node", "Mesh node is unavailable."));
  }
  for (const field of ["tenantId", "userId"]) {
    if (job[field] !== node?.[field]) issues.push(issue(field, `Mesh ${field} binding differs.`));
  }
  if (!node?.capabilities?.includes(job.capability))
    issues.push(issue("capability", "Node capability drifted."));
  if (input.seenJobIds?.has(job.jobId))
    issues.push(issue("duplicate", "Mesh job was already accepted."));
  if ((job.retryCount ?? 0) > policy.mesh.maximumRetries)
    issues.push(issue("retry", "Mesh retry limit exceeded."));
  if (job.protectedData === true)
    issues.push(issue("protected", "Protected data cannot enter the mesh."));
  if (job.cancelled === true || job.revoked === true)
    issues.push(issue("cancelled", "Mesh job is cancelled or revoked."));
  return {
    ok: issues.length === 0,
    issues,
    receipt:
      issues.length === 0
        ? {
            nodeId: node.nodeId,
            jobId: job.jobId,
            capability: job.capability,
            inputDigest: job.inputDigest,
            identityBinding: node.identityBinding,
            transport: node.transport,
            evidenceClass: policy.evidenceClasses.mesh,
          }
        : null,
  };
}

export function authorizeLanOnlyConnection(policy, request, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  if (!request?.tenantId || !request?.userId || !request?.nodeId) {
    issues.push(issue("identity", "LAN tenant, user and node are required."));
  }
  if (
    !policy.lanOnly.pairingMethods.includes(request?.pairingMethod) ||
    request?.pairingProofValid !== true
  ) {
    issues.push(issue("pairing", "QR or short-code pairing proof is invalid."));
  }
  if (
    request?.mutualAuthentication !== true ||
    !SHA256.test(String(request?.localCertificateFingerprint ?? "")) ||
    request?.localCertificateFingerprint !== request?.expectedCertificateFingerprint
  ) {
    issues.push(issue("certificate", "Mutual local certificate authentication failed."));
  }
  if (request?.certificateExpired === true || request?.certificateRevoked === true) {
    issues.push(issue("certificate_state", "Local certificate expired or was revoked."));
  }
  if (request?.networkScopeIndicator !== "LAN ONLY")
    issues.push(issue("indicator", "LAN-only scope indicator is missing."));
  if (request?.emergencyStop === true || request?.revoked === true)
    issues.push(issue("revoked", "LAN session was stopped or revoked."));
  if (request?.subnetChanged === true && request?.reauthenticatedAfterSubnetChange !== true) {
    issues.push(issue("subnet", "Subnet change requires fresh mutual authentication."));
  }
  if (request?.trace?.dnsQueries?.length > 0)
    issues.push(issue("dns", "LAN-only mode emitted a DNS query."));
  if (request?.trace?.relayUsed === true)
    issues.push(issue("relay", "LAN-only mode used a relay."));
  for (const destination of request?.trace?.destinations ?? []) {
    if (!isPrivateAddress(destination))
      issues.push(issue("public_network", `Destination ${destination} is not LAN-only.`));
  }
  return {
    ok: issues.length === 0,
    issues,
    receipt:
      issues.length === 0
        ? {
            nodeId: request.nodeId,
            certificateFingerprint: request.localCertificateFingerprint,
            destinations: request.trace.destinations,
            dnsQueries: 0,
            relayUsed: false,
            scope: "LAN ONLY",
            evidenceClass: policy.evidenceClasses.lan,
          }
        : null,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const policy = JSON.parse(readFileSync("release/OCADE_PRIVATE_COMPUTE_POLICY.json", "utf8"));
  const result = validatePrivateComputePolicy(policy);
  if (!result.ok) {
    console.error(`Private-compute gate failed (${result.issues.length}):`);
    for (const entry of result.issues) console.error(`- ${entry.code}: ${entry.message}`);
    process.exit(1);
  }
  console.log(
    "Private-compute gate: encrypted burst, signed home-node mesh and LAN-only controls are bounded.",
  );
  console.log("No remote provider, spare device or live LAN packet capture has been claimed.");
}

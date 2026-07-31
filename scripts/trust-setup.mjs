import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const SHA256 = /^[a-f0-9]{64}$/;
const issue = (code, message) => ({ code, message });
const stopIfCancelled = (signal) => {
  if (signal?.aborted) {
    const error = new Error("Trust-setup operation cancelled.");
    error.name = "TrustSetupCancelledError";
    throw error;
  }
};
const forbiddenShape = (value, forbidden) => {
  const keys = [];
  const visit = (entry) => {
    if (!entry || typeof entry !== "object") return;
    for (const [key, child] of Object.entries(entry)) {
      keys.push(key.toLowerCase());
      visit(child);
    }
  };
  visit(value);
  return forbidden.some((field) => keys.some((key) => key === field.toLowerCase()));
};

export function validateTrustSetupPolicy(policy) {
  const issues = [];
  if (policy?.schemaVersion !== 1) issues.push(issue("schema", "schemaVersion must be 1."));
  if (typeof policy?.owner !== "string" || policy.owner.length < 3) {
    issues.push(issue("owner", "A production owner is required."));
  }
  if (
    !["windows-credential-manager", "macos-keychain", "linux-secret-service"].every((backend) =>
      policy?.secureBackends?.includes(backend),
    )
  ) {
    issues.push(issue("backends", "Windows, macOS and Linux secure-store backends are required."));
  }
  const capabilities = new Set();
  for (const credential of policy?.credentials ?? []) {
    if (
      !credential?.capability ||
      capabilities.has(credential.capability) ||
      !credential?.provider ||
      credential?.requiredScopes?.length === 0 ||
      credential?.allowedConsumers?.length === 0 ||
      !String(credential?.setupUrl).startsWith("https://")
    ) {
      issues.push(
        issue("credential", "Credential capabilities must be unique, scoped and documented."),
      );
    }
    capabilities.add(credential?.capability);
  }
  if (
    policy?.selfSignedTrust?.publicTrustAllowed !== false ||
    policy?.selfSignedTrust?.productionIdentityPresent !== false ||
    policy?.selfSignedTrust?.placeholderProductionKeysAllowed !== false
  ) {
    issues.push(issue("trust_lab", "Test trust must never imply production or public trust."));
  }
  if (
    policy?.signingEligibility?.communitySigningRequiresPublicSource !== true ||
    policy?.signingEligibility?.communitySigningRequiresOwnerApproval !== true ||
    policy?.signingEligibility?.communitySigningRequiresReproducibleBuild !== true ||
    policy?.signingEligibility?.communitySigningRequiresDependencyNotices !== true ||
    policy?.signingEligibility?.proprietaryComponentsAllowedCommunitySigning !== false
  ) {
    issues.push(issue("eligibility", "Community signing eligibility controls are incomplete."));
  }
  return { ok: issues.length === 0, issues };
}

function descriptorFor(policy, capability) {
  return policy.credentials.find((entry) => entry.capability === capability);
}

function validateAdapter(policy, adapter, testMode) {
  if (!adapter || typeof adapter.describe !== "function" || typeof adapter.read !== "function") {
    return issue("adapter", "An operating-system secure-store adapter is required.");
  }
  const allowed =
    policy.secureBackends.includes(adapter.backend) ||
    (testMode === true && policy.testBackends.includes(adapter.backend));
  return allowed ? null : issue("backend", "Credential backend is not an approved secure store.");
}

export async function inspectCredentialPresence(policy, request, adapter, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  const definition = descriptorFor(policy, request?.capability);
  if (!definition) issues.push(issue("capability", "Credential capability is unknown."));
  if (!request?.tenantId || !request?.userId)
    issues.push(issue("identity", "Tenant and user are required."));
  const adapterIssue = validateAdapter(policy, adapter, options.testMode);
  if (adapterIssue) issues.push(adapterIssue);
  if (issues.length > 0) return { ok: false, issues, status: null };
  const metadata = await adapter.describe(request.tenantId, request.capability);
  if (!metadata) {
    return {
      ok: true,
      issues: [],
      status: {
        present: false,
        capability: request.capability,
        provider: definition.provider,
        setupUrl: definition.setupUrl,
      },
    };
  }
  if (forbiddenShape(metadata, policy.forbiddenAuditFields)) {
    return {
      ok: false,
      issues: [issue("metadata_leak", "Secure-store metadata contains secret material.")],
      status: null,
    };
  }
  const now = (options.now ?? new Date()).getTime();
  const status = {
    present: true,
    capability: request.capability,
    provider: definition.provider,
    credentialId: metadata.credentialId,
    keyVersion: metadata.keyVersion,
    projectId: metadata.projectId,
    scopes: metadata.scopes,
    revoked: metadata.revoked === true,
    expired: Date.parse(String(metadata.expiresAt ?? "")) < now,
    setupUrl: definition.setupUrl,
  };
  return { ok: true, issues: [], status };
}

export async function withScopedCredential(policy, request, adapter, consumer, options = {}) {
  stopIfCancelled(options.signal);
  const presence = await inspectCredentialPresence(policy, request, adapter, options);
  if (!presence.ok || !presence.status?.present) {
    return {
      ok: false,
      issues: presence.issues.length
        ? presence.issues
        : [issue("missing", "Credential is not present in secure storage.")],
      receipt: null,
    };
  }
  const definition = descriptorFor(policy, request.capability);
  const issues = [];
  if (!definition.allowedConsumers.includes(request?.consumer)) {
    issues.push(issue("consumer", "Consumer is not authorised for this credential capability."));
  }
  if (request?.expectedProjectId && presence.status.projectId !== request.expectedProjectId) {
    issues.push(issue("wrong_project", "Credential belongs to another project."));
  }
  if (presence.status.revoked || presence.status.expired) {
    issues.push(issue("revoked", "Credential is revoked or expired."));
  }
  for (const scope of definition.requiredScopes) {
    if (!presence.status.scopes?.includes(scope))
      issues.push(issue("scope", `Credential lacks ${scope}.`));
  }
  if (request?.emergencyStop === true || request?.revoked === true) {
    issues.push(issue("stopped", "Credential lease was stopped or revoked."));
  }
  if (issues.length > 0) return { ok: false, issues, receipt: null };
  stopIfCancelled(options.signal);
  const secret = await adapter.read(request.tenantId, request.capability);
  if (typeof secret !== "string" || secret.length < 1) {
    return {
      ok: false,
      issues: [issue("unreadable", "Secure store did not return a credential.")],
      receipt: null,
    };
  }
  const observed = await consumer(secret, { signal: options.signal });
  if (
    !observed ||
    observed.ok !== true ||
    !SHA256.test(String(observed.postconditionDigest ?? "")) ||
    JSON.stringify(observed).includes(secret) ||
    forbiddenShape(observed, policy.forbiddenAuditFields)
  ) {
    return {
      ok: false,
      issues: [
        issue(
          "consumer_evidence",
          "Credential consumer did not return secret-free postcondition evidence.",
        ),
      ],
      receipt: null,
    };
  }
  const receipt = {
    operation: "credential.consume",
    capability: request.capability,
    provider: definition.provider,
    consumer: request.consumer,
    tenantId: request.tenantId,
    credentialId: presence.status.credentialId,
    keyVersion: presence.status.keyVersion,
    outcome: "POSTCONDITION_VERIFIED",
    observedAt: (options.now ?? new Date()).toISOString(),
    postconditionDigest: observed.postconditionDigest,
  };
  options.logger?.(receipt);
  return { ok: true, issues: [], receipt };
}

export async function rotateCredential(policy, request, adapter, options = {}) {
  stopIfCancelled(options.signal);
  const adapterIssue = validateAdapter(policy, adapter, options.testMode);
  if (adapterIssue) return { ok: false, issues: [adapterIssue], receipt: null };
  if (typeof adapter.write !== "function" || typeof adapter.removeVersion !== "function") {
    return {
      ok: false,
      issues: [issue("rotation", "Secure store cannot rotate versions.")],
      receipt: null,
    };
  }
  if (typeof request?.newValue !== "string" || request.newValue.length < 1) {
    return {
      ok: false,
      issues: [issue("new_value", "A new credential value is required.")],
      receipt: null,
    };
  }
  await adapter.write(request.tenantId, request.capability, request.newValue, request.newMetadata);
  const described = await adapter.describe(request.tenantId, request.capability);
  if (
    !described ||
    described.keyVersion !== request.newMetadata?.keyVersion ||
    forbiddenShape(described, policy.forbiddenAuditFields)
  ) {
    return {
      ok: false,
      issues: [issue("rotation_verify", "Rotated credential metadata was not verified.")],
      receipt: null,
    };
  }
  await adapter.removeVersion(request.tenantId, request.capability, request.previousKeyVersion);
  return {
    ok: true,
    issues: [],
    receipt: {
      operation: "credential.rotate",
      capability: request.capability,
      tenantId: request.tenantId,
      keyVersion: described.keyVersion,
      outcome: "ROTATED_AND_PREVIOUS_REMOVED",
    },
  };
}

export async function removeCredential(policy, request, adapter, options = {}) {
  stopIfCancelled(options.signal);
  const adapterIssue = validateAdapter(policy, adapter, options.testMode);
  if (adapterIssue) return { ok: false, issues: [adapterIssue], receipt: null };
  if (typeof adapter.remove !== "function") {
    return {
      ok: false,
      issues: [issue("removal", "Secure store cannot remove credentials.")],
      receipt: null,
    };
  }
  await adapter.remove(request.tenantId, request.capability);
  const remains = await adapter.describe(request.tenantId, request.capability);
  return remains
    ? {
        ok: false,
        issues: [issue("removal_verify", "Credential remains after removal.")],
        receipt: null,
      }
    : {
        ok: true,
        issues: [],
        receipt: {
          operation: "credential.remove",
          capability: request.capability,
          tenantId: request.tenantId,
          outcome: "REMOVAL_VERIFIED",
        },
      };
}

export function evaluateCommunitySigningEligibility(policy, component) {
  const issues = [];
  if (!component)
    return { ok: false, eligible: false, issues: [issue("component", "Component is unknown.")] };
  if (component.classification === "proprietary" || component.proprietaryInputs === true) {
    issues.push(
      issue("proprietary", "Proprietary artifacts cannot use community open-source signing."),
    );
  }
  if (!component.publicSourceUrl || !String(component.publicSourceUrl).startsWith("https://")) {
    issues.push(issue("public_source", "Public source location is absent."));
  }
  if (!policy.signingEligibility.allowedSpdxLicences.includes(component.spdxLicence)) {
    issues.push(issue("licence", "An approved SPDX licence is absent."));
  }
  if (component.ownerApproved !== true)
    issues.push(issue("owner_approval", "Owner has not approved open-source publication."));
  if (
    !Array.isArray(component.reproducibleBuildCommands) ||
    component.reproducibleBuildCommands.length < 2
  ) {
    issues.push(issue("reproducible_build", "Reproducible build instructions are incomplete."));
  }
  if (!component.dependencyNotices)
    issues.push(issue("dependency_notices", "Dependency notices are absent."));
  return { ok: issues.length === 0, eligible: issues.length === 0, issues };
}

export function authorizeSigningPath(policy, request) {
  const component = policy.components.find((entry) => entry.id === request?.componentId);
  if (request?.route === "community-open-source") {
    const eligibility = evaluateCommunitySigningEligibility(policy, component);
    return {
      ...eligibility,
      route: eligibility.eligible ? "COMMUNITY SIGNING APPLICATION CANDIDATE" : "REFUSED",
      signed: false,
    };
  }
  if (request?.route === "self-signed-test") {
    return request?.environment === "test" && request?.keyClass === "ephemeral-test"
      ? {
          ok: true,
          eligible: true,
          issues: [],
          route: policy.selfSignedTrust.evidenceClass,
          signed: false,
          publicTrust: false,
        }
      : {
          ok: false,
          eligible: false,
          issues: [
            issue("test_trust", "Self-signed trust is restricted to ephemeral test identities."),
          ],
          route: "REFUSED",
          signed: false,
        };
  }
  if (request?.route === "production-commercial") {
    return request?.keyClass === "production-trusted" && request?.identityPresent === true
      ? {
          ok: true,
          eligible: true,
          issues: [],
          route: "PRODUCTION SIGNING CANDIDATE",
          signed: false,
        }
      : {
          ok: false,
          eligible: false,
          issues: [
            issue("production_identity", "A trusted production signing identity is absent."),
          ],
          route: "REFUSED",
          signed: false,
        };
  }
  return {
    ok: false,
    eligible: false,
    issues: [issue("route", "Signing route is unsupported.")],
    route: "REFUSED",
    signed: false,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const policy = JSON.parse(readFileSync("release/OCADE_TRUST_SETUP_POLICY.json", "utf8"));
  const result = validateTrustSetupPolicy(policy);
  if (!result.ok) {
    console.error(`Trust-setup gate failed (${result.issues.length}):`);
    for (const entry of result.issues) console.error(`- ${entry.code}: ${entry.message}`);
    process.exit(1);
  }
  const eligible = policy.components.filter(
    (component) => evaluateCommunitySigningEligibility(policy, component).eligible,
  );
  console.log(
    `Trust-setup gate: ${policy.credentials.length} scoped credentials; ${eligible.length} community-signing eligible components.`,
  );
  console.log(
    "Production credentials, public licences and trusted signing identities remain owner-supplied.",
  );
}

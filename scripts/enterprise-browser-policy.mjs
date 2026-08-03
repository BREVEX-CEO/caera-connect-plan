import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { signEvidencePayload, verifyEvidenceEnvelope } from "./compatibility-evidence.mjs";

const EXTENSION_ID = /^[a-p]{32}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const issue = (code, message) => ({ code, message });
const stopIfCancelled = (signal) => {
  if (signal?.aborted) {
    const error = new Error("Enterprise browser-policy operation cancelled.");
    error.name = "EnterpriseBrowserPolicyCancelledError";
    throw error;
  }
};

export function validateEnterpriseBrowserPolicy(policy) {
  const issues = [];
  if (policy?.schemaVersion !== 1) issues.push(issue("schema", "schemaVersion must be 1."));
  if (typeof policy?.owner !== "string" || policy.owner.length < 3) {
    issues.push(issue("owner", "A production owner is required."));
  }
  if (
    !["chrome", "edge"].every((browser) => policy?.supportedBrowsers?.includes(browser)) ||
    !["windows", "macos", "linux"].every((os) => policy?.supportedOperatingSystems?.includes(os))
  ) {
    issues.push(
      issue("matrix", "Chrome/Edge and Windows/macOS/Linux policy targets are required."),
    );
  }
  if (
    policy?.developmentOriginsAllowedInProduction !== false ||
    policy?.incognitoAllowed !== false ||
    policy?.directAdministrativeAuthority !== false ||
    policy?.manualDeviceManagementApplyRequired !== true
  ) {
    issues.push(
      issue(
        "authority",
        "Production policy must exclude dev/incognito scope and require IT application.",
      ),
    );
  }
  if (
    policy?.signatureRequired !== true ||
    policy?.tenantBindingRequired !== true ||
    policy?.rollbackRequired !== true ||
    policy?.revocationRequired !== true
  ) {
    issues.push(
      issue("trust", "Signature, tenant, rollback and revocation controls are required."),
    );
  }
  for (const host of policy?.allowedUpdateHosts ?? []) {
    if (!host || host.includes("*") || host.includes("/")) {
      issues.push(issue("update_host", "Update hosts must be exact DNS names."));
    }
  }
  return { ok: issues.length === 0, issues };
}

function validateBundleInput(policy, input) {
  const issues = [];
  if (!input?.tenantId || !input?.bundleId || !input?.adminId) {
    issues.push(issue("identity", "Tenant, bundle and admin identity are required."));
  }
  if (!policy.supportedBrowsers.includes(input?.browser)) {
    issues.push(issue("browser", "Browser target is unsupported."));
  }
  if (!policy.supportedOperatingSystems.includes(input?.operatingSystem)) {
    issues.push(issue("operating_system", "Operating-system target is unsupported."));
  }
  if (!EXTENSION_ID.test(String(input?.extensionId ?? ""))) {
    issues.push(issue("extension_id", "A valid 32-character Chromium extension id is required."));
  }
  if (!SHA256.test(String(input?.extensionPackageSha256 ?? ""))) {
    issues.push(issue("extension_digest", "Extension package needs a SHA-256 digest."));
  }
  let updateUrl;
  try {
    updateUrl = new URL(input?.updateUrl);
  } catch {
    issues.push(issue("update_url", "Update URL is invalid."));
  }
  if (
    updateUrl &&
    (updateUrl.protocol !== "https:" || !policy.allowedUpdateHosts.includes(updateUrl.hostname))
  ) {
    issues.push(issue("update_url", "Update URL must be HTTPS on an approved exact host."));
  }
  let rollbackUrl;
  try {
    rollbackUrl = new URL(input?.rollbackUpdateUrl);
  } catch {
    issues.push(issue("rollback_url", "Rollback update URL is invalid."));
  }
  if (
    rollbackUrl &&
    (rollbackUrl.protocol !== "https:" || !policy.allowedUpdateHosts.includes(rollbackUrl.hostname))
  ) {
    issues.push(issue("rollback_url", "Rollback URL must be HTTPS on an approved exact host."));
  }
  const origins = [...new Set(input?.allowedOrigins ?? [])];
  if (origins.length === 0)
    issues.push(issue("origins", "At least one exact production origin is required."));
  for (const origin of origins) {
    if (
      policy.forbiddenOriginPatterns.includes(origin) ||
      /localhost|127\.0\.0\.1/i.test(origin) ||
      origin.slice(0, -2).includes("*") ||
      !/^https:\/\/[^/]+\/\*$/.test(origin)
    ) {
      issues.push(
        issue("origin_scope", `Origin ${origin} is not least privilege production scope.`),
      );
    }
  }
  for (const permission of input?.permissions ?? []) {
    if (policy.forbiddenPermissions.includes(permission)) {
      issues.push(
        issue("permission", `Permission ${permission} is forbidden by enterprise policy.`),
      );
    }
  }
  if (
    (input?.permissions ?? []).some(
      (permission) => !["tabs", "scripting", "downloads"].includes(permission),
    )
  ) {
    issues.push(
      issue("permission", "Policy requested a permission outside the packaged extension contract."),
    );
  }
  if (input?.incognitoAllowed === true)
    issues.push(issue("incognito", "Incognito access conflicts with the extension manifest."));
  if (!input?.previousVersion || !input?.previousPackageSha256 || !input?.rollbackUpdateUrl) {
    issues.push(issue("rollback", "Previous version, digest and rollback URL are required."));
  }
  if (input?.version === input?.previousVersion) {
    issues.push(issue("version", "Deployment and rollback versions must differ."));
  }
  return { issues, origins };
}

export function generateEnterpriseBrowserPolicyBundle(policy, input, privateKey, options = {}) {
  stopIfCancelled(options.signal);
  const validated = validateBundleInput(policy, input);
  if (validated.issues.length > 0) return { ok: false, issues: validated.issues, envelope: null };
  const extensionPolicy = {
    installation_mode: input.mode === "force-install" ? "force_installed" : "normal_installed",
    update_url: input.updateUrl,
    runtime_allowed_hosts: validated.origins,
    runtime_blocked_hosts: ["*://*/*"],
    blocked_permissions: policy.forbiddenPermissions,
    minimum_version_required: input.version,
  };
  const payload = {
    schemaVersion: 1,
    bundleId: input.bundleId,
    tenantId: input.tenantId,
    adminId: input.adminId,
    browser: input.browser,
    operatingSystem: input.operatingSystem,
    extensionId: input.extensionId,
    extensionVersion: input.version,
    extensionPackageSha256: input.extensionPackageSha256,
    expiresAt: input.expiresAt,
    policy: {
      ExtensionSettings: { [input.extensionId]: extensionPolicy },
      ExtensionInstallForcelist:
        input.mode === "force-install" ? [`${input.extensionId};${input.updateUrl}`] : [],
      IncognitoModeAvailability: 1,
    },
    rollback: {
      version: input.previousVersion,
      packageSha256: input.previousPackageSha256,
      updateUrl: input.rollbackUpdateUrl,
      requiresAdminApproval: true,
    },
    revocation: {
      ExtensionSettings: {
        [input.extensionId]: {
          installation_mode: "blocked",
          blocked_install_message: "OCADE was revoked by your organisation.",
        },
      },
      requiresAdminApproval: true,
    },
    administrativeApply: "EXTERNAL_DEVICE_MANAGEMENT_REQUIRED",
    evidenceClass: policy.evidenceClass,
  };
  return { ok: true, issues: [], envelope: signEvidencePayload(payload, privateKey) };
}

export function verifyEnterpriseBrowserPolicyBundle(policy, envelope, publicKey, input = {}) {
  stopIfCancelled(input.signal);
  const issues = [];
  const payload = envelope?.payload ?? {};
  if (!verifyEvidenceEnvelope(envelope, publicKey)) {
    issues.push(issue("signature", "Enterprise policy bundle signature is invalid."));
  }
  if (payload.tenantId !== input.tenantId)
    issues.push(issue("tenant", "Policy bundle belongs to another tenant."));
  if (Date.parse(String(payload.expiresAt ?? "")) < (input.now ?? new Date()).getTime()) {
    issues.push(issue("expired", "Enterprise policy bundle expired."));
  }
  if (input.seenBundleIds?.has(payload.bundleId))
    issues.push(issue("replay", "Enterprise policy bundle was already imported."));
  if (
    payload.extensionId !== input.extensionId ||
    payload.extensionPackageSha256 !== input.extensionPackageSha256
  ) {
    issues.push(issue("package", "Policy bundle targets another extension package."));
  }
  if (
    !policy.supportedBrowsers.includes(payload.browser) ||
    !policy.supportedOperatingSystems.includes(payload.operatingSystem)
  ) {
    issues.push(issue("target", "Policy bundle targets an unsupported platform."));
  }
  const settings = payload.policy?.ExtensionSettings?.[payload.extensionId];
  if (
    !settings ||
    settings.runtime_blocked_hosts?.[0] !== "*://*/*" ||
    !Array.isArray(settings.runtime_allowed_hosts) ||
    settings.runtime_allowed_hosts.some(
      (origin) => origin.includes("*") && !/^https:\/\/[^*]+\/\*$/.test(origin),
    )
  ) {
    issues.push(issue("least_privilege", "Policy origin restrictions are missing or too broad."));
  }
  if (
    payload.administrativeApply !== "EXTERNAL_DEVICE_MANAGEMENT_REQUIRED" ||
    payload.rollback?.requiresAdminApproval !== true ||
    payload.revocation?.requiresAdminApproval !== true ||
    payload.revocation?.ExtensionSettings?.[payload.extensionId]?.installation_mode !== "blocked"
  ) {
    issues.push(
      issue(
        "authority",
        "Policy must retain external admin apply, rollback and revocation authority.",
      ),
    );
  }
  return {
    ok: issues.length === 0,
    issues,
    receipt:
      issues.length === 0
        ? {
            bundleId: payload.bundleId,
            tenantId: payload.tenantId,
            browser: payload.browser,
            operatingSystem: payload.operatingSystem,
            extensionVersion: payload.extensionVersion,
            extensionPackageSha256: payload.extensionPackageSha256,
            evidenceClass: policy.evidenceClass,
            appliedToDeviceManagement: false,
          }
        : null,
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const policy = JSON.parse(readFileSync("release/OCADE_ENTERPRISE_BROWSER_POLICY.json", "utf8"));
  const result = validateEnterpriseBrowserPolicy(policy);
  if (!result.ok) {
    console.error(`Enterprise browser-policy gate failed (${result.issues.length}):`);
    for (const entry of result.issues) console.error(`- ${entry.code}: ${entry.message}`);
    process.exit(1);
  }
  console.log(
    "Enterprise browser-policy gate: Chrome/Edge templates are signed, least-privilege and revocable.",
  );
  console.log("Administrative device-management application remains an external IT action.");
}

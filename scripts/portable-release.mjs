import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const REQUIRED_PROVIDER_KINDS = ["hosted", "self-hosted", "alternate-cloud"];
const REQUIRED_CLEAN_PLATFORMS = ["windows", "linux", "android", "macos"];
const REQUIRED_LIFECYCLE = [
  "install",
  "first-launch",
  "repair",
  "upgrade",
  "rollback",
  "uninstall",
  "leftover-scan",
];
const SAFE_COMMAND = /^(npm (ci|run [a-z0-9:-]+)|cargo (test|check|clippy)\b)/i;
const SHA256 = /^[a-f0-9]{64}$/;

export class PortableReleaseCancelledError extends Error {
  constructor() {
    super("Portable release operation cancelled.");
    this.name = "PortableReleaseCancelledError";
  }
}

const stopIfCancelled = (signal) => {
  if (signal?.aborted) throw new PortableReleaseCancelledError();
};
const digest = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : Buffer.from(value))
    .digest("hex");
const safeRelativePath = (value) =>
  typeof value === "string" &&
  value.length > 0 &&
  !value.startsWith("/") &&
  !/^[a-z]:[\\/]/i.test(value) &&
  !value.split(/[\\/]/).includes("..");
const exactVersion = (value) => /^\d+\.\d+\.\d+$/.test(String(value));

export function validatePortableReleaseManifest(manifest, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  const add = (code, message) => issues.push({ code, message });
  if (manifest?.schemaVersion !== 1) add("schema", "schemaVersion must be 1.");
  if (typeof manifest?.owner !== "string" || manifest.owner.length < 3) {
    add("owner", "A production release owner is required.");
  }
  for (const [tool, version] of Object.entries(manifest?.toolchain ?? {})) {
    if (["node", "npm", "rust", "typescript"].includes(tool) && !exactVersion(version)) {
      add("toolchain_version", `${tool} must use an exact semantic version.`);
    }
  }
  const lockfiles = manifest?.toolchain?.lockfiles;
  if (
    !Array.isArray(lockfiles) ||
    lockfiles.length === 0 ||
    lockfiles.some((path) => !safeRelativePath(path))
  ) {
    add("lockfiles", "Toolchain lockfiles must be explicit relative paths.");
  }
  const allowedSecrets = new Set(manifest?.policy?.secrets ?? []);
  const jobIds = new Set();
  for (const job of manifest?.jobs ?? []) {
    stopIfCancelled(options.signal);
    if (!job.id || jobIds.has(job.id)) add("job_id", "Build job IDs must be present and unique.");
    jobIds.add(job.id);
    if (!Array.isArray(job.commands) || job.commands.length === 0) {
      add("job_commands", `${job.id ?? "unknown"} has no commands.`);
    }
    for (const command of job.commands ?? []) {
      if (!SAFE_COMMAND.test(command) || /[;&|><`]/.test(command)) {
        add("unsafe_command", `${job.id ?? "unknown"} contains an undeclared command shape.`);
      }
    }
    if ((job.artifacts ?? []).some((path) => !safeRelativePath(path))) {
      add("artifact_path", `${job.id ?? "unknown"} contains an unsafe artifact path.`);
    }
    for (const secret of job.requiredSecrets ?? []) {
      if (!allowedSecrets.has(secret)) {
        add("secret_scope", `${job.id ?? "unknown"} requests undeclared secret ${secret}.`);
      }
    }
  }
  const kinds = new Set((manifest?.providers ?? []).map((provider) => provider.kind));
  for (const kind of REQUIRED_PROVIDER_KINDS) {
    if (!kinds.has(kind)) add("provider_kind", `Missing ${kind} runner translation.`);
  }
  for (const sidecar of manifest?.sidecars ?? []) {
    if (
      !sidecar.id ||
      !sidecar.platform ||
      !sidecar.architecture ||
      !sidecar.version ||
      !sidecar.rollbackVersion ||
      !SHA256.test(sidecar.sha256 ?? "") ||
      !String(sidecar.url ?? "").startsWith("https://")
    ) {
      add(
        "sidecar",
        "Published sidecars require identity, target, version, HTTPS, SHA-256 and rollback.",
      );
    }
  }
  const clean = manifest?.cleanMachine ?? {};
  for (const platform of REQUIRED_CLEAN_PLATFORMS) {
    if (!clean.platforms?.includes(platform))
      add("clean_platform", `Missing ${platform} snapshot.`);
  }
  for (const step of REQUIRED_LIFECYCLE) {
    if (!clean.lifecycle?.includes(step))
      add("clean_lifecycle", `Missing ${step} lifecycle check.`);
  }
  if (
    clean.repositoryCheckout !== false ||
    clean.developerToolsPreinstalled !== false ||
    clean.cachedCredentials !== false ||
    clean.destroyAfterEvidenceExport !== true
  ) {
    add("clean_boundary", "Clean-machine evidence must start clean and be destroyed after export.");
  }
  return { ok: issues.length === 0, issues };
}

export function createProviderPlan(manifest, providerId, options = {}) {
  stopIfCancelled(options.signal);
  const validation = validatePortableReleaseManifest(manifest, options);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  const provider = manifest.providers.find((entry) => entry.id === providerId);
  if (!provider) {
    return {
      ok: false,
      issues: [{ code: "provider_missing", message: "Provider is not declared." }],
    };
  }
  return {
    ok: true,
    plan: {
      provider,
      toolchain: manifest.toolchain,
      policy: manifest.policy,
      jobs: manifest.jobs,
      recovery:
        "Retry once on the same immutable source, then move the identical plan to another declared provider.",
    },
    evidenceDigest: digest(
      JSON.stringify({ provider, jobs: manifest.jobs, policy: manifest.policy }),
    ),
  };
}

export function createArtifactProvenance(input, options = {}) {
  stopIfCancelled(options.signal);
  return {
    schemaVersion: 1,
    sourceRevision: input.sourceRevision,
    dependencyDigests: Object.fromEntries(
      Object.entries(input.dependencyLocks ?? {}).map(([path, bytes]) => [path, digest(bytes)]),
    ),
    compiler: input.compiler,
    buildFlags: [...(input.buildFlags ?? [])].sort(),
    symbolsPolicy: input.symbolsPolicy,
    artifacts: (input.artifacts ?? [])
      .map((artifact) => ({
        path: artifact.path,
        sha256: digest(artifact.bytes),
        normalizedManifest: artifact.normalizedManifest,
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };
}

export function verifyIndependentArtifact(primary, independent, options = {}) {
  stopIfCancelled(options.signal);
  const fields = ["sourceRevision", "compiler", "symbolsPolicy"];
  const issues = fields
    .filter((field) => primary?.[field] !== independent?.[field])
    .map((field) => ({ code: `${field}_mismatch`, message: `${field} differs.` }));
  if (
    JSON.stringify(primary?.dependencyDigests) !== JSON.stringify(independent?.dependencyDigests)
  ) {
    issues.push({ code: "dependency_mismatch", message: "Dependency lock digests differ." });
  }
  if (JSON.stringify(primary?.buildFlags) !== JSON.stringify(independent?.buildFlags)) {
    issues.push({ code: "flags_mismatch", message: "Build flags differ." });
  }
  const independentByPath = new Map(
    (independent?.artifacts ?? []).map((entry) => [entry.path, entry]),
  );
  const artifacts = [];
  for (const artifact of primary?.artifacts ?? []) {
    const candidate = independentByPath.get(artifact.path);
    if (!candidate) {
      issues.push({
        code: "artifact_missing",
        message: `${artifact.path} was not independently built.`,
      });
      continue;
    }
    const exact = artifact.sha256 === candidate.sha256;
    const normalized =
      artifact.normalizedManifest &&
      JSON.stringify(artifact.normalizedManifest) === JSON.stringify(candidate.normalizedManifest);
    if (!exact && !normalized) {
      issues.push({
        code: "artifact_mismatch",
        message: `${artifact.path} is neither exact nor structurally equivalent.`,
      });
    }
    artifacts.push({
      path: artifact.path,
      classification: exact ? "exact" : "normalized-equivalent",
    });
  }
  return { ok: issues.length === 0, issues, artifacts };
}

export function resolveSidecar(manifest, request, options = {}) {
  stopIfCancelled(options.signal);
  const sidecar = (manifest?.sidecars ?? []).find(
    (entry) =>
      entry.id === request.id &&
      entry.platform === request.platform &&
      entry.architecture === request.architecture,
  );
  if (!sidecar) {
    return {
      ok: false,
      code: "sidecar_external",
      message:
        "No published sidecar exists for this target; production cannot claim one-click setup.",
      recovery: manifest?.sidecarPolicy?.sourceBuildFallback ?? "development-only",
    };
  }
  const observedDigest = digest(request.bytes);
  if (observedDigest !== sidecar.sha256) {
    return {
      ok: false,
      code: "sidecar_digest",
      message: "Downloaded sidecar digest does not match the signed manifest.",
      recovery: `Restore ${sidecar.rollbackVersion}.`,
    };
  }
  return { ok: true, sidecar, observedDigest };
}

export function validateCleanMachineReceipt(manifest, receipt, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  if (!manifest?.cleanMachine?.platforms?.includes(receipt?.platform)) {
    issues.push({ code: "platform", message: "Platform is not in the clean-machine matrix." });
  }
  if (
    receipt?.repositoryPresent ||
    receipt?.developerToolsPresent ||
    receipt?.cachedCredentialsPresent
  ) {
    issues.push({ code: "contamination", message: "The pre-install environment was not clean." });
  }
  for (const step of manifest?.cleanMachine?.lifecycle ?? []) {
    if (receipt?.steps?.[step] !== true) {
      issues.push({ code: "lifecycle", message: `${step} was not independently observed.` });
    }
  }
  if ((receipt?.leftovers ?? []).length > 0) {
    issues.push({ code: "leftovers", message: "Uninstall left undeclared files or settings." });
  }
  if (receipt?.destroyedAfterExport !== true) {
    issues.push({ code: "destroy", message: "Disposable environment destruction is unverified." });
  }
  return { ok: issues.length === 0, issues };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const manifest = JSON.parse(readFileSync("release/OCADE_PORTABLE_RELEASE_MANIFEST.json", "utf8"));
  const result = validatePortableReleaseManifest(manifest);
  if (!result.ok) {
    console.error(`Portable release gate failed (${result.issues.length}):`);
    for (const entry of result.issues) console.error(`- ${entry.code}: ${entry.message}`);
    process.exit(1);
  }
  console.log(
    `Portable release gate: ${manifest.jobs.length} jobs, ${manifest.providers.length} providers, ${manifest.cleanMachine.platforms.length} clean-machine targets.`,
  );
  console.log(
    `Published sidecars: ${manifest.sidecars.length}; production sidecar runtime remains ${manifest.sidecars.length > 0 ? "configured" : "EXTERNALLY BLOCKED"}.`,
  );
}

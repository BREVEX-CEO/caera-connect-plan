import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { verifyEvidenceEnvelope } from "./compatibility-evidence.mjs";

const digest = (value) => createHash("sha256").update(value).digest("hex");
const issue = (code, message) => ({ code, message });
const expired = (value, now) =>
  !Number.isFinite(Date.parse(String(value))) || Date.parse(String(value)) < now;

export class SubstitutionCancelledError extends Error {
  constructor() {
    super("Capability-substitution operation cancelled.");
    this.name = "SubstitutionCancelledError";
  }
}

const stopIfCancelled = (signal) => {
  if (signal?.aborted) throw new SubstitutionCancelledError();
};

export function validateSubstitutionPolicy(policy) {
  const issues = [];
  if (policy?.schemaVersion !== 1) issues.push(issue("schema", "schemaVersion must be 1."));
  if (typeof policy?.owner !== "string" || policy.owner.length < 3) {
    issues.push(issue("owner", "A production owner is required."));
  }
  const classes = Object.values(policy?.evidenceClasses ?? {});
  if (classes.length !== 6 || new Set(classes).size !== classes.length) {
    issues.push(issue("evidence_classes", "Every route needs a distinct honest evidence class."));
  }
  const equivalentIds = new Set();
  for (const equivalent of policy?.equivalents ?? []) {
    if (
      !equivalent?.category ||
      !equivalent?.adapterId ||
      equivalentIds.has(equivalent.adapterId) ||
      !Array.isArray(equivalent.capabilities) ||
      equivalent.capabilities.length === 0 ||
      !Array.isArray(equivalent.formats) ||
      equivalent.formats.length === 0
    ) {
      issues.push(
        issue("equivalent", "Equivalence mappings must be unique and capability/format bound."),
      );
    }
    equivalentIds.add(equivalent?.adapterId);
  }
  const providerRoutes = new Set(
    (policy?.substitutionProviders ?? []).map((provider) => provider.route),
  );
  for (const route of ["local", "browser", "remote-worker", "wasm"]) {
    if (!providerRoutes.has(route))
      issues.push(issue("provider_route", `Missing ${route} provider route.`));
  }
  if (
    policy?.licensedWorker?.signatureRequired !== true ||
    policy?.licensedWorker?.localLicenceCheckRequired !== true ||
    policy?.licensedWorker?.reusableLicenceSecretAllowed !== false ||
    policy?.licensedWorker?.maximumRetries !== 1 ||
    policy?.licensedWorker?.protectedFilesAllowed !== false ||
    policy?.licensedWorker?.instantRevocationRequired !== true
  ) {
    issues.push(
      issue("licensed_worker", "Licensed-worker trust and recovery limits are incomplete."),
    );
  }
  if (
    policy?.wasm?.networkAllowed !== false ||
    policy?.wasm?.undeclaredFilesAllowed !== false ||
    policy?.wasm?.deterministicReplayRequired !== true ||
    !Number.isInteger(policy?.wasm?.maximumModuleBytes) ||
    !Number.isInteger(policy?.wasm?.maximumMemoryPages) ||
    !Number.isInteger(policy?.wasm?.maximumExecutionMilliseconds)
  ) {
    issues.push(
      issue("wasm", "WASM memory, time, file, network and replay limits are incomplete."),
    );
  }
  const tierPriorities = (policy?.localInferenceTiers ?? []).map((tier) => tier.priority);
  if (
    tierPriorities.length !== 4 ||
    new Set(tierPriorities).size !== tierPriorities.length ||
    !policy.localInferenceTiers.some((tier) => tier.id === "cpu-micro")
  ) {
    issues.push(
      issue(
        "inference_tiers",
        "The WebGPU, native GPU, vector CPU and micro CPU ladder is incomplete.",
      ),
    );
  }
  if (
    policy?.modelStore?.signatureRequired !== true ||
    policy?.modelStore?.bootstrapRequired !== true ||
    policy?.modelStore?.resumable !== true ||
    policy?.modelStore?.rollbackRequired !== true ||
    policy?.modelStore?.preserveBootstrapOnEviction !== true ||
    policy?.modelStore?.garbageCollectionRequired !== true
  ) {
    issues.push(
      issue(
        "model_store",
        "Signed bootstrap, resume, rollback and garbage collection are required.",
      ),
    );
  }
  return { ok: issues.length === 0, issues };
}

export function resolveOpenSourceEquivalent(policy, request, options = {}) {
  stopIfCancelled(options.signal);
  const candidate = policy.equivalents.find(
    (entry) =>
      entry.category === request?.category &&
      entry.capabilities.includes(request?.capability) &&
      entry.formats.includes(request?.expectedFormat),
  );
  if (!candidate) {
    return {
      ok: false,
      issues: [issue("no_equivalent", "No equivalent satisfies the capability and output format.")],
    };
  }
  return {
    ok: true,
    issues: [],
    route: {
      adapterId: candidate.adapterId,
      category: candidate.category,
      requestedApplication: request.requestedApplication,
      expectedFormat: request.expectedFormat,
      evidenceClass: policy.evidenceClasses.equivalence,
      commercialApplicationSupported: false,
      requiresInstalledAdapterEvidence: true,
    },
  };
}

export function authorizeSubstitution(policy, request, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  const provider = policy.substitutionProviders.find((entry) => entry.id === request?.providerId);
  if (!request?.tenantId || !request?.userId)
    issues.push(issue("identity", "Tenant and user are required."));
  if (!provider) issues.push(issue("provider", "Substitution provider is not approved."));
  if (!request?.requestedApplication || !request?.capability || !request?.expectedFormat) {
    issues.push(
      issue("contract", "Original application, capability and output format are required."),
    );
  }
  if (request?.emergencyStop === true || request?.revoked === true) {
    issues.push(issue("revoked", "Substitution was stopped or revoked."));
  }
  if (provider?.dataLeavesDevice && request?.offDeviceConsent !== true) {
    issues.push(issue("consent", "Off-device substitution needs explicit consent."));
  }
  if (
    provider?.route === "browser" &&
    (!request?.providerDisclosure || !request?.privacyDisclosure || !request?.pricingDisclosure)
  ) {
    issues.push(
      issue("disclosure", "Browser substitution needs provider, privacy and pricing disclosures."),
    );
  }
  if (!(request?.providerFormats ?? []).includes(request?.expectedFormat)) {
    issues.push(issue("format", "Provider cannot preserve the requested output format."));
  }
  return {
    ok: issues.length === 0,
    issues,
    receipt:
      issues.length === 0
        ? {
            providerId: provider.id,
            route: provider.route,
            requestedApplication: request.requestedApplication,
            actualProvider: provider.id,
            expectedFormat: request.expectedFormat,
            evidenceClass:
              provider.route === "browser"
                ? policy.evidenceClasses.browser
                : provider.route === "local"
                  ? policy.evidenceClasses.equivalence
                  : provider.route === "remote-worker"
                    ? policy.evidenceClasses.licensedWorker
                    : policy.evidenceClasses.wasm,
            originalApplicationUsed: false,
          }
        : null,
  };
}

export function verifyLicensedWorkerJob(policy, input) {
  stopIfCancelled(input.signal);
  const issues = [];
  const now = (input.now ?? new Date()).getTime();
  const worker = input.signedWorker?.payload ?? {};
  const job = input.signedJob?.payload ?? {};
  const evidence = input.signedEvidence?.payload ?? {};
  if (!verifyEvidenceEnvelope(input.signedWorker, input.workerPublicKey)) {
    issues.push(issue("worker_signature", "Worker capability signature is invalid."));
  }
  if (!verifyEvidenceEnvelope(input.signedJob, input.requesterPublicKey)) {
    issues.push(issue("job_signature", "Job signature is invalid."));
  }
  if (!verifyEvidenceEnvelope(input.signedEvidence, input.workerPublicKey)) {
    issues.push(issue("evidence_signature", "Worker evidence signature is invalid."));
  }
  if (worker.revoked || worker.online !== true || input.emergencyStop === true) {
    issues.push(issue("worker_unavailable", "Worker is offline, revoked or stopped."));
  }
  if (worker.licencePresent !== true || "licenceSecret" in worker || "licenceKey" in worker) {
    issues.push(
      issue("licence", "Licence must be verified locally without exporting a reusable secret."),
    );
  }
  if (expired(worker.expiresAt, now) || expired(job.expiresAt, now)) {
    issues.push(issue("expired", "Worker or job capability expired."));
  }
  for (const field of [
    "workerId",
    "tenantId",
    "userId",
    "applicationId",
    "applicationVersion",
    "capability",
  ]) {
    if (job[field] !== worker[field] || evidence[field] !== job[field]) {
      issues.push(
        issue(`${field}_mismatch`, `${field} is not bound across worker, job and evidence.`),
      );
    }
  }
  if (job.protectedFile === true)
    issues.push(issue("protected_file", "Protected files cannot enter the licensed worker."));
  if ((job.retryCount ?? 0) > policy.licensedWorker.maximumRetries) {
    issues.push(issue("retry", "Licensed-worker retry limit exceeded."));
  }
  if (job.cancelled === true || evidence.cancelled === true) {
    issues.push(issue("cancelled", "Licensed-worker job was cancelled."));
  }
  if (!worker.capabilities?.includes(job.capability)) {
    issues.push(issue("capability", "Worker does not advertise the requested capability."));
  }
  if (
    job.inputDigest !== evidence.inputDigest ||
    !/^[a-f0-9]{64}$/.test(String(evidence.outputDigest ?? ""))
  ) {
    issues.push(issue("evidence", "Worker input/output evidence does not match the signed job."));
  }
  return {
    ok: issues.length === 0,
    issues,
    receipt:
      issues.length === 0
        ? {
            workerId: worker.workerId,
            jobId: job.jobId,
            applicationId: job.applicationId,
            applicationVersion: job.applicationVersion,
            capability: job.capability,
            inputDigest: evidence.inputDigest,
            outputDigest: evidence.outputDigest,
            evidenceClass: policy.evidenceClasses.licensedWorker,
          }
        : null,
  };
}

export async function executeWasmFallback(policy, request, runner, options = {}) {
  stopIfCancelled(options.signal);
  const issues = [];
  if (!request?.tenantId || !request?.userId || !request?.capability) {
    issues.push(issue("identity", "Tenant, user and capability are required."));
  }
  if (
    !Buffer.isBuffer(request?.moduleBytes) ||
    request.moduleBytes.length > policy.wasm.maximumModuleBytes
  ) {
    issues.push(issue("module_size", "WASM package is absent or exceeds the module limit."));
  } else if (digest(request.moduleBytes) !== request.moduleDigest) {
    issues.push(issue("module_digest", "WASM package digest does not match."));
  }
  if (request?.networkAllowed === true || (request?.declaredFiles ?? []).some((path) => !path)) {
    issues.push(issue("scope", "WASM fallback cannot use network or undeclared files."));
  }
  if (
    request?.memoryPages > policy.wasm.maximumMemoryPages ||
    request?.timeoutMilliseconds > policy.wasm.maximumExecutionMilliseconds
  ) {
    issues.push(issue("resource_limit", "WASM memory or execution limit exceeds policy."));
  }
  if (request?.emergencyStop === true || request?.revoked === true) {
    issues.push(issue("revoked", "WASM execution was stopped or revoked."));
  }
  if (issues.length > 0) return { ok: false, issues, receipt: null };
  const runs = [];
  for (let index = 0; index < 2; index += 1) {
    stopIfCancelled(options.signal);
    try {
      runs.push(
        await runner(request.moduleBytes, request.inputBytes, {
          memoryPages: request.memoryPages,
          timeoutMilliseconds: request.timeoutMilliseconds,
          declaredFiles: request.declaredFiles,
          networkAllowed: false,
          signal: options.signal,
        }),
      );
    } catch (error) {
      return {
        ok: false,
        issues: [
          issue("execution", error instanceof Error ? error.message : "WASM execution failed."),
        ],
        receipt: null,
      };
    }
  }
  for (const run of runs) {
    if (
      !Buffer.isBuffer(run.outputBytes) ||
      run.memoryPages > policy.wasm.maximumMemoryPages ||
      run.elapsedMilliseconds > policy.wasm.maximumExecutionMilliseconds ||
      run.networkAttempted === true ||
      (run.filesTouched ?? []).some((path) => !(request.declaredFiles ?? []).includes(path))
    ) {
      issues.push(
        issue("runtime_boundary", "WASM runner exceeded memory, time, file or network scope."),
      );
    }
  }
  const outputDigests = runs.map((run) => digest(run.outputBytes));
  if (new Set(outputDigests).size !== 1) {
    issues.push(issue("nondeterministic", "WASM deterministic replay produced different output."));
  }
  return {
    ok: issues.length === 0,
    issues,
    receipt:
      issues.length === 0
        ? {
            moduleDigest: request.moduleDigest,
            inputDigest: digest(request.inputBytes),
            outputDigest: outputDigests[0],
            replayCount: 2,
            evidenceClass: policy.evidenceClasses.wasm,
            nativeOrGpuReplacement: false,
          }
        : null,
  };
}

export function selectLocalInferenceTier(policy, request, options = {}) {
  stopIfCancelled(options.signal);
  if (request?.emergencyStop === true || request?.revoked === true) {
    return {
      ok: false,
      issues: [issue("revoked", "Inference selection was stopped or revoked.")],
      route: null,
    };
  }
  const reasons = [];
  const tiers = [...policy.localInferenceTiers].sort(
    (left, right) => left.priority - right.priority,
  );
  for (const tier of tiers) {
    if (!(request?.model?.supportedTiers ?? []).includes(tier.id)) {
      reasons.push(`${tier.id}: model incompatible`);
      continue;
    }
    if ((request?.memoryMiB ?? 0) < tier.minimumMemoryMiB) {
      reasons.push(`${tier.id}: insufficient memory`);
      continue;
    }
    if ((tier.minimumGpuMemoryMiB ?? 0) > (request?.gpuMemoryMiB ?? 0)) {
      reasons.push(`${tier.id}: insufficient GPU memory`);
      continue;
    }
    if (tier.requires.includes("webgpu") && request?.webgpu !== true) {
      reasons.push(`${tier.id}: WebGPU unavailable`);
      continue;
    }
    if (tier.requires.includes("native-gpu") && request?.nativeGpu !== true) {
      reasons.push(`${tier.id}: native GPU unavailable`);
      continue;
    }
    if (tier.requires.includes("cpu-vector") && request?.cpuVector !== true) {
      reasons.push(`${tier.id}: vector CPU unavailable`);
      continue;
    }
    if (tier.requires.includes("healthy-driver") && request?.driverHealthy !== true) {
      reasons.push(`${tier.id}: driver failure`);
      continue;
    }
    if (request?.thermalThrottled === true && ["webgpu", "native-gpu"].includes(tier.id)) {
      reasons.push(`${tier.id}: thermal throttling`);
      continue;
    }
    return {
      ok: true,
      issues: [],
      route: {
        tierId: tier.id,
        modelId: request.model.id,
        reasons,
        privacy: "on-device",
        contextTokens: request.model.contextTokens,
        memoryMiB: request.model.memoryMiB,
        expectedLatencyClass:
          tier.id === "cpu-micro"
            ? "slow-or-limited"
            : tier.id.startsWith("cpu")
              ? "moderate"
              : "accelerated",
        evidenceClass: policy.evidenceClasses.localInference,
      },
    };
  }
  return {
    ok: false,
    issues: [
      issue("no_local_tier", "No local tier satisfies hardware, model and policy constraints."),
    ],
    route: { reasons },
  };
}

export function createModelDownloadState(policy, input) {
  stopIfCancelled(input.signal);
  const issues = [];
  const manifest = input.signedManifest?.payload ?? {};
  if (!verifyEvidenceEnvelope(input.signedManifest, input.publicKey)) {
    issues.push(issue("signature", "Model manifest signature is invalid."));
  }
  if (manifest.tenantId !== input.tenantId)
    issues.push(issue("tenant", "Model package belongs to another tenant."));
  if (expired(manifest.expiresAt, (input.now ?? new Date()).getTime())) {
    issues.push(issue("expired", "Model package expired."));
  }
  if (!(manifest.compatibleTiers ?? []).includes(input.tierId)) {
    issues.push(issue("compatibility", "Model package does not support the selected tier."));
  }
  if (
    (input.freeStorageMiB ?? 0) <
    Math.max(policy.modelStore.minimumFreeStorageMiB, manifest.sizeMiB ?? 0)
  ) {
    issues.push(issue("storage", "Free storage is below the model package budget."));
  }
  if (!manifest.bootstrap && input.bootstrapInstalled !== true) {
    issues.push(issue("bootstrap", "A bootstrap model must be usable before stronger packages."));
  }
  if (!manifest.rollbackVersion)
    issues.push(issue("rollback", "Model package has no rollback target."));
  for (const [index, chunk] of (manifest.chunks ?? []).entries()) {
    if (
      chunk.index !== index ||
      !/^[a-f0-9]{64}$/.test(String(chunk.sha256 ?? "")) ||
      chunk.bytes < 1 ||
      chunk.bytes > policy.modelStore.maximumChunkBytes
    ) {
      issues.push(issue("chunk_manifest", "Model chunk manifest is malformed or unbounded."));
    }
  }
  return {
    ok: issues.length === 0,
    issues,
    state:
      issues.length === 0
        ? {
            manifest,
            received: new Map(),
            receivedBytes: 0,
            interrupted: false,
          }
        : null,
  };
}

export function acceptModelChunk(policy, state, index, bytes, options = {}) {
  stopIfCancelled(options.signal);
  if (!state)
    return { ok: false, issues: [issue("state", "Download state is unavailable.")], state };
  const expected = state.manifest.chunks?.[index];
  if (!expected)
    return { ok: false, issues: [issue("index", "Chunk index is outside the manifest.")], state };
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length !== expected.bytes ||
    digest(bytes) !== expected.sha256
  ) {
    return {
      ok: false,
      issues: [issue("chunk_digest", "Chunk bytes are incomplete or corrupted.")],
      state,
    };
  }
  const existing = state.received.get(index);
  if (existing) {
    return existing.equals(bytes)
      ? { ok: true, issues: [], state, idempotent: true }
      : {
          ok: false,
          issues: [issue("chunk_conflict", "Chunk index already contains different bytes.")],
          state,
        };
  }
  const received = new Map(state.received);
  received.set(index, Buffer.from(bytes));
  return {
    ok: true,
    issues: [],
    idempotent: false,
    state: {
      ...state,
      received,
      receivedBytes: state.receivedBytes + bytes.length,
      interrupted: false,
    },
  };
}

export function finalizeModelDownload(policy, state, options = {}) {
  stopIfCancelled(options.signal);
  const chunks = state?.manifest?.chunks ?? [];
  if (!state || state.received.size !== chunks.length) {
    return {
      ok: false,
      issues: [issue("incomplete", "Model download is incomplete.")],
      receipt: null,
    };
  }
  const bytes = Buffer.concat(chunks.map((chunk) => state.received.get(chunk.index)));
  if (digest(bytes) !== state.manifest.packageSha256) {
    return {
      ok: false,
      issues: [issue("package_digest", "Assembled model package digest does not match.")],
      receipt: null,
    };
  }
  return {
    ok: true,
    issues: [],
    receipt: {
      modelId: state.manifest.modelId,
      version: state.manifest.version,
      packageSha256: state.manifest.packageSha256,
      chunks: chunks.length,
      rollbackVersion: state.manifest.rollbackVersion,
      bootstrap: state.manifest.bootstrap,
      evidenceClass: policy.evidenceClasses.modelPackage,
    },
  };
}

export function planModelEviction(policy, models, storageBudgetMiB) {
  const retained = [];
  const evicted = [];
  let used = 0;
  const ordered = [...models].sort(
    (left, right) =>
      Number(Boolean(right.bootstrap)) - Number(Boolean(left.bootstrap)) ||
      Number(Boolean(right.active)) - Number(Boolean(left.active)) ||
      Number(Boolean(right.rollbackTarget)) - Number(Boolean(left.rollbackTarget)) ||
      (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0),
  );
  for (const model of ordered) {
    const protectedModel =
      (policy.modelStore.preserveBootstrapOnEviction && model.bootstrap) ||
      model.active ||
      model.rollbackTarget;
    if (used + model.sizeMiB <= storageBudgetMiB || protectedModel) {
      retained.push(model.id);
      used += model.sizeMiB;
    } else {
      evicted.push(model.id);
    }
  }
  return {
    ok: used <= storageBudgetMiB,
    retained,
    evicted,
    usedMiB: used,
    issues:
      used <= storageBudgetMiB
        ? []
        : [
            issue(
              "protected_models_exceed_budget",
              "Bootstrap, active and rollback models exceed storage budget.",
            ),
          ],
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const policy = JSON.parse(readFileSync("release/OCADE_SUBSTITUTION_FABRIC_POLICY.json", "utf8"));
  const result = validateSubstitutionPolicy(policy);
  if (!result.ok) {
    console.error(`Substitution-fabric gate failed (${result.issues.length}):`);
    for (const entry of result.issues) console.error(`- ${entry.code}: ${entry.message}`);
    process.exit(1);
  }
  console.log(
    `Substitution-fabric gate: ${policy.equivalents.length} open-source equivalents, ${policy.substitutionProviders.length} routes, ${policy.localInferenceTiers.length} local tiers.`,
  );
  console.log(
    "Commercial application, browser-provider and model runtime evidence remain independently required.",
  );
}

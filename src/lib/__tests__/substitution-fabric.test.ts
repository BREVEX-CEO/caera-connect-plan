import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { signEvidencePayload } from "../../../scripts/compatibility-evidence.mjs";
import {
  SubstitutionCancelledError,
  acceptModelChunk,
  authorizeSubstitution,
  createModelDownloadState,
  executeWasmFallback,
  finalizeModelDownload,
  planModelEviction,
  resolveOpenSourceEquivalent,
  selectLocalInferenceTier,
  validateSubstitutionPolicy,
  verifyLicensedWorkerJob,
} from "../../../scripts/substitution-fabric.mjs";

const policy = JSON.parse(readFileSync("release/OCADE_SUBSTITUTION_FABRIC_POLICY.json", "utf8"));
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const NOW = new Date("2026-07-30T16:55:00.000Z");
const FUTURE = "2026-07-30T17:55:00.000Z";
const workerKeys = generateKeyPairSync("ed25519");
const requesterKeys = generateKeyPairSync("ed25519");

const worker = {
  workerId: "worker-1",
  tenantId: "tenant-a",
  userId: "user-a",
  applicationId: "licensed.cad",
  applicationVersion: "7.2.1",
  capability: "cad.export",
  capabilities: ["cad.export"],
  licencePresent: true,
  online: true,
  revoked: false,
  expiresAt: FUTURE,
};
const job = {
  workerId: "worker-1",
  jobId: "job-1",
  tenantId: "tenant-a",
  userId: "user-a",
  applicationId: "licensed.cad",
  applicationVersion: "7.2.1",
  capability: "cad.export",
  expiresAt: FUTURE,
  protectedFile: false,
  retryCount: 0,
  inputDigest: sha("input"),
};
const evidence = {
  workerId: "worker-1",
  jobId: "job-1",
  tenantId: "tenant-a",
  userId: "user-a",
  applicationId: "licensed.cad",
  applicationVersion: "7.2.1",
  capability: "cad.export",
  inputDigest: sha("input"),
  outputDigest: sha("output"),
};

const wasmBytes = Buffer.from([
  0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00, 0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f, 0x03,
  0x02, 0x01, 0x00, 0x07, 0x07, 0x01, 0x03, 0x72, 0x75, 0x6e, 0x00, 0x00, 0x0a, 0x06, 0x01, 0x04,
  0x00, 0x41, 0x2a, 0x0b,
]);
const wasmRequest = {
  tenantId: "tenant-a",
  userId: "user-a",
  capability: "deterministic-number",
  moduleBytes: wasmBytes,
  moduleDigest: sha(wasmBytes),
  inputBytes: Buffer.from("input"),
  memoryPages: 1,
  timeoutMilliseconds: 1000,
  declaredFiles: [],
  networkAllowed: false,
};
const actualWasmRunner = async (moduleBytes: Buffer) => {
  const loaded = (await WebAssembly.instantiate(moduleBytes)) as unknown as
    WebAssembly.Instance | WebAssembly.WebAssemblyInstantiatedSource;
  const instance = "instance" in loaded ? loaded.instance : loaded;
  const run = instance.exports.run as () => number;
  return {
    outputBytes: Buffer.from([run()]),
    memoryPages: 0,
    elapsedMilliseconds: 1,
    networkAttempted: false,
    filesTouched: [],
  };
};

function signedWorkerInput(overrides: Record<string, unknown> = {}) {
  const nextWorker = { ...worker, ...(overrides.worker as object) };
  const nextJob = { ...job, ...(overrides.job as object) };
  const nextEvidence = { ...evidence, ...(overrides.evidence as object) };
  return {
    signedWorker: signEvidencePayload(nextWorker, workerKeys.privateKey),
    signedJob: signEvidencePayload(nextJob, requesterKeys.privateKey),
    signedEvidence: signEvidencePayload(nextEvidence, workerKeys.privateKey),
    workerPublicKey: workerKeys.publicKey,
    requesterPublicKey: requesterKeys.publicKey,
    now: NOW,
    ...overrides,
  };
}

function modelFixture(overrides: Record<string, unknown> = {}) {
  const chunks = [Buffer.from("bootstrap-"), Buffer.from("model")];
  const manifest = {
    modelId: "micro-1",
    version: "1.0.0",
    rollbackVersion: "0.9.0",
    tenantId: "tenant-a",
    expiresAt: FUTURE,
    compatibleTiers: ["cpu-micro"],
    bootstrap: true,
    sizeMiB: 1,
    chunks: chunks.map((chunk, index) => ({ index, bytes: chunk.length, sha256: sha(chunk) })),
    packageSha256: sha(Buffer.concat(chunks)),
    ...overrides,
  };
  return {
    chunks,
    input: {
      signedManifest: signEvidencePayload(manifest, workerKeys.privateKey),
      publicKey: workerKeys.publicKey,
      tenantId: "tenant-a",
      tierId: "cpu-micro",
      freeStorageMiB: 1024,
      bootstrapInstalled: false,
      now: NOW,
    },
  };
}

describe("substitution and local-model fabric", () => {
  it("validates one owner, six honest evidence classes, every route and bounded recovery", () => {
    expect(validateSubstitutionPolicy(policy)).toEqual({ ok: true, issues: [] });
  });

  it("maps open-source equivalents by category, capability and format without claiming commercial support", () => {
    const result = resolveOpenSourceEquivalent(policy, {
      category: "cad",
      capability: "step-export",
      expectedFormat: "STEP",
      requestedApplication: "commercial.cad",
    });
    expect(result).toMatchObject({
      ok: true,
      route: {
        adapterId: "freecad",
        commercialApplicationSupported: false,
        evidenceClass: "CATEGORY CAPABILITY EVIDENCE ONLY",
      },
    });
  });

  it("refuses an equivalence when capability or output format is not genuinely covered", () => {
    expect(
      resolveOpenSourceEquivalent(policy, {
        category: "cad",
        capability: "proprietary-solver",
        expectedFormat: "vendor-private",
      }),
    ).toMatchObject({ ok: false, issues: [{ code: "no_equivalent" }] });
  });

  it("requires off-device consent, provider/privacy/pricing disclosure and output preservation", () => {
    const base = {
      tenantId: "tenant-a",
      userId: "user-a",
      providerId: "approved-browser",
      requestedApplication: "desktop.diagram",
      capability: "diagram-export",
      expectedFormat: "svg",
      providerFormats: ["svg"],
    };
    expect(authorizeSubstitution(policy, base).issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["consent", "disclosure"]),
    );
    expect(
      authorizeSubstitution(policy, {
        ...base,
        offDeviceConsent: true,
        providerDisclosure: "provider",
        privacyDisclosure: "provider retention applies",
        pricingDisclosure: "provider pricing applies",
      }),
    ).toMatchObject({
      ok: true,
      receipt: {
        originalApplicationUsed: false,
        evidenceClass: "APPROVED BROWSER SUBSTITUTION - ORIGINAL APPLICATION NOT USED",
      },
    });
  });

  it("verifies a signed licensed-worker job without receiving a reusable licence secret", () => {
    expect(verifyLicensedWorkerJob(policy, signedWorkerInput())).toMatchObject({
      ok: true,
      receipt: {
        workerId: "worker-1",
        applicationVersion: "7.2.1",
        evidenceClass: "LICENSED WORKER EXECUTION CANDIDATE - REAL EVIDENCE REQUIRED",
      },
    });
  });

  it("refuses revoked/offline workers, exported licence secrets and protected files", () => {
    const result = verifyLicensedWorkerJob(
      policy,
      signedWorkerInput({
        worker: { revoked: true, online: false, licenceKey: "must-not-leave-worker" },
        job: { protectedFile: true },
      }),
    );
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["worker_unavailable", "licence", "protected_file"]),
    );
  });

  it("refuses stale versions, mismatched capabilities, interrupted jobs and evidence drift", () => {
    const result = verifyLicensedWorkerJob(
      policy,
      signedWorkerInput({
        worker: { applicationVersion: "7.2.0", capabilities: [] },
        job: { retryCount: 2, cancelled: true },
        evidence: { inputDigest: sha("different") },
      }),
    );
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "applicationVersion_mismatch",
        "retry",
        "cancelled",
        "capability",
        "evidence",
      ]),
    );
  });

  it("executes a real deterministic WebAssembly module twice through the bounded runner contract", async () => {
    const result = await executeWasmFallback(policy, wasmRequest, actualWasmRunner);
    expect(result).toMatchObject({
      ok: true,
      receipt: {
        moduleDigest: sha(wasmBytes),
        replayCount: 2,
        evidenceClass: "SANDBOXED WASM UNIT EXECUTION ONLY",
        nativeOrGpuReplacement: false,
      },
    });
  });

  it("refuses WASM tampering, excessive resources, network scope and emergency stop before execution", async () => {
    let calls = 0;
    const result = await executeWasmFallback(
      policy,
      {
        ...wasmRequest,
        moduleDigest: sha("tampered"),
        memoryPages: 257,
        networkAllowed: true,
        emergencyStop: true,
      },
      async () => {
        calls += 1;
        return actualWasmRunner(wasmBytes);
      },
    );
    expect(calls).toBe(0);
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["module_digest", "scope", "resource_limit", "revoked"]),
    );
  });

  it("refuses non-deterministic, over-time, file-escaping or networked WASM observations", async () => {
    let sequence = 0;
    const result = await executeWasmFallback(policy, wasmRequest, async () => ({
      outputBytes: Buffer.from([sequence++]),
      memoryPages: 1,
      elapsedMilliseconds: 5001,
      networkAttempted: true,
      filesTouched: ["undeclared.txt"],
    }));
    expect(result.ok).toBe(false);
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["runtime_boundary", "nondeterministic"]),
    );
  });

  it("selects WebGPU when healthy and truthfully exposes its limits", () => {
    const result = selectLocalInferenceTier(policy, {
      webgpu: true,
      nativeGpu: true,
      cpuVector: true,
      driverHealthy: true,
      memoryMiB: 8192,
      gpuMemoryMiB: 8192,
      model: {
        id: "local-7b",
        supportedTiers: ["webgpu", "native-gpu", "cpu-vector"],
        contextTokens: 8192,
        memoryMiB: 4096,
      },
    });
    expect(result).toMatchObject({
      ok: true,
      route: {
        tierId: "webgpu",
        privacy: "on-device",
        expectedLatencyClass: "accelerated",
        evidenceClass: "LOCAL INFERENCE ROUTE SELECTED - RUNTIME EXECUTION REQUIRED",
      },
    });
  });

  it.each([
    [
      {
        webgpu: false,
        nativeGpu: false,
        cpuVector: true,
        driverHealthy: false,
        thermalThrottled: false,
      },
      "cpu-vector",
    ],
    [
      {
        webgpu: true,
        nativeGpu: true,
        cpuVector: true,
        driverHealthy: true,
        thermalThrottled: true,
      },
      "cpu-vector",
    ],
    [
      {
        webgpu: false,
        nativeGpu: false,
        cpuVector: false,
        driverHealthy: false,
        thermalThrottled: false,
      },
      "cpu-micro",
    ],
  ])(
    "falls back under GPU absence, driver failure or thermal throttling",
    (hardware, expectedTier) => {
      const result = selectLocalInferenceTier(policy, {
        ...hardware,
        memoryMiB: 8192,
        gpuMemoryMiB: 8192,
        model: {
          id: "micro",
          supportedTiers: ["webgpu", "native-gpu", "cpu-vector", "cpu-micro"],
          contextTokens: 2048,
          memoryMiB: 512,
        },
      });
      expect(result.route.tierId).toBe(expectedTier);
      expect(result.route.reasons.length).toBeGreaterThan(0);
    },
  );

  it("refuses model incompatibility or insufficient memory instead of silently selecting cloud", () => {
    const result = selectLocalInferenceTier(policy, {
      memoryMiB: 256,
      model: { id: "huge", supportedTiers: ["webgpu"], contextTokens: 128000, memoryMiB: 64000 },
    });
    expect(result).toMatchObject({ ok: false, issues: [{ code: "no_local_tier" }] });
  });

  it("starts with a signed bootstrap package and resumes verified chunks idempotently", () => {
    const fixture = modelFixture();
    const created = createModelDownloadState(policy, fixture.input);
    expect(created.ok).toBe(true);
    const first = acceptModelChunk(policy, created.state, 0, fixture.chunks[0]);
    const duplicate = acceptModelChunk(policy, first.state, 0, fixture.chunks[0]);
    const second = acceptModelChunk(policy, duplicate.state, 1, fixture.chunks[1]);
    expect(first.idempotent).toBe(false);
    expect(duplicate.idempotent).toBe(true);
    expect(finalizeModelDownload(policy, second.state)).toMatchObject({
      ok: true,
      receipt: {
        modelId: "micro-1",
        rollbackVersion: "0.9.0",
        bootstrap: true,
        evidenceClass: "SIGNED MODEL PACKAGE VERIFIED - MODEL EXECUTION REQUIRED",
      },
    });
  });

  it("refuses corrupt chunks, incomplete assembly, low storage and incompatible tiers", () => {
    const fixture = modelFixture();
    const lowStorage = createModelDownloadState(policy, {
      ...fixture.input,
      freeStorageMiB: 1,
      tierId: "webgpu",
    });
    expect(lowStorage.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["storage", "compatibility"]),
    );
    const created = createModelDownloadState(policy, fixture.input);
    expect(acceptModelChunk(policy, created.state, 0, Buffer.from("corrupt"))).toMatchObject({
      ok: false,
      issues: [{ code: "chunk_digest" }],
    });
    expect(finalizeModelDownload(policy, created.state)).toMatchObject({
      ok: false,
      issues: [{ code: "incomplete" }],
    });
  });

  it("evicts least-recent optional models but preserves bootstrap, active and rollback recovery", () => {
    expect(
      planModelEviction(
        policy,
        [
          { id: "bootstrap", sizeMiB: 100, bootstrap: true, lastUsedAt: 1 },
          { id: "active", sizeMiB: 100, active: true, lastUsedAt: 4 },
          { id: "rollback", sizeMiB: 100, rollbackTarget: true, lastUsedAt: 2 },
          { id: "unused", sizeMiB: 100, lastUsedAt: 3 },
        ],
        300,
      ),
    ).toEqual({
      ok: true,
      retained: ["bootstrap", "active", "rollback"],
      evicted: ["unused"],
      usedMiB: 300,
      issues: [],
    });
  });

  it("honours cancellation across equivalence, browser, WASM, inference and model operations", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => resolveOpenSourceEquivalent(policy, {}, { signal: controller.signal })).toThrow(
      SubstitutionCancelledError,
    );
    expect(() => authorizeSubstitution(policy, {}, { signal: controller.signal })).toThrow(
      SubstitutionCancelledError,
    );
    await expect(
      executeWasmFallback(policy, wasmRequest, actualWasmRunner, { signal: controller.signal }),
    ).rejects.toThrow(SubstitutionCancelledError);
    expect(() => selectLocalInferenceTier(policy, {}, { signal: controller.signal })).toThrow(
      SubstitutionCancelledError,
    );
    expect(() =>
      createModelDownloadState(policy, { ...modelFixture().input, signal: controller.signal }),
    ).toThrow(SubstitutionCancelledError);
  });
});

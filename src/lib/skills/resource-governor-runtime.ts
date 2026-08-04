/**
 * Stage 2 Resource Governor runtime contract.
 *
 * This complements the small per-job admission helper in resource-governor.ts.
 * It models the evidence needed before selecting a local model, renderer or
 * solver, and it owns only reversible session/project performance settings.
 */

export type ResourceEvidenceClass = "synthetic_profile" | "host_probe";
export type ResourceHardwareTier = "weak" | "medium" | "strong";
export type ResourceToolRole = "model" | "renderer" | "solver" | "processor";
export type ResourcePowerSource = "mains" | "battery" | "unknown";
export type ResourceThermalState = "nominal" | "warm" | "hot" | "critical" | "unknown";
export type ResourcePlanStatus = "ready" | "fallback" | "defer" | "refuse";

export interface ResourceRange {
  min: number;
  max: number;
}

export interface ResourceGpu {
  id: string;
  name: string;
  vramBytes: number;
  backends: string[];
}

export interface ResourceStorage {
  id: string;
  totalBytes: number;
  freeBytes: number;
}

export interface ResourceEnvironment {
  capturedAt: string;
  evidenceClass: ResourceEvidenceClass;
  cpu: {
    model: string;
    physicalCores: number;
    logicalCores: number;
  };
  memory: {
    totalBytes: number;
    availableBytes: number;
  };
  gpus: ResourceGpu[];
  storage: ResourceStorage[];
  power: {
    source: ResourcePowerSource;
    batteryPercent?: number;
  };
  thermal: ResourceThermalState;
  currentLoad: {
    cpuPercent: number;
    memoryBytes: number;
    gpuPercent?: number;
  };
  availableBackends: string[];
  installedTools: {
    models: string[];
    renderers: string[];
    solvers: string[];
    processors: string[];
  };
  evidence: string[];
}

export interface ResourceDiscoveryHost {
  probe(signal?: AbortSignal): Promise<ResourceEnvironment>;
}

export interface ResourceCostBasis {
  fixedMemoryBytes: number;
  memoryBytesPerUnit: ResourceRange;
  storageBytesPerUnit: ResourceRange;
  millisecondsPerUnit: ResourceRange;
}

export interface ResourceCandidate {
  id: string;
  role: ResourceToolRole;
  quality: "preview" | "balanced" | "full";
  qualityScore: number;
  minAvailableRamBytes: number;
  minFreeStorageBytes: number;
  requiresGpu: boolean;
  minVramBytes: number;
  requiredBackends: string[];
  maxParallelism: number;
  previewScale: number;
  changesEngineeringAccuracy: boolean;
}

export interface ResourceTask {
  id: string;
  kind: "local_inference" | "render" | "solver" | "build" | "video_export";
  role: ResourceToolRole;
  workUnits: number;
  basis: ResourceCostBasis;
  candidates: ResourceCandidate[];
  accuracyCritical: boolean;
  checkpointable: boolean;
  cancellable: boolean;
}

export interface ResourceEstimateRange {
  memoryBytes: ResourceRange;
  storageBytes: ResourceRange;
  durationMs: ResourceRange;
  approximate: true;
  basis: string;
}

export interface ResourcePerformanceProfile {
  id: string;
  scope: "session" | "project";
  selectedToolId: string;
  maxParallelism: number;
  previewScale: number;
  checkpointEveryMs: number;
  warningThresholds: {
    memoryBytes: number;
    freeStorageBytes: number;
    thermal: "warm" | "hot";
  };
  cancellationStrategy: "cooperative_then_force_stop";
  restoreRequired: true;
}

export interface ResourcePlan {
  status: ResourcePlanStatus;
  hardwareTier: ResourceHardwareTier;
  estimate: ResourceEstimateRange;
  selected: ResourceCandidate | null;
  fallback: ResourceCandidate | null;
  profile: ResourcePerformanceProfile | null;
  reasons: string[];
  evidenceClass: ResourceEvidenceClass;
}

export type ResourceRuntimeOutcome<T> =
  { ok: true; data: T; evidence: string[] } | { ok: false; reason: string; evidence: string[] };

const GB = 1024 ** 3;
const MIN_CHECKPOINT_MS = 30_000;
const MAX_CHECKPOINT_MS = 5 * 60_000;
const MEMORY_WARNING_RATIO = 0.8;
const STORAGE_RESERVE_RATIO = 0.1;

export const RESOURCE_GOVERNOR_RUNTIME_BOUNDARY =
  "Synthetic profiles verify policy deterministically. Host hardware, driver, model, renderer and solver evidence must come from an authenticated native probe before a real job can start.";

export async function discoverResourceEnvironment(
  host: ResourceDiscoveryHost,
  signal?: AbortSignal,
): Promise<ResourceRuntimeOutcome<ResourceEnvironment>> {
  if (signal?.aborted) {
    return { ok: false, reason: "Hardware discovery was cancelled before probing.", evidence: [] };
  }
  try {
    const environment = await host.probe(signal);
    if (signal?.aborted) {
      return { ok: false, reason: "Hardware discovery was cancelled.", evidence: [] };
    }
    const error = validateEnvironment(environment);
    if (error) return { ok: false, reason: error, evidence: environment.evidence ?? [] };
    return {
      ok: true,
      data: normalizeEnvironment(environment),
      evidence: [...environment.evidence],
    };
  } catch (error) {
    return {
      ok: false,
      reason: `Hardware discovery failed: ${error instanceof Error ? error.message : String(error)}`,
      evidence: [],
    };
  }
}

export function estimateResourceTask(
  task: ResourceTask,
): ResourceRuntimeOutcome<ResourceEstimateRange> {
  const validation = validateTask(task);
  if (validation) return { ok: false, reason: validation, evidence: [] };

  const memoryMin = safeCost(
    task.basis.fixedMemoryBytes,
    task.workUnits,
    task.basis.memoryBytesPerUnit.min,
  );
  const memoryMax = safeCost(
    task.basis.fixedMemoryBytes,
    task.workUnits,
    task.basis.memoryBytesPerUnit.max,
  );
  const storageMin = safeCost(0, task.workUnits, task.basis.storageBytesPerUnit.min);
  const storageMax = safeCost(0, task.workUnits, task.basis.storageBytesPerUnit.max);
  const durationMin = safeCost(0, task.workUnits, task.basis.millisecondsPerUnit.min);
  const durationMax = safeCost(0, task.workUnits, task.basis.millisecondsPerUnit.max);
  if (
    [memoryMin, memoryMax, storageMin, storageMax, durationMin, durationMax].some((v) => v === null)
  ) {
    return {
      ok: false,
      reason: "The task estimate exceeds JavaScript's safe numeric range.",
      evidence: [],
    };
  }

  const estimate: ResourceEstimateRange = {
    memoryBytes: { min: memoryMin!, max: memoryMax! },
    storageBytes: { min: storageMin!, max: storageMax! },
    durationMs: { min: durationMin!, max: durationMax! },
    approximate: true,
    basis: `${task.workUnits} work units using an adapter-provided bounded min/max cost basis; this is an estimate, not a measurement.`,
  };
  return {
    ok: true,
    data: estimate,
    evidence: [
      `memory:${estimate.memoryBytes.min}-${estimate.memoryBytes.max}`,
      `storage:${estimate.storageBytes.min}-${estimate.storageBytes.max}`,
      `duration:${estimate.durationMs.min}-${estimate.durationMs.max}`,
    ],
  };
}

export function planResourceTask(
  task: ResourceTask,
  environment: ResourceEnvironment,
): ResourceRuntimeOutcome<ResourcePlan> {
  const environmentError = validateEnvironment(environment);
  if (environmentError) return { ok: false, reason: environmentError, evidence: [] };
  const estimateResult = estimateResourceTask(task);
  if (!estimateResult.ok) return estimateResult;

  const normalized = normalizeEnvironment(environment);
  const tier = classifyHardware(normalized);
  const estimate = estimateResult.data;
  const reasons: string[] = [];

  if (normalized.thermal === "critical" || normalized.thermal === "hot") {
    return successfulPlan("defer", tier, estimate, normalized, null, null, null, [
      `The host thermal state is ${normalized.thermal}; wait for independently observed cooling.`,
    ]);
  }
  if (
    normalized.power.source === "battery" &&
    normalized.power.batteryPercent !== undefined &&
    normalized.power.batteryPercent < 25
  ) {
    return successfulPlan("defer", tier, estimate, normalized, null, null, null, [
      `Battery is ${normalized.power.batteryPercent}%; connect external power before starting.`,
    ]);
  }

  const candidates = task.candidates
    .filter((candidate) => candidate.role === task.role)
    .filter((candidate) => isInstalled(candidate, normalized))
    .filter((candidate) => !task.accuracyCritical || !candidate.changesEngineeringAccuracy)
    .filter((candidate) => candidateFits(candidate, estimate, normalized))
    .sort((a, b) => b.qualityScore - a.qualityScore || a.id.localeCompare(b.id));

  if (candidates.length === 0) {
    reasons.push(
      task.accuracyCritical
        ? "No installed candidate fits without changing an accuracy-critical engineering setting."
        : "No installed candidate fits the measured memory, storage, GPU, backend and load limits.",
    );
    return successfulPlan("refuse", tier, estimate, normalized, null, null, null, reasons);
  }

  const selected = candidates[0];
  const highestDeclared = [...task.candidates]
    .filter((candidate) => candidate.role === task.role)
    .filter((candidate) => !task.accuracyCritical || !candidate.changesEngineeringAccuracy)
    .sort((a, b) => b.qualityScore - a.qualityScore)[0];
  const fallback =
    candidates.find((candidate) => candidate.qualityScore < selected.qualityScore) ?? null;
  const status: ResourcePlanStatus =
    highestDeclared && selected.id !== highestDeclared.id ? "fallback" : "ready";

  const memoryHeadroom = Math.max(1, normalized.memory.availableBytes - estimate.memoryBytes.max);
  const byRam = Math.max(
    1,
    Math.floor(normalized.memory.availableBytes / Math.max(1, estimate.memoryBytes.max)),
  );
  const byCpu = Math.max(1, Math.floor(normalized.cpu.logicalCores / 2));
  const maxParallelism = Math.max(1, Math.min(selected.maxParallelism, byRam, byCpu));
  const checkpointEveryMs = task.checkpointable
    ? clamp(Math.floor(estimate.durationMs.max / 10), MIN_CHECKPOINT_MS, MAX_CHECKPOINT_MS)
    : MAX_CHECKPOINT_MS;
  const storageFree = totalFreeStorage(normalized);
  const profile: ResourcePerformanceProfile = {
    id: `${task.id}:${selected.id}:${tier}`,
    scope: "session",
    selectedToolId: selected.id,
    maxParallelism,
    previewScale: selected.previewScale,
    checkpointEveryMs,
    warningThresholds: {
      memoryBytes: Math.floor(normalized.memory.availableBytes * MEMORY_WARNING_RATIO),
      freeStorageBytes: Math.max(
        estimate.storageBytes.max,
        Math.floor(storageFree * STORAGE_RESERVE_RATIO),
      ),
      thermal: task.kind === "solver" || task.kind === "render" ? "warm" : "hot",
    },
    cancellationStrategy: "cooperative_then_force_stop",
    restoreRequired: true,
  };
  reasons.push(
    `${selected.id} is the highest-quality installed candidate that fits the observed host limits.`,
    `Maximum parallelism is ${maxParallelism}; ${formatBytes(memoryHeadroom)} estimated memory headroom remains.`,
  );
  if (status === "fallback") {
    reasons.push(
      `The preferred candidate does not fit; ${selected.id} is the safe reversible fallback.`,
    );
  }
  if (!task.cancellable) {
    reasons.push(
      "The adapter cannot prove cooperative cancellation; force-stop and checkpoint recovery are required.",
    );
  }
  return successfulPlan(status, tier, estimate, normalized, selected, fallback, profile, reasons);
}

export async function discoverAndPlanResourceTask(
  task: ResourceTask,
  host: ResourceDiscoveryHost,
  signal?: AbortSignal,
): Promise<ResourceRuntimeOutcome<ResourcePlan>> {
  const discovery = await discoverResourceEnvironment(host, signal);
  if (!discovery.ok) return discovery;
  if (discovery.data.evidenceClass !== "host_probe") {
    return {
      ok: false,
      reason:
        "A real job requires authenticated host-probe evidence; a synthetic profile is test evidence only.",
      evidence: discovery.evidence,
    };
  }
  return planResourceTask(task, discovery.data);
}

export type ResourceSettingKey =
  | "model.max_context"
  | "renderer.preview_scale"
  | "runtime.max_parallelism"
  | "solver.thread_count"
  | "project.checkpoint_interval_ms";

export type ResourceSettingValue = string | number | boolean;
export type ResourceSettings = Partial<Record<ResourceSettingKey, ResourceSettingValue>>;

export interface ResourceSettingsHost {
  readSettings(keys: ResourceSettingKey[], signal?: AbortSignal): Promise<ResourceSettings>;
  writeSettings(settings: ResourceSettings, signal?: AbortSignal): Promise<void>;
  verifySettings(settings: ResourceSettings, signal?: AbortSignal): Promise<boolean>;
}

export interface ResourceProfileSession {
  profileId: string;
  originals: ResourceSettings;
  applied: ResourceSettings;
  restore(signal?: AbortSignal): Promise<ResourceRuntimeOutcome<{ restored: true }>>;
}

export async function applyReversiblePerformanceProfile(
  profile: ResourcePerformanceProfile,
  settings: ResourceSettings,
  host: ResourceSettingsHost,
  signal?: AbortSignal,
): Promise<ResourceRuntimeOutcome<ResourceProfileSession>> {
  const entries = Object.entries(settings);
  if (profile.scope !== "session" && profile.scope !== "project") {
    return {
      ok: false,
      reason: "Only session or project performance settings may be changed.",
      evidence: [],
    };
  }
  if (!profile.restoreRequired || entries.length === 0) {
    return {
      ok: false,
      reason: "A reversible profile requires at least one bounded setting and mandatory restore.",
      evidence: [],
    };
  }
  if (signal?.aborted) {
    return { ok: false, reason: "Performance-profile application was cancelled.", evidence: [] };
  }

  const keys = entries.map(([key]) => key as ResourceSettingKey);
  let originals: ResourceSettings;
  try {
    originals = await host.readSettings(keys, signal);
  } catch (error) {
    return {
      ok: false,
      reason: `Original settings could not be recorded: ${errorMessage(error)}`,
      evidence: [],
    };
  }
  if (keys.some((key) => !(key in originals))) {
    return {
      ok: false,
      reason: "Every original setting must be recorded before applying a profile.",
      evidence: [],
    };
  }

  try {
    await host.writeSettings(settings, signal);
    if (!(await host.verifySettings(settings, signal))) {
      throw new Error("independent setting verification failed");
    }
  } catch (error) {
    const recovery = await restoreSettings(host, originals, signal);
    return {
      ok: false,
      reason: `Performance profile was not verified: ${errorMessage(error)}. ${
        recovery.ok ? "Original settings were restored and verified." : recovery.reason
      }`,
      evidence: recovery.evidence,
    };
  }

  let restored = false;
  const session: ResourceProfileSession = {
    profileId: profile.id,
    originals: { ...originals },
    applied: { ...settings },
    async restore(restoreSignal) {
      if (restored) {
        return { ok: true, data: { restored: true }, evidence: ["settings:already-restored"] };
      }
      const recovery = await restoreSettings(host, originals, restoreSignal);
      if (!recovery.ok) return recovery;
      restored = true;
      return { ok: true, data: { restored: true }, evidence: recovery.evidence };
    },
  };
  return {
    ok: true,
    data: session,
    evidence: ["original-settings:recorded", "profile:applied", "profile:verified"],
  };
}

export interface ResourceLease {
  taskId: string;
  isCancelled(): boolean;
  release(): void;
}

export class ResourceConcurrencyController {
  private readonly active = new Map<string, { cancelled: boolean; detach?: () => void }>();
  private stopped = false;

  constructor(readonly maximum: number) {
    if (!Number.isInteger(maximum) || maximum < 1) {
      throw new Error("Resource concurrency maximum must be a positive integer.");
    }
  }

  acquire(taskId: string, signal?: AbortSignal): ResourceRuntimeOutcome<ResourceLease> {
    if (!taskId.trim()) return { ok: false, reason: "Task ID is required.", evidence: [] };
    if (this.stopped)
      return { ok: false, reason: "The resource controller is stopped.", evidence: [] };
    if (signal?.aborted)
      return { ok: false, reason: "The task was already cancelled.", evidence: [] };
    if (this.active.has(taskId))
      return { ok: false, reason: "A task with this ID is already active.", evidence: [] };
    if (this.active.size >= this.maximum) {
      return {
        ok: false,
        reason: `Concurrency limit ${this.maximum} is reached; queue or defer this task.`,
        evidence: [`active:${this.active.size}`],
      };
    }

    const state: { cancelled: boolean; detach?: () => void } = { cancelled: false };
    const release = () => {
      state.detach?.();
      this.active.delete(taskId);
    };
    if (signal) {
      const onAbort = () => {
        state.cancelled = true;
        release();
      };
      signal.addEventListener("abort", onAbort, { once: true });
      state.detach = () => signal.removeEventListener("abort", onAbort);
    }
    this.active.set(taskId, state);
    return {
      ok: true,
      data: { taskId, isCancelled: () => state.cancelled, release },
      evidence: [`lease:${taskId}`, `active:${this.active.size}/${this.maximum}`],
    };
  }

  emergencyStop(): string[] {
    this.stopped = true;
    const cancelled = [...this.active.keys()];
    for (const state of this.active.values()) {
      state.cancelled = true;
      state.detach?.();
    }
    this.active.clear();
    return cancelled;
  }

  resume(): void {
    this.stopped = false;
  }

  get activeCount(): number {
    return this.active.size;
  }
}

export const SYNTHETIC_RESOURCE_PROFILES: Record<ResourceHardwareTier, ResourceEnvironment> = {
  weak: syntheticEnvironment("weak", 2, 4 * GB, 2 * GB, [], 20 * GB),
  medium: syntheticEnvironment(
    "medium",
    8,
    16 * GB,
    10 * GB,
    [
      {
        id: "gpu-medium",
        name: "Synthetic 6 GB GPU",
        vramBytes: 6 * GB,
        backends: ["webgpu", "cuda"],
      },
    ],
    200 * GB,
  ),
  strong: syntheticEnvironment(
    "strong",
    24,
    64 * GB,
    52 * GB,
    [
      {
        id: "gpu-strong",
        name: "Synthetic 24 GB GPU",
        vramBytes: 24 * GB,
        backends: ["webgpu", "cuda", "vulkan"],
      },
    ],
    1000 * GB,
  ),
};

function syntheticEnvironment(
  tier: ResourceHardwareTier,
  logicalCores: number,
  totalRamBytes: number,
  availableBytes: number,
  gpus: ResourceGpu[],
  freeBytes: number,
): ResourceEnvironment {
  return {
    capturedAt: "2026-07-26T00:00:00.000Z",
    evidenceClass: "synthetic_profile",
    cpu: { model: `Synthetic ${tier}`, physicalCores: Math.max(1, logicalCores / 2), logicalCores },
    memory: { totalBytes: totalRamBytes, availableBytes },
    gpus,
    storage: [{ id: "synthetic", totalBytes: freeBytes * 2, freeBytes }],
    power: { source: "mains" },
    thermal: "nominal",
    currentLoad: { cpuPercent: 10, memoryBytes: totalRamBytes - availableBytes, gpuPercent: 5 },
    availableBackends: gpus.flatMap((gpu) => gpu.backends),
    installedTools: {
      models: ["model-lite", "model-balanced", "model-full"],
      renderers: ["renderer-preview", "renderer-balanced", "renderer-full"],
      solvers: ["solver-lite", "solver-balanced", "solver-full"],
      processors: ["processor-native"],
    },
    evidence: [`synthetic:${tier}`],
  };
}

function validateEnvironment(environment: ResourceEnvironment): string | null {
  if (!environment || !Number.isFinite(Date.parse(environment.capturedAt)))
    return "Hardware capture time is invalid.";
  if (!["synthetic_profile", "host_probe"].includes(environment.evidenceClass))
    return "Hardware evidence class is invalid.";
  if (
    !environment.cpu?.model.trim() ||
    !positiveInteger(environment.cpu.physicalCores) ||
    !positiveInteger(environment.cpu.logicalCores) ||
    environment.cpu.physicalCores > environment.cpu.logicalCores
  )
    return "CPU discovery evidence is invalid.";
  if (
    !positiveAmount(environment.memory?.totalBytes) ||
    !nonNegativeAmount(environment.memory?.availableBytes) ||
    environment.memory.availableBytes > environment.memory.totalBytes
  )
    return "Memory discovery evidence is invalid.";
  if (!Array.isArray(environment.storage) || environment.storage.length === 0)
    return "Storage discovery evidence is missing.";
  if (
    environment.storage.some(
      (drive) =>
        !drive.id.trim() ||
        !positiveAmount(drive.totalBytes) ||
        !nonNegativeAmount(drive.freeBytes) ||
        drive.freeBytes > drive.totalBytes,
    )
  )
    return "Storage discovery evidence is invalid.";
  if (
    environment.gpus.some(
      (gpu) =>
        !gpu.id.trim() ||
        !gpu.name.trim() ||
        !nonNegativeAmount(gpu.vramBytes) ||
        !Array.isArray(gpu.backends),
    )
  )
    return "GPU discovery evidence is invalid.";
  if (!["mains", "battery", "unknown"].includes(environment.power?.source))
    return "Power-source evidence is invalid.";
  if (
    environment.power.batteryPercent !== undefined &&
    (!Number.isFinite(environment.power.batteryPercent) ||
      environment.power.batteryPercent < 0 ||
      environment.power.batteryPercent > 100)
  )
    return "Battery evidence is invalid.";
  if (!["nominal", "warm", "hot", "critical", "unknown"].includes(environment.thermal))
    return "Thermal evidence is invalid.";
  if (
    !percentage(environment.currentLoad?.cpuPercent) ||
    !nonNegativeAmount(environment.currentLoad?.memoryBytes) ||
    (environment.currentLoad.gpuPercent !== undefined &&
      !percentage(environment.currentLoad.gpuPercent))
  )
    return "Current-load evidence is invalid.";
  if (
    !Array.isArray(environment.availableBackends) ||
    !environment.installedTools ||
    !Array.isArray(environment.installedTools.models) ||
    !Array.isArray(environment.installedTools.renderers) ||
    !Array.isArray(environment.installedTools.solvers) ||
    !Array.isArray(environment.installedTools.processors) ||
    !Array.isArray(environment.evidence) ||
    environment.evidence.length === 0
  ) {
    return "Installed-tool or provenance evidence is missing.";
  }
  return null;
}

function normalizeEnvironment(environment: ResourceEnvironment): ResourceEnvironment {
  return {
    ...environment,
    gpus: environment.gpus.map((gpu) => ({
      ...gpu,
      backends: uniqueSorted(gpu.backends),
    })),
    availableBackends: uniqueSorted(environment.availableBackends),
    installedTools: {
      models: uniqueSorted(environment.installedTools.models),
      renderers: uniqueSorted(environment.installedTools.renderers),
      solvers: uniqueSorted(environment.installedTools.solvers),
      processors: uniqueSorted(environment.installedTools.processors),
    },
    evidence: [...environment.evidence],
  };
}

function validateTask(task: ResourceTask): string | null {
  if (!task.id.trim()) return "Task ID is required.";
  if (!positiveAmount(task.workUnits)) return "Task work units must be positive.";
  const ranges = [
    task.basis.memoryBytesPerUnit,
    task.basis.storageBytesPerUnit,
    task.basis.millisecondsPerUnit,
  ];
  if (!nonNegativeAmount(task.basis.fixedMemoryBytes)) return "Fixed memory cost is invalid.";
  if (ranges.some((range) => !validRange(range))) return "A task estimate range is invalid.";
  if (!Array.isArray(task.candidates) || task.candidates.length === 0)
    return "At least one execution candidate is required.";
  if (task.candidates.some((candidate) => validateCandidate(candidate) !== null))
    return "An execution candidate is invalid.";
  return null;
}

function validateCandidate(candidate: ResourceCandidate): string | null {
  if (!candidate.id.trim() || !positiveInteger(candidate.maxParallelism))
    return "candidate identity/parallelism";
  if (
    !nonNegativeAmount(candidate.minAvailableRamBytes) ||
    !nonNegativeAmount(candidate.minFreeStorageBytes) ||
    !nonNegativeAmount(candidate.minVramBytes) ||
    !Number.isFinite(candidate.previewScale) ||
    candidate.previewScale <= 0 ||
    candidate.previewScale > 1 ||
    !Number.isFinite(candidate.qualityScore)
  )
    return "candidate limits";
  return null;
}

function candidateFits(
  candidate: ResourceCandidate,
  estimate: ResourceEstimateRange,
  environment: ResourceEnvironment,
): boolean {
  if (
    environment.memory.availableBytes <
    Math.max(candidate.minAvailableRamBytes, estimate.memoryBytes.max)
  )
    return false;
  if (
    totalFreeStorage(environment) <
    Math.max(candidate.minFreeStorageBytes, estimate.storageBytes.max)
  )
    return false;
  if (candidate.requiresGpu && environment.gpus.length === 0) return false;
  if (
    candidate.minVramBytes > 0 &&
    !environment.gpus.some((gpu) => gpu.vramBytes >= candidate.minVramBytes)
  )
    return false;
  if (
    candidate.requiredBackends.some((backend) => !environment.availableBackends.includes(backend))
  )
    return false;
  return true;
}

function isInstalled(candidate: ResourceCandidate, environment: ResourceEnvironment): boolean {
  const collection =
    candidate.role === "model"
      ? environment.installedTools.models
      : candidate.role === "renderer"
        ? environment.installedTools.renderers
        : candidate.role === "solver"
          ? environment.installedTools.solvers
          : environment.installedTools.processors;
  return collection.includes(candidate.id);
}

function classifyHardware(environment: ResourceEnvironment): ResourceHardwareTier {
  const maxVram = Math.max(0, ...environment.gpus.map((gpu) => gpu.vramBytes));
  if (
    environment.cpu.logicalCores >= 16 &&
    environment.memory.totalBytes >= 32 * GB &&
    environment.memory.availableBytes >= 16 * GB &&
    maxVram >= 12 * GB
  )
    return "strong";
  if (
    environment.cpu.logicalCores >= 6 &&
    environment.memory.totalBytes >= 8 * GB &&
    environment.memory.availableBytes >= 4 * GB
  )
    return "medium";
  return "weak";
}

function successfulPlan(
  status: ResourcePlanStatus,
  hardwareTier: ResourceHardwareTier,
  estimate: ResourceEstimateRange,
  environment: ResourceEnvironment,
  selected: ResourceCandidate | null,
  fallback: ResourceCandidate | null,
  profile: ResourcePerformanceProfile | null,
  reasons: string[],
): ResourceRuntimeOutcome<ResourcePlan> {
  return {
    ok: true,
    data: {
      status,
      hardwareTier,
      estimate,
      selected,
      fallback,
      profile,
      reasons,
      evidenceClass: environment.evidenceClass,
    },
    evidence: [...environment.evidence, ...reasons],
  };
}

async function restoreSettings(
  host: ResourceSettingsHost,
  originals: ResourceSettings,
  signal?: AbortSignal,
): Promise<ResourceRuntimeOutcome<{ restored: true }>> {
  try {
    await host.writeSettings(originals, signal);
    if (!(await host.verifySettings(originals, signal))) {
      return {
        ok: false,
        reason: "Original settings were written but recovery verification failed.",
        evidence: ["restore:unverified"],
      };
    }
    return { ok: true, data: { restored: true }, evidence: ["restore:verified"] };
  } catch (error) {
    return {
      ok: false,
      reason: `Original settings could not be restored: ${errorMessage(error)}`,
      evidence: ["restore:failed"],
    };
  }
}

function safeCost(fixed: number, units: number, perUnit: number): number | null {
  const value = fixed + units * perUnit;
  return nonNegativeAmount(value) ? value : null;
}

function validRange(range: ResourceRange): boolean {
  return nonNegativeAmount(range.min) && nonNegativeAmount(range.max) && range.min <= range.max;
}

function positiveAmount(value: number): boolean {
  return nonNegativeAmount(value) && value > 0;
}

function nonNegativeAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function percentage(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function totalFreeStorage(environment: ResourceEnvironment): number {
  return environment.storage.reduce((total, drive) => total + drive.freeBytes, 0);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim()))].sort();
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatBytes(value: number): string {
  if (value < 1024) return `${Math.round(value)} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let amount = value / 1024;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${units[index]}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import { describe, expect, it, vi } from "vitest";
import {
  RESOURCE_GOVERNOR_RUNTIME_BOUNDARY,
  ResourceConcurrencyController,
  SYNTHETIC_RESOURCE_PROFILES,
  applyReversiblePerformanceProfile,
  discoverAndPlanResourceTask,
  discoverResourceEnvironment,
  estimateResourceTask,
  planResourceTask,
  type ResourceCandidate,
  type ResourceEnvironment,
  type ResourcePerformanceProfile,
  type ResourceSettings,
  type ResourceSettingsHost,
  type ResourceTask,
} from "../skills/resource-governor-runtime";

const GB = 1024 ** 3;
const MB = 1024 ** 2;

const candidates = (role: ResourceCandidate["role"]): ResourceCandidate[] => [
  {
    id: `${role}-lite`,
    role,
    quality: "preview",
    qualityScore: 1,
    minAvailableRamBytes: 1 * GB,
    minFreeStorageBytes: 1 * GB,
    requiresGpu: false,
    minVramBytes: 0,
    requiredBackends: [],
    maxParallelism: 1,
    previewScale: 0.4,
    changesEngineeringAccuracy: false,
  },
  {
    id: `${role}-balanced`,
    role,
    quality: "balanced",
    qualityScore: 2,
    minAvailableRamBytes: 6 * GB,
    minFreeStorageBytes: 5 * GB,
    requiresGpu: role !== "processor",
    minVramBytes: 4 * GB,
    requiredBackends: role === "processor" ? [] : ["webgpu"],
    maxParallelism: 3,
    previewScale: 0.7,
    changesEngineeringAccuracy: false,
  },
  {
    id: `${role}-full`,
    role,
    quality: "full",
    qualityScore: 3,
    minAvailableRamBytes: 24 * GB,
    minFreeStorageBytes: 20 * GB,
    requiresGpu: role !== "processor",
    minVramBytes: 16 * GB,
    requiredBackends: role === "processor" ? [] : ["cuda"],
    maxParallelism: 8,
    previewScale: 1,
    changesEngineeringAccuracy: false,
  },
];

const task = (
  role: ResourceCandidate["role"] = "model",
  over: Partial<ResourceTask> = {},
): ResourceTask => ({
  id: `${role}-task`,
  kind:
    role === "renderer"
      ? "render"
      : role === "solver"
        ? "solver"
        : role === "processor"
          ? "build"
          : "local_inference",
  role,
  workUnits: 100,
  basis: {
    fixedMemoryBytes: 256 * MB,
    memoryBytesPerUnit: { min: 1 * MB, max: 2 * MB },
    storageBytesPerUnit: { min: 10_000, max: 20_000 },
    millisecondsPerUnit: { min: 100, max: 200 },
  },
  candidates: candidates(role),
  accuracyCritical: role === "solver",
  checkpointable: true,
  cancellable: true,
  ...over,
});

const hostEnvironment = (over: Partial<ResourceEnvironment> = {}): ResourceEnvironment => ({
  ...SYNTHETIC_RESOURCE_PROFILES.medium,
  evidenceClass: "host_probe",
  evidence: ["native-probe:signed", "snapshot:sha256"],
  ...over,
});

describe("hardware discovery and bounded estimates", () => {
  it("accepts complete authenticated host evidence and normalizes backends", async () => {
    const result = await discoverResourceEnvironment({
      probe: vi.fn(async () => ({
        ...hostEnvironment(),
        availableBackends: ["webgpu", "cuda", "webgpu"],
      })),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.availableBackends).toEqual(["cuda", "webgpu"]);
    expect(result.evidence).toContain("native-probe:signed");
  });

  it("rejects incomplete hardware, load, storage and provenance evidence", async () => {
    const result = await discoverResourceEnvironment({
      probe: vi.fn(async () => ({
        ...hostEnvironment(),
        storage: [],
        evidence: [],
      })),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/storage|evidence/i);
  });

  it("computes explicit min/max memory, storage and duration ranges", () => {
    const result = estimateResourceTask(task());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.memoryBytes).toEqual({
      min: 256 * MB + 100 * MB,
      max: 256 * MB + 200 * MB,
    });
    expect(result.data.storageBytes).toEqual({ min: 1_000_000, max: 2_000_000 });
    expect(result.data.durationMs).toEqual({ min: 10_000, max: 20_000 });
    expect(result.data.basis).toMatch(/estimate, not a measurement/i);
  });
});

describe("repeatable weak, medium and strong selection", () => {
  it("uses the smaller local model and one concurrent task on weak hardware", () => {
    const result = planResourceTask(task("model"), SYNTHETIC_RESOURCE_PROFILES.weak);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.hardwareTier).toBe("weak");
    expect(result.data.status).toBe("fallback");
    expect(result.data.selected?.id).toBe("model-lite");
    expect(result.data.profile?.maxParallelism).toBe(1);
    expect(result.data.profile?.previewScale).toBe(0.4);
  });

  it("selects the balanced renderer with bounded parallelism on medium hardware", () => {
    const result = planResourceTask(task("renderer"), SYNTHETIC_RESOURCE_PROFILES.medium);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.hardwareTier).toBe("medium");
    expect(result.data.status).toBe("fallback");
    expect(result.data.selected?.id).toBe("renderer-balanced");
    expect(result.data.profile?.maxParallelism).toBeGreaterThanOrEqual(1);
    expect(result.data.profile?.maxParallelism).toBeLessThanOrEqual(3);
  });

  it("selects the full solver and preserves accuracy on strong hardware", () => {
    const result = planResourceTask(task("solver"), SYNTHETIC_RESOURCE_PROFILES.strong);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.hardwareTier).toBe("strong");
    expect(result.data.status).toBe("ready");
    expect(result.data.selected?.id).toBe("solver-full");
    expect(result.data.selected?.changesEngineeringAccuracy).toBe(false);
    expect(result.data.profile?.cancellationStrategy).toBe("cooperative_then_force_stop");
    expect(result.data.profile?.checkpointEveryMs).toBeGreaterThanOrEqual(30_000);
  });

  it("never chooses a solver candidate that changes engineering accuracy", () => {
    const unsafe = {
      ...candidates("solver")[2],
      id: "solver-unsafe-fast",
      qualityScore: 99,
      changesEngineeringAccuracy: true,
    };
    const result = planResourceTask(
      task("solver", { candidates: [unsafe, ...candidates("solver")] }),
      SYNTHETIC_RESOURCE_PROFILES.strong,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.selected?.id).toBe("solver-full");
    expect(result.data.selected?.changesEngineeringAccuracy).toBe(false);
  });

  it("defers hot or low-battery hosts before selecting a tool", () => {
    const hot = planResourceTask(task(), {
      ...SYNTHETIC_RESOURCE_PROFILES.strong,
      thermal: "hot",
    });
    const battery = planResourceTask(task(), {
      ...SYNTHETIC_RESOURCE_PROFILES.strong,
      power: { source: "battery", batteryPercent: 10 },
    });
    for (const result of [hot, battery]) {
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error("unreachable");
      expect(result.data.status).toBe("defer");
      expect(result.data.selected).toBeNull();
    }
  });

  it("refuses rather than inventing an installed or resource-compatible tool", () => {
    const result = planResourceTask(task("renderer"), {
      ...SYNTHETIC_RESOURCE_PROFILES.weak,
      installedTools: {
        ...SYNTHETIC_RESOURCE_PROFILES.weak.installedTools,
        renderers: [],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.data.status).toBe("refuse");
    expect(result.data.selected).toBeNull();
  });

  it("allows real-job preparation only from authenticated host-probe evidence", async () => {
    const synthetic = await discoverAndPlanResourceTask(task(), {
      probe: vi.fn(async () => SYNTHETIC_RESOURCE_PROFILES.medium),
    });
    expect(synthetic.ok).toBe(false);
    if (synthetic.ok) throw new Error("unreachable");
    expect(synthetic.reason).toMatch(/synthetic profile is test evidence only/i);

    const real = await discoverAndPlanResourceTask(task(), {
      probe: vi.fn(async () => hostEnvironment()),
    });
    expect(real.ok).toBe(true);
  });
});

describe("reversible profiles", () => {
  const profile: ResourcePerformanceProfile = {
    id: "profile-1",
    scope: "session",
    selectedToolId: "model-balanced",
    maxParallelism: 2,
    previewScale: 0.7,
    checkpointEveryMs: 60_000,
    warningThresholds: {
      memoryBytes: 8 * GB,
      freeStorageBytes: 10 * GB,
      thermal: "hot",
    },
    cancellationStrategy: "cooperative_then_force_stop",
    restoreRequired: true,
  };

  function settingsHost(initial: ResourceSettings): {
    host: ResourceSettingsHost;
    current: ResourceSettings;
    writes: ResourceSettings[];
  } {
    const state = { current: { ...initial }, writes: [] as ResourceSettings[] };
    return {
      get current() {
        return state.current;
      },
      get writes() {
        return state.writes;
      },
      host: {
        async readSettings(keys) {
          return Object.fromEntries(
            keys.map((key) => [key, state.current[key]]),
          ) as ResourceSettings;
        },
        async writeSettings(next) {
          state.writes.push({ ...next });
          state.current = { ...state.current, ...next };
        },
        async verifySettings(expected) {
          return Object.entries(expected).every(
            ([key, value]) => state.current[key as keyof ResourceSettings] === value,
          );
        },
      },
    };
  }

  it("records originals, verifies the profile, then restores and verifies originals", async () => {
    const state = settingsHost({
      "model.max_context": 8192,
      "runtime.max_parallelism": 4,
    });
    const result = await applyReversiblePerformanceProfile(
      profile,
      { "model.max_context": 4096, "runtime.max_parallelism": 2 },
      state.host,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(state.current).toMatchObject({
      "model.max_context": 4096,
      "runtime.max_parallelism": 2,
    });
    const restored = await result.data.restore();
    expect(restored.ok).toBe(true);
    expect(state.current).toMatchObject({
      "model.max_context": 8192,
      "runtime.max_parallelism": 4,
    });
  });

  it("rolls back immediately when independent profile verification fails", async () => {
    const state = settingsHost({ "renderer.preview_scale": 1 });
    const verify = vi.spyOn(state.host, "verifySettings");
    verify.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const result = await applyReversiblePerformanceProfile(
      profile,
      { "renderer.preview_scale": 0.5 },
      state.host,
    );
    expect(result.ok).toBe(false);
    expect(state.current["renderer.preview_scale"]).toBe(1);
    expect(state.writes).toHaveLength(2);
  });
});

describe("bounded concurrency and cancellation", () => {
  it("rejects duplicate and over-limit leases, then frees capacity on release", () => {
    const controller = new ResourceConcurrencyController(1);
    const first = controller.acquire("one");
    expect(first.ok).toBe(true);
    expect(controller.acquire("one").ok).toBe(false);
    expect(controller.acquire("two").ok).toBe(false);
    if (!first.ok) throw new Error("unreachable");
    first.data.release();
    expect(controller.acquire("two").ok).toBe(true);
  });

  it("honours AbortSignal and emergency stop without leaving active work", () => {
    const controller = new ResourceConcurrencyController(2);
    const abort = new AbortController();
    const first = controller.acquire("one", abort.signal);
    const second = controller.acquire("two");
    if (!first.ok || !second.ok) throw new Error("unreachable");
    abort.abort();
    expect(first.data.isCancelled()).toBe(true);
    expect(controller.activeCount).toBe(1);
    expect(controller.emergencyStop()).toEqual(["two"]);
    expect(second.data.isCancelled()).toBe(true);
    expect(controller.activeCount).toBe(0);
    expect(controller.acquire("three").ok).toBe(false);
    controller.resume();
    expect(controller.acquire("three").ok).toBe(true);
    expect(RESOURCE_GOVERNOR_RUNTIME_BOUNDARY).toMatch(/authenticated native probe/i);
  });
});

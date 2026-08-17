const MODEL_ENGINE_LOCK = "ocade-browser-model-engine-v1";
const WARMUP_CHANNEL = "ocade-browser-model-warmup-v1";
const WARMUP_STATE_KEY = "ocade:landing-model-warmup:v1";

/** Starts early enough that a genuine two-second visit has already begun work. */
export const LANDING_MODEL_WARMUP_DELAY_MS = 900;

export type LandingWarmupPhase =
  | "idle"
  | "scheduled"
  | "warming"
  | "ready"
  | "partial"
  | "deferred"
  | "unsupported"
  | "error";

export interface LandingWarmupState {
  phase: LandingWarmupPhase;
  engine?: "webgpu" | "wasm";
  progress?: number;
  reason?: string;
  updatedAt: number;
}

interface NetworkInformationLike extends EventTarget {
  saveData?: boolean;
  effectiveType?: string;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
}

interface LockManagerLike {
  request<T>(
    name: string,
    options: { ifAvailable: true; mode: "exclusive" },
    callback: (lock: unknown | null) => Promise<T> | T,
  ): Promise<T>;
}

interface NavigatorWithLocks extends Navigator {
  locks?: LockManagerLike;
}

let scheduled = false;
let activeWarmup: Promise<void> | null = null;
let currentState: LandingWarmupState = { phase: "idle", updatedAt: 0 };
const subscribers = new Set<(state: LandingWarmupState) => void>();

function getConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

export function landingWarmupDecision(input: {
  online: boolean;
  saveData: boolean;
  hasWebLocks: boolean;
}): { start: boolean; reason?: string } {
  if (!input.online) return { start: false, reason: "offline" };
  // Save-Data is an explicit user instruction. OCADE never burns hundreds of
  // megabytes behind a preference whose entire purpose is to prevent that.
  if (input.saveData) return { start: false, reason: "save-data" };
  // The browser-model runtime promises one engine per origin. Warming without
  // the same lock would break that promise the moment two landing tabs opened.
  if (!input.hasWebLocks) return { start: false, reason: "no-web-locks" };
  return { start: true };
}

function persistState(state: LandingWarmupState) {
  currentState = state;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(WARMUP_STATE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing / storage denial should not break the landing page.
    }
  }
  for (const listener of subscribers) listener(state);
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const channel = new BroadcastChannel(WARMUP_CHANNEL);
      channel.postMessage(state);
      channel.close();
    } catch {
      // Cross-tab progress is a convenience, never a requirement to cache.
    }
  }
}

function rememberedState(): LandingWarmupState | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const value = localStorage.getItem(WARMUP_STATE_KEY);
    if (!value) return null;
    const parsed = JSON.parse(value) as Partial<LandingWarmupState>;
    if (typeof parsed.phase !== "string" || typeof parsed.updatedAt !== "number") return null;
    return parsed as LandingWarmupState;
  } catch {
    return null;
  }
}

export function getLandingWarmupState(): LandingWarmupState {
  return rememberedState() ?? currentState;
}

export function subscribeLandingWarmup(listener: (state: LandingWarmupState) => void) {
  subscribers.add(listener);
  listener(getLandingWarmupState());
  return () => subscribers.delete(listener);
}

async function requestPersistentStorage() {
  try {
    await navigator.storage?.persist?.();
  } catch {
    // Browsers are allowed to deny persistence silently. The model is still
    // cached normally and can be repaired/re-downloaded if the browser evicts it.
  }
}

async function warmWebGpu(): Promise<{
  available: boolean;
  ready: boolean;
  progress: number;
}> {
  const { BrowserWebGpuAdapter } = await import("./adapters/browser-webgpu");
  let progress = 0;
  const adapter = new BrowserWebGpuAdapter({
    onProgress: (event) => {
      if (typeof event.fraction === "number") progress = Math.max(progress, event.fraction);
      persistState({ phase: "warming", engine: "webgpu", progress, updatedAt: Date.now() });
    },
  });

  try {
    const availability = await adapter.probe();
    if (!availability.available) return { available: false, ready: false, progress: 0 };
    await adapter.preload();
    // WebLLM reports 1.0 after its cached model/runtime preparation completes.
    return { available: true, ready: progress >= 0.995, progress };
  } finally {
    // The landing page is a cache warmer, not an inference session. Releasing
    // the worker unloads GPU/RAM while IndexedDB keeps the downloaded model.
    await adapter.dispose();
  }
}

async function warmWasmWeights(): Promise<{ ready: boolean; progress: number }> {
  const [catalogue, storeModule, downloadModule] = await Promise.all([
    import("./browser-catalogue"),
    import("./model-store"),
    import("./model-download"),
  ]);

  if (!storeModule.ModelStore.isSupported()) return { ready: false, progress: 0 };

  const tier = catalogue.WASM_TIERS[0];
  const key = catalogue.storageKeyFor(tier);
  const publisherUrl = catalogue.ggufUrl(tier);
  if (!key || !publisherUrl) return { ready: false, progress: 0 };

  const stored = await storeModule.modelStore.readMeta(key);
  const storedBytes = await storeModule.modelStore.sizeOf(key);
  if (stored?.verified === true && storedBytes > 0) return { ready: true, progress: 1 };

  const localUrl = catalogue.sameOriginGgufUrl(tier);
  const source = await downloadModule.preferredWeightsUrl(localUrl, publisherUrl);
  let progress = 0;
  const result = await downloadModule.downloadModel({
    key,
    url: source.url,
    expectedBytes: tier.downloadBytes,
    sha256: catalogue.sha256For(tier),
    onProgress: (event) => {
      if (typeof event.fraction === "number") progress = Math.max(progress, event.fraction);
      persistState({ phase: "warming", engine: "wasm", progress, updatedAt: Date.now() });
    },
  });
  return { ready: result.ok, progress: result.ok ? 1 : progress };
}

async function performWarmup() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;

  const locks = (navigator as NavigatorWithLocks).locks;
  const connection = getConnection();
  const decision = landingWarmupDecision({
    online: navigator.onLine,
    saveData: connection?.saveData === true,
    hasWebLocks: typeof locks?.request === "function",
  });

  if (!decision.start || !locks) {
    persistState({
      phase: decision.reason === "no-web-locks" ? "unsupported" : "deferred",
      reason: decision.reason,
      updatedAt: Date.now(),
    });
    return;
  }

  await locks.request(MODEL_ENGINE_LOCK, { ifAvailable: true, mode: "exclusive" }, async (lock) => {
    if (!lock) {
      // Another OCADE tab already owns the model engine. Do not create a second
      // model copy just because the landing page also wants to warm it.
      persistState({
        phase: "deferred",
        reason: "another-tab-owns-engine",
        updatedAt: Date.now(),
      });
      return;
    }

    persistState({ phase: "warming", engine: "webgpu", progress: 0, updatedAt: Date.now() });
    try {
      const gpu = await warmWebGpu();
      if (gpu.ready) {
        await requestPersistentStorage();
        persistState({ phase: "ready", engine: "webgpu", progress: 1, updatedAt: Date.now() });
        return;
      }

      if (gpu.available) {
        // A usable WebGPU engine began warming but did not finish. Keep the
        // partial WebLLM cache and resume it later; do NOT immediately download
        // a second 491 MB WASM model on the same visit.
        persistState({
          phase: "partial",
          engine: "webgpu",
          progress: gpu.progress,
          reason: "webgpu-warmup-incomplete-will-resume",
          updatedAt: Date.now(),
        });
        return;
      }

      // WebGPU is genuinely unavailable. Cache the managed CPU fallback without
      // loading it into an inference runtime, keeping RAM use bounded.
      const wasm = await warmWasmWeights();
      if (wasm.ready) {
        await requestPersistentStorage();
        persistState({ phase: "ready", engine: "wasm", progress: 1, updatedAt: Date.now() });
      } else {
        persistState({
          phase: "partial",
          engine: "wasm",
          progress: wasm.progress,
          reason: "wasm-warmup-incomplete-will-resume",
          updatedAt: Date.now(),
        });
      }
    } catch (error) {
      persistState({
        phase: "partial",
        progress: getLandingWarmupState().progress ?? 0,
        reason: error instanceof Error ? error.message : String(error),
        updatedAt: Date.now(),
      });
    }
  });
}

/**
 * Start once per page context. The promise intentionally outlives the landing
 * React component, so a client-side navigation to /demo/ocade does not cancel
 * a model cache that has already started.
 */
export function scheduleLandingModelWarmup() {
  if (typeof window === "undefined" || scheduled) return;
  scheduled = true;

  const prior = rememberedState();
  // A confirmed cache should not be re-instantiated on every marketing visit.
  if (prior?.phase === "ready") return;

  persistState({ phase: "scheduled", updatedAt: Date.now() });
  window.setTimeout(() => {
    if (activeWarmup) return;
    activeWarmup = performWarmup().finally(() => {
      activeWarmup = null;
    });
  }, LANDING_MODEL_WARMUP_DELAY_MS);
}

/**
 * A lost/offline first attempt is not terminal. The page calls this when the
 * browser reports connectivity again; partial model data already in IndexedDB
 * or OPFS is left in place so the model downloader can resume from it.
 */
export function retryLandingModelWarmup() {
  if (typeof window === "undefined" || activeWarmup) return;
  const state = getLandingWarmupState();
  if (state.phase === "ready") return;
  activeWarmup = performWarmup().finally(() => {
    activeWarmup = null;
  });
}

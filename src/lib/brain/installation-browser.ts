/**
 * The one installation authority this browser tab uses, wired to real things.
 *
 * `installation-authority.ts` is the machine and knows nothing about WebGPU,
 * wllama, OPFS or Web Locks. This is where those are supplied, in one place, so
 * there is exactly one construction of the authority in the whole application
 * and no surface can accidentally build a second one.
 *
 * WHAT IS DECIDED HERE
 *
 *  - **The ladder.** Which ways this device could run OCADE, strongest first,
 *    each with a measured reason. A rung is only declared unavailable after
 *    something was actually checked.
 *  - **The sources.** Where the bytes come from, OCADE's own distribution
 *    first. Every source is held to the same committed digest.
 *  - **Ownership.** One tab installs; the others watch its progress over a
 *    BroadcastChannel. Web Locks decides which, because the browser releases a
 *    lock when a page closes or is discarded, so failover is a platform
 *    property rather than a heartbeat this code could get wrong.
 */

import {
  ModelInstallationAuthority,
  type CapabilityPath,
  type CapabilityRung,
  type InstallState,
  type InstallTarget,
} from "./installation-authority";
import { modelVault } from "./model-vault";
import { ModelStore, modelStore } from "./model-store";
import { sourceLadder } from "./download-plan";
import {
  WASM_TIERS,
  WEBGPU_TIERS,
  resolvedFor,
  sameOriginGgufUrl,
  ggufUrl,
  sha256For,
  storageKeyFor,
  runtimeMemoryBytes,
  type BrowserModelTier,
} from "./browser-catalogue";

const INSTALL_LOCK = "ocade.model.install";
const INSTALL_CHANNEL = "ocade.model.install.bus";

/**
 * OCADE's own model distribution, when this deployment has one.
 *
 * Set to the base of an immutable, versioned object-storage path served through
 * a CDN — see `docs/MODEL_DISTRIBUTION.md` for the bucket layout and the cache
 * headers the artifacts must carry. Absent, the ladder simply starts one rung
 * lower and a plain deployment keeps working with no configuration, which is
 * what makes this safe to leave unset.
 */
function ocadeCdnBase(): string | null {
  try {
    const configured = (import.meta.env?.VITE_OCADE_MODEL_CDN as string | undefined) ?? "";
    const trimmed = configured.trim().replace(/\/+$/, "");
    if (!trimmed) return null;
    // Only ever https, and only ever an absolute origin. A relative or plain
    // http value here would silently downgrade every first run.
    const url = new URL(trimmed);
    return url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

/** The CDN path for one tier's artifact, versioned so it can be immutable. */
export function cdnUrlFor(tier: BrowserModelTier): string | null {
  const base = ocadeCdnBase();
  const entry = resolvedFor(tier);
  if (!base || !entry) return null;
  return `${base}/models/${encodeURIComponent(tier.version)}/${encodeURIComponent(entry.path)}`;
}

/* ------------------------------------------------------------- the ladder -- */

/**
 * Is WebGPU usable, and how much can it allocate at once?
 *
 * `maxBufferSize` is the largest single ALLOCATION, not a memory budget —
 * browsers report a flat 2 GB on almost everything, including integrated
 * graphics that cannot really run the larger tiers. It is used only to EXCLUDE
 * a tier that certainly will not fit, never to justify one.
 */
async function probeWebGpu(): Promise<{ ok: boolean; bytes: number | null; why: string }> {
  const gpu = (globalThis.navigator as Navigator & { gpu?: GPU } | undefined)?.gpu;
  if (!gpu) {
    return { ok: false, bytes: null, why: "this browser cannot use the graphics card" };
  }
  try {
    const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) {
      return { ok: false, bytes: null, why: "the graphics card did not offer an adapter" };
    }
    const limit = adapter.limits?.maxBufferSize;
    return {
      ok: true,
      bytes: typeof limit === "number" ? Number(limit) : null,
      why: "the graphics card offered an adapter",
    };
  } catch (error) {
    return {
      ok: false,
      bytes: null,
      why: `the graphics card could not be prepared: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

/**
 * Can this page run multithreaded WebAssembly?
 *
 * IT ASKS THE PLATFORM RATHER THAN ASSUMING. `crossOriginIsolated` is the only
 * honest answer: `SharedArrayBuffer` can exist and still be unusable by the
 * threaded build without isolation, and isolation depends on response headers
 * this code cannot see from here.
 *
 * WHY THE APP IS NOT ISOLATED BY DEFAULT, AND WHAT CHANGED. The note in
 * `browser-wasm.ts` said cross-origin isolation was avoided because COOP
 * `same-origin` severs `window.opener` and would break the sign-in popups. That
 * reasoning no longer describes this application: `auth.tsx` signs in through a
 * FULL-PAGE REDIRECT to `/auth/callback`, not a popup, and COOP does not affect
 * a redirect. So the blocker is COEP rather than COOP, and COEP is a real
 * constraint — every cross-origin subresource would need CORP or CORS — which
 * is a deployment-wide change that has to be proven against the live site
 * rather than assumed here.
 *
 * The honest position, therefore: the threaded rung is offered the moment the
 * platform says isolation is in force, and the single-threaded rung is always
 * there underneath. Nothing claims threads it does not have.
 */
function threadsAvailable(): boolean {
  return (
    typeof SharedArrayBuffer === "function" &&
    typeof globalThis.crossOriginIsolated === "boolean" &&
    globalThis.crossOriginIsolated
  );
}

/**
 * Every way this device might run OCADE, strongest first.
 *
 * THE POINT OF A LADDER IS THAT ONE FAILURE IS NOT A REFUSAL. A device that
 * cannot allocate enough graphics memory for the standard context gets a
 * reduced one; a device with no usable graphics path gets the processor; a
 * device that cannot do either is TOLD WHAT WAS ACTUALLY WRONG rather than
 * "unsupported". A refusal is reached only after every rung has been measured.
 */
export async function probeBrowserCapabilities(): Promise<CapabilityRung[]> {
  const rungs: CapabilityRung[] = [];

  if (typeof window === "undefined") {
    return [{ path: "wasm_single", available: false, why: "there is no browser here" }];
  }

  const gpu = await probeWebGpu();
  const smallest = WEBGPU_TIERS[0];
  const needed = smallest ? runtimeMemoryBytes(smallest) : 0;

  if (gpu.ok) {
    /*
     * A CONSERVATIVE ALLOCATION LIMIT MUST NOT BE A REFUSAL ON ITS OWN.
     *
     * When the reported ceiling is below what the standard context needs, the
     * device does not lose the graphics path — it drops to the reduced-context
     * rung, which is a genuinely smaller allocation rather than the same one
     * hoped about. Only after that has also been tried does the processor
     * become the answer.
     */
    const fits = gpu.bytes === null || needed === 0 || gpu.bytes >= needed;
    rungs.push({ path: "webgpu", available: fits, why: gpu.why });
    rungs.push({
      path: "webgpu_reduced",
      available: true,
      why: fits
        ? "a smaller working set, if the standard one does not start"
        : "the reported allocation limit is below the standard working set, so a smaller one is tried",
    });
  } else {
    rungs.push({ path: "webgpu", available: false, why: gpu.why });
    rungs.push({ path: "webgpu_reduced", available: false, why: gpu.why });
  }

  const wasmOk = typeof WebAssembly !== "undefined";
  const wasmWhy = wasmOk
    ? "the processor can run OCADE's engine"
    : "this browser cannot run OCADE's engine on the processor";

  /*
   * THE THREADED RUNG IS OFFERED ONLY WHEN BOTH HALVES ARE REAL.
   *
   * Isolation alone is not enough — the installed library ships only the
   * single-threaded binary, and its multi-thread build is expected from a CDN
   * that a local-first product will not fetch its engine from. So the rung
   * exists exactly when this page is isolated AND the deployment self-hosts the
   * threaded build. Anything less and the single-threaded rung below is the
   * honest answer rather than a faster one that would not start.
   */
  const { selfHostedMultiThreadWasm } = await import("./adapters/browser-wasm");
  const threadedBuild = wasmOk && threadsAvailable() ? await selfHostedMultiThreadWasm() : null;
  rungs.push({
    path: "wasm_threaded",
    available: wasmOk && threadedBuild !== null,
    why: !wasmOk
      ? wasmWhy
      : !threadsAvailable()
        ? "this page is not isolated, so it can only use one processor core"
        : threadedBuild === null
          ? "this deployment does not host the multi-core engine build"
          : "this page can use several processor cores",
  });
  rungs.push({ path: "wasm_single", available: wasmOk, why: wasmWhy });

  /*
   * STORAGE IS A HARD GATE ON EVERY BROWSER RUNG, and it is applied here rather
   * than discovered as a failed write halfway through a transfer. A browser
   * that will not keep a file between visits cannot hold an engine at all, and
   * saying so up front is the difference between a clear explanation and a
   * progress bar that dies at 60%.
   */
  if (!ModelStore.isSupported()) {
    const why =
      "this browser will not let OCADE keep anything between visits, which an on-device engine needs";
    for (const rung of rungs) {
      if (rung.path !== "desktop_bridge" && rung.path !== "paired_device") {
        rung.available = false;
        rung.why = why;
      }
    }
  }

  return rungs;
}

/* ------------------------------------------------------------- the target -- */

/**
 * What a path needs downloaded, if anything.
 *
 * The WebGPU rungs return null, and that is a statement rather than an
 * omission: their runtime fetches and caches its own shards, so OCADE has no
 * single file to stream and no digest of its own to enforce there. It says so
 * instead of pretending — and the runtime still reports through the authority,
 * so there is one progress story either way.
 *
 * The processor rungs return a real target, because that is the artifact OCADE
 * distributes, sizes, digests and verifies itself.
 */
export async function resolveInstallTarget(path: CapabilityPath): Promise<InstallTarget | null> {
  if (path === "desktop_bridge" || path === "paired_device") return null;
  if (path === "webgpu" || path === "webgpu_reduced") return null;

  const tier = WASM_TIERS[0];
  const entry = resolvedFor(tier);
  const publisher = ggufUrl(tier);
  if (!entry || !publisher) return null;

  return {
    version: tier.version,
    totalBytes: entry.sizeBytes,
    sha256: sha256For(tier),
    sources: sourceLadder({
      cdnUrl: cdnUrlFor(tier),
      sameOriginUrl: sameOriginGgufUrl(tier),
      publisherUrl: publisher,
    }),
    // The key this artifact lived under before storage was versioned. A user
    // who already downloaded it must not pay for it twice.
    legacyKey: storageKeyFor(tier),
  };
}

/* ------------------------------------------------------- cross-tab ownership */

/**
 * Run `work` only if this tab wins the install lock.
 *
 * Web Locks rather than a timestamp in localStorage: the lock is held by the
 * page, so the browser releases it when that page closes, crashes or is
 * discarded under memory pressure. The queue is the browser's too, so exactly
 * one waiter is promoted and there is no window in which two tabs both believe
 * they won.
 *
 * `ifAvailable` means a losing tab returns IMMEDIATELY as a follower rather
 * than queueing behind a transfer that may take minutes. It watches the owner's
 * progress instead, which is what a second tab should show.
 */
async function acquireInstallLock(work: () => Promise<void>): Promise<boolean> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks?.request) {
    await work();
    return true;
  }
  let won = false;
  await locks.request(INSTALL_LOCK, { ifAvailable: true }, async (lock) => {
    if (!lock) return;
    won = true;
    await work();
  });
  return won;
}

/** State published to, and received from, the other tabs. */
function createBus(onState: (state: InstallState) => void): (state: InstallState) => void {
  if (typeof BroadcastChannel !== "function") return () => {};
  let channel: BroadcastChannel;
  try {
    channel = new BroadcastChannel(INSTALL_CHANNEL);
  } catch {
    return () => {};
  }
  channel.onmessage = (event: MessageEvent<InstallState>) => {
    if (event.data && typeof event.data === "object") onState(event.data);
  };
  return (state) => {
    try {
      channel.postMessage(state);
    } catch {
      /* A closed channel simply stops sharing; it never fails an install. */
    }
  };
}

/* ---------------------------------------------------------------- the one -- */

let authority: ModelInstallationAuthority | null = null;

/**
 * The application's single installation authority.
 *
 * Lazily constructed and then permanent. Every surface calls this; nothing
 * constructs `ModelInstallationAuthority` anywhere else, which is what makes
 * "one canonical authority" a fact about the code rather than a convention
 * somebody has to follow.
 */
export function installationAuthority(): ModelInstallationAuthority {
  if (authority) return authority;

  const created: ModelInstallationAuthority = new ModelInstallationAuthority({
    vault: modelVault,
    fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, init)) as typeof fetch,
    probeCapabilities: probeBrowserCapabilities,
    resolveTarget: resolveInstallTarget,
    activateRuntime: (path, version, report) => activateBrowserRuntime(path, version, report),
    storageHeadroom: async () => {
      const nav = globalThis.navigator as Navigator | undefined;
      if (!nav?.storage?.estimate) return null;
      try {
        const estimate = await nav.storage.estimate();
        if (estimate.quota === undefined) return null;
        return Math.max(0, estimate.quota - (estimate.usage ?? 0));
      } catch {
        return null;
      }
    },
    requestPersistence: () => modelStore.requestPersistence(),
    acquireLock: acquireInstallLock,
    broadcast: (state) => bus(state),
  });

  const bus = createBus((state) => created.observe(state));
  authority = created;
  return created;
}

/**
 * Load the engine for a path and prove it starts.
 *
 * Imported lazily and only for the rung being tried, so a device that routes to
 * the graphics engine never downloads the processor runtime's code and the
 * other way round. Neither library is in the first-paint bundle.
 */
async function activateBrowserRuntime(
  path: CapabilityPath,
  version: string,
  report: (progress: { stage: "downloading" | "loading"; fraction: number | null }) => void,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const { activateRuntimeForPath } = await import("./runtime-activation");
    return await activateRuntimeForPath(path, version, report);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The engine could not be started.",
    };
  }
}

/** For tests, and for a deliberate teardown in a diagnostic surface. */
export function resetInstallationAuthorityForTests(): void {
  authority = null;
}

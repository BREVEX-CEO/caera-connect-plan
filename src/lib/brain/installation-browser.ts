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
import { planThreads, readThreadSignals } from "./wasm-threads";
import { sha256OfBlobStreaming } from "./streaming-digest";
import { onBackgroundFetchStaged } from "./background-fetch";
import {
  OFFLINE_MODEL,
  expectedSha256,
  publisherUrl,
  resolved,
  sameOriginUrl,
  storageKey,
} from "./model-catalogue";

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

/** The CDN path for the artifact, versioned so it can be served immutable. */
export function cdnUrl(): string | null {
  const base = ocadeCdnBase();
  const entry = resolved();
  if (!base || !entry) return null;
  return `${base}/models/${encodeURIComponent(OFFLINE_MODEL.version)}/${encodeURIComponent(entry.path)}`;
}

/* ------------------------------------------------------------- the ladder -- */

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

  const wasmOk = typeof WebAssembly !== "undefined";
  const wasmWhy = wasmOk
    ? "the processor can run OCADE's engine"
    : "this browser cannot run OCADE's engine on the processor";

  /*
   * THE THREADED RUNG IS A HEADERS QUESTION, AND NOTHING ELSE.
   *
   * This used to require a self-hosted `multi-thread/wllama.wasm` as well as
   * isolation, because the code believed the installed library shipped only a
   * single-threaded binary. It ships ONE unified binary that runs on one core
   * or several depending on `n_threads` and on whether `SharedArrayBuffer` is
   * usable — so the file was never missing and the rung was refused for a
   * reason that had stopped being the reason.
   *
   * `crossOriginIsolated` is the whole of the test now, and it is a fact the
   * platform reports rather than something this code can talk itself into.
   */
  const threadPlan = planThreads(readThreadSignals());
  rungs.push({
    path: "wasm_threaded",
    available: wasmOk && threadPlan.multithreaded,
    why: wasmOk ? threadPlan.because : wasmWhy,
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
      rung.available = false;
      rung.why = why;
    }
  }

  return rungs;
}

/* ------------------------------------------------------------- the target -- */

/**
 * What a path needs downloaded.
 *
 * Both rungs answer with the same artifact, which is the point: OCADE
 * distributes, sizes, digests and verifies one file, and the rung only decides
 * how many cores read it. A second backend would mean a second target, and
 * install-once cannot survive two.
 */
export async function resolveInstallTarget(path: CapabilityPath): Promise<InstallTarget | null> {
  void path;
  const entry = resolved();
  const publisher = publisherUrl();
  if (!entry || !publisher) return null;

  return {
    version: OFFLINE_MODEL.version,
    totalBytes: entry.sizeBytes,
    sha256: expectedSha256(),
    sources: sourceLadder({
      cdnUrl: cdnUrl(),
      sameOriginUrl: sameOriginUrl(),
      publisherUrl: publisher,
    }),
    // The key this artifact lived under before storage was versioned. A person
    // who already downloaded it must not pay for it twice.
    legacyKey: storageKey(),
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
 * Waiters queue behind the owner while watching its BroadcastChannel progress.
 * This matters when the owner navigates or closes at the exact moment a new
 * document starts: an `ifAvailable` probe used to return immediately and leave
 * the new document permanently showing "already preparing" if the owner never
 * got a chance to broadcast one last state. Web Locks promotes the waiter when
 * the owner finishes or disappears, and the promoted document verifies the
 * durable artifact before activating it in its own JavaScript context. That is
 * a zero-download reopen, not a second transfer.
 */
async function acquireInstallLock(work: () => Promise<void>): Promise<boolean> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks?.request) {
    await work();
    return true;
  }
  let won = false;
  await locks.request(INSTALL_LOCK, async (lock) => {
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
    hashBlob: (blob, signal) => sha256OfBlobStreaming(blob, { signal }),
    acquireLock: acquireInstallLock,
    broadcast: (state) => bus(state),
  });

  const bus = createBus((state) => created.observe(state));

  /*
   * A COMPLETED BACKGROUND TRANSFER IS A REASON TO LOOK, NOT A REASON TO TRUST.
   *
   * The service worker writes the bytes and says so. It does not hash them and
   * records nothing about them, so what arrives here is only "there is a file
   * where you expected one". `install()` then finds a complete artifact with no
   * proof beside it and streams a digest over it before anything is activated
   * -- the same check a foreground download gets, in the same place.
   */
  onBackgroundFetchStaged((ok) => {
    if (!ok) return;
    void created.install({ reason: "resumed" });
  });

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

/**
 * Turning a chosen capability path into a running engine.
 *
 * WHY THIS IS SEPARATE FROM THE ADAPTERS. The adapters know how to talk to
 * their runtimes; they do not get to decide WHETHER to start, WHICH tier, or
 * WHERE the weights came from. Those are the authority's decisions, and the
 * previous design let each adapter make them independently inside `preload()`
 * — which is how the same model came to be downloaded by two adapters, two
 * tabs and a keystroke handler at once.
 *
 * So this module is deliberately thin and deliberately the only door: it takes
 * a path the authority already chose, starts exactly that runtime, and records
 * which one is live so routing can send work to the same instance rather than
 * probing for a new one.
 *
 * THE WEIGHTS DO NOT COME FROM HERE EITHER. On the processor path the bytes are
 * read out of the vault — already downloaded, already digest-checked, already
 * activated — so the adapter cannot start a transfer of its own. That is the
 * whole reason the adapter now accepts a weights provider instead of owning a
 * downloader.
 */

import type { CapabilityPath } from "./installation-authority";
import type { BrainAdapter } from "./adapter";
import { modelVault } from "./model-vault";
import { recordInstallEvent } from "./install-telemetry";
import { WASM_TIERS, WEBGPU_TIERS, type BrowserModelTier } from "./browser-catalogue";

export interface RuntimeProgress {
  stage: "downloading" | "loading";
  fraction: number | null;
}

/**
 * The engine that is actually running, if any.
 *
 * Held at module scope because it is a property of the tab, not of a React
 * tree: a route change must not dispose an engine that took a minute to load,
 * and a second component mounting must not start a second one.
 */
let live: { path: CapabilityPath; adapter: BrainAdapter; version: string } | null = null;

/** The running engine, for routing. Null until the authority has started one. */
export function activeRuntime(): { path: CapabilityPath; adapter: BrainAdapter } | null {
  return live ? { path: live.path, adapter: live.adapter } : null;
}

/**
 * How much of the standard context a reduced-context attempt keeps.
 *
 * Half, because the KV cache is the part that scales with context and it is
 * usually what a constrained device runs out of. It is a REAL retry at a
 * genuinely smaller working set, not the same attempt with a different label —
 * the alternative, declaring the device unsupported on one conservative
 * allocation limit, refuses devices that would have worked.
 */
export const REDUCED_CONTEXT_FRACTION = 0.5;

export function reducedContextTokens(tier: BrowserModelTier): number {
  // Kept on a 256-token boundary so the number stays a sensible cache size.
  const reduced = Math.floor((tier.contextTokens * REDUCED_CONTEXT_FRACTION) / 256) * 256;
  return Math.max(1024, reduced);
}

/** Start the runtime for one path. Never starts two. */
export async function activateRuntimeForPath(
  path: CapabilityPath,
  version: string,
  report: (progress: RuntimeProgress) => void,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (live && live.path === path && live.version === version) return { ok: true };
  if (live) {
    // Swapping paths must not leave the previous engine resident: on the
    // graphics card that is the memory the new one is about to need.
    try {
      await live.adapter.dispose?.();
    } catch {
      /* Tearing down an engine that already died must not throw. */
    }
    live = null;
  }

  switch (path) {
    case "webgpu":
    case "webgpu_reduced":
      return startWebGpu(path, version, report);
    case "wasm_threaded":
    case "wasm_single":
      return startWasm(path, version, report);
    case "desktop_bridge":
      return startDesktopBridge(version);
    case "paired_device":
      return startPairedDevice(version);
  }
}

async function startWebGpu(
  path: "webgpu" | "webgpu_reduced",
  version: string,
  report: (progress: RuntimeProgress) => void,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const tier = WEBGPU_TIERS[0];
  if (!tier) return { ok: false, reason: "No graphics engine is configured." };

  const { BrowserWebGpuAdapter } = await import("./adapters/browser-webgpu");
  const { shareAcrossTabs } = await import("./adapters/shared-browser-engine");

  const adapter = new BrowserWebGpuAdapter({
    /*
     * The runtime's own wording is deliberately NOT forwarded. Its progress
     * text names shards and quantisation formats; a person preparing OCADE for
     * the first time is not debugging a runtime, so the numbers travel and the
     * vocabulary does not.
     */
    onProgress: (p) =>
      report({
        stage: p.fraction !== null && p.fraction >= 1 ? "loading" : "downloading",
        fraction: p.fraction,
      }),
    contextTokensOverride: path === "webgpu_reduced" ? reducedContextTokens(tier) : undefined,
  });

  const probe = await adapter.probe();
  if (!probe.available) return { ok: false, reason: probe.reason };

  try {
    const shared = shareAcrossTabs(adapter);
    await shared.preload?.();
    live = { path, adapter: shared, version };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The graphics engine could not start.",
    };
  }
}

async function startWasm(
  path: "wasm_threaded" | "wasm_single",
  version: string,
  report: (progress: RuntimeProgress) => void,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const tier = WASM_TIERS[0];
  if (!tier) return { ok: false, reason: "No processor engine is configured." };

  const { BrowserWasmAdapter } = await import("./adapters/browser-wasm");

  const adapter = new BrowserWasmAdapter({
    onProgress: (p) => report({ stage: "loading", fraction: p.fraction }),
    /*
     * THE ADAPTER IS HANDED THE BYTES; IT DOES NOT GO AND GET THEM.
     *
     * This is what stops a second transfer existing. The vault only returns an
     * artifact for a version its pointer names, and it only points at versions
     * whose digest matched — so an adapter cannot load anything the authority
     * has not already proven.
     */
    weightsProvider: async () => {
      const active = modelVault.activeVersion();
      if (active !== version) return null;
      return modelVault.readArtifact(version);
    },
    preferThreads: path === "wasm_threaded",
  });

  const probe = await adapter.probe();
  if (!probe.available) return { ok: false, reason: probe.reason };

  try {
    report({ stage: "loading", fraction: null });
    await adapter.load();

    /*
     * WHAT THE RUNTIME ACTUALLY DID, recorded once it can be asked.
     *
     * `planThreads` says what OCADE wanted; wllama's own feature detection
     * decides what it got, and the two can legitimately disagree — an isolated
     * page whose browser still fails the WebAssembly threads probe runs on one
     * core however many were requested. Recording the request instead of the
     * outcome is how a diagnostics surface starts claiming threads a device
     * does not have.
     */
    const outcome = adapter.threads();
    recordInstallEvent({
      kind: "threads",
      path,
      multithreaded: outcome.multithreaded,
      threads: outcome.threads,
    });

    live = { path, adapter, version };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The processor engine could not start.",
    };
  }
}

async function startDesktopBridge(
  version: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { DesktopBridgeAdapter } = await import("./adapters/desktop-bridge");
  const { devicePolicySnapshot } = await import("../use-device-policy");
  const adapter = new DesktopBridgeAdapter({ policy: devicePolicySnapshot });
  const probe = await adapter.probe();
  if (!probe.available) return { ok: false, reason: probe.reason };
  try {
    await adapter.preload?.();
    live = { path: "desktop_bridge", adapter, version };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The local engine could not start.",
    };
  }
}

async function startPairedDevice(
  version: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { PairedDesktopAdapter } = await import("./adapters/paired-desktop");
  const { pairedCredentials } = await import("./paired-credentials");
  const adapter = new PairedDesktopAdapter({ credentials: pairedCredentials });
  const probe = await adapter.probe();
  if (!probe.available) return { ok: false, reason: probe.reason };
  live = { path: "paired_device", adapter, version };
  return { ok: true };
}

/**
 * An adapter that is whatever the authority has actually started.
 *
 * WHY ROUTING CANNOT JUST BUILD ITS OWN. `use-brain` used to construct a
 * `BrowserWebGpuAdapter` and a `BrowserWasmAdapter` inside a `useMemo` and hand
 * them to the router. The authority now constructs the one it actually starts.
 * Leaving both in place would mean two adapter instances per tab — and on the
 * WebGPU path that is two copies of the weights resident on the graphics card,
 * which is the exact defect `shared-browser-engine.ts` was written to fix
 * across tabs, reintroduced within a single one.
 *
 * So routing gets this instead: a thin delegate holding no engine of its own.
 * When the authority has a live runtime it forwards to it; when it does not, it
 * reports unavailable with the reason the authority would give. There is
 * exactly one browser engine in a tab, and it is the one the authority chose.
 */
export function authorityBackedAdapter(id: "browser_webgpu" | "browser_wasm"): BrainAdapter {
  const matches = (path: CapabilityPath): boolean =>
    id === "browser_webgpu"
      ? path === "webgpu" || path === "webgpu_reduced"
      : path === "wasm_threaded" || path === "wasm_single";

  const current = (): BrainAdapter | null => {
    const running = activeRuntime();
    return running && matches(running.path) ? running.adapter : null;
  };

  return {
    id,
    displayName: id === "browser_webgpu" ? "OCADE Browser" : "OCADE Browser (compatibility)",
    async probe() {
      const adapter = current();
      if (adapter) return adapter.probe();
      return {
        available: false as const,
        code: "no_model" as const,
        /*
         * Deliberately the language of preparation rather than of failure. The
         * engine is not missing; it has not finished being prepared, and the
         * setup surface is already saying so with a percentage.
         */
        reason: "OCADE is still preparing this device.",
        remedies: [],
      };
    },
    async preload() {
      // Preparation belongs to the authority. A preload here would be the
      // second installer this whole design exists to remove.
      await current()?.preload?.();
    },
    async stream(messages, handlers) {
      const adapter = current();
      if (!adapter) {
        return {
          ok: false as const,
          failure: "unavailable" as const,
          reason: "OCADE is still preparing this device.",
        };
      }
      return adapter.stream(messages, handlers);
    },
    async dispose() {
      await disposeRuntime();
    },
  };
}

/** Tear the running engine down. Used by uninstall and by tests. */
export async function disposeRuntime(): Promise<void> {
  const current = live;
  live = null;
  try {
    await current?.adapter.dispose?.();
  } catch {
    /* An engine that already died must not throw on the way out. */
  }
}

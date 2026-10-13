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
function activeRuntime(): { path: CapabilityPath; adapter: BrainAdapter } | null {
  return live ? { path: live.path, adapter: live.adapter } : null;
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

  return startWasm(path, version, report);
}

async function startWasm(
  path: CapabilityPath,
  version: string,
  report: (progress: RuntimeProgress) => void,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { BrowserWasmAdapter } = await import("./adapters/browser-wasm");

  const adapter = new BrowserWasmAdapter({
    // The rung decides where the layers go. A failure to start here is not a
    // refusal: the authority moves down the ladder to the processor.
    gpuLayers: path === "webgpu" ? 99 : 0,
    /*
     * THE ADAPTER IS HANDED THE BYTES; IT DOES NOT GO AND GET THEM.
     *
     * This is what stops a second transfer existing. The vault only returns an
     * artifact for a version its pointer names, and it only points at versions
     * whose digest matched — so an adapter cannot load anything the authority
     * has not already proven.
     */
    weightsProvider: async () => {
      await modelVault.load();
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

    live = { path, adapter, version };
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "The processor engine could not start.",
    };
  }
}

/**
 * An adapter that is whatever the authority has actually started.
 *
 * WHY ROUTING CANNOT JUST BUILD ITS OWN. Chat used to construct an adapter of
 * its own inside a `useMemo` and hand it to a router. That meant two adapter
 * instances per tab and, on a device that had actually loaded weights, two
 * copies of them resident at once.
 *
 * So routing gets this instead: a thin delegate holding no engine of its own.
 * When the authority has a live runtime it forwards to it; when it does not, it
 * reports unavailable with the reason the authority would give. There is
 * exactly one browser engine in a tab, and it is the one the authority chose.
 */
export function authorityBackedAdapter(): BrainAdapter {
  const current = (): BrainAdapter | null => activeRuntime()?.adapter ?? null;

  /*
   * A MODEL ALREADY ON THIS DEVICE IS STARTED, AND WAITED FOR, WHEN IT IS ASKED FOR.
   *
   * Opening OCADE checks the stored model and starts the engine from it, which takes seconds;
   * a question in those seconds (or before preparation had even begun) was answered "still
   * preparing, try again" and dropped — the real model, offline, 13 Oct 2026. With verified
   * bytes on the device that start is only loading them, so it is joined or begun here. A
   * model still to be downloaded is never waited for: Automatic answers online meanwhile.
   */
  const started = async (): Promise<BrainAdapter | null> => {
    if (current()) return current();
    await modelVault.load();
    if (!modelVault.activeVersion()) return null;
    const { installationAuthority } = await import("./installation-browser");
    const authority = installationAuthority();
    await (authority.pending() ?? authority.install({ reason: "warm" })).catch(() => undefined);
    return current();
  };

  return {
    id: "browser_wasm",
    displayName: "OCADE Offline Intelligence",
    async probe() {
      const adapter = await started();
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
      const adapter = await started();
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

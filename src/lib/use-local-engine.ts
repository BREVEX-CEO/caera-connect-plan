import { useCallback, useEffect, useRef, useState } from "react";
import { discoverLocalModels, DEFAULT_LOCAL_BRIDGE_URL, type LocalDiscovery } from "./ocade-local";
import { guardedRead, TtlCache, isTimeoutError } from "./request-guard";

/**
 * The engine probe is a read-only capability check that several surfaces mount
 * at once (chat, Copilot panel, usage page). Sharing one short-lived cache and
 * a single in-flight call stops OCADE hammering the local runtime.
 */
const DISCOVERY_TTL_MS = 15_000;
const discoveryCache = new TtlCache<LocalDiscovery>(DISCOVERY_TTL_MS, 4);

export type LocalEngineStatus = "idle" | "checking" | "ready" | "unavailable";

export interface LocalEngineState extends LocalDiscovery {
  status: LocalEngineStatus;
  /** Pass `true` to bypass the short-lived cache and re-probe immediately. */
  refresh: (force?: boolean) => void;
}

/**
 * A raw loopback runtime is a packaged-desktop capability, not a fact inferred
 * from a web page being served on localhost. Browser WebGPU/WASM preparation
 * belongs to the installation authority; paired runtimes use the authenticated
 * paired adapter. Explicit diagnostics/model-management screens may still pass
 * `true` to inspect a user-requested loopback runtime.
 */
function packagedDesktopRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const host = window as Window & { __TAURI__?: unknown; __OCADE_DESKTOP__?: unknown };
  return Boolean(host.__TAURI__ || host.__OCADE_DESKTOP__);
}

/**
 * Detects and monitors the on-device OCADE Local engine (Ollama-compatible)
 * from the browser. Purely a read/health probe — no prompts are sent. Exposes
 * the discovered models (already classified into OCADE capability labels) and a
 * manual refresh. Raw model names stay internal to the discovery result.
 */
export function useLocalEngine(
  bridgeUrl: string = DEFAULT_LOCAL_BRIDGE_URL,
  enabled?: boolean,
): LocalEngineState {
  const probeEnabled = enabled ?? packagedDesktopRuntime();
  const [state, setState] = useState<LocalDiscovery>({ ok: false, reachable: false, models: [] });
  const [status, setStatus] = useState<LocalEngineStatus>("idle");
  const active = useRef(true);

  const refresh = useCallback(
    (force = false) => {
      if (!probeEnabled) {
        setStatus("idle");
        return;
      }
      if (force) discoveryCache.clear();
      setStatus("checking");
      void guardedRead({
        key: `local-engine:${bridgeUrl}`,
        fn: () => discoverLocalModels(bridgeUrl),
        /*
         * Wider than the discovery call's own per-request budget on purpose.
         * When this guard was the SHORTER of the two it cut discovery off
         * mid-probe and the UI reported "no local engine" for an engine that
         * was merely busy loading weights. The inner budgets are the real
         * deadline; this is only a backstop against a hung promise.
         */
        timeoutMs: 30_000,
        cache: discoveryCache,
      })
        .then((d) => {
          if (!active.current) return;
          setState(d);
          setStatus(d.ok ? "ready" : "unavailable");
        })
        .catch((e: unknown) => {
          if (!active.current) return;
          /*
           * A timeout and a refused connection need DIFFERENT actions from the
           * user, so collapsing both into "did not respond" hides the remedy:
           *  - timeout  → the engine is reachable but busy, often loading a
           *               large model for the first time. Waiting works.
           *  - anything else → nothing is listening. It has to be started.
           */
          const timedOut = isTimeoutError(e);
          setState({
            ok: false,
            // A timeout means something WAS listening — reporting it as
            // unreachable would be wrong.
            reachable: timedOut,
            models: [],
            reason: timedOut
              ? "The local engine is taking longer than expected — it may still be loading a model. Try again in a moment."
              : "No local engine is running on this computer.",
          });
          setStatus("unavailable");
        });
    },
    [bridgeUrl, probeEnabled],
  );

  useEffect(() => {
    active.current = true;
    refresh();
    return () => {
      active.current = false;
    };
  }, [refresh]);

  return { ...state, status, refresh };
}

import { useCallback, useMemo, useRef } from "react";
import { DesktopBridgeAdapter } from "./adapters/desktop-bridge";
import { BrowserWebGpuAdapter } from "./adapters/browser-webgpu";
import { shareAcrossTabs } from "./adapters/shared-browser-engine";
import { BrowserWasmAdapter } from "./adapters/browser-wasm";
import { PairedDesktopAdapter } from "./adapters/paired-desktop";
import { pairedCredentials, hasPairing } from "./paired-credentials";
import { detectDeviceSignals, resolveDeviceMode, type DeviceMode } from "./device-mode";
import { routeBrain, type RouteOutcome } from "./router";
import { publishPreparation } from "./preparation";
import { modelStore } from "./model-store";
import {
  REMEDY_LABELS,
  type AdapterId,
  type BrainAdapter,
  type BrainMessage,
  type RemedyAction,
} from "./adapter";
import { useDevicePolicy } from "../use-device-policy";
import { serverIsThisMachine } from "../hardware/detect.browser";
import type { RoutePolicy } from "../local/router-policy";

/**
 * Assemble the OCADE Brain for this device and answer "who can serve this?".
 *
 * WHAT IS REGISTERED TODAY, and what is not.
 *
 * Four of five: the desktop bridge, the browser's WebGPU engine, the browser's
 * WebAssembly fallback and a paired computer. The mobile-native adapter is NOT
 * registered, because it is not implemented — and an adapter that is listed
 * but absent would make the router report an engine the product cannot
 * actually run, which is the precise failure this architecture exists to
 * prevent.
 *
 * The consequence stays honest and visible: a phone with no paired computer
 * still routes to the browser engines, and if those cannot run either,
 * `routeBrain` refuses and names "Install OCADE" and "Pair a computer" — which
 * is the truth about this build.
 */
export interface BrainHandle {
  mode: DeviceMode;
  /** Decide which engine serves a request. Never throws. */
  route: (options?: { heavy?: boolean; visionRequired?: boolean }) => Promise<RouteOutcome>;
  /** Load weights ahead of a send, so the first message is not a cold start. */
  /**
   * Get the on-device engine ready.
   *
   * `pending` is what the next message is shaping up to be. It is optional but
   * it matters for anything large: the runtime reloads the weights when the
   * context window changes, so warming without it warms at the wrong window
   * and the load is paid again after the user presses send.
   */
  warm: (pending?: BrainMessage[]) => void;
  /** Labels for the remedy buttons a refusal offers. */
  remedyLabel: (remedy: RemedyAction) => string;
}

export function useBrain(options?: { hasPairedDesktop?: boolean }): BrainHandle {
  const device = useDevicePolicy();
  // A stored pairing is what makes this a paired device mode. Read rather than
  // assumed so the mode reflects what is actually configured here.
  const paired = options?.hasPairedDesktop ?? hasPairing();

  // Read lazily: the device measurement lands after the first render, and an
  // adapter constructed with an empty policy would route on no hardware facts.
  const policyRef = useRef<RoutePolicy>(device.policy);
  policyRef.current = device.policy;

  const registry = useMemo(() => {
    const map = new Map<AdapterId, BrainAdapter>();
    map.set("desktop_bridge", new DesktopBridgeAdapter({ policy: () => policyRef.current }));
    /*
     * Both browser engines are registered unconditionally. Their `probe()`
     * decides availability from the real environment — WebGPU presence, the
     * adapter's memory limit, storage quota — so registering them costs
     * nothing on a device that cannot run them, and neither library is loaded
     * until one is actually routed to.
     */
    /*
     * Shared across tabs. Without this every open tab loaded its own copy of
     * the weights onto the graphics card; three tabs meant three copies.
     */
    /*
     * BOTH BROWSER ADAPTERS PUBLISH THEIR PROGRESS, AND UNTIL NOW NEITHER DID.
     *
     * Each has always accepted an `onProgress` callback. Both were constructed
     * here with no options, so the reports were emitted into nothing:
     * `EngineState.progress` was typed `number | null` and no code path ever
     * assigned it, and a first visit downloading several hundred megabytes
     * showed a spinner with no percentage, no size and no way to tell a slow
     * download from a hung one.
     *
     * The runtimes' own wording is deliberately NOT forwarded. WebLLM's
     * `report.text` names shards and quantisation formats; a person preparing
     * OCADE for the first time is not debugging a runtime, so the stage and
     * the numbers travel and the vocabulary does not.
     */
    map.set(
      "browser_webgpu",
      shareAcrossTabs(
        new BrowserWebGpuAdapter({
          onProgress: (p) =>
            publishPreparation({
              stage: p.fraction !== null && p.fraction >= 1 ? "loading" : "downloading",
              fraction: p.fraction,
            }),
        }),
      ),
    );
    map.set(
      "browser_wasm",
      new BrowserWasmAdapter({
        onProgress: (p) =>
          publishPreparation({
            stage: p.fraction !== null && p.fraction >= 1 ? "loading" : "downloading",
            fraction: p.fraction,
          }),
      }),
    );
    map.set("paired_desktop", new PairedDesktopAdapter({ credentials: pairedCredentials }));
    return map;
  }, []);

  const mode = useMemo(() => resolveDeviceMode(detectDeviceSignals(paired)), [paired]);

  /*
   * When the OCADE server IS this machine — the desktop build, and local
   * development — the desktop bridge is a genuine on-device engine and should
   * be preferred over a browser one, which is slower and needs its own
   * download. Everywhere else the mode stands as measured, so a hosted browser
   * routes to the browser engines exactly as the preference table says.
   *
   * This replaced a blanket "treat pc_web as desktop_app" override that made
   * sense only while the bridge was the sole working adapter.
   */
  const effectiveMode: DeviceMode =
    mode === "pc_web" && serverIsThisMachine() ? "desktop_app" : mode;

  const route = useCallback(
    (opts?: { heavy?: boolean; visionRequired?: boolean }) =>
      routeBrain({
        mode: effectiveMode,
        adapters: registry,
        heavy: opts?.heavy,
        visionRequired: opts?.visionRequired,
        cloudEnabled: false,
      }),
    [effectiveMode, registry],
  );

  const warm = useCallback(
    (pending?: BrainMessage[]) => {
      /*
       * WARM THE SAME ENGINE ORDER THAT ROUTING USES.
       *
       * Starting every candidate in parallel looked harmless until the desktop
       * bridge answered a turn while the speculative browser preload remained
       * at 0%. The conversation then truthfully said "response complete" and,
       * at the same time, falsely looked stuck on "Preparing OCADE
       * Intelligence". It also spent bandwidth preparing an engine that the
       * router had already decided not to use.
       *
       * Probe the preferred local bridge first. If it is genuinely available,
       * warm it and stop. Only a missing or failed bridge falls through to the
       * browser engines. The whole chain stays fire-and-forget: a failed warm
       * must never become an error for a message that has not been sent.
       *
       * WASM IS WARMED TOO, AND THAT IS THE FALLBACK THAT MATTERS. A browser
       * with no usable WebGPU adapter got a `preload` that probed, found
       * nothing and returned -- so the ONE engine that device could actually
       * run was never prepared, and the download it needed started on the
       * user's first message instead. The fallback is only a fallback if it is
       * made ready like the primary.
       */
      void (async () => {
        const bridge = registry.get("desktop_bridge");
        if (bridge instanceof DesktopBridgeAdapter) {
          try {
            const availability = await bridge.probe();
            if (availability.available) {
              await bridge.preload(pending);
              publishPreparation({ stage: "ready", fraction: 1 });
              return;
            }
          } catch {
            // A bridge that disappears during probing simply yields to the
            // browser fallback, exactly as a normal route would.
          }
        }

        const webgpu = registry.get("browser_webgpu");
        if (!webgpu?.preload) return;

        publishPreparation({ stage: "checking", fraction: null });
        try {
          const availability = await webgpu.probe();
          /*
           * Persistent storage is asked for BEFORE the bytes arrive.
           *
           * A browser that has not granted it may evict several hundred
           * megabytes of weights under disk pressure, and the user then
           * re-downloads them over whatever connection they are on. Asking
           * first costs one permission check; asking afterwards is asking
           * about something already at risk.
           */
          await modelStore.requestPersistence();
          if (availability.available) {
            await webgpu.preload();
            publishPreparation({ stage: "ready", fraction: 1 });
            return;
          }
          const wasm = registry.get("browser_wasm");
          if (wasm?.preload) {
            const fallback = await wasm.probe();
            if (fallback.available) {
              await wasm.preload();
              publishPreparation({ stage: "ready", fraction: 1 });
              return;
            }
            publishPreparation({
              stage: "unsupported",
              detail: fallback.reason,
              fraction: null,
            });
            return;
          }
          publishPreparation({
            stage: "unsupported",
            detail: availability.reason,
            fraction: null,
          });
        } catch {
          /*
           * An ordinary network interruption is NOT a dead end here: the
           * downloader keeps the bytes it already wrote and resumes from
           * them, so the honest state is "will carry on", not "failed".
           */
          publishPreparation({ stage: "retrying" });
        }
      })();
    },
    [registry],
  );

  /*
   * MEMOISED, and that is not a micro-optimisation.
   *
   * This used to return a fresh object literal on every render, with a fresh
   * `remedyLabel` arrow inside it. Any caller that put the handle in a
   * dependency array — `useCallback([brain])`, `useEffect([check])` — got a new
   * identity every render, so the effect re-ran, set state, and re-rendered.
   * The demo screen probed the engine in a mount effect and hit
   * "Maximum update depth exceeded" immediately.
   *
   * `route` and `warm` are already stable `useCallback`s; wrapping the handle
   * makes the whole thing stable, which is what a hook returning callbacks owes
   * its callers.
   */
  const remedyLabel = useCallback((remedy: RemedyAction) => REMEDY_LABELS[remedy], []);

  return useMemo(
    () => ({ mode: effectiveMode, route, warm, remedyLabel }),
    [effectiveMode, route, warm, remedyLabel],
  );
}

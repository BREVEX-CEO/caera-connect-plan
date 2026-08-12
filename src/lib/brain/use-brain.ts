import { useCallback, useMemo, useRef } from "react";
import { DesktopBridgeAdapter } from "./adapters/desktop-bridge";
import { BrowserWebGpuAdapter } from "./adapters/browser-webgpu";
import { BrowserWasmAdapter } from "./adapters/browser-wasm";
import { PairedDesktopAdapter } from "./adapters/paired-desktop";
import { pairedCredentials, hasPairing } from "./paired-credentials";
import { detectDeviceSignals, resolveDeviceMode, type DeviceMode } from "./device-mode";
import { routeBrain, type RouteOutcome } from "./router";
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
    map.set("browser_webgpu", new BrowserWebGpuAdapter());
    map.set("browser_wasm", new BrowserWasmAdapter());
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
      const adapter = registry.get("desktop_bridge");
      if (adapter instanceof DesktopBridgeAdapter) {
        // Fire and forget: a failed warm-up must never surface as an error for a
        // message the user has not sent yet.
        void adapter
          .probe()
          .then(() => adapter.preload(pending))
          .catch(() => {});
      }
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

import { useCallback, useMemo, useRef } from "react";
import { DesktopBridgeAdapter } from "./adapters/desktop-bridge";
import { PairedDesktopAdapter } from "./adapters/paired-desktop";
import { pairedCredentials, hasPairing } from "./paired-credentials";
import { detectDeviceSignals, resolveDeviceMode, type DeviceMode } from "./device-mode";
import { routeBrain, type RouteOutcome } from "./router";
import { installationAuthority } from "./installation-browser";
import { authorityBackedAdapter } from "./runtime-activation";
import {
  REMEDY_LABELS,
  type AdapterId,
  type BrainAdapter,
  type BrainMessage,
  type RemedyAction,
} from "./adapter";
import { useDevicePolicy } from "../use-device-policy";
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
     * THE BROWSER ENGINES ARE NOT CONSTRUCTED HERE ANY MORE.
     *
     * This used to build a `BrowserWebGpuAdapter` and a `BrowserWasmAdapter`
     * inside this `useMemo`, each with its own `onProgress` publishing into a
     * separate preparation store. The installation authority now constructs the
     * one engine it actually starts, so building them here too would leave two
     * adapter instances in one tab -- and on the graphics path that is two
     * copies of the weights resident at once, which is precisely the defect
     * `shared-browser-engine.ts` exists to prevent across tabs, reintroduced
     * inside a single one.
     *
     * `authorityBackedAdapter` holds no engine. It forwards to whatever the
     * authority has running and otherwise reports, in preparation language,
     * that the device is still being prepared. So there is one engine per tab,
     * one progress story, and no path from routing back into a download.
     */
    map.set("browser_webgpu", authorityBackedAdapter("browser_webgpu"));
    map.set("browser_wasm", authorityBackedAdapter("browser_wasm"));
    map.set("paired_desktop", new PairedDesktopAdapter({ credentials: pairedCredentials }));
    return map;
  }, []);

  const mode = useMemo(() => resolveDeviceMode(detectDeviceSignals(paired)), [paired]);

  /*
   * A loopback URL does not make a browser the packaged desktop app.
   *
   * Local development and the production browser harness both run on
   * 127.0.0.1. Treating that hostname as a desktop signal made ordinary web
   * Chat probe an absent native engine on every visit, producing browser
   * network errors before the user had paired or installed anything. The
   * packaged shell already supplies explicit __TAURI__/__OCADE_DESKTOP__
   * signals through `detectDeviceSignals`; those are the only truthful reason
   * to prefer the unauthenticated same-machine bridge.
   */
  const effectiveMode: DeviceMode = mode;

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
       * WARMING IS NOW A REQUEST TO JOIN, NOT A SECOND INSTALLER.
       *
       * What used to live here was a whole parallel preparation path: probe the
       * bridge, else probe WebGPU, else probe WebAssembly, ask for persistent
       * storage, call `preload()` on whichever answered, and publish its own
       * progress. It ran on the composer's first keystroke, and it was one of
       * the five independent things that could each begin downloading the same
       * model. It is also where "retrying" was published from a catch block
       * that then did nothing at all, which is why that label never corresponded
       * to a retry.
       *
       * The installation authority owns every one of those steps now, and
       * `install()` joins whatever is already in flight instead of starting
       * anything. So typing can still ASK for the engine -- which is the useful
       * half of what this did -- and can no longer CREATE a download, which was
       * the harmful half.
       *
       * `pending` is deliberately unused. It existed so the runtime could be
       * warmed at the context window the next message would need; the authority
       * decides the window from the tier and the device now, and re-warming at a
       * different one per keystroke was work the user paid for twice.
       */
      void pending;

      /*
       * The desktop bridge stays a special case, and it is the honest one: it
       * is a local engine that is already installed, so there is nothing to
       * download and preloading it is pure latency saved. The authority routes
       * to it as the strongest rung anyway; this only means a bridge-backed
       * machine does not wait for an idle callback to start warming.
       */
      void (async () => {
        const bridge = registry.get("desktop_bridge");
        if (effectiveMode === "desktop_app" && bridge instanceof DesktopBridgeAdapter) {
          try {
            const availability = await bridge.probe();
            if (availability.available) {
              await bridge.preload(pending);
              return;
            }
          } catch {
            // A bridge that disappears during probing simply yields to the
            // authority, exactly as a normal route would.
          }
        }
        await installationAuthority().install({ reason: "warm" });
      })();
    },
    [effectiveMode, registry],
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

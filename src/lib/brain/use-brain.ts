import { useCallback, useMemo, useRef } from "react";
import { DesktopBridgeAdapter } from "./adapters/desktop-bridge";
import { SharedBrowserAdapter } from "./adapters/shared-browser";
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

export interface BrainHandle {
  mode: DeviceMode;
  route: (options?: { heavy?: boolean; visionRequired?: boolean }) => Promise<RouteOutcome>;
  warm: (pending?: BrainMessage[]) => void;
  remedyLabel: (remedy: RemedyAction) => string;
}

/** Assemble the strictly local OCADE Brain for the current device. */
export function useBrain(options?: { hasPairedDesktop?: boolean }): BrainHandle {
  const device = useDevicePolicy();
  const paired = options?.hasPairedDesktop ?? hasPairing();
  const policyRef = useRef<RoutePolicy>(device.policy);
  policyRef.current = device.policy;

  const registry = useMemo(() => {
    const map = new Map<AdapterId, BrainAdapter>();
    map.set("desktop_bridge", new DesktopBridgeAdapter({ policy: () => policyRef.current }));

    /*
     * One browser adapter owns BOTH WebGPU and WASM fallback. Its Web Locks /
     * BroadcastChannel coordinator guarantees that only the leader tab may load
     * the browser model; follower tabs relay their streams to that leader.
     */
    map.set("browser_webgpu", new SharedBrowserAdapter());
    map.set("paired_desktop", new PairedDesktopAdapter({ credentials: pairedCredentials }));
    return map;
  }, []);

  const mode = useMemo(() => resolveDeviceMode(detectDeviceSignals(paired)), [paired]);
  const effectiveMode: DeviceMode =
    mode === "pc_web" && serverIsThisMachine() ? "desktop_app" : mode;

  const route = useCallback(
    (opts?: { heavy?: boolean; visionRequired?: boolean }) =>
      routeBrain({
        mode: effectiveMode,
        adapters: registry,
        heavy: opts?.heavy,
        visionRequired: opts?.visionRequired,
      }),
    [effectiveMode, registry],
  );

  const warm = useCallback(
    (pending?: BrainMessage[]) => {
      const bridge = registry.get("desktop_bridge");
      if (bridge instanceof DesktopBridgeAdapter) {
        void bridge.probe().then(() => bridge.preload(pending)).catch(() => {});
      }
      const browser = registry.get("browser_webgpu");
      if (browser instanceof SharedBrowserAdapter) {
        // Followers return immediately; only the Web-Locks leader warms weights.
        void browser.preload().catch(() => {});
      }
    },
    [registry],
  );

  const remedyLabel = useCallback((remedy: RemedyAction) => REMEDY_LABELS[remedy], []);
  return useMemo(
    () => ({ mode: effectiveMode, route, warm, remedyLabel }),
    [effectiveMode, route, warm, remedyLabel],
  );
}

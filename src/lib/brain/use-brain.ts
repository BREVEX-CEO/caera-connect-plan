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

/** Assemble the local OCADE Brain for the current device. */
export function useBrain(options?: { hasPairedDesktop?: boolean }): BrainHandle {
  const device = useDevicePolicy();
  const paired = options?.hasPairedDesktop ?? hasPairing();
  const policyRef = useRef<RoutePolicy>(device.policy);
  policyRef.current = device.policy;

  const registry = useMemo(() => {
    const map = new Map<AdapterId, BrainAdapter>();
    map.set("desktop_bridge", new DesktopBridgeAdapter({ policy: () => policyRef.current }));
    // One adapter owns BOTH WebGPU and WASM fallback. Web Locks elect one tab
    // to hold the model; every follower relays instead of loading another copy.
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
        cloudEnabled: false,
      }),
    [effectiveMode, registry],
  );

  const warm = useCallback(
    (pending?: BrainMessage[]) => {
      const browser = registry.get("browser_webgpu");
      const warmBrowser = () => {
        if (browser instanceof SharedBrowserAdapter) void browser.preload().catch(() => {});
      };

      // Do not pull 340+ MB of browser weights on a desktop whose native engine
      // is already healthy. Browser warming is a FALLBACK, not a parallel tax.
      if (effectiveMode === "desktop_app") {
        const bridge = registry.get("desktop_bridge");
        if (bridge instanceof DesktopBridgeAdapter) {
          void bridge
            .probe()
            .then((availability) => {
              if (availability.available) return bridge.preload(pending);
              warmBrowser();
            })
            .catch(warmBrowser);
          return;
        }
      }

      // A paired computer is already the preferred engine. Only warm browser
      // weights if that approved machine is not currently reachable.
      if (effectiveMode === "pc_web_paired" || effectiveMode === "mobile_app") {
        const pairedAdapter = registry.get("paired_desktop");
        if (pairedAdapter) {
          void pairedAdapter
            .probe()
            .then((availability) => {
              if (!availability.available) warmBrowser();
            })
            .catch(warmBrowser);
          return;
        }
      }

      warmBrowser();
    },
    [effectiveMode, registry],
  );

  const remedyLabel = useCallback((remedy: RemedyAction) => REMEDY_LABELS[remedy], []);
  return useMemo(
    () => ({ mode: effectiveMode, route, warm, remedyLabel }),
    [effectiveMode, route, warm, remedyLabel],
  );
}

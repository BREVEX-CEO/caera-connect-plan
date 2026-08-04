import { useCallback, useMemo, useRef } from "react";
import { DesktopBridgeAdapter } from "./adapters/desktop-bridge";
import { detectDeviceSignals, resolveDeviceMode, type DeviceMode } from "./device-mode";
import { routeBrain, type RouteOutcome } from "./router";
import { REMEDY_LABELS, type AdapterId, type BrainAdapter, type RemedyAction } from "./adapter";
import { useDevicePolicy } from "../use-device-policy";
import type { RoutePolicy } from "../local/router-policy";

/**
 * Assemble the OCADE Brain for this device and answer "who can serve this?".
 *
 * WHAT IS REGISTERED TODAY, and what is not.
 *
 * Only the desktop bridge is registered, because it is the only adapter that
 * has been built AND proven against a real engine. The router already knows
 * the full preference order for all five device modes, so registering a new
 * adapter is a one-line change here — but an adapter that is listed and not
 * implemented would make the router report an engine the product cannot
 * actually run, which is the precise failure this architecture exists to stop.
 *
 * The consequence is honest and visible rather than hidden: a browser with no
 * paired desktop routes to nothing, and `routeBrain` returns a refusal naming
 * "Install OCADE" and "Pair a computer" — which is the truth about this build.
 */
export interface BrainHandle {
  mode: DeviceMode;
  /** Decide which engine serves a request. Never throws. */
  route: (options?: { heavy?: boolean; visionRequired?: boolean }) => Promise<RouteOutcome>;
  /** Load weights ahead of a send, so the first message is not a cold start. */
  warm: () => void;
  /** Labels for the remedy buttons a refusal offers. */
  remedyLabel: (remedy: RemedyAction) => string;
}

export function useBrain(options?: { hasPairedDesktop?: boolean }): BrainHandle {
  const device = useDevicePolicy();

  // Read lazily: the device measurement lands after the first render, and an
  // adapter constructed with an empty policy would route on no hardware facts.
  const policyRef = useRef<RoutePolicy>(device.policy);
  policyRef.current = device.policy;

  const registry = useMemo(() => {
    const map = new Map<AdapterId, BrainAdapter>();
    map.set("desktop_bridge", new DesktopBridgeAdapter({ policy: () => policyRef.current }));
    return map;
  }, []);

  const mode = useMemo(
    () => resolveDeviceMode(detectDeviceSignals(options?.hasPairedDesktop ?? false)),
    [options?.hasPairedDesktop],
  );

  /*
   * A browser on a computer has no desktop bridge in its preference order, yet
   * this build's only working engine IS that bridge — and in local development
   * the bridge genuinely is on the same machine. Rather than pretend the mode
   * is something it is not, the bridge is offered as an extra candidate when
   * it is actually reachable, and the router still records what it tried.
   */
  const effectiveMode: DeviceMode = mode === "pc_web" ? "desktop_app" : mode;

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

  const warm = useCallback(() => {
    const adapter = registry.get("desktop_bridge");
    if (adapter instanceof DesktopBridgeAdapter) {
      // Fire and forget: a failed warm-up must never surface as an error for a
      // message the user has not sent yet.
      void adapter
        .probe()
        .then(() => adapter.preload())
        .catch(() => {});
    }
  }, [registry]);

  return {
    mode: effectiveMode,
    route,
    warm,
    remedyLabel: (remedy) => REMEDY_LABELS[remedy],
  };
}

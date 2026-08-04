import type { AdapterId } from "./adapter";

/**
 * Which kind of device is this, and therefore which engines may serve it.
 *
 * Pure and injectable on purpose. Device mode decides whether a person's
 * conversation stays on their machine, and a rule that can only be exercised
 * on the device it describes is a rule nobody has tested. Everything here
 * takes its inputs as arguments so all five modes are reachable from a unit
 * test on one laptop.
 */

export type DeviceMode =
  /** The OCADE desktop application. It owns a local engine. */
  | "desktop_app"
  /** A browser on a computer, with a paired OCADE desktop reachable. */
  | "pc_web_paired"
  /** A browser on a computer, nothing paired. */
  | "pc_web"
  /** The OCADE mobile application. */
  | "mobile_app"
  /** A browser on a phone, nothing paired. */
  | "mobile_web";

export interface DeviceSignals {
  /** True inside the packaged desktop shell. */
  isDesktopApp: boolean;
  /** True inside the packaged mobile shell. */
  isMobileApp: boolean;
  /** Phone or tablet form factor. */
  isMobileBrowser: boolean;
  /** A paired OCADE desktop has been approved and is currently reachable. */
  hasPairedDesktop: boolean;
}

export function resolveDeviceMode(signals: DeviceSignals): DeviceMode {
  // The packaged shells are decided first: a desktop app that also happens to
  // have a paired machine is still a desktop app, and should use its own
  // engine rather than reaching across the network for no reason.
  if (signals.isDesktopApp) return "desktop_app";
  if (signals.isMobileApp) return "mobile_app";
  if (signals.isMobileBrowser) return "mobile_web";
  return signals.hasPairedDesktop ? "pc_web_paired" : "pc_web";
}

/**
 * Preference order per device mode.
 *
 * Read these as "try in this order, take the first that probes ready".
 *
 * THE REASONING, mode by mode:
 *
 *  - `desktop_app` owns a real engine on real hardware. Nothing beats it, and
 *    it never needs a browser engine.
 *  - `pc_web_paired` prefers the paired desktop because it is the same user's
 *    own machine running a far larger model than a browser can hold. The
 *    browser engines remain behind it so unplugging the desktop degrades
 *    rather than breaks.
 *  - `pc_web` has only the browser. WebGPU first because it is an order of
 *    magnitude faster than WebAssembly; WASM exists so a browser without
 *    WebGPU is still served rather than turned away.
 *  - `mobile_app` prefers the paired desktop FOR HEAVY WORK — a phone should
 *    not melt to answer a question the user's own laptop can take — and falls
 *    back to its native model so the phone still works with no network.
 *  - `mobile_web` is the weakest position, and its order says so.
 *
 * CLOUD IS NEVER IN THIS LIST. It is not a fallback; it is a separate decision
 * the user makes explicitly, handled by the caller. Putting it here is how a
 * local-first product quietly becomes a cloud product.
 */
export const ADAPTER_PREFERENCE: Record<DeviceMode, AdapterId[]> = {
  desktop_app: ["desktop_bridge"],
  pc_web_paired: ["paired_desktop", "browser_webgpu", "browser_wasm"],
  pc_web: ["browser_webgpu", "browser_wasm"],
  mobile_app: ["paired_desktop", "mobile_native"],
  mobile_web: ["browser_webgpu", "browser_wasm"],
};

/**
 * Heavy work belongs on the biggest machine available.
 *
 * A phone CAN answer "what is the capital of Japan" locally in a second. It
 * should not be asked to summarise a forty-page document while the user's
 * paired laptop sits idle — that is the difference between a warm phone and a
 * phone that shuts down mid-answer.
 */
export function preferenceFor(mode: DeviceMode, heavy: boolean): AdapterId[] {
  const order = ADAPTER_PREFERENCE[mode];
  if (mode !== "mobile_app" || heavy) return order;
  // Light work on a phone with the app: answer locally, leave the laptop alone.
  return ["mobile_native", "paired_desktop"];
}

/** Read the real signals from the running environment. */
export function detectDeviceSignals(hasPairedDesktop: boolean): DeviceSignals {
  const w =
    typeof window === "undefined"
      ? undefined
      : (window as Window & {
          __TAURI__?: unknown;
          __OCADE_DESKTOP__?: unknown;
          Capacitor?: { isNativePlatform?: () => boolean };
        });

  const isDesktopApp = !!w?.__TAURI__ || !!w?.__OCADE_DESKTOP__;
  const isMobileApp = !!w?.Capacitor?.isNativePlatform?.();

  const nav =
    typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { userAgentData?: { mobile?: boolean } });
  const isMobileBrowser =
    typeof nav?.userAgentData?.mobile === "boolean"
      ? nav.userAgentData.mobile
      : /android|iphone|ipad|ipod|mobile|tablet/i.test(nav?.userAgent ?? "");

  return { isDesktopApp, isMobileApp, isMobileBrowser, hasPairedDesktop };
}

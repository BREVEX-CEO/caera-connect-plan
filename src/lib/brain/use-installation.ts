/**
 * Reading — and starting — the one installation, from React.
 *
 * TWO HOOKS, AND THE SPLIT IS DELIBERATE.
 *
 * `useInstallationState` only WATCHES. Any number of components may use it,
 * on any route, and none of them causes anything to happen. That is what makes
 * it safe to put a progress line beside a composer, a badge in a header and a
 * full-screen setup experience on a route all at once.
 *
 * `useInstallationBootstrap` STARTS the install, and is mounted in exactly one
 * place — the application root. Preparation is a property of the visit, not of
 * whichever screen happens to be open, so it begins as soon as trusted client
 * code runs and keeps running across every navigation after that.
 *
 * WHY STARTING IS NOT IN THE WATCHING HOOK. It used to be, in effect: the
 * composer's first keystroke called `warm()`. That made the moment a person
 * started typing the moment a gigabyte started moving — the worst possible
 * time, because they are now waiting mid-sentence for something that could have
 * begun while they read the landing page. Watching and starting are different
 * responsibilities and only one of them belongs on a screen.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { installationAuthority } from "./installation-browser";
import {
  describeInstall,
  isPreparing,
  type InstallRemedy,
  type InstallState,
} from "./installation-authority";

/** Watch the installation. Causes nothing to happen. */
export function useInstallationState(): InstallState {
  const authority = installationAuthority();
  return useSyncExternalStore(
    useCallback((listener) => authority.subscribe(listener), [authority]),
    () => authority.snapshot(),
    /*
     * The server snapshot. Rendered on the server there is no browser, no
     * storage and no engine, so the honest answer is "nothing has started" —
     * and it must be a STABLE reference, because returning a fresh object here
     * makes React re-render forever.
     */
    () => SERVER_STATE,
  );
}

const SERVER_STATE: InstallState = {
  stage: "idle",
  fraction: null,
  etaSeconds: null,
  detail: null,
  problem: null,
  remedies: [],
  observing: false,
  retries: 0,
  path: null,
};

export interface InstallationControls {
  state: InstallState;
  /** One line for a person, in product language. */
  line: string;
  preparing: boolean;
  ready: boolean;
  /** A real new attempt. */
  retry: () => void;
  /** Stop, keeping every byte already downloaded. */
  pause: () => void;
  /** Remove OCADE's local intelligence from this device. */
  uninstall: () => Promise<void>;
  /** Re-check what is on disk and repair it. */
  repair: () => void;
  remedies: InstallRemedy[];
}

/** Watch, plus the controls a setup or settings screen needs. */
export function useInstallation(): InstallationControls {
  const authority = installationAuthority();
  const state = useInstallationState();

  return {
    state,
    line: describeInstall(state),
    preparing: isPreparing(state.stage),
    ready: state.stage === "ready",
    retry: useCallback(() => void authority.retry(), [authority]),
    pause: useCallback(() => authority.pause(), [authority]),
    uninstall: useCallback(async () => {
      await authority.uninstall();
    }, [authority]),
    repair: useCallback(() => void authority.repair(), [authority]),
    remedies: state.remedies,
  };
}

/**
 * Start preparing as early as it is technically safe to.
 *
 * MOUNTED ONCE, IN THE ROOT. Not in the demo, not in Chat, not behind a
 * keystroke — a visitor who lands on the marketing page and signs in four
 * minutes later should find the engine already there.
 *
 * DEFERRED BY ONE IDLE CALLBACK, and only one. First paint must not compete
 * with a capability probe that touches WebGPU and storage; after that, the
 * transfer is network and disk work that has no business waiting for anything.
 * The deferral is milliseconds, not a policy.
 *
 * IT DOES NOT WAIT FOR WI-FI. Cellular is allowed, deliberately: the local
 * engine is what makes OCADE work offline later, so postponing it on a mobile
 * connection would trade the feature the user came for against a preference
 * nobody expressed. The transfer plan uses fewer connections on a phone, and
 * `saveData` narrows it further — restraint rather than refusal.
 */
export function useInstallationBootstrap(options?: { enabled?: boolean }): void {
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let cancelled = false;
    const start = () => {
      if (cancelled) return;
      // Fire and forget. A failed install is a state on the authority, never a
      // rejected promise nobody is holding.
      void installationAuthority().install({ reason: "app_bootstrap" });
    };

    const idle = (
      window as Window & {
        requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
      }
    ).requestIdleCallback;

    let handle: number;
    if (typeof idle === "function") {
      // The timeout matters: on a busy page idle may never come, and "as early
      // as technically possible" cannot mean "eventually, maybe".
      handle = idle(start, { timeout: 1500 });
      return () => {
        cancelled = true;
        (window as Window & { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback?.(
          handle,
        );
      };
    }
    handle = window.setTimeout(start, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [enabled]);

  /**
   * Resume when the device comes back.
   *
   * A phone that walked out of signal, a laptop that slept, a tab that was
   * discarded and restored, a return from the OAuth redirect. In every one of
   * those the transfer stopped and the checkpoint survived, so the right
   * response to "we are online and visible again" is to carry on from it.
   */
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    const resume = () => {
      const authority = installationAuthority();
      if (authority.isReady()) return;
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      void authority.install({ reason: "resumed" });
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") resume();
    };

    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", onVisibility);
    // `pageshow` fires on a back/forward-cache restore, which `visibilitychange`
    // does not always cover — and coming back from sign-in is exactly that.
    window.addEventListener("pageshow", resume);
    return () => {
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", resume);
    };
  }, [enabled]);
}

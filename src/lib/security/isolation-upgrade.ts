/**
 * Getting an already-loaded document onto the isolated side of the boundary.
 *
 * Cross-origin isolation is decided when a DOCUMENT is created, from the
 * headers on that response. A client-side router transition into `/ocade`
 * keeps the document it started from — the landing page, which is deliberately
 * not isolated — so `crossOriginIsolated` stays false and the engine silently
 * runs on one core. The route looks right and the threads are not there.
 *
 * The fix is a real navigation, and the only interesting question is how to do
 * it without creating a reload loop. A browser that does not implement
 * `Cross-Origin-Embedder-Policy: credentialless` will keep reporting
 * `crossOriginIsolated === false` however many times the page is fetched, so an
 * unguarded "reload until isolated" is an infinite loop on precisely the
 * browsers least able to afford one.
 *
 * So: AT MOST ONE ATTEMPT, remembered in `sessionStorage`. If the reload does
 * not produce isolation, the page stops asking and runs single-threaded, which
 * is the honest outcome and the one the capability ladder already handles.
 *
 * Links into these routes should navigate properly in the first place —
 * `needsFullNavigation` is what a router integration consults — and this exists
 * for everything else: a deep link followed by a client-side redirect, a
 * restored session, a back button.
 */

import { isolationUpgradeTarget } from "./isolation";

const ATTEMPT_KEY = "ocade.isolation.attempted.v1";

/** Why the upgrade did or did not happen. Diagnostics only. */
export type IsolationOutcome =
  /** Already isolated; nothing to do. */
  | "isolated"
  /** Not an isolated route; nothing to do. */
  | "not_required"
  /** A full navigation was started. */
  | "navigating"
  /** Tried once already and it did not take. Running single-threaded. */
  | "unavailable"
  /** No browser here. */
  | "no_document";

export interface UpgradeDeps {
  pathname: string;
  isolated: boolean;
  /** Injected so both branches are reachable without a browser. */
  readAttempt: () => boolean;
  writeAttempt: () => void;
  /** Optional: called once isolation is confirmed, to return the one attempt. */
  clearAttempt?: () => void;
  navigate: (to: string) => void;
}

/**
 * Decide and act. Pure enough to test, because every effect is injected.
 *
 * The attempt is recorded BEFORE the navigation, not after: the navigation
 * destroys this document, so anything written afterwards would never run and
 * the next document would believe it was the first attempt. That ordering is
 * the difference between one reload and an unbounded number of them.
 */
function upgradeIsolation(deps: UpgradeDeps): IsolationOutcome {
  const target = isolationUpgradeTarget({
    pathname: deps.pathname,
    isolated: deps.isolated,
    alreadyTried: deps.readAttempt(),
  });

  if (target === null) {
    if (deps.isolated) {
      /*
       * SUCCESS RETURNS THE BUDGET.
       *
       * The one-shot marker exists to stop a browser that cannot isolate from
       * reloading forever. A browser that HAS isolated has proved it can, so
       * holding the marker afterwards would spend the single attempt on the
       * first crossing and leave every later one — landing page to /ocade, an
       * hour into the session — permanently single-threaded.
       *
       * Clearing it here means the budget is only ever consumed by failure,
       * which is what it was for.
       */
      deps.clearAttempt?.();
      return "isolated";
    }
    if (deps.readAttempt()) return "unavailable";
    return "not_required";
  }

  deps.writeAttempt();
  deps.navigate(target);
  return "navigating";
}

/** The browser wiring. Never throws; a refusal simply means single-threaded. */
export function upgradeIsolationInBrowser(): IsolationOutcome {
  if (typeof window === "undefined" || typeof document === "undefined") return "no_document";

  return upgradeIsolation({
    pathname: window.location.pathname,
    isolated: globalThis.crossOriginIsolated === true,
    readAttempt: () => {
      try {
        return window.sessionStorage.getItem(ATTEMPT_KEY) === "1";
      } catch {
        /*
         * No session storage — a locked-down profile, or private mode in some
         * browsers. Reporting "already tried" is the safe direction: it costs a
         * single-threaded engine and cannot produce a reload loop. The other
         * way round could reload forever with nothing to remember it by.
         */
        return true;
      }
    },
    writeAttempt: () => {
      try {
        window.sessionStorage.setItem(ATTEMPT_KEY, "1");
      } catch {
        /* Handled by readAttempt's fail-safe above. */
      }
    },
    clearAttempt: () => {
      try {
        window.sessionStorage.removeItem(ATTEMPT_KEY);
      } catch {
        /* Nothing to clear. */
      }
    },
    // `replace`, not `assign`: the un-isolated version of this same URL should
    // not sit in history, where Back would return the user to a page that
    // immediately tries to leave again.
    navigate: (to) => window.location.replace(to),
  });
}

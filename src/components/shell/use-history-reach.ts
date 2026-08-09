import { useEffect, useState } from "react";

/**
 * Can the Back and Forward buttons actually go anywhere?
 *
 * WHY THIS EXISTS. The shell's history buttons called `window.history.back()`
 * unconditionally and were never disabled. On the first page of a session there
 * is nothing behind you, so Back was a control that looked live, responded to
 * hover, took a click and did nothing — the exact "dead button" the product's
 * own audit forbids, sitting in the chrome of every authenticated screen.
 *
 * WHY IT IS NOT SIMPLY `history.length`. That counts entries in the whole
 * session history, not the position within it, so it is 1 both on a fresh tab
 * AND after navigating back to the first entry — and it never shrinks, so it
 * cannot answer "is there anything forward of here?" at all.
 *
 * The Navigation API can answer both exactly. It is Chromium-only today, which
 * is why the fallback matters:
 *
 * WHEN THE API IS ABSENT, BOTH STAY ENABLED. A browser that cannot tell us is a
 * browser where disabling would be a guess, and a Back button wrongly disabled
 * on a page you CAN go back from is a worse failure than one that occasionally
 * does nothing. Reporting "unknown" as "reachable" keeps the mistake on the
 * safe side.
 */
export interface HistoryReach {
  canGoBack: boolean;
  canGoForward: boolean;
  /** False when the browser cannot report it and both are assumed reachable. */
  measured: boolean;
}

interface NavigationLike {
  canGoBack?: boolean;
  canGoForward?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export function readHistoryReach(nav: NavigationLike | undefined): HistoryReach {
  if (!nav || typeof nav.canGoBack !== "boolean" || typeof nav.canGoForward !== "boolean") {
    return { canGoBack: true, canGoForward: true, measured: false };
  }
  return { canGoBack: nav.canGoBack, canGoForward: nav.canGoForward, measured: true };
}

export function useHistoryReach(): HistoryReach {
  /*
   * Starts as "reachable, unmeasured" so the server render and the first client
   * frame agree. Measuring during render would make the markup depend on a
   * browser API the server does not have, and React would report a hydration
   * mismatch on every authenticated page.
   */
  const [reach, setReach] = useState<HistoryReach>({
    canGoBack: true,
    canGoForward: true,
    measured: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = (window as Window & { navigation?: NavigationLike }).navigation;
    const sync = () => setReach(readHistoryReach(nav));
    sync();
    if (!nav?.addEventListener) return;

    /*
     * `navigate` fires as a navigation starts, when `canGoBack` still reflects
     * the OLD position — reading it there leaves the buttons one navigation
     * stale. `navigatesuccess` and `currententrychange` fire after the entry
     * has actually moved, which is what these buttons describe.
     */
    nav.addEventListener("navigatesuccess", sync);
    nav.addEventListener("currententrychange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      nav.removeEventListener?.("navigatesuccess", sync);
      nav.removeEventListener?.("currententrychange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  return reach;
}

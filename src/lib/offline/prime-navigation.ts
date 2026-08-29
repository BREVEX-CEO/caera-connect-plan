/**
 * Cache the small route chunks needed to reach recovery and appearance
 * controls after the network disappears.
 *
 * A service worker can cache only requests it controls. The first document's
 * eager chunks are already in flight while a new worker installs, and
 * code-split settings routes are not requested at all until somebody opens
 * them. Waiting for control and then importing these routes gives the worker a
 * successful, content-hashed response to retain. No account data is involved.
 */

async function waitForController(timeoutMs = 8_000): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return true;

  return new Promise<boolean>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", finish);
      resolve(Boolean(navigator.serviceWorker.controller));
    };
    const timer = window.setTimeout(finish, timeoutMs);
    navigator.serviceWorker.addEventListener("controllerchange", finish);
  });
}

type RoutePreloader = {
  preloadRoute: (options: { to: string }) => Promise<unknown>;
};

/** Browser-only, best-effort route warm-up. Never throws. */
export async function primeOfflineNavigationFromBrowser(router: RoutePreloader): Promise<boolean> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!navigator.onLine || !("serviceWorker" in navigator)) return false;

  try {
    if (!(await waitForController())) return false;
    /* Importing route source modules is not enough: the bundler can fold their
     * exports into the entry chunk while TanStack's generated lazy route still
     * points at a separate `settings-*.js` chunk. Preloading through the live
     * router follows that generated reference and therefore asks the
     * controlling service worker for the exact assets a later click needs. */
    await Promise.all([
      router.preloadRoute({ to: "/settings/activity" }),
      router.preloadRoute({ to: "/settings/appearance" }),
    ]);
    return true;
  } catch {
    return false;
  }
}

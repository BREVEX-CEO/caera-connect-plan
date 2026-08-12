import { assessOffline, isRuntimeAsset, type OfflineReadiness } from "./readiness";
import { modelStore } from "../brain/model-store";

/**
 * Measure the four things offline readiness actually depends on.
 *
 * Split from `assessOffline` so the policy is pure and testable and this file
 * holds only the browser calls. Every one of them is optional in some browser,
 * so each failure is caught and reported as "not present" — the safe direction.
 * A readiness check that throws is a readiness check that gets wrapped in a
 * try/catch at the call site and quietly treated as "fine".
 */
export async function measureOfflineReadiness(): Promise<OfflineReadiness> {
  let serviceWorkerActive = false;
  try {
    serviceWorkerActive = Boolean(navigator.serviceWorker?.controller);
    if (!serviceWorkerActive && navigator.serviceWorker?.getRegistration) {
      const registration = await navigator.serviceWorker.getRegistration();
      // `controller` is null on the very first load, before the worker claims
      // the page — an active registration still means the app opens offline.
      serviceWorkerActive = Boolean(registration?.active);
    }
  } catch {
    /* Unsupported or blocked. Reported as absent. */
  }

  let shellCachedEntries = 0;
  let runtimeCached = false;
  try {
    if (typeof caches !== "undefined") {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        for (const request of await cache.keys()) {
          shellCachedEntries += 1;
          if (isRuntimeAsset(request.url)) runtimeCached = true;
        }
      }
    }
  } catch {
    /* Cache Storage unavailable. */
  }

  let models: Array<{ key: string; bytes: number; verified: boolean }> = [];
  try {
    models = await modelStore.list();
  } catch {
    /* OPFS refused — private mode, or an unsupported browser. */
  }

  let persistent = false;
  try {
    persistent = (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    /* Reported as evictable, which is the assumption that cannot mislead. */
  }

  return assessOffline({
    serviceWorkerActive,
    shellCachedEntries,
    runtimeCached,
    models,
    persistent,
  });
}

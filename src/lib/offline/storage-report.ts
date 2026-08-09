/**
 * What OCADE is holding on this device, and what clearing it would cost.
 *
 * THE CLAIM THIS BACKS. OCADE tells people it works offline once an engine has
 * been downloaded. That claim is only honest if the user can see what has
 * actually been downloaded — a product that says "works offline" while holding
 * nothing is making a promise it will break on the first flight.
 *
 * So this reports real measurements: the Cache Storage the service worker
 * filled, the browser's own quota estimate, and whether storage is PERSISTENT.
 *
 * PERSISTENCE IS THE PART PEOPLE MISS. By default a browser may evict a site's
 * cache under storage pressure, which on a laptop with a full disk means the
 * multi-gigabyte engine someone downloaded is silently gone the next time they
 * are on a plane. `navigator.storage.persist()` asks the browser not to, and
 * this reports whether the request was granted rather than assuming it.
 */

export interface StorageBucket {
  name: string;
  /** What lives here, in the user's terms. */
  describes: string;
  entries: number;
  /** Bytes, where the browser will tell us. Null when it will not. */
  bytes: number | null;
}

export interface StorageReport {
  /** Total the browser reports as used by this origin. */
  usageBytes: number | null;
  /** Total the browser is willing to give this origin. */
  quotaBytes: number | null;
  /** Eviction under pressure has been ruled out. */
  persistent: boolean;
  /** Whether the browser exposes the estimate API at all. */
  measurable: boolean;
  buckets: StorageBucket[];
}

/** Names the service worker uses, mapped to what a person would call them. */
const BUCKET_LABELS: Array<{ match: RegExp; describes: string }> = [
  { match: /^ocade-shell/, describes: "The application itself — opens with no connection" },
  {
    match: /webllm|wasm|model|weights/i,
    describes: "Engine weights — what answers on this device",
  },
  { match: /link|capture/i, describes: "Pages you captured, kept readable offline" },
];

function describeBucket(name: string): string {
  return BUCKET_LABELS.find((b) => b.match.test(name))?.describes ?? "Cached files";
}

/**
 * Measure. Never throws — every API here is optional in some browser, and a
 * settings screen that crashes because a quota API is missing is worse than one
 * that says "this browser will not tell us".
 */
export async function measureStorage(): Promise<StorageReport> {
  const empty: StorageReport = {
    usageBytes: null,
    quotaBytes: null,
    persistent: false,
    measurable: false,
    buckets: [],
  };
  if (typeof navigator === "undefined") return empty;

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;
  let measurable = false;
  try {
    if (navigator.storage?.estimate) {
      const estimate = await navigator.storage.estimate();
      usageBytes = estimate.usage ?? null;
      quotaBytes = estimate.quota ?? null;
      measurable = true;
    }
  } catch {
    /* Some browsers reject in private mode. Reported as unmeasurable. */
  }

  let persistent = false;
  try {
    persistent = (await navigator.storage?.persisted?.()) ?? false;
  } catch {
    /* Unsupported. Reported as not persistent, which is the safe assumption. */
  }

  const buckets: StorageBucket[] = [];
  try {
    if (typeof caches !== "undefined") {
      for (const name of await caches.keys()) {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        buckets.push({
          name,
          describes: describeBucket(name),
          entries: keys.length,
          // Per-cache byte size is not exposed by any browser. Reported as
          // null rather than estimated, because a made-up number here would be
          // the user deciding what to delete from a figure we invented.
          bytes: null,
        });
      }
    }
  } catch {
    /* Cache Storage unavailable. The buckets list stays empty. */
  }

  return { usageBytes, quotaBytes, persistent, measurable, buckets };
}

/**
 * Ask the browser to stop evicting our cache.
 *
 * Returns what actually happened. Chrome grants this silently based on
 * engagement; Firefox prompts; Safari may refuse outright. Reporting the real
 * outcome is the difference between "your engine is safe offline" being true
 * and being a hope.
 */
export async function requestPersistentStorage(): Promise<{ granted: boolean; reason: string }> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return {
      granted: false,
      reason: "This browser cannot protect stored data from being cleared automatically.",
    };
  }
  try {
    const granted = await navigator.storage.persist();
    return {
      granted,
      reason: granted
        ? "Your downloaded engine and cached pages will not be cleared automatically."
        : "The browser declined. It may still clear OCADE's cache when the device runs low on space — the engine would need downloading again.",
    };
  } catch {
    return { granted: false, reason: "The browser refused the request." };
  }
}

/** Bytes as a person reads them. Null stays null rather than becoming "0 B". */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "unknown";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Delete one cache bucket.
 *
 * Separated from the report so a caller cannot clear something it has not
 * shown the user first.
 */
export async function clearBucket(name: string): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    return await caches.delete(name);
  } catch {
    return false;
  }
}

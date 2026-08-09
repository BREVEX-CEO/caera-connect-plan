/**
 * OCADE offline shell (HWE-35).
 *
 * WHY A LOCAL-FIRST PRODUCT NEEDS ONE. OCADE tells people their conversations
 * can stay on their device and that the engine can run on their own hardware.
 * Before this file, the application itself would not open without a network
 * round trip — so a laptop on a plane, holding a local model and a local vault,
 * showed a browser error page. The claim and the behaviour disagreed.
 *
 * DELIBERATELY CONSERVATIVE. A service worker in front of a server-rendered app
 * is an easy way to serve a user yesterday's build forever, so:
 *
 *   - NAVIGATION IS NETWORK-FIRST. The network answer always wins when it
 *     arrives; the cache is consulted only when the network fails. Nobody gets
 *     a stale page because they happen to have visited before.
 *   - /api/ IS NEVER CACHED, NEVER SERVED FROM CACHE. Those responses carry
 *     conversation content and authorisation outcomes. A cached 200 for a
 *     request that should now be 401 is a security bug, and a cached chat reply
 *     is somebody's data surviving a sign-out.
 *   - ONLY GET. A cached POST is a request the user thinks happened.
 *   - THE CACHE IS VERSIONED, and old versions are deleted on activate, so a
 *     deploy cannot leave two generations of assets fighting.
 */

const VERSION = "ocade-shell-v1";
const OFFLINE_URL = "/offline.html";

/**
 * The smallest set that makes the app open offline.
 *
 * Deliberately not the JavaScript bundles: those are content-hashed and change
 * every build, so listing them here would either go stale immediately or
 * require this file to be generated. They are picked up by the runtime cache
 * below once they have been fetched successfully at least once.
 */
const PRECACHE = [OFFLINE_URL, "/favicon.ico", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      // A precache miss must not leave the worker permanently uninstalled.
      // The offline page is the only entry that really matters and it is
      // retried on the next navigation failure.
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Requests that must always go to the network, and never be stored. */
function isNeverCached(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn/") ||
    url.pathname.startsWith("/auth/")
  );
}

/**
 * Model weights, which must NOT go through this cache.
 *
 * Weights live in OPFS, put there by `lib/brain/model-store.ts`, because they
 * are hundreds of megabytes and OPFS can stream them chunk by chunk and resume
 * a partial download. Letting them also land in Cache Storage would store the
 * same gigabyte twice against one quota — and the copy here would be the one
 * the user cannot see, cannot resume and cannot delete from the Offline
 * Storage screen, because that screen reports OPFS.
 *
 * Cross-origin weights are already excluded by the origin check below. This
 * covers weights served from our own origin, where that check does not help.
 */
function isModelWeight(url) {
  return /\.(gguf|bin|safetensors|onnx|params)$/.test(url.pathname);
}

/**
 * Static assets worth keeping once they have been fetched successfully.
 *
 * `.wasm` is included on purpose and it is the entry that makes offline
 * INFERENCE possible rather than just an offline shell: it is the engine
 * runtime that executes the weights. Caching the app without it produces a
 * product that opens on a plane and cannot answer — which is the failure
 * `lib/offline/readiness.ts` reports as `runtime_not_cached`.
 */
function isRuntimeCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  if (isModelWeight(url)) return false;

  /*
   * A tokenizer is JSON and the engine cannot run without it, but ".json" as a
   * blanket rule would also cache any route that happens to serve JSON — which
   * on this app means somebody's data, cached under a URL that survives a sign
   * out. Restricted to the build's own asset directory, where filenames are
   * content-hashed and nothing user-specific is ever served.
   */
  if (/\.json$/.test(url.pathname)) {
    return /^\/(assets|_build)\//.test(url.pathname);
  }

  return /\.(js|mjs|css|woff2?|png|svg|ico|webmanifest|wasm)$/.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isNeverCached(url)) return; // straight to the network, unrecorded

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        // Offline. Prefer this exact page if it was cached, then the generic
        // offline shell. Never a different page's markup, which would show the
        // user somewhere they are not.
        const cached = await caches.match(request);
        return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
    return;
  }

  if (!isRuntimeCacheable(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          // Only successful, same-origin, basic responses are worth storing.
          // An opaque or error response cached here would be served forever.
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached ?? Response.error());
      // Content-hashed assets never change under one URL, so the cached copy
      // is served immediately and the network refreshes it behind.
      return cached ?? network;
    }),
  );
});

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

const SHELL_CACHE_PREFIX = "ocade-shell-v";
const VERSION = `${SHELL_CACHE_PREFIX}11`;
const OFFLINE_URL = "/offline.html";

/**
 * The smallest set that makes the app open offline.
 *
 * Deliberately not the JavaScript bundles: those are content-hashed and change
 * every build, so listing them here would either go stale immediately or
 * require this file to be generated. They are picked up by the runtime cache
 * below once they have been fetched successfully at least once.
 */
const REQUIRED_PRECACHE = ["/", OFFLINE_URL, "/manifest.webmanifest"];

const OPTIONAL_PRECACHE = [
  "/favicon.ico",
  /*
   * EXACTLY THE ICONS THE MANIFEST ASKS FOR.
   *
   * This listed 128 and 192. The manifest declares 192 and 512 -- 512 twice,
   * once as `maskable` -- and never mentions 128 at all. So offline, Chrome
   * read the cached manifest, went looking for an icon that had never been
   * stored, and logged "Download error or resource isn't a valid image"
   * against a file that is a perfectly valid PNG sitting in public/icons.
   *
   * Caching a file nothing references while missing one that is referenced
   * twice is the kind of mismatch that only shows up with the network off,
   * which is the one condition nobody tests by hand.
   */
  "/icons/ocade-192.png",
  "/icons/ocade-512.png",
  "/brand/ocade-carcc-mark.png",
  "/brand/ocade-carcc-wordmark.png",
  "/demo/ocade",
  "/demo/control",
];

/**
 * Find the build's own first-paint chunks by reading the shell it just cached.
 *
 * The comment above is right that a hard-coded list of content-hashed bundles
 * goes stale immediately. What it missed is what happened instead: the runtime
 * cache below only sees an asset AFTER it has been fetched through this worker,
 * and on a first visit the page's scripts are already in flight while this
 * worker is still installing. So they were never cached at all, and anybody who
 * visited once and then went offline was served the shell document with none of
 * its JavaScript — right title, right favicon, empty body.
 *
 * A generated manifest file was the obvious answer and it does not work here:
 * Nitro builds its public-asset table during the bundle, so a file written
 * afterwards is not in it and the request falls through to the SSR handler.
 * `importScripts` then received an HTML document and threw.
 *
 * So the worker reads the shell instead. `/` is precached above, and being a
 * server-rendered document it carries `<script src="/assets/…">` and the
 * `<link rel="modulepreload">` tags for everything the entry statically
 * imports — which is exactly the set a visitor waits for before first paint.
 * No build step, no extra route, and it is correct on every deploy without
 * anybody remembering to regenerate anything.
 */
async function firstPaintAssets(cache) {
  try {
    const shell = await cache.match("/");
    if (!shell) return [];
    const html = await shell.text();
    const found = new Set();
    for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|mjs|css))"/g)) {
      found.add(match[1]);
    }
    return [...found];
  } catch {
    // A shell that cannot be read is not a reason to fail the install.
    return [];
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then(async (cache) => {
        /*
         * Upgrade atomically around the actual shell. If the root, offline
         * page, or manifest is missing during a rolling deploy, rejecting this
         * install leaves the previous worker and its complete cache active.
         * Optional brand art and revisit routes are independent: one 404 must
         * not block an otherwise usable upgrade.
         */
        await cache.addAll(REQUIRED_PRECACHE);
        // Read the shell only after it is in the cache — that is where the
        // asset URLs come from.
        const firstPaint = await firstPaintAssets(cache);
        await Promise.allSettled(
          [...OPTIONAL_PRECACHE, ...firstPaint].map((url) => cache.addAll([url])),
        );
        await self.skipWaiting();
      })
      .catch(async (error) => {
        // Do not retain a half-staged cache that a later activation could use.
        await caches.delete(VERSION);
        throw error;
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((k) => k.startsWith(SHELL_CACHE_PREFIX) && k !== VERSION)
              .map((k) => caches.delete(k)),
          ),
        ),
      // Navigation preload removes the service-worker startup round trip on a
      // normal online visit. Unsupported engines simply skip this branch.
      self.registration?.navigationPreload?.enable?.().catch(() => undefined),
    ]).then(() => self.clients.claim()),
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

/* ------------------------------------------------- background preparation -- */

/**
 * CONTINUING TO PREPARE OCADE WHILE THE PAGE IS NOT THERE.
 *
 * Background Fetch is the ONLY web API that genuinely survives a tab being
 * closed: the browser owns the transfer, shows its own progress, and wakes this
 * worker when it finishes. Everywhere else, "we will keep downloading in the
 * background" is a claim ordinary page JavaScript cannot honour — the process
 * is killed and the promise dies with it — so OCADE does not make it. It
 * persists validated progress instead and resumes on the next visit, which is
 * a smaller promise that is actually true.
 *
 * WHAT THIS DOES AND, MORE IMPORTANTLY, WHAT IT DOES NOT.
 *
 * It writes bytes into the same OPFS location the page's installer uses, and
 * then tells the page. It does NOT hash them, does NOT record any metadata, and
 * does NOT mark anything usable. Verification lives in exactly one place —
 * `installation-authority.ts` — and duplicating a digest check here in
 * unbundled worker JavaScript would be a second implementation to keep in step
 * with the first, which is how the two eventually disagree about whether a file
 * is safe to run.
 *
 * So the division is: the browser moves the bytes, this worker files them, and
 * the page proves them. A file that arrives corrupt is caught by the page's
 * streaming digest on the next visit and deleted, exactly as if it had been
 * downloaded in the foreground.
 */

const MODEL_FETCH_PREFIX = "ocade-model:";
const MODEL_ROOT = "ocade-models";

/** The OPFS directory handle for a slash-separated path, created as needed. */
async function modelDirectory(segments) {
  const base = await self.navigator.storage.getDirectory();
  let dir = await base.getDirectoryHandle(MODEL_ROOT, { create: true });
  for (const segment of segments) {
    dir = await dir.getDirectoryHandle(segment, { create: true });
  }
  return dir;
}

/**
 * A registration id carries the destination path, and it is validated here.
 *
 * The id round-trips through the browser's own storage, so it is treated as
 * untrusted on the way back: only plain path segments are accepted, and
 * anything with a traversal, an empty segment or a leading dot is dropped
 * rather than turned into a write somewhere unexpected.
 */
function pathFromFetchId(id) {
  if (typeof id !== "string" || !id.startsWith(MODEL_FETCH_PREFIX)) return null;
  const raw = id.slice(MODEL_FETCH_PREFIX.length);
  const segments = raw.split("/").filter(Boolean);
  if (segments.length < 2 || segments.length > 6) return null;
  for (const segment of segments) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment) || segment.includes("..")) return null;
  }
  return segments;
}

async function storeBackgroundFetch(registration) {
  const segments = pathFromFetchId(registration.id);
  if (!segments) return false;
  const name = segments.pop();

  const records = await registration.matchAll();
  if (records.length !== 1) return false;
  const response = await records[0].responseReady;
  if (!response || !response.ok) return false;

  const dir = await modelDirectory(segments);
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  try {
    // Streamed, never buffered: this is a gigabyte-class artifact and the
    // worker has no more memory to spend on it than the page did.
    await response.body.pipeTo(writable);
  } catch (error) {
    try {
      await writable.abort();
    } catch {
      /* already gone */
    }
    // A partial file left here is not a problem: the page verifies before it
    // uses anything, and a short file simply fails that check.
    throw error;
  }
  return true;
}

/** Tell every open page that something changed, so it can verify and activate. */
async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  for (const client of clients) client.postMessage(message);
}

self.addEventListener("backgroundfetchsuccess", (event) => {
  event.waitUntil(
    (async () => {
      let stored = false;
      try {
        stored = await storeBackgroundFetch(event.registration);
      } catch {
        stored = false;
      }
      // `updateUI` is what the browser shows in its own download surface. The
      // product language rule applies there too: no model name, no size.
      try {
        await event.updateUI({
          title: stored ? "OCADE is ready to finish setting up" : "OCADE setup needs another try",
        });
      } catch {
        /* Some engines only allow one updateUI call; failing it is harmless. */
      }
      await notifyClients({ type: "ocade:model-staged", ok: stored, id: event.registration.id });
    })(),
  );
});

self.addEventListener("backgroundfetchfail", (event) => {
  // Nothing is written and nothing is claimed. The page resumes from its own
  // checkpoint on the next visit, which is the same path every other
  // interruption takes.
  event.waitUntil(
    notifyClients({ type: "ocade:model-staged", ok: false, id: event.registration.id }),
  );
});

self.addEventListener("backgroundfetchabort", (event) => {
  event.waitUntil(notifyClients({ type: "ocade:model-aborted", id: event.registration.id }));
});

/** Tapping the browser's own progress notification opens OCADE. */
self.addEventListener("backgroundfetchclick", (event) => {
  event.waitUntil(self.clients.openWindow("/"));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isNeverCached(url)) return; // straight to the network, unrecorded

  if (request.mode === "navigate") {
    const navigation = Promise.resolve(event.preloadResponse)
      /*
       * A PRELOAD THAT FAILED IS NOT A RESPONSE, IT ONLY LOOKS LIKE ONE.
       *
       * `preloaded ?? fetch(request)` was wrong in the one case that matters.
       * Navigation preload starts its request before this handler runs, so
       * when the network drops the preload does not always reject — depending
       * on how far it got, it can RESOLVE with an error response instead. That
       * response is not ok, so the caching branch below skips it, and then the
       * old code returned it to the page anyway: a blank document, delivered
       * instead of the cached shell, with the offline fallback never reached.
       *
       * It failed intermittently for exactly that reason. The service-worker
       * probe read an empty title and an empty body on some runs and the real
       * shell in 104ms on others, from identical code and an identical cache.
       *
       * So a preload is used only if it is genuinely usable. Anything else —
       * absent, errored, or not ok — falls through to `fetch`, which fails
       * honestly offline and lands in the catch below where the shell is.
       */
      .then((preloaded) =>
        preloaded && preloaded.ok && preloaded.type !== "error" ? preloaded : fetch(request),
      )
      .then(async (response) => {
        const cacheControl = response.headers.get("cache-control") ?? "";
        const contentType = response.headers.get("content-type") ?? "";

        // Keep the last successful document for this exact route. This is
        // still network-first, so a connection always receives the current
        // deployment. Private/no-store responses are never copied, and a
        // cached shell cannot contain an API response or a signed-out user's
        // data because those paths were excluded above.
        if (
          response.ok &&
          response.type === "basic" &&
          contentType.includes("text/html") &&
          !/\b(?:private|no-store)\b/i.test(cacheControl)
        ) {
          const copy = response.clone();
          await caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        // Offline. Prefer this exact page if it was cached, then the generic
        // offline shell. Never a different page's markup, which would show
        // the user somewhere they are not.
        const cached = await caches.match(request);
        const appShell = await caches.match("/");
        return cached ?? appShell ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
      });
    event.waitUntil(navigation.then(() => undefined));
    event.respondWith(navigation);
    return;
  }

  if (!isRuntimeCacheable(url)) return;

  const cachedResponse = caches.match(request);
  const network = cachedResponse.then((cached) =>
    fetch(request)
      .then(async (response) => {
        // Only successful, same-origin, basic responses are worth storing.
        // An opaque or error response cached here would be served forever.
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          await caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => cached ?? Response.error()),
  );
  // Register the background refresh while the fetch event is still active;
  // calling waitUntil from a later promise callback is too late in browsers.
  event.waitUntil(network.then(() => undefined));
  // Content-hashed assets never change under one URL, so the cached copy is
  // served immediately while the registered network refresh runs behind it.
  event.respondWith(cachedResponse.then((cached) => cached ?? network));
});

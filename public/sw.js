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
const VERSION = `${SHELL_CACHE_PREFIX}19`;
const OFFLINE_URL = "/offline.html";
const SHELL_ROUTES = ["/", "/ocade-jarvis"];

/*
 * RUNTIME ASSETS OUTLIVE A DEPLOY. The versioned cache above is deleted on
 * every activation, and it used to hold everything fetched at runtime too —
 * the lazily loaded chunks and `wllama.wasm`, the engine that runs the
 * installed model. So the first visit after a deploy (the one that installs
 * this worker) quietly threw them away, and the next time the person was
 * offline the app opened without its engine. Content-hashed assets never change
 * under one URL, so they are safe to keep across versions; the oldest are
 * pruned by count so old builds cannot pile up.
 */
const ASSET_CACHE = "ocade-static-assets";
const ASSET_CACHE_LIMIT = 200;

async function keepAsset(request, response) {
  const cache = await caches.open(ASSET_CACHE);
  // put() re-appends an existing URL, so the list stays oldest-first.
  await cache.put(request, response);
  const keys = await cache.keys();
  await Promise.all(
    keys.slice(0, Math.max(0, keys.length - ASSET_CACHE_LIMIT)).map((key) => cache.delete(key)),
  );
}

/**
 * The smallest set that makes the app open offline.
 *
 * Deliberately not the JavaScript bundles: those are content-hashed and change
 * every build, so listing them here would either go stale immediately or
 * require this file to be generated. They are picked up by the runtime cache
 * below once they have been fetched successfully at least once.
 */
const REQUIRED_PRECACHE = [...SHELL_ROUTES, OFFLINE_URL].map(
  (path) =>
    new Request(new URL(path, self.location.origin), { credentials: "omit", cache: "reload" }),
);

const OPTIONAL_PRECACHE = [
  "/favicon.ico",
  /*
   * EXACTLY WHAT SOMETHING STILL REFERENCES.
   *
   * This once listed the manifest's icon set, and before that a size the
   * manifest never mentioned -- so offline, Chrome read the cached manifest,
   * went looking for an icon that had never been stored, and logged "Download
   * error or resource isn't a valid image" against a perfectly valid PNG.
   *
   * The web app manifest (public/manifest.webmanifest) names its own icons;
   * this list only keeps the ones something here still needs offline. The 192
   * also serves Background Fetch while a download runs in the background.
   */
  // Also the shell's 28px brand mark, so one small file serves both.
  "/icons/ocade-192.png",
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
    const found = new Set();
    for (const route of SHELL_ROUTES) {
      const shell = await cache.match(route);
      if (!shell) continue;
      const html = await shell.text();
      for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+\.(?:js|mjs|css))"/g)) {
        found.add(match[1]);
      }
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
        // The first-paint JavaScript is required: a cached shell without it
        // cannot hydrate, so its failure keeps the previous worker instead.
        await cache.addAll(await firstPaintAssets(cache));
        await Promise.allSettled(OPTIONAL_PRECACHE.map((url) => cache.addAll([url])));
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
              .filter(
                (k) => (k.startsWith(SHELL_CACHE_PREFIX) && k !== VERSION) || k === "ocade-assets",
              )
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
    url.pathname === "/auth" ||
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
 *
 * Matched by PATH rather than by file extension. The artifact is reached
 * through OCADE's authorised delivery route and has no name and no extension to
 * match on, which is the point of it; the extension list this replaced also
 * spelled out which formats OCADE runs, in a file every visitor downloads.
 */
function isModelWeight(url) {
  return url.pathname.startsWith("/api/offline/");
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

  const buildAsset = /^\/(?:assets|_build)\//.test(url.pathname);
  const publicAsset = /^\/(?:icons|fonts|brand)\//.test(url.pathname);
  if (url.pathname === "/favicon.ico" || url.pathname === "/manifest.webmanifest") return true;
  return (
    (buildAsset || publicAsset) && /\.(js|mjs|css|woff2?|png|svg|ico|json|wasm)$/.test(url.pathname)
  );
}

/* ------------------------------------------------- background preparation -- */

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isNeverCached(url)) return;

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

      .catch(async () => {
        // Only anonymous, precached shell documents can be used after a connection drops.
        const shell = await caches.open(VERSION);
        const cached = SHELL_ROUTES.includes(url.pathname) ? await shell.match(url.pathname) : null;
        return cached ?? (await shell.match(OFFLINE_URL)) ?? Response.error();
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
          await keepAsset(request, response.clone()).catch(() => undefined);
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

/* ---------------------------------------------------- browser notifications -- */

/*
 * A push from OCADE: show it, always (a push that shows nothing is refused by
 * browsers, and would be a secret one). The message is what the server wrote:
 * a title, a line, a same-origin path, and a tag so a resend replaces rather
 * than stacks.
 */
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data ? event.data.json() : {};
  } catch {
    message = {};
  }
  const title = typeof message.title === "string" && message.title ? message.title : "OCADE";
  // Only an OCADE page, decided by the URL parser (so `/\evil` is not one).
  let path = "/";
  try {
    const target = new URL(
      typeof message.url === "string" ? message.url : "/",
      self.location.origin,
    );
    if (target.origin === self.location.origin)
      path = target.pathname + target.search + target.hash;
  } catch {
    path = "/";
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof message.body === "string" ? message.body : "",
      tag: typeof message.tag === "string" ? message.tag : undefined,
      icon: "/icons/ocade-192.png",
      badge: "/icons/ocade-192.png",
      data: { url: path },
    }),
  );
});

/* Pressed: the open OCADE window goes there, or a new one opens. Same origin only. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/", self.location.origin);
  if (target.origin !== self.location.origin) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      const open = windows.find((client) => new URL(client.url).origin === target.origin);
      if (open) {
        await open.focus();
        return open.navigate(target.href).catch(() => self.clients.openWindow(target.href));
      }
      return self.clients.openWindow(target.href);
    }),
  );
});

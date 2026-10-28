// RC10: exact before/after service-worker code, simulated browser APIs; no network or Cloudflare API calls.
// Reproduce in an isolated Node 22+ cloud runner:
// node --input-type=module -e "import('./docs/audit-checkpoints/20261028-cloud-safety/remote-sw-regression.mjs').then(async m=>console.log(JSON.stringify(await m.default(),null,2)))"
// A PASS does not establish real-browser or release qualification.
export default async () => { async function run(instantiate) {
  const handlers = {}, stores = new Map();
  let writes=0, skipped=false, offline=false;
  const key = r => typeof r==="string" ? r : new URL(r.url).pathname;
  const caches = {
    async open(name) {
      const store=stores.get(name) || new Map(); stores.set(name,store);
      return {
        async addAll(urls) { for(const url of urls) store.set(url,new Response(url === "/" ? "<html></html>" : url)); },
        async put(req,res) { writes++; store.set(key(req),res); },
        async match(req) { return store.get(key(req))?.clone(); },
        async keys() { return [...store.keys()]; },
        async delete(req) { return store.delete(key(req)); }
      };
    },
    async keys(){return [...stores.keys()];},
    async delete(name){return stores.delete(name);},
    async match(req){for(const store of stores.values()){const hit=store.get(key(req));if(hit)return hit.clone();}}
  };
  const self = {location:{origin:"https://ocade.test"},addEventListener:(name,fn)=>handlers[name]=fn,
                skipWaiting:async()=>{skipped=true;},clients:{claim:async()=>{}}};
  const fakeFetch = async()=>{if(offline)throw new TypeError("offline");
    return Object.defineProperty(new Response("fresh",{headers:{"content-type":"text/html"}}),"type",{value:"basic"});};
  instantiate(self,caches,fakeFetch);
  let installed;handlers.install({waitUntil:p=>installed=p});await installed;
  const rows=[];
  for(const isOffline of [false,true]) {
    offline=isOffline;
    for(const path of ["/auth","/auth?next=%2Flibrary","/auth/","/auth/verify","/auth/callback","/auth/challenge"]) {
      let answer;const oldWrites=writes;
      handlers.fetch({request:{method:"GET",url:"https://ocade.test"+path,mode:"navigate"},
        waitUntil:()=>{},respondWith:p=>answer=p});
      if(answer)await answer;
      rows.push({id:(isOffline?"offline":"online")+":"+path,pass:answer===undefined&&writes===oldWrites});
    }
  }
  offline=false;
  for(const path of ["/author","/authentication","/","/help"]){
    let answer;handlers.fetch({request:{method:"GET",url:"https://ocade.test"+path,mode:"navigate"},
      waitUntil:()=>{},respondWith:p=>answer=p});
    const res=await answer;rows.push({id:"public:"+path,pass:res?.status===200&&await res.text()==="fresh"});
  }
  for(const path of ["/api/jarvis/device","/_serverFn/id"]){
    let hit=false;handlers.fetch({request:{method:"GET",url:"https://ocade.test"+path,mode:"navigate"},
      waitUntil:()=>{},respondWith:()=>hit=true});rows.push({id:"private:"+path,pass:!hit});
  }
  stores.set("ocade-shell-v16",new Map());stores.set("ocade-shell-v17",new Map());stores.set("ocade-assets",new Map());
  let activated;handlers.activate({waitUntil:p=>activated=p});await activated;
  rows.push({id:"upgrade:old-auth-cache-removed",pass:!stores.has("ocade-shell-v17")});
  rows.push({id:"upgrade:assets-kept",pass:stores.has("ocade-assets")});
  return {rows,pass:rows.filter(r=>r.pass).length,fail:rows.filter(r=>!r.pass).length};
}
 function baselineWorker(self,caches,fetch){/**
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
const VERSION = `${SHELL_CACHE_PREFIX}17`;
const OFFLINE_URL = "/offline.html";

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
const ASSET_CACHE = "ocade-assets";
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
const REQUIRED_PRECACHE = ["/", OFFLINE_URL];

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
          /*
           * Under the page's PATH, not its full address. The fallback below
           * ignores the query anyway, and keeping one copy per address kept
           * one per conversation (?c=) and per Shortcut (?ask=…, the words in
           * it) for as long as the cache lived.
           */
          const page = new URL(request.url);
          // A refused cache write costs the offline copy, never this response.
          await caches
            .open(VERSION)
            .then((cache) => cache.put(new Request(page.origin + page.pathname), copy))
            .catch(() => undefined);
        }
        return response;
      })
      .catch(async () => {
        /*
         * Offline. This page as it was last seen (its query aside: a Chat
         * link with ?c= is still Chat), else the offline page. Never another
         * page's markup: Chat's document served for /auth showed Chat at the
         * sign-in address and failed to hydrate (React error 418), measured on
         * WebKit when the network dropped mid-navigation.
         */
        const cached = await caches.match(request, { ignoreSearch: true });
        return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
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
}
 function candidateWorker(self,caches,fetch){/**
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
const VERSION = `${SHELL_CACHE_PREFIX}18`;
const OFFLINE_URL = "/offline.html";

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
const ASSET_CACHE = "ocade-assets";
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
const REQUIRED_PRECACHE = ["/", OFFLINE_URL];

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
          /*
           * Under the page's PATH, not its full address. The fallback below
           * ignores the query anyway, and keeping one copy per address kept
           * one per conversation (?c=) and per Shortcut (?ask=…, the words in
           * it) for as long as the cache lived.
           */
          const page = new URL(request.url);
          // A refused cache write costs the offline copy, never this response.
          await caches
            .open(VERSION)
            .then((cache) => cache.put(new Request(page.origin + page.pathname), copy))
            .catch(() => undefined);
        }
        return response;
      })
      .catch(async () => {
        /*
         * Offline. This page as it was last seen (its query aside: a Chat
         * link with ?c= is still Chat), else the offline page. Never another
         * page's markup: Chat's document served for /auth showed Chat at the
         * sign-in address and failed to hydrate (React error 418), measured on
         * WebKit when the network dropped mid-navigation.
         */
        const cached = await caches.match(request, { ignoreSearch: true });
        return cached ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
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
}
 const before=await run(baselineWorker); const after=await run(candidateWorker);
 return {environment:"Cloudflare remote JS sandbox",evidenceClass:"Exact service-worker source with simulated Cache Storage/network/event dispatch",before,after,realBrowser:false,cloudflareApiCalls:0};
};

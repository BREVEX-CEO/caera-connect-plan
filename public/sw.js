/* OCADE offline-first service worker. AI inference remains local-only. */
const VERSION = "ocade-local-only-v7";
const OFFLINE_URL = "/offline.html";
const MAX_RETRIES = 5;
const PRECACHE = ["/", OFFLINE_URL, "/favicon.ico", "/manifest.webmanifest", "/icons/ocade-128.png", "/icons/ocade-192.png", "/brand/ocade-mark.png", "/brand/ocade-wordmark.png", "/brand/ocade-companion-v1.png", "/demo/ocade", "/demo/control"];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fetchWithRetry(request, attempts = MAX_RETRIES) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(request);
      if (response.ok || response.type === "opaque") return response;
      lastError = new Error(`HTTP ${response.status}`);
      if (response.status >= 400 && response.status < 500) throw lastError;
    } catch (error) { lastError = error; }
    if (attempt < attempts) await sleep(250 * 2 ** (attempt - 1));
  }
  throw lastError ?? new Error("Network request failed");
}
function isNeverCached(url) { return url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn/") || url.pathname.startsWith("/auth/"); }
function isModelFile(url) { return url.pathname.startsWith("/models/") || /\.(gguf|bin|safetensors|onnx|params)(?:$|\?)/i.test(url.pathname); }
function isRuntimeCacheable(url) {
  if (url.origin !== self.location.origin || isNeverCached(url)) return false;
  if (isModelFile(url)) return true;
  if (/\.json$/i.test(url.pathname)) return /^\/(assets|_build)\//.test(url.pathname);
  return /\.(js|mjs|css|woff2?|png|svg|ico|webmanifest|wasm)$/i.test(url.pathname);
}
async function cacheSuccessful(cache, request, response) {
  if (!response) return;
  const url = new URL(request.url ?? request, self.location.origin);
  if (url.origin !== self.location.origin) return;
  const cacheControl = response.headers.get("cache-control") ?? "";
  if (!response.ok || response.type !== "basic" || /\b(?:private|no-store)\b/i.test(cacheControl)) return;
  await cache.put(request, response.clone());
}
async function cacheOneWithRetry(cache, url) {
  try {
    const request = new Request(url, { cache: "reload" });
    const response = await fetchWithRetry(request);
    await cacheSuccessful(cache, request, response);
    return true;
  } catch { return false; }
}
async function fillPrecache() {
  const cache = await caches.open(VERSION);
  const results = await Promise.all(PRECACHE.map((url) => cacheOneWithRetry(cache, url)));
  return results.every(Boolean);
}
async function broadcast(type, data = {}) {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type, ...data });
}
self.addEventListener("install", (event) => {
  event.waitUntil(fillPrecache().then((complete) => broadcast("OCADE_SHELL_CACHE_STATUS", { complete })).catch(() => undefined).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))),
    self.registration?.navigationPreload?.enable?.().catch(() => undefined),
  ]).then(() => self.clients.claim()));
});
self.addEventListener("message", (event) => {
  const data = event.data ?? {};
  if (data.type === "OCADE_RETRY_OFFLINE_CACHE") {
    event.waitUntil(fillPrecache().then((complete) => broadcast("OCADE_SHELL_CACHE_STATUS", { complete })));
    return;
  }
  if (data.type === "OCADE_CACHE_MODEL_URL" && typeof data.url === "string") {
    event.waitUntil((async () => {
      const url = new URL(data.url, self.location.origin);
      if (url.origin !== self.location.origin || !isModelFile(url)) return;
      const cache = await caches.open(VERSION);
      const complete = await cacheOneWithRetry(cache, url.href);
      await broadcast("OCADE_MODEL_CACHE_STATUS", { url: url.href, complete });
    })());
  }
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (isNeverCached(url)) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const preloaded = await event.preloadResponse;
        const response = preloaded ?? (await fetchWithRetry(request));
        const cache = await caches.open(VERSION);
        event.waitUntil(cacheSuccessful(cache, request, response));
        return response;
      } catch {
        return (await caches.match(request)) ?? (await caches.match("/")) ?? (await caches.match(OFFLINE_URL)) ?? Response.error();
      }
    })());
    return;
  }
  if (!isRuntimeCacheable(url)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetchWithRetry(request);
      const cache = await caches.open(VERSION);
      event.waitUntil(cacheSuccessful(cache, request, response));
      return response;
    } catch { return Response.error(); }
  })());
});

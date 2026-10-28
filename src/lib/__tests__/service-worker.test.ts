import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * public/sw.js run as a worker would run it, with Cache Storage and the network
 * replaced. F-191: a refused cache write must not cost the page its response.
 * F-194: an upgrade whose first-paint JavaScript failed to cache must not activate.
 */
function worker(options: { putFails?: boolean; failAsset?: string; shell?: string }) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const stores = new Map<string, Map<string, Response>>();
  let skipped = false;
  const keyOf = (request: Request | string) =>
    typeof request === "string" ? request : new URL(request.url).pathname;
  const open = async (name: string) => {
    const store = stores.get(name) ?? new Map<string, Response>();
    stores.set(name, store);
    return {
      addAll: async (urls: string[]) => {
        for (const url of urls) {
          if (url === options.failAsset) throw new TypeError("network error");
          const body = url === "/" ? (options.shell ?? "<html></html>") : url;
          store.set(url, new Response(body));
        }
      },
      put: async (request: Request | string, response: Response) => {
        if (options.putFails) throw new DOMException("quota", "QuotaExceededError");
        store.set(keyOf(request), response);
      },
      match: async (request: Request | string) => store.get(keyOf(request))?.clone(),
      keys: async () => [...store.keys()],
      delete: async (key: string) => store.delete(key),
    };
  };
  const caches = {
    open,
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: Request | string) => {
      for (const store of stores.values()) {
        const hit = store.get(keyOf(request));
        if (hit) return hit.clone();
      }
      return undefined;
    },
  };
  const self = {
    location: { origin: "https://ocade.test" },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
    },
    skipWaiting: async () => {
      skipped = true;
    },
    clients: { claim: async () => undefined },
    registration: undefined,
  };
  // A same-origin network answer is "basic"; a constructed Response is not.
  const fetch = async () =>
    Object.defineProperty(
      new Response("fresh", { status: 200, headers: { "content-type": "text/html" } }),
      "type",
      { value: "basic" },
    );
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self,
    caches,
    fetch,
    Response,
    Request,
    URL,
    Promise,
    Set,
  });
  const install = async () => {
    let done: Promise<unknown> = Promise.resolve();
    handlers.install!({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done.catch(() => undefined);
    return { skipped, stores };
  };
  const request = async (path: string, mode: "navigate" | "no-cors") => {
    let answer: Promise<Response> | undefined;
    const req = { url: `https://ocade.test${path}`, method: "GET", mode };
    handlers.fetch!({
      request: req,
      preloadResponse: undefined,
      waitUntil: () => undefined,
      respondWith: (p: Promise<Response>) => (answer = p),
    });
    return answer!;
  };
  return { install, request };
}

describe("the service worker", () => {
  it("never intercepts authentication documents, including the exact /auth path (RC10)", async () => {
    const sw = worker({});
    await sw.install();
    for (const path of ["/auth", "/auth?next=%2Flibrary", "/auth/", "/auth/verify", "/auth/callback"]) {
      expect(await sw.request(path, "navigate"), path).toBeUndefined();
    }
    // Path boundaries matter: unrelated public documents still use the offline shell policy.
    expect((await sw.request("/author", "navigate")).status).toBe(200);
  });

  it("delivers a fresh page and asset when the cache refuses to store them (F-191)", async () => {
    const sw = worker({ putFails: true });
    const page = await sw.request("/chat", "navigate");
    expect([page.status, await page.text()]).toEqual([200, "fresh"]);
    const asset = await sw.request("/assets/entry-1.js", "no-cors");
    expect([asset.status, await asset.text()]).toEqual([200, "fresh"]);
  });

  it("does not activate an upgrade missing its first-paint JavaScript (F-194)", async () => {
    const shell = '<script src="/assets/entry-1.js"></script>';
    const broken = await worker({ shell, failAsset: "/assets/entry-1.js" }).install();
    expect(broken.skipped).toBe(false);
    expect([...broken.stores.keys()].some((name) => name.startsWith("ocade-shell-v"))).toBe(false);

    const whole = await worker({ shell }).install();
    expect(whole.skipped).toBe(true);
  });

  it("still upgrades when only optional art fails", async () => {
    const result = await worker({ failAsset: "/favicon.ico" }).install();
    expect(result.skipped).toBe(true);
  });
});

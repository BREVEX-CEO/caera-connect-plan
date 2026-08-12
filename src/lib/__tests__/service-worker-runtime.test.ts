import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The service worker's HANDLERS, executed.
 *
 * WHY THIS EXISTS SEPARATELY FROM `service-worker-rules.test.ts`. That file
 * pulls the two caching predicates out and checks their logic, which is worth
 * doing — but a predicate returning the right answer proves nothing about the
 * handler that calls it. `install` could fail to precache, `activate` could
 * delete the cache it just filled, and `fetch` could serve a stale navigation,
 * with every predicate still perfect.
 *
 * The whole offline promise rests on these three handlers, and until now not
 * one of them had ever run. So this builds a fake worker global — Cache
 * Storage, `caches`, `fetch`, an event with `respondWith`/`waitUntil` — and
 * executes `public/sw.js` against it.
 *
 * WHAT THAT CANNOT PROVE: that a real browser registers it, that the scope is
 * right, or that an actual offline reload works. This is the logic, exercised.
 * The registration path is `web-supervisor`'s subject and is tested there.
 */

const SOURCE = readFileSync("public/sw.js", "utf8");

/* ------------------------------------------------------- fake platform -- */

class FakeCache {
  entries = new Map<string, { body: string; status: number; type: string }>();

  async put(request: { url: string } | string, response: FakeResponse) {
    this.entries.set(typeof request === "string" ? request : request.url, {
      body: response.body,
      status: response.status,
      type: response.type,
    });
  }
  async match(request: { url: string } | string) {
    const key = typeof request === "string" ? request : request.url;
    const hit = this.entries.get(key);
    return hit ? new FakeResponse(hit.body, { status: hit.status, type: hit.type }) : undefined;
  }
  async addAll(urls: string[]) {
    for (const url of urls) {
      // A real addAll REJECTS if any request fails, which is the behaviour the
      // install handler has to survive.
      if (url.includes("missing")) throw new TypeError("failed to fetch");
      this.entries.set(url, { body: `precached:${url}`, status: 200, type: "basic" });
    }
  }
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }
  async delete(request: { url: string } | string) {
    return this.entries.delete(typeof request === "string" ? request : request.url);
  }
}

class FakeResponse {
  body: string;
  status: number;
  type: string;
  constructor(body: string, init: { status?: number; type?: string } = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.type = init.type ?? "basic";
  }
  get ok() {
    return this.status >= 200 && this.status < 300;
  }
  clone() {
    return new FakeResponse(this.body, { status: this.status, type: this.type });
  }
  static error() {
    return new FakeResponse("", { status: 0, type: "error" });
  }
}

interface Harness {
  self: Record<string, unknown>;
  caches: Map<string, FakeCache>;
  fire(type: string, event: Record<string, unknown>): Promise<void>;
  network: { fail: boolean; response: () => FakeResponse; requests: string[] };
}

function harness(): Harness {
  const listeners = new Map<string, (event: Record<string, unknown>) => void>();
  const cacheStore = new Map<string, FakeCache>();
  const network = {
    fail: false,
    response: () => new FakeResponse("from network", { status: 200, type: "basic" }),
    requests: [] as string[],
  };

  const caches = {
    async open(name: string) {
      if (!cacheStore.has(name)) cacheStore.set(name, new FakeCache());
      return cacheStore.get(name)!;
    },
    async keys() {
      return [...cacheStore.keys()];
    },
    async delete(name: string) {
      return cacheStore.delete(name);
    },
    async match(request: { url: string } | string) {
      for (const cache of cacheStore.values()) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const selfObj: Record<string, unknown> = {
    location: new URL("https://app.example.com/sw.js"),
    addEventListener: (type: string, fn: (event: Record<string, unknown>) => void) => {
      listeners.set(type, fn);
    },
    skipWaiting: () => Promise.resolve(),
    clients: { claim: () => Promise.resolve() },
    caches,
  };

  const fetchImpl = (request: { url: string } | string) => {
    const url = typeof request === "string" ? request : request.url;
    network.requests.push(url);
    return network.fail
      ? Promise.reject(new TypeError("offline"))
      : Promise.resolve(network.response());
  };

  // Execute the real worker source against this scope.
  const factory = new Function(
    "self",
    "caches",
    "fetch",
    "Response",
    "URL",
    `${SOURCE}\n//# sourceURL=sw.js`,
  );
  factory(selfObj, caches, fetchImpl, FakeResponse, URL);

  return {
    self: selfObj,
    caches: cacheStore,
    network,
    async fire(type, event) {
      const fn = listeners.get(type);
      if (!fn) throw new Error(`sw.js registered no ${type} listener`);
      const waits: Array<Promise<unknown>> = [];
      const responses: Array<Promise<unknown>> = [];
      fn({
        ...event,
        waitUntil: (p: Promise<unknown>) => waits.push(p),
        respondWith: (p: Promise<unknown>) => responses.push(p),
      });
      await Promise.all(waits);
      // Exposed so the caller can await the served response.
      (event as { _responses?: Array<Promise<unknown>> })._responses = responses;
      await Promise.all(responses.map((p) => p.catch(() => undefined)));
    },
  };
}

let h: Harness;
beforeEach(() => {
  h = harness();
});

describe("install fills the cache that makes the app openable offline", () => {
  it("precaches the offline shell", async () => {
    await h.fire("install", {});
    const cache = [...h.caches.values()][0];
    expect(cache, "install created no cache at all").toBeTruthy();
    expect([...cache.entries.keys()]).toContain("/offline.html");
  });

  it("still installs when a precache entry cannot be fetched", async () => {
    /*
     * A single missing asset must not leave the worker permanently
     * uninstalled — that would take offline support down entirely because one
     * icon 404'd. `addAll` rejects atomically, so the handler has to catch.
     */
    const source = SOURCE.replace('"/favicon.ico"', '"/missing.ico"');
    const listeners = new Map<string, (e: Record<string, unknown>) => void>();
    const store = new Map<string, FakeCache>();
    const caches = {
      async open(name: string) {
        if (!store.has(name)) store.set(name, new FakeCache());
        return store.get(name)!;
      },
      async keys() {
        return [...store.keys()];
      },
      async delete(n: string) {
        return store.delete(n);
      },
      async match() {
        return undefined;
      },
    };
    let claimed = false;
    new Function("self", "caches", "fetch", "Response", "URL", source)(
      {
        location: new URL("https://app.example.com/sw.js"),
        addEventListener: (t: string, f: (e: Record<string, unknown>) => void) =>
          listeners.set(t, f),
        skipWaiting: () => {
          claimed = true;
          return Promise.resolve();
        },
        clients: { claim: () => Promise.resolve() },
        caches,
      },
      caches,
      () => Promise.resolve(new FakeResponse("x")),
      FakeResponse,
      URL,
    );

    const waits: Array<Promise<unknown>> = [];
    listeners.get("install")!({ waitUntil: (p: Promise<unknown>) => waits.push(p) });
    await Promise.all(waits);
    expect(claimed, "a failed precache left the worker uninstalled").toBe(true);
  });
});

describe("activate removes only the previous versions", () => {
  it("deletes an old cache and keeps the current one", async () => {
    await h.fire("install", {});
    const current = [...h.caches.keys()][0];
    h.caches.set("ocade-shell-v0", new FakeCache());

    await h.fire("activate", {});
    expect([...h.caches.keys()], "activate deleted the cache it depends on").toContain(current);
    expect([...h.caches.keys()], "a superseded cache survived").not.toContain("ocade-shell-v0");
  });
});

describe("navigation is network-first, and falls back rather than failing", () => {
  it("serves the network response when online", async () => {
    await h.fire("install", {});
    const event = {
      request: { url: "https://app.example.com/home", method: "GET", mode: "navigate" },
    };
    await h.fire("fetch", event);
    const served = await (event as unknown as { _responses: Array<Promise<FakeResponse>> })
      ._responses[0];
    expect(served.body).toBe("from network");
  });

  it("serves the offline page when the network fails", async () => {
    /*
     * The whole point of the worker. Without this a laptop on a plane gets the
     * browser's own error page, and the product's central claim is false at the
     * one moment it is being tested.
     */
    await h.fire("install", {});
    h.network.fail = true;
    const event = {
      request: { url: "https://app.example.com/home", method: "GET", mode: "navigate" },
    };
    await h.fire("fetch", event);
    const served = await (event as unknown as { _responses: Array<Promise<FakeResponse>> })
      ._responses[0];
    expect(served.body).toMatch(/offline\.html/);
  });

  it("prefers the exact page over the generic offline shell", async () => {
    // Showing a different page's markup would put the user somewhere they are
    // not.
    await h.fire("install", {});
    const cache = [...h.caches.values()][0];
    await cache.put(
      { url: "https://app.example.com/home" },
      new FakeResponse("the real home page"),
    );
    h.network.fail = true;

    const event = {
      request: { url: "https://app.example.com/home", method: "GET", mode: "navigate" },
    };
    await h.fire("fetch", event);
    const served = await (event as unknown as { _responses: Array<Promise<FakeResponse>> })
      ._responses[0];
    expect(served.body).toBe("the real home page");
  });
});

describe("what the worker refuses to touch", () => {
  it("never intercepts a non-GET request", async () => {
    // A cached POST is a request the user believes happened.
    const event = {
      request: { url: "https://app.example.com/x.js", method: "POST", mode: "cors" },
    };
    await h.fire("fetch", event);
    expect((event as unknown as { _responses: unknown[] })._responses).toHaveLength(0);
  });

  /*
   * ASSET-SHAPED PATHS, deliberately.
   *
   * The first version of this used `/api/chat`, and mutation testing showed it
   * proved nothing: `/api/chat` has no file extension, so the asset check skips
   * it whether or not the exclusion exists. Deleting the entire `/api/` rule
   * left all fifteen tests green.
   *
   * These paths WOULD be cached if the exclusion were removed, so they test the
   * exclusion rather than the extension check. A cached 200 for a request that
   * should now be 401 is a security bug, and a cached reply is somebody's data
   * surviving a sign-out.
   */
  it.each(["/api/bundle.js", "/_serverFn/data.js", "/auth/session.js"])(
    "never intercepts %s, even though it looks like an asset",
    async (path) => {
      const event = {
        request: { url: `https://app.example.com${path}`, method: "GET", mode: "cors" },
      };
      await h.fire("fetch", event);
      expect(
        (event as unknown as { _responses: unknown[] })._responses,
        "an authenticated path was intercepted",
      ).toHaveLength(0);
    },
  );

  it.each(["/api/chat", "/_serverFn/send", "/auth/callback"])(
    "never intercepts %s",
    async (path) => {
      const event = {
        request: { url: `https://app.example.com${path}`, method: "GET", mode: "cors" },
      };
      await h.fire("fetch", event);
      expect((event as unknown as { _responses: unknown[] })._responses).toHaveLength(0);
    },
  );

  it("does not intercept a cross-origin asset", async () => {
    const event = { request: { url: "https://cdn.other.net/a.js", method: "GET", mode: "cors" } };
    await h.fire("fetch", event);
    expect((event as unknown as { _responses: unknown[] })._responses).toHaveLength(0);
  });
});

describe("static assets are cached once fetched", () => {
  it("stores a successful same-origin asset", async () => {
    await h.fire("install", {});
    const event = {
      request: { url: "https://app.example.com/assets/index-abc.js", method: "GET", mode: "cors" },
    };
    await h.fire("fetch", event);
    await (event as unknown as { _responses: Array<Promise<unknown>> })._responses[0];

    const cache = [...h.caches.values()][0];
    // Give the write-behind a tick — the handler caches without awaiting.
    await new Promise((r) => setTimeout(r, 0));
    expect([...cache.entries.keys()]).toContain("https://app.example.com/assets/index-abc.js");
  });

  it("does not store an error response", async () => {
    /*
     * An error cached here is served forever. This is the failure that turns a
     * transient 500 during a deploy into a permanently broken app.
     */
    await h.fire("install", {});
    h.network.response = () => new FakeResponse("boom", { status: 500, type: "basic" });
    const event = {
      request: { url: "https://app.example.com/assets/bad.js", method: "GET", mode: "cors" },
    };
    await h.fire("fetch", event);
    await (event as unknown as { _responses: Array<Promise<unknown>> })._responses[0];
    await new Promise((r) => setTimeout(r, 0));

    const cache = [...h.caches.values()][0];
    expect([...cache.entries.keys()]).not.toContain("https://app.example.com/assets/bad.js");
  });

  it("does not store an opaque cross-origin response", async () => {
    await h.fire("install", {});
    h.network.response = () => new FakeResponse("opaque", { status: 200, type: "opaque" });
    const event = {
      request: { url: "https://app.example.com/assets/x.js", method: "GET", mode: "cors" },
    };
    await h.fire("fetch", event);
    await (event as unknown as { _responses: Array<Promise<unknown>> })._responses[0];
    await new Promise((r) => setTimeout(r, 0));

    const cache = [...h.caches.values()][0];
    expect([...cache.entries.keys()]).not.toContain("https://app.example.com/assets/x.js");
  });

  it("serves a cached asset when the network is gone", async () => {
    await h.fire("install", {});
    const cache = [...h.caches.values()][0];
    await cache.put(
      { url: "https://app.example.com/assets/index-abc.js" },
      new FakeResponse("cached bundle"),
    );
    h.network.fail = true;

    const event = {
      request: { url: "https://app.example.com/assets/index-abc.js", method: "GET", mode: "cors" },
    };
    await h.fire("fetch", event);
    const served = await (event as unknown as { _responses: Array<Promise<FakeResponse>> })
      ._responses[0];
    expect(served.body).toBe("cached bundle");
  });
});

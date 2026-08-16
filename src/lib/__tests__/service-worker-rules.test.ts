import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

/**
 * The service worker's caching rules, executed rather than read.
 *
 * WHY IT IS DONE THIS WAY. `public/sw.js` cannot be imported: it is a classic
 * worker script that reads `self.location` at module scope and registers event
 * listeners on `self`. So the two decision functions are extracted from the
 * source and evaluated with a stubbed `self`. That runs the REAL logic — a
 * change to either predicate changes what these tests see — while a
 * string-matching test would keep passing after the rule was inverted.
 *
 * WHAT IS AT STAKE. Each rule below is a bug that would only show up in
 * production, after a deploy, for some users:
 *
 *   - caching an API response = a signed-out user served someone's data
 *   - caching model weights   = a gigabyte stored twice, invisibly
 *   - NOT caching the .wasm   = an app that opens on a plane and cannot answer
 */

const SOURCE = readFileSync("public/sw.js", "utf8");

/**
 * Pull the decision functions out of the worker source into one shared scope.
 *
 * They must be evaluated together because `isRuntimeCacheable` calls
 * `isModelWeight`; extracting them one at a time gives each its own scope and
 * the call fails with a ReferenceError.
 */
function extractAll(names: string[]): Record<string, (url: URL) => boolean> {
  const bodies = names.map((name) => {
    const match = SOURCE.match(new RegExp(`function ${name}\\(url\\)\\s*\\{[\\s\\S]*?\\n\\}`));
    if (!match) throw new Error(`${name} not found in public/sw.js`);
    return match[0];
  });
  const factory = new Function("self", `${bodies.join("\n")}; return { ${names.join(", ")} };`) as (
    self: unknown,
  ) => Record<string, (url: URL) => boolean>;
  return factory({ location: new URL("https://app.example.com/") });
}

const { isNeverCached, isRuntimeCacheable, isModelWeight } = extractAll([
  "isNeverCached",
  "isModelWeight",
  "isRuntimeCacheable",
]);

const at = (path: string, origin = "https://app.example.com") => new URL(path, origin);

describe("responses that must never be cached", () => {
  it.each(["/api/chat", "/api/conversations/1", "/_serverFn/send", "/auth/callback"])(
    "%s goes straight to the network",
    (path) => {
      // A cached 200 for a request that should now be 401 is a security bug,
      // and a cached reply is somebody's data surviving a sign-out.
      expect(isNeverCached(at(path))).toBe(true);
    },
  );

  it("ordinary assets are not swept up by that rule", () => {
    expect(isNeverCached(at("/assets/index-abc123.js"))).toBe(false);
    expect(isNeverCached(at("/favicon.ico"))).toBe(false);
  });
});

describe("the engine runtime is cached — this is what offline inference needs", () => {
  it("caches the WebAssembly runtime", () => {
    /*
     * The single entry that separates "the app opens offline" from "OCADE
     * answers offline". Without it a user with a downloaded model still gets
     * nothing on a plane, because there is no runtime to execute the weights.
     */
    expect(isRuntimeCacheable(at("/assets/wllama-abc123.wasm"))).toBe(true);
  });

  it("caches a tokenizer shipped as a build asset", () => {
    expect(isRuntimeCacheable(at("/assets/tokenizer-abc.json"))).toBe(true);
  });

  it("does not cache JSON served from an application route", () => {
    // ".json" as a blanket rule would cache whatever a route returns — which
    // in this app means somebody's data, under a URL that outlives a sign-out.
    expect(isRuntimeCacheable(at("/workspace/export.json"))).toBe(false);
    expect(isRuntimeCacheable(at("/conversations/42.json"))).toBe(false);
  });

  it("caches the ordinary static assets", () => {
    for (const path of [
      "/assets/index-abc.js",
      "/assets/style-abc.css",
      "/assets/font.woff2",
      "/logo.svg",
      "/manifest.webmanifest",
    ]) {
      expect(isRuntimeCacheable(at(path)), path).toBe(true);
    }
  });
});

describe("model weights stay out of Cache Storage", () => {
  it.each(["/models/qwen.gguf", "/m/model.safetensors", "/m/weights.bin", "/m/model.onnx"])(
    "%s is recognised as a weight",
    (path) => {
      expect(isModelWeight(at(path))).toBe(true);
    },
  );

  it("same-origin weights are not runtime-cached", () => {
    /*
     * Weights belong in OPFS: hundreds of megabytes, streamed and resumable.
     * A second copy here would consume the same quota twice, and it would be
     * the copy the user cannot see, resume or delete — the Offline Storage
     * screen reports OPFS.
     */
    expect(isRuntimeCacheable(at("/models/qwen2.5-0.5b.gguf"))).toBe(false);
  });

  it("cross-origin weights are excluded by the origin check", () => {
    expect(isRuntimeCacheable(at("/model.gguf", "https://cdn.example.net"))).toBe(false);
  });

  it("does not mistake a wasm runtime for a weight", () => {
    expect(isModelWeight(at("/assets/wllama.wasm"))).toBe(false);
  });
});

describe("cross-origin requests are never runtime-cached", () => {
  it.each(["/a.js", "/b.css", "/c.wasm"])("%s from another origin is skipped", (path) => {
    // An opaque response cached here would be served forever with no way to
    // tell whether it was ever valid.
    expect(isRuntimeCacheable(at(path, "https://other.example.net"))).toBe(false);
  });
});

describe("the worker's stated invariants are still in the file", () => {
  it("pre-caches both OCADE brand assets used by the offline intro", () => {
    expect(SOURCE).toContain('"/brand/ocade-mark.png"');
    expect(SOURCE).toContain('"/brand/ocade-wordmark.png"');
    expect(SOURCE).toContain('"/brand/ocade-companion-v1.png"');
  });

  it("pre-caches both device-only demo rooms for an offline revisit", () => {
    expect(SOURCE).toContain('"/demo/ocade"');
    expect(SOURCE).toContain('"/demo/control"');
  });

  it("pre-caches the application root for cold-start navigation", () => {
    const precache = SOURCE.slice(
      SOURCE.indexOf("const PRECACHE"),
      SOURCE.indexOf("];", SOURCE.indexOf("const PRECACHE")),
    );
    expect(precache).toMatch(/["']\/["']/);
  });

  it("enables navigation preload to remove an avoidable online round trip", () => {
    expect(SOURCE).toContain("navigationPreload");
    expect(SOURCE).toContain("event.preloadResponse");
  });

  it("only handles GET", () => {
    expect(SOURCE).toMatch(/request\.method\s*!==\s*["']GET["']/);
  });

  it("serves navigations network-first", () => {
    // Cache-first navigation is how a service worker serves yesterday's build
    // forever.
    expect(SOURCE).toMatch(/mode\s*===\s*["']navigate["']/);
    const nav = SOURCE.slice(SOURCE.indexOf('mode === "navigate"'));
    expect(nav.indexOf("fetch(request)")).toBeLessThan(nav.indexOf("caches.match(request)"));
  });

  it("keeps the last public document so a previously opened route cold-starts offline", () => {
    const nav = SOURCE.slice(SOURCE.indexOf('mode === "navigate"'));
    expect(nav).toMatch(/contentType\.includes\(["']text\/html["']\)/);
    expect(nav).toMatch(/private\|no-store/);
    expect(nav).toMatch(/cache\.put\(request,\s*copy\)/);
  });

  it("deletes previous cache versions on activate", () => {
    expect(SOURCE).toMatch(/keys\.filter\(\(k\)\s*=>\s*k\s*!==\s*VERSION\)/);
  });

  it("stores only successful basic responses", () => {
    expect(SOURCE).toMatch(/response\.ok\s*&&\s*response\.type\s*===\s*["']basic["']/);
  });
});

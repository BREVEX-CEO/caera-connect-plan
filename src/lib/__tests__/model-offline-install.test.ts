import { describe, it, expect, vi, beforeEach } from "vitest";
import { importModelFile, preferredWeightsUrl, sha256OfBlob } from "../brain/model-download";
import { sameOriginGgufUrl, ggufUrl, WASM_TIERS } from "../brain/browser-catalogue";
import type { ModelStore } from "../brain/model-store";

/**
 * Reaching a working engine with the radio off.
 *
 * OCADE's offline claim had a step in it that could not be done offline: the
 * first one. Every route to a working engine began with a download from the
 * publisher's host, so an air-gapped machine, or one behind an egress policy
 * that blocks that host, could never obtain an engine at all — "works offline
 * once downloaded" quietly meant "does not work here, ever".
 *
 * Two paths close it, and both are asserted to make NO NETWORK CALL rather
 * than merely to succeed. Succeeding is not the property that matters; a
 * function that fetched a fallback and then succeeded would pass a
 * success-only test and fail the actual requirement.
 */

/** A store that lives in memory, with the same contract as the real one. */
function fakeStore() {
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  const meta = new Map<string, unknown>();
  let failWritesAfter = Number.POSITIVE_INFINITY;
  let written = 0;

  const store = {
    async sizeOf(key: string) {
      return files.get(key)?.length ?? 0;
    },
    async append(key: string, chunk: Uint8Array, at: number) {
      written += chunk.length;
      if (written > failWritesAfter) return false;
      const existing = files.get(key) ?? new Uint8Array(new ArrayBuffer(0));
      const next = new Uint8Array(new ArrayBuffer(Math.max(existing.length, at + chunk.length)));
      next.set(existing.subarray(0, Math.min(existing.length, at)), 0);
      next.set(chunk, at);
      files.set(key, next);
      return true;
    },
    async readBlob(key: string) {
      const bytes = files.get(key);
      return bytes ? new Blob([bytes]) : null;
    },
    async remove(key: string) {
      meta.delete(key);
      return files.delete(key);
    },
    async readMeta(key: string) {
      return (meta.get(key) ?? null) as never;
    },
    async writeMeta(key: string, value: unknown) {
      if (value === null) meta.delete(key);
      else meta.set(key, value);
    },
  } as unknown as ModelStore;

  return {
    store,
    files,
    meta,
    setWriteLimit(bytes: number) {
      failWritesAfter = bytes;
    },
  };
}

const payload = new Uint8Array(new ArrayBuffer(4096)).map((_, i) => (i * 7) % 251);
const fileOf = (bytes: Uint8Array<ArrayBuffer>) => new Blob([bytes]);

/**
 * A fetch that fails the test if anything calls it.
 *
 * This is the assertion, not a stub. An import path that reached the network
 * would otherwise still pass every test about its return value.
 */
function forbiddenFetch() {
  return vi.fn(() => {
    throw new Error("the offline install path made a network request");
  });
}

beforeEach(() => {
  // The real store gates on OPFS; these tests inject a store, so the support
  // check is satisfied for the duration.
  vi.stubGlobal("navigator", {
    storage: { getDirectory: () => Promise.resolve({}), estimate: () => Promise.resolve({}) },
  });
  vi.stubGlobal("FileSystemFileHandle", class {});
});

describe("installing the engine from a local file", () => {
  it("writes every byte without touching the network", async () => {
    const { store, files } = fakeStore();
    const net = forbiddenFetch();
    vi.stubGlobal("fetch", net);

    const result = await importModelFile({ key: "wasm/model.gguf", file: fileOf(payload), store });

    expect(result.ok).toBe(true);
    expect(files.get("wasm/model.gguf")).toHaveLength(payload.length);
    expect(net, "an offline install must not fetch anything").not.toHaveBeenCalled();
  });

  it("verifies an imported file against its published digest", async () => {
    const { store, meta } = fakeStore();
    const sha256 = await sha256OfBlob(fileOf(payload));
    expect(sha256).not.toBeNull();

    const result = await importModelFile({
      key: "k",
      file: fileOf(payload),
      sha256: sha256!,
      store,
    });

    expect(result.ok && result.verified).toBe(true);
    expect(meta.get("k")).toMatchObject({ verified: true });
  });

  it("deletes a file that does not match its digest rather than running it", async () => {
    const { store, files } = fakeStore();
    const result = await importModelFile({
      key: "k",
      file: fileOf(payload),
      // A digest the payload cannot possibly have.
      sha256: "0".repeat(64),
      store,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure).toBe("digest_mismatch");
    expect(files.has("k"), "corrupt weights were kept on disk").toBe(false);
  });

  it("reports unverified rather than verified when no digest is supplied", async () => {
    const { store } = fakeStore();
    const result = await importModelFile({ key: "k", file: fileOf(payload), store });
    // Absence of a check is not a passing check.
    expect(result.ok && result.verified).toBe(false);
  });

  it("replaces a partial download instead of appending to it", async () => {
    const { store, files } = fakeStore();
    // A half-finished transfer already on disk under the same key.
    await store.append("k", new Uint8Array(new ArrayBuffer(2048)), 0);

    await importModelFile({ key: "k", file: fileOf(payload), store });

    // Appending would have produced 2048 + 4096 bytes of corrupt weights.
    expect(files.get("k")).toHaveLength(payload.length);
  });

  it("reports progress that ends at exactly the full size", async () => {
    const { store } = fakeStore();
    const seen: { receivedBytes: number; fraction: number }[] = [];
    await importModelFile({
      key: "k",
      file: fileOf(payload),
      store,
      onProgress: (p) => seen.push(p),
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1)?.receivedBytes).toBe(payload.length);
    /*
     * Exactly 1, not 0.999. The bar reaching 99.9% and stopping is what a
     * rounded size constant looked like on screen for the download path, and
     * it is indistinguishable from a hang. How MANY events arrive is set by
     * the Blob stream's own chunking — one for a 4 KB fixture, many hundreds
     * for a real 470 MB file — so asserting a count here would only test the
     * platform's chunk size.
     */
    expect(seen.at(-1)?.fraction).toBe(1);
  });

  it("refuses and cleans up when storage fills mid-write", async () => {
    const { store, files, setWriteLimit } = fakeStore();
    setWriteLimit(1024);
    const result = await importModelFile({ key: "k", file: fileOf(payload), store });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.failure).toBe("insufficient_storage");
    expect(files.has("k"), "a half-written engine was left behind").toBe(false);
  });
});

describe("preferring weights this deployment serves itself", () => {
  const remote = "https://models.example.invalid/model.gguf";

  it("uses the same-origin copy when the deployment has one", async () => {
    let init: RequestInit | undefined;
    const probe = vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
      init = options;
      return new Response(null, { status: 200 });
    });
    const chosen = await preferredWeightsUrl(
      "/models/model.gguf",
      remote,
      probe as unknown as typeof fetch,
    );
    expect(chosen).toEqual({ url: "/models/model.gguf", local: true });
    // A HEAD, not a GET: asking "is it there" must not start pulling 470 MB.
    expect(init).toMatchObject({ method: "HEAD" });
  });

  it("falls back to the publisher when the deployment does not self-host", async () => {
    const probe = vi.fn(async () => new Response(null, { status: 404 }));
    const chosen = await preferredWeightsUrl(
      "/models/model.gguf",
      remote,
      probe as unknown as typeof fetch,
    );
    expect(chosen).toEqual({ url: remote, local: false });
  });

  it("falls back when the probe itself throws, so it can never cause a failure", async () => {
    const probe = vi.fn(async () => {
      throw new Error("offline");
    });
    const chosen = await preferredWeightsUrl(
      "/models/model.gguf",
      remote,
      probe as unknown as typeof fetch,
    );
    expect(chosen).toEqual({ url: remote, local: false });
  });

  it("never enables wllama's CDN compatibility mode", async () => {
    /*
     * `@wllama/wllama` ships a `WasmCompatFromCDN` constant pointing at
     * jsdelivr, and the string is visible in the production bundle — which
     * looks alarming and is currently harmless: `compat` is initialised to
     * null and only becomes the CDN config if `setCompat("default")` is
     * called. OCADE never calls it, so the engine binary is served from this
     * origin as the adapter's comment says.
     *
     * "Currently harmless" is the reason for this test. One `setCompat` call
     * added for a Safari or Firefox fix would silently make every fallback
     * engine load fetch its runtime from a third party — the precise failure
     * an offline user hits at the moment they cannot recover from it, and it
     * would not fail a single existing assertion.
     */
    const { readFileSync } = await import("node:fs");
    const adapter = readFileSync("src/lib/brain/adapters/browser-wasm.ts", "utf8");
    expect(adapter, "wllama compat mode would pull its runtime from a CDN").not.toMatch(
      /setCompat/,
    );
    // The self-hosted binary is what makes that safe; losing it is the same defect.
    expect(adapter).toMatch(/wllama\.wasm\?url/);
  });

  it("points at this origin, not a third party", () => {
    const local = sameOriginGgufUrl(WASM_TIERS[0]);
    expect(local).toBe("/models/qwen2.5-0.5b-instruct-q4_k_m.gguf");
    // The catalogue URL is absolute and external; the self-hosted one is not.
    expect(local?.startsWith("/")).toBe(true);
    expect(ggufUrl(WASM_TIERS[0])?.startsWith("http")).toBe(true);
  });
});

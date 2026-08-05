import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadModel, sha256OfBlob } from "../brain/model-download";
import type { ModelStore } from "../brain/model-store";

/**
 * The download path, driven against a fake store and a fake network.
 *
 * These are the states a 400 MB transfer on a phone actually reaches —
 * interrupted, resumed, cancelled, corrupted, out of space — and each one is
 * exercised here rather than hoped about. The rule under test throughout: a
 * digest that cannot be checked is UNVERIFIED, and weights that fail their
 * digest are DELETED rather than kept for a "resume" that would produce a
 * model which loads and answers nonsense.
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

/** A response whose body streams the given bytes in small pieces. */
function streamingResponse(bytes: Uint8Array<ArrayBuffer>, init: ResponseInit = {}) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 8) {
        controller.enqueue(bytes.subarray(i, Math.min(i + 8, bytes.length)));
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-length": String(bytes.length) },
    ...init,
  });
}

const payload = new Uint8Array(new ArrayBuffer(64)).map((_, i) => i % 251);

beforeEach(() => {
  // The real store gates on OPFS; these tests inject a store, so the support
  // check is satisfied for the duration.
  vi.stubGlobal("navigator", {
    storage: { getDirectory: () => Promise.resolve({}), estimate: () => Promise.resolve({}) },
  });
  vi.stubGlobal("FileSystemFileHandle", class {});
});

describe("a clean download", () => {
  it("writes every byte and reports the total", async () => {
    const { store, files } = fakeStore();
    const result = await downloadModel({
      key: "wasm/model.gguf",
      url: "https://example.invalid/model.gguf",
      store,
      fetchImpl: (async () => streamingResponse(payload)) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(files.get("wasm/model.gguf")).toHaveLength(payload.length);
  });

  it("reports progress that ends at the full size", async () => {
    const { store } = fakeStore();
    const seen: number[] = [];
    await downloadModel({
      key: "k",
      url: "u",
      store,
      expectedBytes: payload.length,
      onProgress: (p) => seen.push(p.receivedBytes),
      fetchImpl: (async () => streamingResponse(payload)) as unknown as typeof fetch,
    });
    expect(seen.at(-1)).toBe(payload.length);
    expect(seen.length).toBeGreaterThan(1);
  });
});

describe("verification", () => {
  it("marks a matching digest as verified", async () => {
    const { store } = fakeStore();
    const expected = await sha256OfBlob(new Blob([payload]));
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      sha256: expected!,
      fetchImpl: (async () => streamingResponse(payload)) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.verified).toBe(true);
  });

  it("DELETES weights whose digest does not match, rather than keeping them", async () => {
    const { store, files } = fakeStore();
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      sha256: "0".repeat(64),
      fetchImpl: (async () => streamingResponse(payload)) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("digest_mismatch");
    // Kept, they would be "resumed" next time into a model that answers rubbish.
    expect(files.has("k")).toBe(false);
  });

  it("reports unverified — never verified — when no digest was published", async () => {
    const { store } = fakeStore();
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      fetchImpl: (async () => streamingResponse(payload)) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.verified).toBe(false);
  });
});

describe("resuming", () => {
  it("asks for only the missing bytes when part of the file is present", async () => {
    const { store, files } = fakeStore();
    files.set("k", payload.subarray(0, 24));
    let sentRange: string | null = null;
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      fetchImpl: (async (_u: string, init?: RequestInit) => {
        sentRange = (init?.headers as Record<string, string> | undefined)?.Range ?? null;
        return streamingResponse(payload.subarray(24), { status: 206 });
      }) as unknown as typeof fetch,
    });
    expect(sentRange).toBe("bytes=24-");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.resumed).toBe(true);
    expect(files.get("k")).toHaveLength(payload.length);
  });

  it("restarts from zero when the server ignores the range request", async () => {
    /*
     * A server answering 200 sends the WHOLE file. Appending that to what is
     * already stored produces a silently corrupt double-length file, so the
     * partial download is discarded and the transfer starts again.
     */
    const { store, files } = fakeStore();
    files.set("k", payload.subarray(0, 24));
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      fetchImpl: (async () =>
        streamingResponse(payload, { status: 200 })) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(true);
    expect(files.get("k")).toHaveLength(payload.length);
  });

  it("does not re-download a file that is already complete and verified", async () => {
    const { store, files, meta } = fakeStore();
    files.set("k", payload);
    meta.set("k", { verified: true, expectedBytes: payload.length });
    const fetchImpl = vi.fn();
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      expectedBytes: payload.length,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
  });
});

describe("interruption and refusal", () => {
  it("keeps what it already received when cancelled, so a resume is cheap", async () => {
    const { store, files } = fakeStore();
    const controller = new AbortController();
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      signal: controller.signal,
      onProgress: (p) => {
        if (p.receivedBytes >= 16) controller.abort();
      },
      fetchImpl: (async () => streamingResponse(payload)) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("cancelled");
    // Stopping is not the same as discarding.
    expect(files.get("k")?.length ?? 0).toBeGreaterThan(0);
  });

  it("reports a mid-transfer network failure honestly", async () => {
    const { store } = fakeStore();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payload.subarray(0, 8));
        controller.error(new Error("connection reset"));
      },
    });
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      fetchImpl: (async () => new Response(body, { status: 200 })) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toBe("network");
      expect(result.reason).toMatch(/interrupted/i);
    }
  });

  it("calls a failing write insufficient storage rather than a network error", async () => {
    const { store, setWriteLimit } = fakeStore();
    setWriteLimit(4);
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      fetchImpl: (async () => streamingResponse(payload)) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("insufficient_storage");
  });

  it("reports a refusing server by its status", async () => {
    const { store } = fakeStore();
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      fetchImpl: (async () => new Response("nope", { status: 503 })) as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure).toBe("network");
      expect(result.reason).toContain("503");
    }
  });

  it("refuses before starting when the browser has no room", async () => {
    const { store } = fakeStore();
    vi.stubGlobal("navigator", {
      storage: {
        getDirectory: () => Promise.resolve({}),
        estimate: () => Promise.resolve({ quota: 1000, usage: 900 }),
      },
    });
    const fetchImpl = vi.fn();
    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      expectedBytes: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("insufficient_storage");
    // Refusing AFTER filling the disk is not a refusal path.
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

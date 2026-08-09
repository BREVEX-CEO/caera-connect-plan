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

describe("a finished download stays finished", () => {
  /**
   * Interrupted-download resume defect, fixed.
   *
   * Completion used to be decided by `alreadyHave >= expectedBytes`, which made
   * a hand-written catalogue constant load-bearing for correctness. The WASM
   * tier declared `469 * MB` — 491,782,144 — beside a comment giving the real
   * size, 491,400,032. The 382,112-byte gap meant the check never passed for a
   * file that had downloaded perfectly.
   *
   * The consequence was the worst-shaped bug available: on-device inference
   * broke *because* the download had succeeded. Every subsequent launch resumed
   * from the full length, the server answered 416 Range Not Satisfiable, and
   * that was reported as a network failure. The engine was permanently
   * unreachable for exactly the users who had waited out a 491 MB transfer.
   *
   * Two fixes, both pinned below: the digest decides completeness, and a 416 on
   * a resume means "already complete" rather than "unreachable".
   */
  const digestOf = async (bytes: Uint8Array) => (await sha256OfBlob(new Blob([bytes.slice()])))!;

  it("uses a verified file without going to the network at all", async () => {
    const { store, files, meta } = fakeStore();
    files.set("k", payload.slice() as Uint8Array<ArrayBuffer>);
    meta.set("k", { verified: true, expectedBytes: payload.length });

    const fetchImpl = vi.fn();
    const result = await downloadModel({
      key: "k",
      url: "u",
      // Deliberately WRONG, and larger than the file — the exact shape of the
      // original defect. A verified file must be used regardless.
      expectedBytes: payload.length + 382_112,
      store,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.verified).toBe(true);
    expect(fetchImpl, "a completed engine was re-downloaded").not.toHaveBeenCalled();
  });

  it("treats a 416 on resume as a complete download, not a network failure", async () => {
    const { store, files } = fakeStore();
    files.set("k", payload.slice() as Uint8Array<ArrayBuffer>);

    const result = await downloadModel({
      key: "k",
      url: "u",
      sha256: await digestOf(payload),
      store,
      fetchImpl: (async () => new Response(null, { status: 416 })) as unknown as typeof fetch,
    });

    expect(result.ok, "a finished engine reported itself unreachable").toBe(true);
    expect(result.ok && result.verified).toBe(true);
    expect(result.ok && result.bytes).toBe(payload.length);
  });

  it("does not delete the completed file while handling the 416", async () => {
    /*
     * ORDERING. The range-ignored branch treats any non-206 as "the server sent
     * the whole file" and clears what is on disk. Running it before the 416
     * check would destroy the very download being rescued, then hash a file
     * that no longer exists.
     */
    const { store, files } = fakeStore();
    files.set("k", payload.slice() as Uint8Array<ArrayBuffer>);

    await downloadModel({
      key: "k",
      url: "u",
      sha256: await digestOf(payload),
      store,
      fetchImpl: (async () => new Response(null, { status: 416 })) as unknown as typeof fetch,
    });

    expect(files.get("k"), "the completed download was deleted").toHaveLength(payload.length);
  });

  it("still deletes a corrupt file that answers 416", async () => {
    // "Already complete" must not become a way to skip verification: a wrong
    // file of the right length would otherwise load and answer nonsense.
    const { store, files } = fakeStore();
    files.set("k", payload.slice() as Uint8Array<ArrayBuffer>);

    const result = await downloadModel({
      key: "k",
      url: "u",
      sha256: "0".repeat(64),
      store,
      fetchImpl: (async () => new Response(null, { status: 416 })) as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure).toBe("digest_mismatch");
    expect(files.has("k"), "corrupt weights were kept").toBe(false);
  });

  it("does not short-circuit on an unverified file", async () => {
    // Only a checked digest may skip the network. Bytes on disk with no proof
    // are just bytes.
    const { store, files, meta } = fakeStore();
    files.set("k", payload.slice(0, 32) as Uint8Array<ArrayBuffer>);
    meta.set("k", { verified: false, expectedBytes: payload.length });

    const fetchImpl = vi.fn(async () =>
      streamingResponse(payload.slice(32) as Uint8Array<ArrayBuffer>, { status: 206 }),
    );
    await downloadModel({
      key: "k",
      url: "u",
      expectedBytes: payload.length,
      store,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(fetchImpl, "an unverified partial file was treated as done").toHaveBeenCalled();
  });
});

describe("the published catalogue matches the file it points at", () => {
  it("declares the exact byte count, not a rounded one", async () => {
    /*
     * The number that caused the defect. Verified against a live HEAD request
     * to the published URL: content-length 491,400,032. `469 * MB` rounds to
     * 491,782,144 and is what bricked the engine.
     */
    const { WASM_TIERS } = await import("../brain/browser-catalogue");
    expect(WASM_TIERS[0].downloadBytes).toBe(491_400_032);
    // Not a whole number of MiB — a rounded constant is the bug returning.
    expect(WASM_TIERS[0].downloadBytes % (1024 * 1024)).not.toBe(0);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadModel } from "../brain/model-download";
import type { ModelStore } from "../brain/model-store";

function fakeStore() {
  const files = new Map<string, Uint8Array<ArrayBuffer>>();
  const meta = new Map<string, any>();
  const store = {
    sizeOf: async (key: string) => files.get(key)?.length ?? 0,
    append: async (key: string, chunk: Uint8Array, at: number) => {
      const existing = files.get(key) ?? new Uint8Array(new ArrayBuffer(0));
      const next = new Uint8Array(new ArrayBuffer(Math.max(existing.length, at + chunk.length)));
      next.set(existing, 0);
      next.set(chunk, at);
      files.set(key, next);
      return true;
    },
    readBlob: async (key: string) => {
      const bytes = files.get(key);
      return bytes ? new Blob([bytes]) : null;
    },
    remove: async (key: string) => {
      meta.delete(key);
      files.delete(key);
      return true;
    },
    readMeta: async (key: string) => meta.get(key) ?? null,
    writeMeta: async (key: string, value: unknown) => {
      if (value === null) meta.delete(key);
      else meta.set(key, value);
    },
  } as unknown as ModelStore;
  return { store, files, meta };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("navigator", {
    storage: { getDirectory: () => Promise.resolve({}), estimate: () => Promise.resolve({}) },
  });
  vi.stubGlobal("FileSystemFileHandle", class {});
});

describe("model download hidden failure modes", () => {
  it("keeps a large partial file when a resume attempt gets HTTP 503", async () => {
    const { store, files } = fakeStore();
    const partial = new Uint8Array(new ArrayBuffer(24));
    files.set("k", partial);

    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      fetchImpl: (async () => new Response("busy", { status: 503 })) as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    expect(files.get("k")).toHaveLength(24);
  });

  it("does not trust stale verified metadata for a different physical file size", async () => {
    const { store, files, meta } = fakeStore();
    files.set("k", new Uint8Array(new ArrayBuffer(8)));
    meta.set("k", { verified: true, expectedBytes: 64, sha256: "a".repeat(64) });
    const fetchImpl = vi.fn(async () => new Response("missing", { status: 404 }));

    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(result.ok).toBe(false);
  });

  it("refuses to execute a downloaded model when its published digest cannot be checked", async () => {
    const { store } = fakeStore();
    vi.stubGlobal("crypto", {});
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3, 4]));
        controller.close();
      },
    });

    const result = await downloadModel({
      key: "k",
      url: "u",
      store,
      sha256: "0".repeat(64),
      fetchImpl: (async () => new Response(body, { status: 200 })) as unknown as typeof fetch,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("verification_unavailable");
  });
});

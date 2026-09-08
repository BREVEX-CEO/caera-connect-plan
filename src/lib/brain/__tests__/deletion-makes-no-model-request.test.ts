import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ModelVault } from "../model-vault";
import type { ModelFileWriter, ModelStore } from "../model-store";
import { deleteLocalData } from "@/lib/storage/local-data";

/**
 * DELETING ACCOUNT DATA MUST NOT COST A GIGABYTE.
 *
 * PLAN.md §A is unusually specific about this, and the specificity is the point:
 * after an account-data deletion there must be "no model-origin `fetch`, `HEAD`,
 * Range request, preconnect, or mirror probe", the verified bytes must be
 * unchanged, the active version must be unchanged, and "automatic preparation
 * does not restart".
 *
 * Every one of those is a thing that CANNOT be seen by looking at the screen.
 * The product would look identical either way — a progress panel appearing in
 * the corner is exactly what a first install looks like — and the person only
 * discovers the difference from their data bill. So the network is watched
 * rather than reasoned about.
 *
 * The spy fails on ANY request, not merely on a model host. A test that
 * allow-listed everything except huggingface.co would pass a mirror nobody
 * remembered to add to the list, and adding a mirror is exactly the change that
 * would introduce this bug.
 */

/** The hosts a model can legitimately come from, named so the test says what it guards. */
const MODEL_ORIGINS = ["https://huggingface.co"];

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    get length() {
      return map.size;
    },
    key: (index: number) => [...map.keys()][index] ?? null,
  };
}

function memoryStore() {
  const files = new Map<string, Uint8Array>();
  const writerFor = (key: string): ModelFileWriter => ({
    async write(chunk, at) {
      const existing = files.get(key) ?? new Uint8Array(0);
      const next = new Uint8Array(Math.max(existing.length, at + chunk.length));
      next.set(existing, 0);
      next.set(chunk, at);
      files.set(key, next);
      return true;
    },
    async flush() {
      return true;
    },
    async close() {},
  });
  const store = {
    async sizeOf(key: string) {
      return files.get(key)?.length ?? 0;
    },
    async openWriter(key: string) {
      return writerFor(key);
    },
    async readBlob(key: string) {
      const bytes = files.get(key);
      return bytes ? new Blob([bytes as BufferSource]) : null;
    },
    async remove(key: string) {
      return files.delete(key);
    },
    async list() {
      return [...files.entries()].map(([key, bytes]) => ({
        key,
        bytes: bytes.length,
        verified: false,
      }));
    },
    async readMeta() {
      return null as never;
    },
    async writeMeta() {},
  } as unknown as ModelStore;
  return { store, files };
}

let requests: string[];
let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  requests = [];
  originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    requests.push(typeof input === "string" ? input : input.toString());
    return new Response(null, { status: 500 });
  }) as unknown as typeof globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("account-data deletion never reaches a model origin", () => {
  it("names the origins it is guarding, so an empty list cannot pass", () => {
    expect(MODEL_ORIGINS.length).toBeGreaterThan(0);
    for (const origin of MODEL_ORIGINS) expect(origin).toMatch(/^https:\/\//);
  });

  it("deletes every account class and asks the network for nothing", async () => {
    const backing = memoryStore();
    const storage = memoryStorage();
    const vault = new ModelVault({ store: backing.store, storage });

    const writer = await vault.openWriter("v1");
    await writer!.write(new Uint8Array(2048).fill(7), 0);
    await writer!.close();
    vault.writeMeta("v1", { verified: true, expectedBytes: 2048, sha256: "d".repeat(64) });
    await vault.activate("v1");

    const before = await vault.installationView();
    expect(before).toEqual({ stored: true, ready: true });
    const bytesBefore = new Map(backing.files);

    storage.setItem("ocade.memory.local.v1", "[]");
    storage.setItem("caera:conversations", "[]");
    storage.setItem("ocade.artifacts.v1", "[]");

    const result = deleteLocalData(["all_account_data"], {
      store: storage,
      readModelIdentity: () => {
        const version = vault.activeVersion();
        if (!version) return null;
        const meta = vault.readMeta(version);
        return { version, verified: meta?.verified === true, sha256: meta?.sha256 };
      },
    });

    expect(result.deletedRecords).toBe(3);
    expect(result.modelAfter).toEqual(result.modelBefore);
    expect(result.modelNetworkRequests).toBe(0);

    // Reading the install state afterwards is what a real surface does next,
    // and it is the moment a naive implementation would start downloading.
    expect(await vault.installationView()).toEqual({ stored: true, ready: true });
    expect(vault.activeVersion()).toBe("v1");
    expect(vault.readMeta("v1")?.verified).toBe(true);

    // The bytes themselves, unchanged.
    for (const [key, bytes] of bytesBefore) {
      expect(backing.files.get(key)?.length, key).toBe(bytes.length);
    }
    expect(requests).toEqual([]);
  });

  it("recovers a wiped pointer from storage OCADE already has, still without the network", async () => {
    /*
     * The harsher case: not just account data deleted, but everything local
     * gone — private mode, a browser tidying site data, the `localStorage
     * .clear()` this product used to run. Before the sidecar existed this left
     * a complete, verified model that the product could not see, and
     * preparation began again from nothing.
     */
    const backing = memoryStore();
    const storage = memoryStorage();
    const vault = new ModelVault({ store: backing.store, storage });

    const writer = await vault.openWriter("v1");
    await writer!.write(new Uint8Array(2048).fill(7), 0);
    await writer!.close();
    vault.writeMeta("v1", { verified: true, expectedBytes: 2048, sha256: "d".repeat(64) });
    await vault.activate("v1");

    storage.clear();
    requests.length = 0;

    // The first thing any surface asks. It must recover, not re-download.
    expect(await vault.installationView()).toEqual({ stored: true, ready: true });
    expect(vault.activeVersion()).toBe("v1");
    expect(requests).toEqual([]);
  });

  it("does not reach the network even when there is genuinely no model", async () => {
    // "Nothing installed" must be an answer, not a trigger. Automatic
    // preparation is a decision somebody else makes, with a permit and a UI.
    const backing = memoryStore();
    const vault = new ModelVault({ store: backing.store, storage: memoryStorage() });
    expect(await vault.installationView()).toEqual({ stored: false, ready: false });
    expect(requests).toEqual([]);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { ModelVault, versionPath } from "../model-vault";
import type { ModelStore, ModelFileWriter } from "../model-store";

/**
 * Staging, activation, rollback and removal.
 *
 * THE PROPERTY EVERYTHING HERE PROTECTS: a failed upgrade must never be able to
 * destroy the engine that was working. The layout is what makes that true — one
 * directory per immutable version and one pointer that says which is active, so
 * promotion is a single write rather than a copy that might not finish, and a
 * candidate that fails verification is simply never pointed at.
 *
 * The second property, equally load-bearing: NOTHING UNVERIFIED CAN BE
 * ACTIVATED, however complete it looks. Bytes on disk are inert until something
 * with evidence says otherwise.
 */

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    keys: () => [...map.keys()],
  };
}

function memoryStore() {
  const files = new Map<string, Uint8Array>();
  const meta = new Map<string, unknown>();

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
    async append(key: string, chunk: Uint8Array, at: number) {
      return writerFor(key).write(chunk, at);
    },
    async movePath(from: string, to: string) {
      const bytes = files.get(from);
      if (!bytes) return false;
      files.set(to, bytes);
      files.delete(from);
      return true;
    },
    async readBlob(key: string) {
      const bytes = files.get(key);
      return bytes ? new Blob([bytes as BufferSource]) : null;
    },
    async remove(key: string) {
      return files.delete(key);
    },
    async readMeta(key: string) {
      return (meta.get(key) ?? null) as never;
    },
    async writeMeta(key: string, value: unknown) {
      if (value === null) meta.delete(key);
      else meta.set(key, value);
    },
    async list() {
      return [...files.entries()].map(([key, bytes]) => ({
        key,
        bytes: bytes.length,
        verified: false,
      }));
    },
  } as unknown as ModelStore;

  return { store, files, meta };
}

let backing: ReturnType<typeof memoryStore>;
let storage: ReturnType<typeof memoryStorage>;
let vault: ModelVault;

async function put(version: string, bytes: number, verified = true) {
  const writer = await vault.openWriter(version);
  await writer!.write(new Uint8Array(bytes).fill(1), 0);
  await writer!.close();
  vault.writeMeta(version, { verified, expectedBytes: bytes, sha256: `digest-${version}` });
}

beforeEach(() => {
  backing = memoryStore();
  storage = memoryStorage();
  vault = new ModelVault({ store: backing.store, storage });
});

describe("activation is a pointer, not a move", () => {
  it("activates a verified version", async () => {
    await put("v1", 100);
    expect(await vault.activate("v1")).toBe(true);
    expect(vault.activeVersion()).toBe("v1");
  });

  it("REFUSES to activate an unverified version, however complete it looks", async () => {
    await put("v1", 100, false);
    expect(await vault.activate("v1")).toBe(false);
    expect(vault.activeVersion()).toBeNull();
  });

  it("refuses a version with no metadata at all", async () => {
    expect(await vault.activate("never-heard-of-it")).toBe(false);
    expect(vault.activeVersion()).toBeNull();
  });

  it("moves the bytes nowhere when a version is promoted", async () => {
    await put("v1", 100);
    const before = [...backing.files.keys()];
    await vault.activate("v1");
    // Promotion touched no file at all: that is what makes it atomic rather
    // than "atomic if the copy finishes".
    expect([...backing.files.keys()]).toEqual(before);
  });

  it("remembers the outgoing version as the rollback target", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    await put("v2", 120);
    await vault.activate("v2");
    expect(vault.activeVersion()).toBe("v2");
    expect(vault.previousVersion()).toBe("v1");
  });
});

describe("a failed upgrade cannot destroy the working engine", () => {
  it("leaves the active version untouched while a candidate is staged", async () => {
    await put("v1", 100);
    await vault.activate("v1");

    // A candidate downloading into its own directory, not yet verified.
    const writer = await vault.openWriter("v2");
    await writer!.write(new Uint8Array(40).fill(9), 0);
    await writer!.close();
    vault.writeMeta("v2", { verified: false, expectedBytes: 120 });

    expect(vault.activeVersion()).toBe("v1");
    expect(await vault.bytesOf("v1")).toBe(100);
  });

  it("removing a failed candidate does not disturb the active one", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    await put("v2", 120, false);

    await vault.removeVersion("v2");
    expect(vault.activeVersion()).toBe("v1");
    expect(await vault.bytesOf("v1")).toBe(100);
    expect(await vault.bytesOf("v2")).toBe(0);
  });

  it("rolls back to the previous version when one is still present", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    await put("v2", 120);
    await vault.activate("v2");

    expect(await vault.rollback()).toBe("v1");
    expect(vault.activeVersion()).toBe("v1");
    // And the version rolled away from becomes the thing to roll forward to.
    expect(vault.previousVersion()).toBe("v2");
  });

  it("refuses to roll back to a version whose files are gone", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    await put("v2", 120);
    await vault.activate("v2");
    await vault.removeVersion("v1");

    expect(await vault.rollback()).toBeNull();
    expect(vault.activeVersion()).toBe("v2");
  });

  it("has nothing to roll back to on a first install", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    expect(await vault.rollback()).toBeNull();
  });
});

describe("pruning keeps exactly one generation behind", () => {
  it("removes older versions but never the active or previous one", async () => {
    for (const [version, bytes] of [
      ["v1", 100],
      ["v2", 110],
      ["v3", 120],
    ] as const) {
      await put(version, bytes);
      await vault.activate(version);
    }

    const removed = await vault.pruneTo(["v3"]);
    expect(removed).toEqual(["v1"]);
    expect(vault.activeVersion()).toBe("v3");
    expect(await vault.bytesOf("v3")).toBe(120);
    // Kept deliberately: a bad upgrade needs somewhere to fall back to.
    expect(await vault.bytesOf("v2")).toBe(110);
  });

  it("keeps whatever it is explicitly told to keep", async () => {
    await put("v1", 100);
    await put("keepme", 50);
    await vault.activate("v1");
    const removed = await vault.pruneTo(["v1", "keepme"]);
    expect(removed).toEqual([]);
  });
});

describe("listing sees files even when their metadata was lost", () => {
  it("reports a version whose metadata is gone", async () => {
    await put("v1", 100);
    // Private mode, a cleared localStorage, a storage partition reset.
    vault.writeMeta("v1", null);

    const versions = await vault.listVersions();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ version: "v1", bytes: 100 });
    // A gigabyte the product cannot see is a gigabyte it cannot be honest about.
    expect(versions[0].meta).toBeNull();
  });

  it("ignores files outside the versioned layout", async () => {
    await put("v1", 100);
    // A pre-versioning artifact from an older install.
    await backing.store.append("wasm/old/engine.gguf", new Uint8Array(10), 0);
    const versions = await vault.listVersions();
    expect(versions.map((v) => v.version)).toEqual(["v1"]);
  });
});

describe("uninstall removes the engine and only the engine", () => {
  it("removes every version, the pointers and the metadata", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    await put("v2", 120);
    await vault.activate("v2");

    const result = await vault.removeEverything();
    expect(result.versionsRemoved).toBe(2);
    expect(vault.activeVersion()).toBeNull();
    expect(vault.previousVersion()).toBeNull();
    expect(await vault.listVersions()).toEqual([]);
    expect(vault.readMeta("v1")).toBeNull();
  });

  it("removes pre-versioning artifacts too", async () => {
    // Somebody who installed before the layout was versioned has hundreds of
    // megabytes under the old keys. An uninstall that left them would report
    // "removed" over a full disk.
    await backing.store.append("wasm/qwen/engine.gguf", new Uint8Array(500), 0);
    await put("v1", 100);

    const result = await vault.removeEverything();
    expect(result.legacyRemoved).toBeGreaterThan(0);
    expect(backing.files.size).toBe(0);
  });

  it("leaves storage that is not OCADE's engine completely alone", async () => {
    await put("v1", 100);
    storage.setItem("caera:conversations", "a conversation");
    storage.setItem("caera:demo:session:v2", "12345");
    storage.setItem("supabase.auth.token", "a token");

    await vault.removeEverything();

    expect(storage.getItem("caera:conversations")).toBe("a conversation");
    expect(storage.getItem("caera:demo:session:v2")).toBe("12345");
    expect(storage.getItem("supabase.auth.token")).toBe("a token");
  });
});

describe("adopting a pre-versioning install", () => {
  it("moves a verified legacy file in rather than re-downloading it", async () => {
    const legacy = "wasm/qwen/engine.gguf";
    await backing.store.append(legacy, new Uint8Array(400).fill(7), 0);
    await backing.store.writeMeta(legacy, {
      verified: true,
      expectedBytes: 400,
      sha256: "known-digest",
    });

    const adopted = await vault.adoptLegacy(legacy, "v1", {
      sha256: "known-digest",
      expectedBytes: 400,
    });

    expect(adopted).toBe(true);
    expect(vault.activeVersion()).toBe("v1");
    expect(await vault.bytesOf("v1")).toBe(400);
    expect(vault.readMeta("v1")?.verified).toBe(true);
    // Moved, not copied: the user's disk does not hold it twice.
    expect(await backing.store.sizeOf(legacy)).toBe(0);
  });

  it("REFUSES an unverified legacy file", async () => {
    const legacy = "wasm/qwen/engine.gguf";
    await backing.store.append(legacy, new Uint8Array(400), 0);
    await backing.store.writeMeta(legacy, { verified: false, expectedBytes: 400 });

    // Adopting on the strength of a length is the shortcut that ships a
    // corrupt engine. It falls through to the normal, verified path instead.
    expect(await vault.adoptLegacy(legacy, "v1", { expectedBytes: 400 })).toBe(false);
    expect(vault.activeVersion()).toBeNull();
  });

  it("refuses a legacy file whose digest is for different weights", async () => {
    const legacy = "wasm/qwen/engine.gguf";
    await backing.store.append(legacy, new Uint8Array(400), 0);
    await backing.store.writeMeta(legacy, {
      verified: true,
      expectedBytes: 400,
      sha256: "an-older-engine",
    });

    expect(
      await vault.adoptLegacy(legacy, "v1", { sha256: "the-current-engine", expectedBytes: 400 }),
    ).toBe(false);
  });

  it("does nothing when the version is already installed", async () => {
    await put("v1", 100);
    const legacy = "wasm/qwen/engine.gguf";
    await backing.store.append(legacy, new Uint8Array(400), 0);
    await backing.store.writeMeta(legacy, { verified: true, expectedBytes: 400 });

    expect(await vault.adoptLegacy(legacy, "v1", { expectedBytes: 400 })).toBe(false);
    expect(await vault.bytesOf("v1")).toBe(100);
  });
});

describe("storage paths cannot escape their directory", () => {
  it("sanitises a version or artifact name into one safe segment", () => {
    for (const hostile of ["../../etc/passwd", "..", "./x", "a/b/c", ".hidden"]) {
      const path = versionPath(hostile, hostile);
      expect(path.startsWith("versions/")).toBe(true);
      for (const segment of path.split("/")) {
        expect(segment).not.toBe("..");
        expect(segment.startsWith(".")).toBe(false);
      }
      expect(path.split("/")).toHaveLength(3);
    }
  });

  it("never produces an empty segment", () => {
    const path = versionPath("", "");
    expect(path.split("/").every((segment) => segment.length > 0)).toBe(true);
  });
});

describe("metadata patches are bookkeeping, never evidence", () => {
  it("a patch cannot promote an unproven file to verified", async () => {
    await put("v1", 100, false);
    vault.patchMeta("v1", { contiguousChunks: 12, chunkBytes: 4096 });
    expect(vault.readMeta("v1")?.verified).toBe(false);
    // And that unproven version still cannot be activated.
    expect(await vault.activate("v1")).toBe(false);
  });

  it("keeps the rest of the metadata when patching one field", async () => {
    await put("v1", 100, false);
    vault.patchMeta("v1", { contiguousChunks: 3 });
    const meta = vault.readMeta("v1");
    expect(meta?.expectedBytes).toBe(100);
    expect(meta?.sha256).toBe("digest-v1");
    expect(meta?.contiguousChunks).toBe(3);
  });
});

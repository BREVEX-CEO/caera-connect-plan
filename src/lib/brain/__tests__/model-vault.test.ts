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
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    /** Everything gone, as a browser clearing site data does it. */
    clear: () => map.clear(),
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
    async writeFile(key: string, bytes: Uint8Array) {
      files.set(key, bytes.slice());
      return true;
    },
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
      }));
    },
  } as unknown as ModelStore;

  const write = (key: string, bytes: Uint8Array) => writerFor(key).write(bytes, 0);
  return { store, files, write };
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
  vault = new ModelVault({ store: backing.store, legacy: storage });
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
    /*
     * Promotion moves no ARTIFACT at all: that is what makes it atomic rather
     * than "atomic if the copy finishes".
     *
     * It does write one new file — the pointer sidecar — and that is the point
     * of the sidecar rather than a violation of this rule: it records what the
     * pointer now says, beside the bytes it describes, so a browser that clears
     * local storage does not leave a verified model unusable. It never carries
     * an artifact and never replaces one.
     */
    const artifactsAfter = [...backing.files.keys()].filter((key) => key.endsWith(".bin"));
    expect(artifactsAfter).toEqual(before.filter((key) => key.endsWith(".bin")));
    expect([...backing.files.keys()]).toContain("versions/pointers.json");
  });

  it("keeps the pointer only in OPFS, so clearing site storage changes nothing", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    storage.clear();
    expect(storage.length).toBe(0);

    // A new tab, a reload: everything comes from the manifest beside the bytes.
    const reloaded = new ModelVault({ store: backing.store, legacy: storage });
    expect(await reloaded.installationView()).toEqual({ ready: true, stored: true });
    expect(reloaded.activeVersion()).toBe("v1");
    expect(reloaded.readMeta("v1")?.verified).toBe(true);
  });

  it("writes nothing about the model to localStorage", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    await put("v2", 120);
    await vault.activate("v2");
    expect(storage.length).toBe(0);
  });

  it("moves an older release's localStorage pointers into OPFS once, then clears them", async () => {
    storage.setItem("ocade.model.active.v1", "v1");
    storage.setItem(
      "ocade.model.version.v1.v1",
      JSON.stringify({ verified: true, expectedBytes: 100, sha256: "d" }),
    );
    storage.setItem("ocade.model.meta.wasm/old.bin", JSON.stringify({ verified: true }));
    storage.setItem("supabase.auth.token", "kept");
    const writer = await backing.store.openWriter(versionPath("v1", "v1.bin"));
    await writer!.write(new Uint8Array(100), 0);

    const migrated = new ModelVault({ store: backing.store, legacy: storage });
    expect(await migrated.installationView()).toEqual({ ready: true, stored: true });
    expect(storage.getItem("ocade.model.active.v1")).toBeNull();
    expect(storage.getItem("ocade.model.meta.wasm/old.bin")).toBeNull();
    expect(storage.getItem("supabase.auth.token")).toBe("kept");

    // The manifest alone now carries it.
    const again = new ModelVault({ store: backing.store, legacy: null });
    expect(await again.installationView()).toEqual({ ready: true, stored: true });
  });

  it("refuses a pointer the manifest's verification record does not justify", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    await backing.store.writeFile(
      "versions/pointers.json",
      new TextEncoder().encode(
        JSON.stringify({ active: "v1", meta: { v1: { verified: false, expectedBytes: 100 } } }),
      ),
    );
    const reloaded = new ModelVault({ store: backing.store, legacy: null });
    expect(await reloaded.installationView()).toEqual({ ready: false, stored: false });
  });

  it("treats a corrupt manifest as no evidence rather than crashing", async () => {
    await backing.store.writeFile("versions/pointers.json", new TextEncoder().encode("{not json"));
    const reloaded = new ModelVault({ store: backing.store, legacy: null });
    expect(await reloaded.installationView()).toEqual({ ready: false, stored: false });
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

describe("canonical installation view and cleanup", () => {
  it("reports Ready only for the verified active artifact", async () => {
    expect(await vault.installationView()).toEqual({ ready: false, stored: false });
    await put("v1", 100, false);
    expect(await vault.installationView()).toEqual({ ready: false, stored: false });

    await vault.writeMeta("v1", { verified: true, expectedBytes: 100, sha256: "digest-v1" });
    await vault.activate("v1");
    expect(await vault.installationView()).toEqual({ ready: true, stored: true });
  });

  it("removes legacy and partial artifacts but keeps active and rollback", async () => {
    await put("v1", 100);
    await vault.activate("v1");
    await put("v2", 120);
    await vault.activate("v2");

    backing.files.set("wasm/legacy-engine.bin", new Uint8Array(80));
    backing.files.set(versionPath("v2", "stale.partial"), new Uint8Array(12));
    backing.files.set(versionPath("orphan", "orphan.bin"), new Uint8Array(20));

    const removed = await vault.cleanupAfterActivation("v2");

    expect(removed).toEqual(
      expect.arrayContaining([
        "wasm/legacy-engine.bin",
        versionPath("v2", "stale.partial"),
        versionPath("orphan", "orphan.bin"),
      ]),
    );
    expect(await vault.bytesOf("v2")).toBe(120);
    expect(await vault.bytesOf("v1")).toBe(100);
    expect(vault.activeVersion()).toBe("v2");
    expect(vault.previousVersion()).toBe("v1");
    // F20: cleanup used to delete the manifest itself, stranding the install.
    expect(removed).not.toContain("versions/pointers.json");
    const reloaded = new ModelVault({ store: backing.store, legacy: null });
    expect(await reloaded.installationView()).toEqual({ ready: true, stored: true });
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
    await backing.write("wasm/old/engine.bin", new Uint8Array(10));
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
    await backing.write("wasm/legacy/engine.bin", new Uint8Array(500));
    await put("v1", 100);

    const result = await vault.removeEverything();
    expect(result.legacyRemoved).toBeGreaterThan(0);
    expect(backing.files.size).toBe(0);
  });

  it("leaves localStorage that is not OCADE's engine completely alone", async () => {
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

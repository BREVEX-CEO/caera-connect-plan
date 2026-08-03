import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ResumeContent } from "../madee-resume-types";

/**
 * Browser-Only resume storage.
 *
 * The value here is the KEY DISCIPLINE: every resume version must be namespaced
 * as `resume-version:<id>` inside the "resumes" data class. If a save and a load
 * ever disagree about the key, or two versions collide on one key, a user's
 * resume silently disappears or overwrites another. These tests pin the key
 * shape and the save/load/delete round trip.
 */

const store = new Map<string, unknown>();
const calls: Array<{ op: string; collection: string; key: string }> = [];

vi.mock("@/lib/storage/indexeddb-adapter", () => ({
  indexedDbAdapter: {
    put: vi.fn(async (collection: string, key: string, value: unknown) => {
      calls.push({ op: "put", collection, key });
      store.set(key, value);
    }),
    get: vi.fn(async (collection: string, key: string) => {
      calls.push({ op: "get", collection, key });
      return store.has(key) ? { id: key, value: store.get(key) } : undefined;
    }),
    delete: vi.fn(async (collection: string, key: string) => {
      calls.push({ op: "delete", collection, key });
      store.delete(key);
    }),
  },
}));

const { saveLocalResumeContent, loadLocalResumeContent, deleteLocalResumeContent } =
  await import("../madee-local-store");

const content = { sections: [{ id: "s1" }] } as unknown as ResumeContent;

beforeEach(() => {
  store.clear();
  calls.length = 0;
});

describe("resume version storage", () => {
  it("saves under a namespaced key in the resumes data class", async () => {
    await saveLocalResumeContent("v1", content);
    expect(calls[0]).toEqual({ op: "put", collection: "resumes", key: "resume-version:v1" });
  });

  it("loads back exactly what was saved", async () => {
    await saveLocalResumeContent("v1", content);
    await expect(loadLocalResumeContent("v1")).resolves.toEqual(content);
  });

  it("returns null for a version that was never saved", async () => {
    await expect(loadLocalResumeContent("missing")).resolves.toBeNull();
  });

  it("keeps different versions in separate keys", async () => {
    const other = { sections: [{ id: "s2" }] } as unknown as ResumeContent;
    await saveLocalResumeContent("v1", content);
    await saveLocalResumeContent("v2", other);

    await expect(loadLocalResumeContent("v1")).resolves.toEqual(content);
    await expect(loadLocalResumeContent("v2")).resolves.toEqual(other);
    expect(store.size).toBe(2);
  });

  it("overwrites the same version rather than accumulating duplicates", async () => {
    const updated = { sections: [{ id: "updated" }] } as unknown as ResumeContent;
    await saveLocalResumeContent("v1", content);
    await saveLocalResumeContent("v1", updated);

    expect(store.size).toBe(1);
    await expect(loadLocalResumeContent("v1")).resolves.toEqual(updated);
  });

  it("deletes only the requested version", async () => {
    await saveLocalResumeContent("v1", content);
    await saveLocalResumeContent("v2", content);
    await deleteLocalResumeContent("v1");

    await expect(loadLocalResumeContent("v1")).resolves.toBeNull();
    await expect(loadLocalResumeContent("v2")).resolves.toEqual(content);
  });

  it("uses the same key for save, load and delete", async () => {
    await saveLocalResumeContent("v9", content);
    await loadLocalResumeContent("v9");
    await deleteLocalResumeContent("v9");

    const keys = new Set(calls.map((c) => c.key));
    expect([...keys]).toEqual(["resume-version:v9"]);
    expect(new Set(calls.map((c) => c.collection))).toEqual(new Set(["resumes"]));
  });
});

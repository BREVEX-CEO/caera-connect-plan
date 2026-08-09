import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  deleteAttachment,
  sitesFor,
  remoteDeletionOrder,
  describeSite,
  type DeletionSite,
} from "../attachments/deletion";
import {
  saveChatCitations,
  removeCitationsForSource,
  getChatCitations,
} from "../chat-citation-store";
import { saveProjectFile, listProjectFiles } from "../project-files";

/**
 * Deleting an attachment must empty every place it left a trace.
 *
 * THE FAILURE MODE UNDER TEST is not "delete throws". It is "delete succeeds,
 * reports success, and something is still on disk" — which no amount of manual
 * clicking will reveal, because the residue is in stores the user cannot see.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
});

describe("the remote order is the one that cannot lose bytes", () => {
  it("deletes the stored object before the row that points at it", () => {
    /*
     * The row holds `storage_path` — the only record of where the bytes are.
     * Row first, then a failed object delete, and those bytes are unreachable
     * forever. This ordering is invisible at the call site, so it is pinned
     * here on its own.
     */
    expect(remoteDeletionOrder()).toEqual(["remote_object", "remote_row"]);
  });

  it("keeps the row when the object could not be deleted", async () => {
    const receipt = await deleteAttachment(
      { name: "contract.pdf", remote: { rowId: "row-1", storagePath: "u/1/contract.pdf" } },
      {
        deleteRemoteObject: async () => false, // the server refused
        deleteRemoteRow: async () => true, // would succeed — must not be called
      },
    );
    expect(receipt.complete).toBe(false);
    expect(receipt.remaining).toContain("remote_row");
    const row = receipt.outcomes.find((o) => o.site === "remote_row");
    expect(row?.detail).toMatch(/only record of where the file is stored/i);
  });

  it("never calls the row delete when the object delete failed", async () => {
    const deleteRemoteRow = vi.fn(async () => true);
    await deleteAttachment(
      { name: "x.pdf", remote: { rowId: "row-2", storagePath: "u/2/x.pdf" } },
      { deleteRemoteObject: async () => false, deleteRemoteRow },
    );
    expect(deleteRemoteRow, "deleting the row would strand the object").not.toHaveBeenCalled();
  });

  it("deletes the row once the object is gone", async () => {
    const receipt = await deleteAttachment(
      { name: "y.pdf", remote: { rowId: "row-3", storagePath: "u/3/y.pdf" } },
      { deleteRemoteObject: async () => true, deleteRemoteRow: async () => true },
    );
    expect(receipt.remaining).not.toContain("remote_object");
    expect(receipt.remaining).not.toContain("remote_row");
  });

  it("treats a thrown object delete as a failure, not a crash", async () => {
    const receipt = await deleteAttachment(
      { name: "z.pdf", remote: { rowId: "row-4", storagePath: "u/4/z.pdf" } },
      {
        deleteRemoteObject: async () => {
          throw new Error("network down");
        },
      },
    );
    expect(receipt.complete).toBe(false);
    expect(receipt.remaining).toContain("remote_object");
  });
});

describe("a local failure does not abandon the sites after it", () => {
  it("still clears citations when the vault refuses", async () => {
    saveChatCitations({
      conversationId: "c1",
      messageId: "m1",
      citations: [
        { sourceId: "S1", name: "leak.pdf", kind: "pdf", locator: { page: 2 }, snippet: "secret" },
      ],
    });

    const receipt = await deleteAttachment(
      { name: "leak.pdf", vaultId: "v1", vaultClass: "files" },
      {
        adapter: {
          delete: async () => {
            throw new Error("Browser Only vault is locked.");
          },
        },
      },
    );

    // The vault is reported as still holding data...
    expect(receipt.remaining).toContain("vault_payload");
    expect(receipt.complete).toBe(false);
    // ...but the excerpt, which comes after it, was still deleted.
    const left = getChatCitations("c1", "m1");
    expect(left.ok && left.data, "an excerpt of the deleted file survived").toBeNull();
  });

  it("names exactly which places still hold data", async () => {
    const receipt = await deleteAttachment(
      { name: "a.pdf", vaultId: "v2", vaultClass: "files" },
      {
        adapter: {
          delete: async () => {
            throw new Error("locked");
          },
        },
      },
    );
    expect(receipt.summary).toMatch(/partly deleted/i);
    expect(receipt.summary).toMatch(/1 place/);
  });
});

describe("the receipt describes only work that exists", () => {
  it("lists no remote sites for a file that was never synced", () => {
    const sites = sitesFor({ name: "local-only.txt" });
    expect(sites).not.toContain("remote_object");
    expect(sites).not.toContain("remote_row");
  });

  it("lists remote sites, in order, for a synced file", () => {
    const sites = sitesFor({
      name: "synced.pdf",
      remote: { rowId: "r", storagePath: "p" },
    });
    expect(sites.slice(-2)).toEqual(["remote_object", "remote_row"]);
  });

  it("omits the extracted-text site when no text was ever extracted", () => {
    expect(sitesFor({ name: "image.png" })).not.toContain("extracted_text");
  });

  it("gives every site a plain-language name", () => {
    const all: DeletionSite[] = [
      "extracted_text",
      "citation_excerpts",
      "vault_payload",
      "cached_copies",
      "remote_object",
      "remote_row",
    ];
    for (const site of all) {
      expect(describeSite(site), site).toMatch(/^[A-Z]/);
      expect(describeSite(site).length).toBeGreaterThan(4);
    }
  });

  it("does not claim to delete a retrieval index that is never persisted", async () => {
    const saved = await saveProjectFile({
      projectId: "p1",
      name: "notes.txt",
      mime: "text/plain",
      sizeBytes: 12,
      text: "hello world retrieval",
    });
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;

    const receipt = await deleteAttachment({ fileId: saved.data.id, name: "notes.txt" });
    const text = receipt.outcomes.find((o) => o.site === "extracted_text");
    // Passages and the BM25 index are computed at query time from this text.
    // The receipt says so rather than inventing a separate deletion step.
    expect(text?.detail).toMatch(/derived from it and no longer exist/i);
    expect(receipt.outcomes.map((o) => o.site)).not.toContain("retrieval_index");

    const left = listProjectFiles("p1");
    expect(left.ok && left.data).toHaveLength(0);
  });
});

describe("deleting an already-deleted attachment is not an error", () => {
  it("reports a missing project-file record as cleared", async () => {
    const receipt = await deleteAttachment({ fileId: "never-existed", name: "ghost.txt" });
    const text = receipt.outcomes.find((o) => o.site === "extracted_text");
    // Absence is the goal. Treating "already gone" as failure makes the retry
    // path permanently red for a user who has done nothing wrong.
    expect(text?.cleared).toBe(true);
  });
});

describe("excerpts are removed by source, across every conversation", () => {
  it("removes quotes of one file without touching other sources", () => {
    saveChatCitations({
      conversationId: "c1",
      messageId: "m1",
      citations: [
        { sourceId: "S1", name: "gone.pdf", kind: "pdf", locator: { page: 1 }, snippet: "a" },
        { sourceId: "S2", name: "kept.pdf", kind: "pdf", locator: { page: 1 }, snippet: "b" },
      ],
    });
    saveChatCitations({
      conversationId: "c2",
      messageId: "m2",
      citations: [
        { sourceId: "S1", name: "gone.pdf", kind: "pdf", locator: { page: 9 }, snippet: "c" },
      ],
    });

    const result = removeCitationsForSource("gone.pdf");
    expect(result.ok && result.data.removed).toBe(2);

    const first = getChatCitations("c1", "m1");
    expect(first.ok && first.data?.map((c) => c.name)).toEqual(["kept.pdf"]);
    // A record left with nothing is dropped, not kept as an empty shell that
    // still names the conversation.
    const second = getChatCitations("c2", "m2");
    expect(second.ok && second.data).toBeNull();
  });

  it("reports zero rather than failing when nothing quoted the source", () => {
    const result = removeCitationsForSource("untouched.pdf");
    expect(result.ok).toBe(true);
    expect(result.ok && result.data.removed).toBe(0);
  });
});

describe("cached copies", () => {
  it("deletes cache entries that mention the file and leaves the rest", async () => {
    const deleted: string[] = [];
    const entries = [
      { url: "https://app/api/files/report.pdf" },
      { url: "https://app/api/files/unrelated.pdf" },
    ];
    const fakeCaches = {
      keys: async () => ["ocade-shell-v1"],
      open: async () => ({
        keys: async () => entries,
        delete: async (req: { url: string }) => {
          deleted.push(req.url);
          return true;
        },
      }),
    } as unknown as CacheStorage;

    const receipt = await deleteAttachment({ name: "report.pdf" }, { caches: fakeCaches });
    expect(deleted).toEqual(["https://app/api/files/report.pdf"]);
    const cached = receipt.outcomes.find((o) => o.site === "cached_copies");
    expect(cached?.cleared).toBe(true);
    expect(cached?.detail).toMatch(/1 cached copy deleted/);
  });

  it("reports a cache failure instead of silently succeeding", async () => {
    const fakeCaches = {
      keys: async () => {
        throw new Error("storage disabled");
      },
    } as unknown as CacheStorage;
    const receipt = await deleteAttachment({ name: "r.pdf" }, { caches: fakeCaches });
    expect(receipt.remaining).toContain("cached_copies");
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { StorageLockedError } from "../storage/types";

/**
 * Privacy-aware chat persistence.
 *
 * The privacy promise is concrete and ASYMMETRIC, which is the part that used
 * to be got wrong here. A `browser_only` conversation must NEVER be written to
 * Supabase — that direction is the guarantee, and a mistake in it silently
 * uploads a conversation somebody asked to keep on their machine.
 *
 * The other direction is not a guarantee at all. `private_sync` used to write
 * ONLY to the cloud, and this file asserted that as though it were a privacy
 * property. It was a bug: a message sent with the network down was lost, and
 * Chat could not start a conversation offline. Writing a synchronised message
 * to the device first leaks nothing — it is the user's own device — and it is
 * what makes Chat fast and usable offline. So the assertion is inverted here,
 * deliberately, while the browser_only one is untouched.
 */

interface VaultRow {
  id: string;
  value: unknown;
}

const vault = {
  rows: [] as VaultRow[],
  put: vi.fn(),
  list: vi.fn(),
  delete: vi.fn(),
};
const cloud = { appended: [] as unknown[], listed: [] as unknown[] };

vi.mock("../storage/resolver", () => ({
  resolveAdapter: vi.fn(async () => ({
    put: (collection: string, id: string, value: unknown) => {
      vault.put(collection, id, value);
      vault.rows.push({ id, value });
      return Promise.resolve();
    },
    list: (collection: string) => {
      vault.list(collection);
      return Promise.resolve(vault.rows);
    },
    delete: (collection: string, id: string) => {
      vault.delete(collection, id);
      vault.rows = vault.rows.filter((r) => r.id !== id);
      return Promise.resolve();
    },
  })),
}));

vi.mock("../ocade.functions", () => ({
  appendOcadeMessage: vi.fn(async (arg: unknown) => {
    cloud.appended.push(arg);
  }),
  listMessages: vi.fn(async () => cloud.listed),
}));

const { persistChatMessage, loadChatMessages, deleteVaultConversation, describeStorageError } =
  await import("../ocade-chat-store");

beforeEach(() => {
  vault.rows = [];
  vault.put.mockClear();
  vault.list.mockClear();
  vault.delete.mockClear();
  cloud.appended = [];
  cloud.listed = [];
});

const base = {
  userId: "u1",
  conversationId: "c1",
  role: "user" as const,
  content: "hello",
};

describe("persistChatMessage routes by privacy mode", () => {
  it("keeps a browser_only message OUT of the cloud", async () => {
    const r = await persistChatMessage({ ...base, chatsMode: "browser_only" });
    expect(r.stored).toBe("vault");
    expect(vault.put).toHaveBeenCalledTimes(1);
    expect(cloud.appended).toHaveLength(0); // the privacy promise
  });

  it("keeps a pc_vault message out of the cloud too", async () => {
    const r = await persistChatMessage({ ...base, chatsMode: "pc_vault" });
    expect(r.stored).toBe("vault");
    expect(cloud.appended).toHaveLength(0);
  });

  it("writes a private_sync message to the device FIRST, then sends it", async () => {
    const r = await persistChatMessage({ ...base, chatsMode: "private_sync" });
    expect(r.stored).toBe("cloud");
    // Both happened, and the local one is what makes the message survive a
    // dropped connection.
    expect(vault.put).toHaveBeenCalledTimes(1);
    expect(cloud.appended).toHaveLength(1);
    const [, storedId] = vault.put.mock.calls[0];
    expect(storedId).toBe(r.record.id);
  });

  it("returns a complete record with defaults filled in", async () => {
    const r = await persistChatMessage({ ...base, chatsMode: "browser_only" });
    expect(r.record).toMatchObject({
      conversation_id: "c1",
      role: "user",
      content: "hello",
      attachments: [],
      model_id: null,
      provider_id: null,
    });
    expect(typeof r.record.created_at).toBe("string");
    expect(r.record.id).toContain("c1::");
  });

  it("carries model, provider and attachments through", async () => {
    const r = await persistChatMessage({
      ...base,
      chatsMode: "browser_only",
      modelId: "m1",
      providerId: "p1",
      attachments: [{ name: "a.txt" } as never],
    });
    expect(r.record.model_id).toBe("m1");
    expect(r.record.provider_id).toBe("p1");
    expect(r.record.attachments).toHaveLength(1);
  });

  it("gives two messages in the same conversation distinct ids", async () => {
    const a = await persistChatMessage({ ...base, chatsMode: "browser_only" });
    const b = await persistChatMessage({ ...base, chatsMode: "browser_only" });
    expect(a.record.id).not.toBe(b.record.id);
  });

  it("propagates a locked vault instead of silently dropping the message", async () => {
    const { resolveAdapter } = await import("../storage/resolver");
    vi.mocked(resolveAdapter).mockRejectedValueOnce(new StorageLockedError());
    await expect(persistChatMessage({ ...base, chatsMode: "browser_only" })).rejects.toBeInstanceOf(
      StorageLockedError,
    );
  });
});

describe("loadChatMessages", () => {
  const row = (id: string, conversation_id: string, created_at: string) => ({
    id,
    value: { id, conversation_id, created_at, role: "user", content: id },
  });

  it("returns only the requested conversation", async () => {
    vault.rows = [row("m1", "c1", "2026-01-01T00:00:00Z"), row("m2", "c2", "2026-01-01T00:00:01Z")];
    const out = await loadChatMessages({
      userId: "u1",
      chatsMode: "browser_only",
      conversationId: "c1",
    });
    expect(out.map((m) => m.id)).toEqual(["m1"]);
  });

  it("orders messages oldest first regardless of storage order", async () => {
    vault.rows = [
      row("late", "c1", "2026-01-01T00:00:09Z"),
      row("early", "c1", "2026-01-01T00:00:01Z"),
      row("middle", "c1", "2026-01-01T00:00:05Z"),
    ];
    const out = await loadChatMessages({
      userId: "u1",
      chatsMode: "browser_only",
      conversationId: "c1",
    });
    expect(out.map((m) => m.id)).toEqual(["early", "middle", "late"]);
  });

  it("skips empty vault entries rather than returning holes", async () => {
    vault.rows = [{ id: "broken", value: null }, row("ok", "c1", "2026-01-01T00:00:00Z")];
    const out = await loadChatMessages({
      userId: "u1",
      chatsMode: "browser_only",
      conversationId: "c1",
    });
    expect(out.map((m) => m.id)).toEqual(["ok"]);
  });

  it("reads private_sync conversations from the cloud", async () => {
    cloud.listed = [{ id: "s1", conversation_id: "c1", created_at: "2026-01-01T00:00:00Z" }];
    const out = await loadChatMessages({
      userId: "u1",
      chatsMode: "private_sync",
      conversationId: "c1",
    });
    expect(out.map((m) => m.id)).toEqual(["s1"]);
  });

  it("returns an empty list when the cloud returns nothing", async () => {
    cloud.listed = null as never;
    const out = await loadChatMessages({
      userId: "u1",
      chatsMode: "private_sync",
      conversationId: "c1",
    });
    expect(out).toEqual([]);
  });
});

describe("deleteVaultConversation (privacy control)", () => {
  it("deletes only the target conversation and reports the count", async () => {
    vault.rows = [
      { id: "a", value: { conversation_id: "c1" } },
      { id: "b", value: { conversation_id: "c1" } },
      { id: "c", value: { conversation_id: "c2" } },
    ];
    const removed = await deleteVaultConversation("u1", "c1");
    expect(removed).toBe(2);
    expect(vault.rows.map((r) => r.id)).toEqual(["c"]);
  });

  it("reports zero when nothing matches, without deleting anything", async () => {
    vault.rows = [{ id: "c", value: { conversation_id: "c2" } }];
    expect(await deleteVaultConversation("u1", "nope")).toBe(0);
    expect(vault.delete).not.toHaveBeenCalled();
  });

  it("tolerates empty vault entries", async () => {
    vault.rows = [{ id: "broken", value: null }];
    expect(await deleteVaultConversation("u1", "c1")).toBe(0);
  });
});

describe("describeStorageError gives an actionable message", () => {
  it("explains a locked vault and where to unlock it", () => {
    const msg = describeStorageError(new StorageLockedError());
    expect(msg).toMatch(/locked/i);
    expect(msg).toMatch(/Settings/);
  });

  it("explains a missing native companion", () => {
    const e = new Error("nope");
    e.name = "NativeCompanionRequiredError";
    expect(describeStorageError(e)).toMatch(/Native Companion/i);
  });

  it("passes a plain error message through", () => {
    expect(describeStorageError(new Error("disk full"))).toBe("disk full");
  });

  it("falls back to an honest default for a non-error", () => {
    expect(describeStorageError("weird")).toBe("Could not save this message.");
  });
});

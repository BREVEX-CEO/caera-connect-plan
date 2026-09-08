import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * INCOGNITO CONVERSATIONS AND DELETE-ALL — PLAN.md §8.
 *
 * Both are promises about ABSENCE, which is the hardest kind of behaviour to
 * keep working: nothing goes wrong on screen when they break. An incognito
 * conversation that is quietly written to the vault looks identical to one that
 * is not, right up until somebody opens their history and finds it there.
 */

interface VaultRow {
  id: string;
  value: unknown;
}

const vault = {
  rows: [] as VaultRow[],
};
const cloud = { appended: [] as unknown[] };

vi.mock("@/lib/storage/resolver", () => ({
  resolveAdapter: vi.fn(async () => ({
    put: (_collection: string, id: string, value: unknown) => {
      vault.rows = [...vault.rows.filter((row) => row.id !== id), { id, value }];
      return Promise.resolve();
    },
    list: () => Promise.resolve(vault.rows),
    delete: (_collection: string, id: string) => {
      vault.rows = vault.rows.filter((row) => row.id !== id);
      return Promise.resolve();
    },
  })),
}));

vi.mock("@/lib/ocade.functions", () => ({
  appendOcadeMessage: vi.fn(async (arg: unknown) => {
    cloud.appended.push(arg);
  }),
  listMessages: vi.fn(async () => []),
}));

const { mayPersist, mayRemember, INCOGNITO_CLAIMS } = await import("../chat/incognito");
const { persistChatMessage, loadChatMessages, deleteAllVaultMessages } =
  await import("../ocade-chat-store");
const { createConversationLocally, listConversationsLocally, deleteAllConversationsLocally } =
  await import("../chat/local-conversations");

beforeEach(() => {
  vault.rows = [];
  cloud.appended = [];
});

describe("an incognito message is written nowhere", () => {
  const base = {
    userId: "user-1",
    conversationId: "conversation-1",
    role: "user" as const,
    content: "Something I do not want kept.",
    incognito: true,
  };

  it("stays out of the vault in browser_only", async () => {
    const result = await persistChatMessage({ ...base, chatsMode: "browser_only" });
    expect(result.stored).toBe("not_stored");
    expect(vault.rows).toHaveLength(0);
  });

  it("stays out of BOTH the vault and the cloud in private_sync", async () => {
    /*
     * The synchronised mode is the dangerous one: its normal path writes to the
     * device AND queues an upload, so a missed check leaks the conversation to
     * the account and to every other device signed into it.
     */
    const result = await persistChatMessage({ ...base, chatsMode: "private_sync" });
    expect(result.stored).toBe("not_stored");
    expect(vault.rows).toHaveLength(0);
    expect(cloud.appended).toHaveLength(0);
  });

  it("still returns the record, because the screen renders from it", async () => {
    const result = await persistChatMessage({ ...base, chatsMode: "browser_only" });
    expect(result.record.content).toBe(base.content);
    expect(result.record.conversation_id).toBe("conversation-1");
  });

  it("refuses BEFORE choosing a destination", () => {
    /*
     * A structural check, and the reason is a real failure mode: a guard placed
     * inside one branch protects that branch only, and the next storage mode
     * added below it inherits nothing. The refusal must sit above the
     * `private_sync` branch, where every destination passes through it.
     */
    const source = readFileSync(join(process.cwd(), "src/lib/ocade-chat-store.ts"), "utf8");
    const body = source.slice(source.indexOf("export async function persistChatMessage("));
    expect(body.indexOf("mayPersist(")).toBeLessThan(body.indexOf('=== "private_sync"'));
  });
});

describe("the promises the interface makes are the ones the code keeps", () => {
  it("excludes memory in both directions", () => {
    expect(mayRemember(true)).toBe(false);
    expect(mayRemember(false)).toBe(true);
    expect(mayPersist(true)).toBe(false);
    const claims = INCOGNITO_CLAIMS.kept.join(" ");
    expect(claims).toMatch(/will not remember/i);
    // Not writing memory is the easy half; not READING it is the half that
    // makes the conversation unconnected to the person having it.
    expect(claims).toMatch(/will not use what it already remembers/i);
  });

  it("does not claim anonymity it cannot deliver", () => {
    const notKept = INCOGNITO_CLAIMS.notKept.join(" ");
    expect(notKept).toMatch(/still reaches the provider/i);
    expect(notKept).toMatch(/does not erase/i);
    expect(notKept).toMatch(/does not hide/i);
  });

  it("never persists the flag itself", async () => {
    await persistChatMessage({
      userId: "user-1",
      chatsMode: "browser_only",
      conversationId: "conversation-1",
      role: "user",
      content: "Kept.",
    });
    const stored = JSON.stringify(vault.rows);
    // Storing "this one was incognito" would itself be a record that the
    // conversation happened.
    expect(stored).not.toContain("incognito");
  });
});

describe("delete-all clears the device", () => {
  it("removes every message body and tombstones every conversation", async () => {
    await createConversationLocally("user-1", { title: "One", privacyMode: "browser_only" });
    await createConversationLocally("user-1", { title: "Two", privacyMode: "browser_only" });
    await persistChatMessage({
      userId: "user-1",
      chatsMode: "browser_only",
      conversationId: "conversation-1",
      role: "user",
      content: "First message",
    });
    await persistChatMessage({
      userId: "user-1",
      chatsMode: "browser_only",
      conversationId: "conversation-2",
      role: "user",
      content: "Second message",
    });

    const removed = await deleteAllVaultMessages("user-1");
    expect(removed).toBe(2);
    const tombstoned = await deleteAllConversationsLocally("user-1");
    expect(tombstoned).toBe(2);

    for (const conversationId of ["conversation-1", "conversation-2"]) {
      const transcript = await loadChatMessages({
        userId: "user-1",
        chatsMode: "browser_only",
        conversationId,
      });
      expect(transcript).toHaveLength(0);
    }
    expect(await listConversationsLocally("user-1")).toHaveLength(0);
  });

  it("keeps conversation records as tombstones so the deletion travels", async () => {
    await createConversationLocally("user-1", { title: "One", privacyMode: "browser_only" });
    await deleteAllVaultMessages("user-1");
    await deleteAllConversationsLocally("user-1");
    /*
     * A tombstone for a MESSAGE would be a record containing the text it claims
     * to have deleted, so message bodies are removed outright. A conversation
     * record carries only a title and a deletion time, and removing it outright
     * would let another device re-synchronise the conversation straight back.
     */
    expect(vault.rows).toHaveLength(1);
    expect(vault.rows[0]!.id.startsWith("conv:")).toBe(true);
    expect(JSON.stringify(vault.rows[0]!.value)).toContain("deleted_at");
  });

  it("is idempotent — running it twice deletes nothing the second time", async () => {
    await createConversationLocally("user-1", { title: "One", privacyMode: "browser_only" });
    await persistChatMessage({
      userId: "user-1",
      chatsMode: "browser_only",
      conversationId: "conversation-1",
      role: "user",
      content: "First message",
    });
    await deleteAllVaultMessages("user-1");
    await deleteAllConversationsLocally("user-1");
    expect(await deleteAllVaultMessages("user-1")).toBe(0);
    expect(await deleteAllConversationsLocally("user-1")).toBe(0);
  });
});

describe("the server's delete-all is scoped by the session, not by the request", () => {
  const source = readFileSync(join(process.cwd(), "src/lib/ocade.functions.ts"), "utf8");
  const body = source.slice(
    source.indexOf("export const deleteAllConversations ="),
    source.indexOf("/* -------------------- Messages"),
  );

  it("accepts no id list", () => {
    /*
     * A request that could name what to clear could name somebody else's. The
     * scope is the session's own rows, and a `.validator(` here would be the
     * first step toward accepting one.
     */
    expect(body).not.toContain(".validator(");
    expect(body).toContain('.eq("user_id", context.userId)');
  });

  it("deletes in one statement rather than looping", () => {
    // A client-driven loop stops where the connection does, leaving a history
    // that is neither cleared nor intact.
    expect(body).not.toMatch(/for \(|\.map\(/);
    expect(body).toContain('.delete({ count: "exact" })');
  });
});

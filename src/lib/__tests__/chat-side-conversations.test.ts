import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * SIDE CONVERSATIONS — PLAN.md §8.
 *
 * The feature's promise is subtractive: a side question and its answer must NOT
 * become part of the conversation. Everything asserted here is a way that
 * promise can be broken, and every one of them has a plausible route into the
 * code — side records carry `conversation_id`, so the transcript loader will
 * pick them up the moment its exclusion is dropped.
 */

interface VaultRow {
  id: string;
  value: unknown;
}

const vault = {
  rows: [] as VaultRow[],
  deletes: [] as string[],
};

vi.mock("@/lib/storage/resolver", () => ({
  resolveAdapter: vi.fn(async () => ({
    put: (_collection: string, id: string, value: unknown) => {
      vault.rows.push({ id, value });
      return Promise.resolve();
    },
    list: () => Promise.resolve(vault.rows),
    delete: (_collection: string, id: string) => {
      vault.deletes.push(id);
      vault.rows = vault.rows.filter((row) => row.id !== id);
      return Promise.resolve();
    },
  })),
}));

vi.mock("@/lib/ocade.functions", () => ({
  appendOcadeMessage: vi.fn(async () => undefined),
  listMessages: vi.fn(async () => []),
}));

const { appendSideMessage, deleteSideThread, isSideKey, loadSideThreads, sideConversationPrompt } =
  await import("../chat/side-conversations");
const { loadChatMessages, persistChatMessage, deleteVaultConversation } =
  await import("../ocade-chat-store");

beforeEach(() => {
  vault.rows = [];
  vault.deletes = [];
});

const anchored = {
  userId: "user-1",
  conversationId: "conversation-1",
  anchorMessageId: "message-1",
  role: "user" as const,
  content: "What does that word mean?",
};

describe("a side thread is stored apart from the transcript", () => {
  it("writes under a key the transcript loader can exclude", async () => {
    const { stored, record } = await appendSideMessage(anchored);
    expect(stored).toBe(true);
    expect(isSideKey(record.id)).toBe(true);
    expect(vault.rows).toHaveLength(1);
    expect(isSideKey(vault.rows[0]!.id)).toBe(true);
  });

  it("is NOT returned by the transcript loader", async () => {
    await persistChatMessage({
      userId: "user-1",
      chatsMode: "browser_only",
      conversationId: "conversation-1",
      role: "assistant",
      content: "The answer everyone will read back.",
    });
    await appendSideMessage(anchored);
    await appendSideMessage({ ...anchored, role: "assistant", content: "It means this." });

    const transcript = await loadChatMessages({
      userId: "user-1",
      chatsMode: "browser_only",
      conversationId: "conversation-1",
    });

    /*
     * THE ASSERTION THE WHOLE FEATURE RESTS ON. Three records exist for this
     * conversation and exactly one of them is the conversation. If the
     * exclusion in `loadChatMessages` is removed this returns three, the side
     * question appears inline, and it is sent to the engine as part of the
     * next turn — which is precisely what somebody asking a side question
     * asked not to happen.
     */
    expect(transcript).toHaveLength(1);
    expect(transcript[0]!.content).toBe("The answer everyone will read back.");
  });

  it("groups threads by their anchor and orders each one", async () => {
    const first = await appendSideMessage({ ...anchored, content: "First" });
    const second = await appendSideMessage({
      ...anchored,
      role: "assistant",
      content: "Second",
    });
    // A different anchor in the same conversation.
    await appendSideMessage({ ...anchored, anchorMessageId: "message-2", content: "Elsewhere" });
    // Same anchor id, different conversation: must not bleed across.
    await appendSideMessage({
      ...anchored,
      conversationId: "conversation-2",
      content: "Another chat",
    });

    const threads = await loadSideThreads({ userId: "user-1", conversationId: "conversation-1" });
    expect([...threads.keys()].sort()).toEqual(["message-1", "message-2"]);
    expect(threads.get("message-1")!.map((m) => m.content)).toEqual(["First", "Second"]);
    expect(threads.get("message-2")!.map((m) => m.content)).toEqual(["Elsewhere"]);
    // Ordering is by creation time, not insertion order into the store.
    expect(first.record.created_at <= second.record.created_at).toBe(true);
  });
});

describe("an incognito conversation writes no side thread either", () => {
  it("returns the turn for the screen and stores nothing", async () => {
    const { stored, record } = await appendSideMessage({ ...anchored, incognito: true });
    // The record is real — it is on screen — and it is nowhere else.
    expect(record.content).toBe(anchored.content);
    expect(stored).toBe(false);
    expect(vault.rows).toHaveLength(0);
  });
});

describe("discarding", () => {
  it("removes one thread and leaves the conversation and other threads alone", async () => {
    await persistChatMessage({
      userId: "user-1",
      chatsMode: "browser_only",
      conversationId: "conversation-1",
      role: "assistant",
      content: "The anchor message.",
    });
    await appendSideMessage(anchored);
    await appendSideMessage({ ...anchored, role: "assistant", content: "Answered." });
    await appendSideMessage({ ...anchored, anchorMessageId: "message-2", content: "Kept." });

    const removed = await deleteSideThread({
      userId: "user-1",
      conversationId: "conversation-1",
      anchorMessageId: "message-1",
    });
    expect(removed).toBe(2);

    const threads = await loadSideThreads({ userId: "user-1", conversationId: "conversation-1" });
    expect([...threads.keys()]).toEqual(["message-2"]);

    const transcript = await loadChatMessages({
      userId: "user-1",
      chatsMode: "browser_only",
      conversationId: "conversation-1",
    });
    expect(transcript).toHaveLength(1);
  });

  it("is swept when the conversation it hangs off is deleted", async () => {
    await persistChatMessage({
      userId: "user-1",
      chatsMode: "browser_only",
      conversationId: "conversation-1",
      role: "assistant",
      content: "The anchor message.",
    });
    await appendSideMessage(anchored);
    await appendSideMessage({ ...anchored, conversationId: "conversation-2", content: "Other" });

    await deleteVaultConversation("user-1", "conversation-1");

    /*
     * A side thread that outlived its conversation would be a stored record of
     * a conversation the person deleted — the exact thing deletion is for.
     */
    const threads = await loadSideThreads({ userId: "user-1", conversationId: "conversation-1" });
    expect(threads.size).toBe(0);
    const elsewhere = await loadSideThreads({
      userId: "user-1",
      conversationId: "conversation-2",
    });
    expect(elsewhere.size).toBe(1);
  });
});

describe("what the engine is told", () => {
  const thread = [
    {
      id: "side:conversation-1:message-1::t1::aaaa",
      conversation_id: "conversation-1",
      anchor_message_id: "message-1",
      role: "user" as const,
      content: "Earlier side question",
      created_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  it("sends the anchor passage, the side thread and the question — in that order", () => {
    const prompt = sideConversationPrompt({
      anchorContent: "The paragraph being asked about.",
      thread,
      question: "And what about this part?",
    });
    expect(prompt[0]!.role).toBe("system");
    expect(prompt[1]!.content).toContain("The paragraph being asked about.");
    expect(prompt[2]!.content).toBe("Earlier side question");
    expect(prompt.at(-1)).toEqual({ role: "user", content: "And what about this part?" });
  });

  it("cannot carry the conversation, because it is never given one", () => {
    /*
     * A structural assertion rather than a string search: the function's inputs
     * are the anchor, the thread and the question, so there is no parameter a
     * transcript could arrive through. Widening it later is what this catches.
     */
    expect(sideConversationPrompt.length).toBe(1);
    const prompt = sideConversationPrompt({
      anchorContent: "Anchor",
      thread: [],
      question: "Question",
    });
    expect(prompt).toHaveLength(3);
  });
});

describe("the chat surface wires the side thread to the panel, not the transcript", () => {
  const source = readFileSync(
    join(process.cwd(), "src/routes/_authenticated/ocade.index.tsx"),
    "utf8",
  );

  it("renders side threads through renderFooter rather than as messages", () => {
    /*
     * `renderFooter` draws UNDER a message. Rendering a side thread through
     * `setMessages` instead would put it in the transcript — visually part of
     * the conversation, included in the next prompt, and saved with it.
     */
    expect(source).toMatch(/renderFooter=\{\(message\) => \{/);
    expect(source).toMatch(/<SideThreadPanel/);
    expect(source).not.toMatch(/setMessages\(\s*\(m\) => \[\.\.\.m, asked/);
  });

  it("charges a side question through the same permit as any other generation", () => {
    const body = source.slice(
      source.indexOf("async function askAside("),
      source.indexOf("async function discardAside("),
    );
    expect(body).toContain('beginBilledRequest({ surface: "chat" })');
    expect(body).toContain("billed.recordDelivery(");
    expect(body).toContain("await billed.settle()");
    // The permit must be taken BEFORE the engine runs, or it is not a gate.
    expect(body.indexOf('beginBilledRequest({ surface: "chat" })')).toBeLessThan(
      body.indexOf("await reason("),
    );
  });

  it("inherits the conversation's incognito state rather than deciding again", () => {
    const body = source.slice(
      source.indexOf("async function askAside("),
      source.indexOf("async function discardAside("),
    );
    const appends = body.match(/appendSideMessage\(\{[\s\S]*?\}\)/g) ?? [];
    expect(appends).toHaveLength(2);
    for (const append of appends) {
      expect(append).toContain("incognito: conversation.incognito");
    }
  });
});

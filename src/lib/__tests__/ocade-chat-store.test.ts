import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * WHERE A MESSAGE GOES, AND WHAT THE SCREEN IS TOLD ABOUT IT.
 *
 * The store used to route by a per-account privacy mode: an encrypted browser
 * vault, an OS vault, or Supabase — and for Supabase it wrote to both. Most of
 * this file was about which of the three won. `PLAN.md` Phase 2 leaves one
 * authority, so what is worth proving changed:
 *
 *  - an incognito turn is written NOWHERE, and the record still comes back
 *    because the screen renders from it;
 *  - a reachable account gets the row, and the row's id and timestamp win;
 *  - an UNREACHABLE account does not lose the turn and does not claim to have
 *    saved it — it waits in the tab, marked, with a key that makes the later
 *    upload idempotent.
 *
 * The server function is mocked because this is the store's own logic. That the
 * key it sends actually prevents a duplicate row is proved against real
 * PostgreSQL in `db-twin.test.ts`, through the migration's own verification.
 */

const appendOcadeMessage = vi.fn();
const listMessages = vi.fn();

vi.mock("../ocade.functions", () => ({
  appendOcadeMessage: (input: unknown) => appendOcadeMessage(input),
  listMessages: (input: unknown) => listMessages(input),
}));

const { persistChatMessage, loadChatMessages, describeStorageError } =
  await import("../ocade-chat-store");
const { unsyncedCount, unsyncedTurns, forgetAllUnsyncedTurns } =
  await import("../chat/unsynced-turns");

beforeEach(() => {
  appendOcadeMessage.mockReset();
  listMessages.mockReset();
  forgetAllUnsyncedTurns();
});

describe("an incognito turn is written nowhere", () => {
  it("does not call the server at all", async () => {
    const result = await persistChatMessage({
      conversationId: "c1",
      role: "user",
      content: "secret",
      incognito: true,
    });
    expect(appendOcadeMessage).not.toHaveBeenCalled();
    expect(result.stored).toBe("not_stored");
  });

  it("still returns the record, because the screen renders from it", async () => {
    const result = await persistChatMessage({
      conversationId: "c1",
      role: "user",
      content: "secret",
      incognito: true,
    });
    expect(result.record.content).toBe("secret");
    expect(result.record.conversation_id).toBe("c1");
  });

  it("leaves nothing waiting in the tab either", async () => {
    // An unsynchronised buffer would be a record of the conversation having
    // happened, which is the one thing the mode exists to prevent.
    await persistChatMessage({
      conversationId: "c1",
      role: "user",
      content: "secret",
      incognito: true,
    });
    expect(unsyncedCount()).toBe(0);
  });
});

describe("a reachable account takes the message", () => {
  it("sends it and reports the row", async () => {
    appendOcadeMessage.mockResolvedValue({
      id: "row-1",
      created_at: "2026-09-09T10:00:00.000Z",
    });
    const result = await persistChatMessage({
      conversationId: "c1",
      role: "user",
      content: "hello",
    });
    expect(result.stored).toBe("cloud");
    // The row's id wins: it is what every other device will see, and a screen
    // showing the local one would disagree with the conversation on reload.
    expect(result.record.id).toBe("row-1");
    expect(result.record.created_at).toBe("2026-09-09T10:00:00.000Z");
  });

  it("carries model, provider and attachments through", async () => {
    appendOcadeMessage.mockResolvedValue({ id: "row-2" });
    await persistChatMessage({
      conversationId: "c1",
      role: "assistant",
      content: "answer",
      modelId: "ocade-local",
      providerId: "device",
      attachments: [{ kind: "file", name: "a.txt", mime: "text/plain", sizeBytes: 4 }],
    });
    const sent = appendOcadeMessage.mock.calls[0]![0] as { data: Record<string, unknown> };
    expect(sent.data.modelId).toBe("ocade-local");
    expect(sent.data.providerId).toBe("device");
    expect(sent.data.attachments).toHaveLength(1);
  });

  it("sends an idempotency key with every turn", async () => {
    appendOcadeMessage.mockResolvedValue({ id: "row-3" });
    await persistChatMessage({ conversationId: "c1", role: "user", content: "one" });
    await persistChatMessage({ conversationId: "c1", role: "user", content: "two" });
    const keys = appendOcadeMessage.mock.calls.map(
      (call) => (call[0] as { data: { clientKey?: string } }).data.clientKey,
    );
    expect(keys.every(Boolean)).toBe(true);
    expect(new Set(keys).size, "two turns shared one key").toBe(2);
  });
});

describe("an unreachable account does not lose the turn, and does not claim to have saved it", () => {
  beforeEach(() => {
    appendOcadeMessage.mockRejectedValue(new Error("Failed to fetch"));
  });

  it("reports it as unsynchronised rather than as saved or as failed", async () => {
    const result = await persistChatMessage({
      conversationId: "c1",
      role: "user",
      content: "written offline",
    });
    expect(result.stored).toBe("unsynced");
    expect(result.record.unsynced).toBe(true);
  });

  it("holds it in the tab, with the key the upload will use", async () => {
    await persistChatMessage({ conversationId: "c1", role: "user", content: "written offline" });
    const waiting = unsyncedTurns();
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.content).toBe("written offline");
    expect(waiting[0]!.clientKey).toBeTruthy();
  });

  it("shows the waiting turn in the transcript, marked", async () => {
    listMessages.mockResolvedValue([]);
    await persistChatMessage({ conversationId: "c1", role: "user", content: "written offline" });
    const rows = await loadChatMessages({ conversationId: "c1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.unsynced).toBe(true);
  });

  it("keeps another conversation's waiting turn out of this transcript", async () => {
    listMessages.mockResolvedValue([]);
    await persistChatMessage({ conversationId: "c2", role: "user", content: "elsewhere" });
    expect(await loadChatMessages({ conversationId: "c1" })).toHaveLength(0);
  });
});

describe("what comes back from the columns is checked, not trusted", () => {
  /*
   * `citations` is `jsonb` and `reaction` is text, so both hold whatever was
   * written to them — including a shape an older version of OCADE wrote. The
   * screen renders citation cards and a feedback control from these, so a
   * malformed value has to be dropped here rather than reaching them.
   */
  it("keeps the citations that are citations and drops the rest", async () => {
    listMessages.mockResolvedValue([
      {
        id: "a",
        conversation_id: "c1",
        role: "assistant",
        content: "answer",
        created_at: "2026-01-01",
        citations: [
          { sourceId: "S1", name: "notes.pdf", kind: "pdf", locator: { page: 2 }, snippet: "x" },
          { sourceId: "not-a-source-id", name: "bad", kind: "pdf", locator: {}, snippet: null },
          { name: "no source id at all", kind: "pdf", locator: {}, snippet: null },
          "not even an object",
        ],
      },
    ]);
    const [row] = await loadChatMessages({ conversationId: "c1" });
    expect(row!.citations).toHaveLength(1);
    expect(row!.citations![0]!.name).toBe("notes.pdf");
  });

  it("treats a citations value that is not a list as no citations", async () => {
    listMessages.mockResolvedValue([
      {
        id: "a",
        conversation_id: "c1",
        role: "assistant",
        content: "answer",
        created_at: "2026-01-01",
        citations: { sourceId: "S1" },
      },
    ]);
    expect((await loadChatMessages({ conversationId: "c1" }))[0]!.citations).toEqual([]);
  });

  it("reads an unrecognised reaction as no feedback", async () => {
    // A stored value the interface cannot show must not render as a pressed
    // control somebody cannot un-press.
    listMessages.mockResolvedValue([
      {
        id: "a",
        conversation_id: "c1",
        role: "assistant",
        content: "answer",
        created_at: "2026-01-01",
        reaction: "loved-it",
      },
    ]);
    expect((await loadChatMessages({ conversationId: "c1" }))[0]!.reaction).toBeNull();
  });

  it("carries a reaction the interface does show", async () => {
    listMessages.mockResolvedValue([
      {
        id: "a",
        conversation_id: "c1",
        role: "assistant",
        content: "answer",
        created_at: "2026-01-01",
        reaction: "not_helpful",
      },
    ]);
    expect((await loadChatMessages({ conversationId: "c1" }))[0]!.reaction).toBe("not_helpful");
  });
});

describe("loading a conversation", () => {
  it("orders the account's rows and the waiting turns together, oldest first", async () => {
    listMessages.mockResolvedValue([
      { id: "b", conversation_id: "c1", role: "user", content: "second", created_at: "2026-01-02" },
      { id: "a", conversation_id: "c1", role: "user", content: "first", created_at: "2026-01-01" },
    ]);
    appendOcadeMessage.mockRejectedValue(new Error("offline"));
    await persistChatMessage({ conversationId: "c1", role: "user", content: "third" });

    const rows = await loadChatMessages({ conversationId: "c1" });
    expect(rows.map((row) => row.content)).toEqual(["first", "second", "third"]);
  });

  it("returns an empty list when the account has nothing", async () => {
    listMessages.mockResolvedValue(null);
    expect(await loadChatMessages({ conversationId: "c1" })).toEqual([]);
  });
});

describe("describeStorageError gives an actionable message", () => {
  it("explains an unreachable account, and what happens to the message", () => {
    const message = describeStorageError(new Error("Failed to fetch"));
    expect(message).toMatch(/could not reach your account/i);
    expect(message, "does not say what closing the tab costs").toMatch(/closing the tab/i);
  });

  it("passes a plain error message through", () => {
    expect(describeStorageError(new Error("Conversation not found"))).toBe(
      "Conversation not found",
    );
  });

  it("falls back to an honest default for a non-error", () => {
    expect(describeStorageError(undefined)).toMatch(/could not save/i);
  });
});

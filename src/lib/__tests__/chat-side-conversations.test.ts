import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A SIDE CONVERSATION — PLAN.md §8.
 *
 * A short thread hanging off ONE message. Somebody reading an answer wants to
 * ask "what does this word mean" without that question, and the paragraph
 * explaining it, becoming part of the thread they will read back tomorrow.
 *
 * WHAT THE STORE CHANGE MOVED. Side messages used to live in the same
 * encrypted browser store as the transcript, under a `side:` key prefix that
 * the transcript loader had to remember to exclude — a convention, enforced by
 * everyone remembering it. They are rows now, with `anchor_message_id` set, and
 * the exclusion is a database filter the loader cannot forget. So the tests
 * that pinned the prefix are gone, and what they were really protecting — a
 * side question never appearing inline, and never being sent to the engine as
 * part of the thread — is asserted against the query and the prompt instead.
 */

const calls = {
  appended: [] as { data: Record<string, unknown> }[],
  listed: [] as { data: Record<string, unknown> }[],
  deleted: [] as { data: Record<string, unknown> }[],
};

vi.mock("@/lib/ocade.functions", () => ({
  appendOcadeMessage: vi.fn(async (arg: { data: Record<string, unknown> }) => {
    calls.appended.push(arg);
    return { id: "row-1", created_at: "2026-01-02T00:00:00.000Z" };
  }),
  listSideMessages: vi.fn(async (arg: { data: Record<string, unknown> }) => {
    calls.listed.push(arg);
    return [];
  }),
  deleteSideThread: vi.fn(async (arg: { data: Record<string, unknown> }) => {
    calls.deleted.push(arg);
    return { ok: true as const };
  }),
}));

const { appendSideMessage, loadSideThread, deleteSideThread, sideConversationPrompt } =
  await import("../chat/side-conversations");

beforeEach(() => {
  calls.appended = [];
  calls.listed = [];
  calls.deleted = [];
});

describe("a side thread is stored apart from the transcript", () => {
  it("writes the turn against its anchor", async () => {
    await appendSideMessage({
      conversationId: "conversation-1",
      anchorMessageId: "message-1",
      role: "user",
      content: "What does this mean?",
    });
    expect(calls.appended).toHaveLength(1);
    expect(calls.appended[0]!.data.anchorMessageId).toBe("message-1");
  });

  it("takes the row's id and timestamp, not the ones invented for the screen", async () => {
    const { record } = await appendSideMessage({
      conversationId: "conversation-1",
      anchorMessageId: "message-1",
      role: "user",
      content: "What does this mean?",
    });
    expect(record.id).toBe("row-1");
    expect(record.created_at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("is excluded from the transcript by the query, not by a convention", () => {
    /*
     * THE DEFECT THIS PREVENTS. Without the filter every side question appears
     * inline in the conversation and is sent to the engine as part of it —
     * turning a deliberately separate thread into the main one. It is asserted
     * on the query because that is now where the rule lives; a comment saying
     * "remember to exclude these" is what it replaced.
     */
    const source = readFileSync(join(process.cwd(), "src/lib/ocade.functions.ts"), "utf8");
    const transcript = source.slice(
      source.indexOf("export const listMessages ="),
      source.indexOf("export const listSideMessages ="),
    );
    expect(transcript).toContain('.is("anchor_message_id", null)');
  });

  it("reads one anchor's thread rather than every thread of the conversation", async () => {
    await loadSideThread({ conversationId: "conversation-1", anchorMessageId: "message-2" });
    expect(calls.listed[0]!.data).toEqual({
      conversationId: "conversation-1",
      anchorMessageId: "message-2",
    });
  });
});

describe("an incognito conversation writes no side thread either", () => {
  it("returns the turn for the screen and stores nothing", async () => {
    const result = await appendSideMessage({
      conversationId: "conversation-1",
      anchorMessageId: "message-1",
      role: "user",
      content: "private aside",
      incognito: true,
    });
    expect(result.stored).toBe(false);
    expect(result.record.content).toBe("private aside");
    expect(calls.appended).toHaveLength(0);
  });
});

describe("discarding", () => {
  it("removes one thread, named by its anchor", async () => {
    await deleteSideThread({ conversationId: "conversation-1", anchorMessageId: "message-1" });
    expect(calls.deleted[0]!.data).toEqual({
      conversationId: "conversation-1",
      anchorMessageId: "message-1",
    });
  });

  it("is swept by the database when the anchor goes", () => {
    /*
     * The foreign key is what makes this true, so the foreign key is what is
     * asserted. A side thread that outlived the message it hangs off would be
     * an orphaned record of a conversation somebody deleted.
     */
    const migration = readFileSync(
      join(process.cwd(), "supabase/migrations/20260909130000_ocade_side_conversations.sql"),
      "utf8",
    );
    expect(migration).toMatch(
      /anchor_message_id UUID\s+REFERENCES public\.ocade_messages\(id\) ON DELETE CASCADE/,
    );
  });
});

describe("what the engine is told", () => {
  const thread = [
    {
      id: "row-9",
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

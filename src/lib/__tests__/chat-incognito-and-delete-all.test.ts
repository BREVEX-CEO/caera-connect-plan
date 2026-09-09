import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * INCOGNITO CONVERSATIONS AND DELETE-ALL — PLAN.md §8.
 *
 * Both are promises about ABSENCE, which is the hardest kind of behaviour to
 * keep working: nothing goes wrong on screen when they break. An incognito
 * conversation that is quietly written looks identical to one that is not,
 * right up until somebody opens their history and finds it there.
 *
 * WHAT CHANGED WITH `PLAN.md` PHASE 2. Absence used to have to be checked in
 * three places, because a message could land in a browser vault, an OS vault or
 * Supabase. There is one authority now, so "written nowhere" is one assertion —
 * and the buffer that holds a turn while the account is unreachable is the one
 * new place that had to be checked too.
 */

const cloud = { appended: [] as unknown[] };

vi.mock("@/lib/ocade.functions", () => ({
  appendOcadeMessage: vi.fn(async (arg: unknown) => {
    cloud.appended.push(arg);
    return { id: "row", created_at: new Date().toISOString() };
  }),
  listMessages: vi.fn(async () => []),
}));

const { mayPersist, mayRemember, INCOGNITO_CLAIMS } = await import("../chat/incognito");
const { persistChatMessage } = await import("../ocade-chat-store");
const { unsyncedCount, forgetAllUnsyncedTurns } = await import("../chat/unsynced-turns");

beforeEach(() => {
  cloud.appended = [];
  forgetAllUnsyncedTurns();
});

describe("an incognito message is written nowhere", () => {
  const base = {
    conversationId: "conversation-1",
    role: "user" as const,
    content: "something private",
  };

  it("never reaches the account", async () => {
    await persistChatMessage({ ...base, incognito: true });
    expect(cloud.appended).toHaveLength(0);
  });

  it("never reaches the unsynchronised buffer either", async () => {
    /*
     * The buffer is memory, not disk, but it is still a copy — and the flush
     * that drains it would write the turn to the account the moment the
     * connection returned. "Nowhere" has to include it.
     */
    await persistChatMessage({ ...base, incognito: true });
    expect(unsyncedCount()).toBe(0);
  });

  it("still returns the record, because the screen renders from it", async () => {
    const result = await persistChatMessage({ ...base, incognito: true });
    expect(result.stored).toBe("not_stored");
    expect(result.record.content).toBe("something private");
  });

  it("refuses BEFORE choosing a destination", () => {
    /*
     * `mayPersist` is consulted at the top of the store rather than at each
     * call site. A guarantee spread across nine `if`s holds until somebody adds
     * a tenth, and the tenth is the one nobody notices.
     */
    const source = readFileSync(join(process.cwd(), "src/lib/ocade-chat-store.ts"), "utf8");
    const guard = source.indexOf("mayPersist(");
    const send = source.indexOf("appendOcadeMessage(");
    expect(guard).toBeGreaterThan(0);
    expect(send).toBeGreaterThan(guard);
  });

  it("writes an ordinary message, so the test above is not passing by accident", async () => {
    await persistChatMessage(base);
    expect(cloud.appended).toHaveLength(1);
  });
});

describe("the promises the interface makes are the ones the code keeps", () => {
  it("excludes memory in both directions", () => {
    // Excluding only the write is the weaker half: a reply shaped by what OCADE
    // remembers about somebody connects the conversation to them anyway.
    expect(mayRemember(true)).toBe(false);
    expect(mayPersist(true)).toBe(false);
    expect(mayRemember(false)).toBe(true);
    expect(mayPersist(false)).toBe(true);
  });

  it("does not claim anonymity it cannot deliver", () => {
    const notKept = INCOGNITO_CLAIMS.notKept.join(" ");
    expect(notKept).toMatch(/provider/i);
    expect(notKept).toMatch(/already remembers/i);
  });

  it("never persists the flag itself", async () => {
    // Storing "this conversation was incognito" would be a record of it having
    // happened, which is the one thing the mode is for.
    await persistChatMessage({
      conversationId: "conversation-2",
      role: "user",
      content: "ordinary",
    });
    const sent = cloud.appended[0] as { data: Record<string, unknown> };
    expect(Object.keys(sent.data)).not.toContain("incognito");
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

  it("takes the messages with the conversations", () => {
    /*
     * `ocade_messages.conversation_id` cascades, so one delete clears both. A
     * separate message sweep would be a second statement that can fail on its
     * own and leave the text of a deleted conversation in the account.
     */
    const schema = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/20260721142438_03071f4a-d755-4453-beea-10cd60c22e02.sql",
      ),
      "utf8",
    );
    expect(schema).toMatch(
      /conversation_id UUID NOT NULL REFERENCES public\.ocade_conversations\(id\) ON DELETE CASCADE/,
    );
  });
});

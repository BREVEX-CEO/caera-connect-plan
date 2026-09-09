/**
 * A SIDE CONVERSATION — PLAN.md §8.
 *
 * A short thread hanging off ONE message of a conversation. Somebody reading an
 * answer wants to ask "what does this word mean" without that question, and the
 * paragraph explaining it, becoming part of the thread they will read back
 * tomorrow.
 *
 * IT IS NOT A BRANCH, and the two are listed separately in §8 because they
 * solve opposite problems. A branch says "take this conversation in another
 * direction from here" and produces a SECOND conversation carrying a copy of
 * everything before the fork. A side conversation says "hold on, one question"
 * and produces nothing in the sidebar at all: it belongs to the message it
 * hangs off, travels with it, and is deleted with it.
 *
 * WHERE THEY LIVE. In `ocade_messages`, with `anchor_message_id` set to the
 * message they hang off. They used to live in an encrypted browser vault under
 * a `side:` key prefix that the main transcript loader had to remember to
 * exclude; `PLAN.md` Phase 2 leaves one persistent authority, and the database
 * enforces what the prefix only described — the transcript reads
 * `anchor_message_id IS NULL`, and the foreign key deletes a thread with the
 * message it belongs to rather than leaving an orphan behind.
 *
 * INCOGNITO IS INHERITED, not decided again. A side thread of a conversation
 * that is not being written down must not be written down either, and asking
 * the caller to remember that would be a second place to forget it.
 */
import {
  appendOcadeMessage,
  deleteSideThread as deleteSideThreadRows,
  listSideMessages,
} from "@/lib/ocade.functions";
import { mayPersist } from "./incognito";

export interface SideMessage {
  id: string;
  conversation_id: string;
  /** The message this thread hangs off. Immutable for the thread's life. */
  anchor_message_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

/**
 * An id for a turn that is not written down.
 *
 * Only incognito threads need one: every other side message is a row and takes
 * the id the database gives it. React still needs a stable key for the ones it
 * renders from memory.
 */
function localSideId(): string {
  return `side-local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Add one turn to a side thread.
 *
 * Returns the record whether or not it was stored, because the screen renders
 * from it: in an incognito conversation the turn is real, it is on screen, and
 * it is nowhere else.
 */
export async function appendSideMessage(input: {
  conversationId: string;
  anchorMessageId: string;
  role: "user" | "assistant";
  content: string;
  incognito?: boolean;
}): Promise<{ stored: boolean; record: SideMessage }> {
  const createdAt = new Date().toISOString();
  const record: SideMessage = {
    id: localSideId(),
    conversation_id: input.conversationId,
    anchor_message_id: input.anchorMessageId,
    role: input.role,
    content: input.content,
    created_at: createdAt,
  };

  if (!mayPersist(Boolean(input.incognito))) return { stored: false, record };

  const row = (await appendOcadeMessage({
    data: {
      conversationId: input.conversationId,
      anchorMessageId: input.anchorMessageId,
      role: input.role,
      content: input.content,
    },
  })) as unknown as { id?: string; created_at?: string } | null;

  return {
    stored: true,
    // The row's id and timestamp win, for the same reason they do in the main
    // transcript: they are what the next read will return.
    record: { ...record, id: row?.id ?? record.id, created_at: row?.created_at ?? createdAt },
  };
}

/**
 * One side thread, in order.
 *
 * ONE ANCHOR AT A TIME, and that is a change from the vault version, which
 * scanned the whole data class once and grouped every thread of the
 * conversation by anchor. It had to: a key-value store has no other way to
 * find them. A conversation with forty messages therefore paid a full scan on
 * every open to render threads the reader had not asked to see. An index on
 * the anchor answers the question actually being asked — this message's thread,
 * when somebody expands it.
 */
export async function loadSideThread(input: {
  conversationId: string;
  anchorMessageId: string;
}): Promise<SideMessage[]> {
  const rows = (await listSideMessages({
    data: { conversationId: input.conversationId, anchorMessageId: input.anchorMessageId },
  })) as unknown as SideMessage[] | null;
  return rows ?? [];
}

/**
 * Discard one side thread.
 *
 * The anchor message is untouched: closing a side question must never alter the
 * conversation it was asked beside.
 */
export async function deleteSideThread(input: {
  conversationId: string;
  anchorMessageId: string;
}): Promise<void> {
  await deleteSideThreadRows({
    data: { conversationId: input.conversationId, anchorMessageId: input.anchorMessageId },
  });
}

/**
 * What the engine is told when a side question is asked.
 *
 * THE ANCHOR AND THE SIDE THREAD, AND NOTHING ELSE. Sending the whole
 * conversation would make a side question cost the same as a main one — in
 * tokens, in latency, and in commercial allowance — for a question that is
 * about one paragraph. Sending only the question would strip the "this" out of
 * "what does this mean".
 *
 * Pure, so what a side question actually asks is checkable without an engine.
 */
export function sideConversationPrompt(input: {
  anchorContent: string;
  thread: readonly SideMessage[];
  question: string;
}): { role: "system" | "user" | "assistant"; content: string }[] {
  return [
    {
      role: "system",
      content:
        "You are answering a short side question about one passage from a longer conversation. The passage follows. Answer only what is asked, briefly, and do not restate the passage.",
    },
    { role: "user", content: `The passage:\n\n${input.anchorContent}` },
    ...input.thread.map((message) => ({ role: message.role, content: message.content })),
    { role: "user" as const, content: input.question },
  ];
}

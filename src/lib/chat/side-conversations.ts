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
 * WHY THE KEY PREFIX MATTERS MORE THAN IT LOOKS. Side messages live in the same
 * `chats` data class as everything else, because they must sync with the
 * conversation and be swept when it is deleted. But they carry
 * `conversation_id`, and `loadChatMessages` filters on exactly that — so
 * without a key that the main loader can EXCLUDE, every side question would
 * appear inline in the transcript and be sent to the engine as part of it. The
 * `side:` prefix is what keeps them apart, the same device `conv:` uses for
 * conversation records.
 *
 * INCOGNITO IS INHERITED, not decided again. A side thread of a conversation
 * that is not being written down must not be written down either, and asking
 * the caller to remember that would be a second place to forget it.
 */
import { resolveAdapter } from "@/lib/storage/resolver";
import { mayPersist } from "./incognito";

/** Distinguishable by inspection from `conv:` and from a message key. */
const SIDE_PREFIX = "side:";

export interface SideMessage {
  id: string;
  conversation_id: string;
  /** The message this thread hangs off. Immutable for the thread's life. */
  anchor_message_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export function isSideKey(id: string): boolean {
  return id.startsWith(SIDE_PREFIX);
}

/**
 * The storage key.
 *
 * `side:<conversation>:<anchor>::<createdAt>::<suffix>` — the conversation id
 * comes first so a prefix scan finds a conversation's side threads, and the
 * timestamp sorts a thread into order without a second field.
 */
function keyFor(conversationId: string, anchorId: string, createdAt: string): string {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${SIDE_PREFIX}${conversationId}:${anchorId}::${createdAt}::${suffix}`;
}

/**
 * Add one turn to a side thread.
 *
 * Returns the record whether or not it was stored, because the screen renders
 * from it: in an incognito conversation the turn is real, it is on screen, and
 * it is nowhere else.
 */
export async function appendSideMessage(input: {
  userId: string;
  conversationId: string;
  anchorMessageId: string;
  role: "user" | "assistant";
  content: string;
  incognito?: boolean;
}): Promise<{ stored: boolean; record: SideMessage }> {
  const createdAt = new Date().toISOString();
  const record: SideMessage = {
    id: keyFor(input.conversationId, input.anchorMessageId, createdAt),
    conversation_id: input.conversationId,
    anchor_message_id: input.anchorMessageId,
    role: input.role,
    content: input.content,
    created_at: createdAt,
  };

  if (!mayPersist(Boolean(input.incognito))) return { stored: false, record };

  const adapter = await resolveAdapter(input.userId, "chats");
  await adapter.put("chats", record.id, record);
  return { stored: true, record };
}

/**
 * Every side thread of one conversation, grouped by the message it hangs off.
 *
 * One pass over the data class rather than one per anchor: a conversation with
 * forty messages would otherwise scan the same store forty times to render a
 * transcript, and this runs on every open.
 */
export async function loadSideThreads(input: {
  userId: string;
  conversationId: string;
}): Promise<Map<string, SideMessage[]>> {
  const adapter = await resolveAdapter(input.userId, "chats");
  const stored = await adapter.list<SideMessage>("chats");

  const byAnchor = new Map<string, SideMessage[]>();
  for (const row of stored) {
    if (!isSideKey(row.id)) continue;
    const value = row.value;
    if (!value || value.conversation_id !== input.conversationId) continue;
    const list = byAnchor.get(value.anchor_message_id) ?? [];
    list.push(value);
    byAnchor.set(value.anchor_message_id, list);
  }
  for (const list of byAnchor.values()) {
    list.sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  return byAnchor;
}

/**
 * Discard one side thread.
 *
 * The anchor message is untouched: closing a side question must never alter the
 * conversation it was asked beside.
 */
export async function deleteSideThread(input: {
  userId: string;
  conversationId: string;
  anchorMessageId: string;
}): Promise<number> {
  const adapter = await resolveAdapter(input.userId, "chats");
  const stored = await adapter.list<SideMessage>("chats");
  const targets = stored.filter(
    (row) =>
      isSideKey(row.id) &&
      row.value?.conversation_id === input.conversationId &&
      row.value?.anchor_message_id === input.anchorMessageId,
  );
  for (const target of targets) {
    await adapter.delete("chats", target.id);
  }
  return targets.length;
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

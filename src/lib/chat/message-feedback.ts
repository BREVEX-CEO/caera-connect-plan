/* Local-only message feedback. Stores IDs and explicit feedback values only. */
import type { ChatMessageView, ChatReaction } from "@/components/ocade/chat/chat-types";

export type ChatReactionMap = Record<string, ChatReaction>;

const STORAGE_PREFIX = "ocade.chat.reactions.v1";

function storageKey(userId: string, conversationId: string): string {
  return `${STORAGE_PREFIX}:${userId}:${conversationId}`;
}

export function readChatReactions(userId: string, conversationId: string): ChatReactionMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userId, conversationId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, ChatReaction] =>
          entry[1] === "helpful" || entry[1] === "not_helpful",
      ),
    );
  } catch {
    return {};
  }
}

export function writeChatReactions(
  userId: string,
  conversationId: string,
  reactions: ChatReactionMap,
): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey(userId, conversationId), JSON.stringify(reactions));
    return true;
  } catch {
    return false;
  }
}

/** Selecting the active reaction again clears it. */
export function toggleChatReaction(
  reactions: ChatReactionMap,
  messageId: string,
  reaction: ChatReaction,
): ChatReactionMap {
  const next = { ...reactions };
  if (next[messageId] === reaction) delete next[messageId];
  else next[messageId] = reaction;
  return next;
}

export function deliveryStateFor(
  messages: Array<Pick<ChatMessageView, "role">>,
  index: number,
  streaming: boolean,
): ChatMessageView["deliveryState"] {
  if (messages[index]?.role !== "user") return undefined;
  if (messages.slice(index + 1).some((message) => message.role === "assistant")) {
    return "processed";
  }
  return streaming ? "processing" : "sent";
}

export function quoteForReply(content: string, maxLength = 280): string {
  const collapsed = content.trim().replace(/\s+/g, " ");
  const excerpt =
    collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1)}…` : collapsed;
  return excerpt ? `> ${excerpt}\n\n` : "";
}

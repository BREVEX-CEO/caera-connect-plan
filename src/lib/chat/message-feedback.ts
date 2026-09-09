/**
 * PRESENTATION RULES FOR A TRANSCRIPT.
 *
 * This file used to hold a per-browser map of helpful/not-helpful, keyed by
 * user and conversation. `PLAN.md` Phase 2 puts that on the message row it is
 * about — marking a reply unhelpful on a laptop now shows on a phone, and
 * clearing the browser no longer loses it — so what is left here is the two
 * things that are genuinely about rendering rather than about storage.
 */
import type { ChatMessageView } from "@/components/ocade/chat/chat-types";

export function deliveryStateFor(
  messages: Array<Pick<ChatMessageView, "role" | "unsynced">>,
  index: number,
  streaming: boolean,
): ChatMessageView["deliveryState"] {
  if (messages[index]?.role !== "user") return undefined;
  /*
   * FIRST, because it outranks every other answer. A turn held in this tab has
   * not been sent anywhere, whatever has happened around it in the transcript.
   */
  if (messages[index]?.unsynced) return "unsynced";
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

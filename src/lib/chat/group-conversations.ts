import type { ChatConversationView } from "@/components/ocade/chat/chat-types";

/**
 * Bucketing the conversation list by age.
 *
 * Pure, and separate from the sidebar that renders it, so the date arithmetic
 * — including the unparseable-date case — can be exercised without mounting a
 * component.
 */
export type Bucket = { label: string; items: ChatConversationView[] };

const DAY = 24 * 60 * 60 * 1000;

export function groupConversations(
  conversations: ChatConversationView[],
  now = Date.now(),
): Bucket[] {
  const pinned: ChatConversationView[] = [];
  const today: ChatConversationView[] = [];
  const yesterday: ChatConversationView[] = [];
  const week: ChatConversationView[] = [];
  const older: ChatConversationView[] = [];

  for (const c of conversations) {
    if (c.pinned) {
      pinned.push(c);
      continue;
    }
    const at = Date.parse(c.updatedAt);
    // An unparseable date sorts into Older rather than crashing or vanishing.
    const age = Number.isFinite(at) ? now - at : Number.POSITIVE_INFINITY;
    if (age < DAY) today.push(c);
    else if (age < 2 * DAY) yesterday.push(c);
    else if (age < 7 * DAY) week.push(c);
    else older.push(c);
  }

  return [
    { label: "Pinned", items: pinned },
    { label: "Today", items: today },
    { label: "Yesterday", items: yesterday },
    { label: "Previous 7 days", items: week },
    { label: "Older", items: older },
  ].filter((b) => b.items.length > 0);
}

/**
 * Search that reads this device first.
 *
 * WHAT WAS WRONG. `ocade.search.tsx` issued six Supabase queries and nothing
 * else. Three consequences followed, and all three contradict what the rest of
 * the product now promises:
 *
 *  - A Browser Only conversation is never uploaded, by design. So it could not
 *    be found. The one privacy mode whose whole point is that the data stays
 *    here made that data unsearchable.
 *  - Offline, Search threw. Every conversation was sitting in the vault a few
 *    milliseconds away.
 *  - A Private Sync message written seconds ago but not yet drained from the
 *    outbox did not exist upstream, so Search could not see what Chat was
 *    already showing.
 *
 * Ranking is deliberately simple and explainable rather than a scoring model:
 * a title match beats a body match, an earlier match beats a later one, and
 * recency breaks ties. Someone who typed three letters wants the thing they
 * were just working on.
 */
import { resolveAdapter } from "@/lib/storage/resolver";
import { isConversationKey } from "@/lib/chat/local-conversations";
import type { LocalConversation } from "@/lib/chat/local-conversations";
import type { ChatMessageRecord } from "@/lib/ocade-chat-store";

export type LocalSearchKind = "conversation" | "message" | "project" | "output";

export interface LocalSearchResult {
  key: string;
  kind: LocalSearchKind;
  title: string;
  excerpt?: string;
  createdAt?: string;
  /** Where to send the user. A result you cannot open is a result you did not find. */
  conversationId?: string;
  /** Higher is better. Exposed so the merge with remote rows can re-sort. */
  score: number;
  /** True when this row came from the device rather than the server. */
  local: boolean;
}

/** Case-insensitive index of `needle` in `hay`, or -1. */
function indexOfCI(hay: string, needle: string): number {
  return hay.toLowerCase().indexOf(needle.toLowerCase());
}

/**
 * A window of text around the match, with the match itself inside it.
 *
 * Returning the first 220 characters of a long message — which is what the
 * Supabase version did — routinely showed a snippet not containing the word
 * the person searched for, which reads as a wrong result.
 */
export function snippetAround(text: string, query: string, width = 180): string {
  const at = indexOfCI(text, query);
  if (at < 0) return text.slice(0, width);
  const start = Math.max(0, at - Math.floor(width / 3));
  const end = Math.min(text.length, start + width);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * Score one candidate.
 *
 * Title matches outrank body matches because a conversation called "Tax
 * return" is a better answer to "tax" than a message mentioning it once. An
 * earlier position scores higher because a match in the first few words is
 * usually the subject rather than an aside.
 */
export function scoreMatch(title: string, body: string, query: string): number {
  const inTitle = indexOfCI(title, query);
  const inBody = indexOfCI(body, query);
  if (inTitle < 0 && inBody < 0) return 0;
  let score = 0;
  if (inTitle >= 0) score += 100 - Math.min(50, inTitle);
  if (inBody >= 0) score += 40 - Math.min(30, Math.floor(inBody / 40));
  if (inTitle === 0) score += 25; // starts with it
  return score;
}

export interface LocalSearchDeps {
  conversations: LocalConversation[];
  messages: ChatMessageRecord[];
}

/** Pure, so every ranking rule is testable without a browser or a database. */
export function searchLocalRecords(query: string, deps: LocalSearchDeps): LocalSearchResult[] {
  const q = query.trim();
  if (q.length < 2) return [];

  const titles = new Map(deps.conversations.map((c) => [c.id, c.title]));
  const out: LocalSearchResult[] = [];

  for (const c of deps.conversations) {
    if (c.deleted_at) continue;
    const score = scoreMatch(c.title ?? "", "", q);
    if (score <= 0) continue;
    out.push({
      key: `conversation:${c.id}`,
      kind: "conversation",
      title: c.title || "Untitled conversation",
      createdAt: c.updated_at,
      conversationId: c.id,
      score,
      local: true,
    });
  }

  for (const m of deps.messages) {
    const score = scoreMatch("", m.content ?? "", q);
    if (score <= 0) continue;
    out.push({
      key: `message:${m.id}`,
      kind: "message",
      /*
       * Named by its conversation rather than "You message" / "OCADE message".
       * A list of twelve rows all called "OCADE message" tells the reader
       * nothing about which one they want.
       */
      title: titles.get(m.conversation_id) || "Untitled conversation",
      excerpt: snippetAround(m.content ?? "", q),
      createdAt: m.created_at,
      conversationId: m.conversation_id,
      score,
      local: true,
    });
  }

  return sortResults(out);
}

/** Score first, then recency. Stable and explainable. */
export function sortResults(rows: LocalSearchResult[]): LocalSearchResult[] {
  return [...rows].sort(
    (a, b) =>
      b.score - a.score || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
  );
}

/**
 * Fold server rows in without duplicating what the device already has.
 *
 * Keyed by the result key, which for a conversation or message is its id — and
 * ids are generated on the device now, so the same record genuinely carries
 * the same key on both sides. The local copy wins because it may contain an
 * edit that has not drained from the outbox yet.
 */
export function mergeSearchResults(
  local: LocalSearchResult[],
  remote: LocalSearchResult[],
): LocalSearchResult[] {
  const byKey = new Map(local.map((r) => [r.key, r]));
  for (const r of remote) if (!byKey.has(r.key)) byKey.set(r.key, r);
  return sortResults([...byKey.values()]);
}

/** Read everything this device holds for the signed-in user. */
export async function readLocalCorpus(userId: string): Promise<LocalSearchDeps> {
  const adapter = await resolveAdapter(userId, "chats");
  const rows = await adapter.list<LocalConversation | ChatMessageRecord>("chats");
  const conversations: LocalConversation[] = [];
  const messages: ChatMessageRecord[] = [];
  for (const row of rows) {
    if (!row.value) continue;
    if (isConversationKey(row.id)) conversations.push(row.value as LocalConversation);
    else messages.push(row.value as ChatMessageRecord);
  }
  return { conversations, messages };
}

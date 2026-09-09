/**
 * RANKING A SEARCH RESULT, AND SAYING WHERE IT MATCHED.
 *
 * Deliberately simple and explainable rather than a scoring model: a title
 * match beats a body match, an earlier match beats a later one, and recency
 * breaks ties. Someone who typed three letters wants the thing they were just
 * working on.
 *
 * WHAT LEFT THIS FILE. It was `local-search.ts`, and it also read a device
 * corpus — every conversation, message, project and output out of an encrypted
 * browser store — because Search had to answer for content the server had
 * never seen. `PLAN.md` Phase 2 leaves one persistent authority, so there is
 * one corpus and the server can answer for all of it. The ranking survived
 * because it is the part that was never about where the rows came from.
 */

export type SearchResultKind = "conversation" | "message" | "project" | "output";

export interface SearchResult {
  key: string;
  kind: SearchResultKind;
  title: string;
  excerpt?: string;
  createdAt?: string;
  /** Where to send the user. A result you cannot open is a result you did not find. */
  conversationId?: string;
  /** Higher is better. */
  score: number;
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

/** Score first, then recency. Stable and explainable. */
export function sortResults(rows: SearchResult[]): SearchResult[] {
  return [...rows].sort(
    (a, b) =>
      b.score - a.score || String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
  );
}

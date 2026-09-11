/**
 * What fitted, what was dropped, and why.
 *
 * THE SILENT FAILURE EVERY ASSISTANT SHARES. Context windows are finite. When a
 * conversation outgrows one, something has to go — and every mainstream
 * assistant drops it silently. The reply arrives with the same confidence as
 * always, and the user has no way to know that the file they attached forty
 * messages ago is no longer in front of the model, or that the middle of their
 * document was cut. They then trust an answer that was formed without the
 * evidence they believe it was formed from.
 *
 * This is not a small omission. It is the difference between "the model was
 * wrong" and "the model never saw it", and those call for opposite responses
 * from the user. One means re-ask; the other means restructure.
 *
 * OCADE can do better for a reason that is structural rather than clever: the
 * assembly happens on the user's machine, so the budget arithmetic is available
 * to show. Nothing here needs the vendor's cooperation.
 *
 * ESTIMATES ARE LABELLED AS ESTIMATES. Token counts without the model's own
 * tokenizer are approximations, and this says so rather than printing a precise
 * looking number it cannot stand behind.
 */

import { formatNumber } from "@/lib/locale/format";
export type DropReason =
  "older_turn" | "middle_of_document" | "low_relevance" | "duplicate" | "attachment_unreadable";

export interface BudgetItem {
  id: string;
  /** What the user calls it. */
  label: string;
  kind: "system" | "turn" | "document" | "memory";
  /** Estimated tokens. */
  tokens: number;
  /**
   * Higher survives longer. The system prompt and the current question are
   * pinned; everything else competes.
   */
  priority: number;
  /** Pinned items are never dropped — the request is refused instead. */
  pinned?: boolean;
}

export interface DroppedItem {
  id: string;
  label: string;
  kind: BudgetItem["kind"];
  tokens: number;
  reason: DropReason;
  /** What the user can do about it. */
  remedy: string;
}

export interface BudgetPlan {
  /** Items that will be sent, in order. */
  included: BudgetItem[];
  dropped: DroppedItem[];
  usedTokens: number;
  limitTokens: number;
  /** True when nothing had to be dropped. */
  complete: boolean;
  /** True when even the pinned items do not fit. */
  impossible: boolean;
  summary: string;
}

/**
 * Rough token estimate.
 *
 * ~4 characters per token is the usual English approximation. It is wrong for
 * code, wrong for CJK, and wrong for heavily punctuated text — which is exactly
 * why every number derived from it is presented as "about".
 */
export function estimateTokens(text: string): number {
  if (text.length === 0) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

const REMEDIES: Record<DropReason, string> = {
  older_turn: "Start a new conversation, or pin the part you need.",
  middle_of_document: "Ask about a specific section by name so it can be searched instead.",
  low_relevance: "Mention the document by name in your question to raise its priority.",
  duplicate: "This was already included once; nothing is missing.",
  attachment_unreadable: "No text could be read from this file, so it could not be included.",
};

/**
 * Decide what fits.
 *
 * Drops lowest priority first, and reports each removal with a reason and a
 * remedy. The order is stable so the same conversation produces the same plan —
 * a budget that shuffled would make the disclosure impossible to trust.
 */
export function planBudget(items: readonly BudgetItem[], limitTokens: number): BudgetPlan {
  const pinned = items.filter((i) => i.pinned);
  const optional = items.filter((i) => !i.pinned);
  const pinnedTokens = pinned.reduce((n, i) => n + i.tokens, 0);

  if (pinnedTokens > limitTokens) {
    /*
     * Refused rather than silently truncated. Cutting the user's actual
     * question to make it fit is the one failure that guarantees a wrong
     * answer while looking like a normal one.
     */
    return {
      included: [],
      dropped: [],
      usedTokens: pinnedTokens,
      limitTokens,
      complete: false,
      impossible: true,
      summary: `This message is too long for the engine on its own — about ${formatNumber(pinnedTokens)} tokens against a limit of ${formatNumber(limitTokens)}. Shorten the question or use an engine with more room.`,
    };
  }

  // Highest priority first; ties keep their original order so the plan is
  // reproducible.
  const ranked = [...optional]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.priority - a.item.priority || a.index - b.index);

  const included: BudgetItem[] = [...pinned];
  const dropped: DroppedItem[] = [];
  let used = pinnedTokens;

  for (const { item } of ranked) {
    if (used + item.tokens <= limitTokens) {
      included.push(item);
      used += item.tokens;
    } else {
      const reason = reasonFor(item);
      dropped.push({
        id: item.id,
        label: item.label,
        kind: item.kind,
        tokens: item.tokens,
        reason,
        remedy: REMEDIES[reason],
      });
    }
  }

  // Restore the caller's original ordering for what survived: the model needs
  // the conversation in sequence, not in priority order.
  const order = new Map(items.map((item, index) => [item.id, index]));
  included.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const complete = dropped.length === 0;
  return {
    included,
    dropped,
    usedTokens: used,
    limitTokens,
    complete,
    impossible: false,
    summary: complete
      ? `Everything fits — about ${formatNumber(used)} of ${formatNumber(limitTokens)} tokens used.`
      : describeDropped(dropped, used, limitTokens),
  };
}

function reasonFor(item: BudgetItem): DropReason {
  if (item.kind === "turn") return "older_turn";
  if (item.kind === "document") return item.tokens > 0 ? "low_relevance" : "attachment_unreadable";
  return "low_relevance";
}

function describeDropped(dropped: readonly DroppedItem[], used: number, limit: number): string {
  const docs = dropped.filter((d) => d.kind === "document").length;
  const turns = dropped.filter((d) => d.kind === "turn").length;
  const parts: string[] = [];
  if (docs > 0) parts.push(`${docs} ${docs === 1 ? "document" : "documents"}`);
  if (turns > 0) parts.push(`${turns} earlier ${turns === 1 ? "message" : "messages"}`);
  const what = parts.length > 0 ? parts.join(" and ") : `${dropped.length} items`;
  /*
   * Says it plainly. The tempting phrasing — "context optimised" — is how this
   * gets hidden, and hiding it is the entire problem being solved.
   */
  return `${what} did not fit and were left out of this answer. About ${formatNumber(used)} of ${formatNumber(limit)} tokens were used.`;
}

/**
 * The one line that goes under the answer.
 *
 * Returns null when nothing was dropped, so a normal answer carries no notice.
 * A warning on every message is a warning nobody reads.
 */
export function truncationNotice(plan: BudgetPlan): string | null {
  if (plan.complete || plan.impossible) return null;
  const documents = plan.dropped.filter((d) => d.kind === "document");
  if (documents.length > 0) {
    // Documents are called out specifically: a user who attached a file and is
    // not told it was excluded will read the answer as being about that file.
    return `This answer did not include ${documents.map((d) => d.label).join(", ")} — ${
      documents.length === 1 ? "it" : "they"
    } did not fit in the engine's context.`;
  }
  return `Earlier messages were left out of this answer to fit the engine's context.`;
}

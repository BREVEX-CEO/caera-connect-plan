/**
 * What is worth remembering, and what is noise dressed as memory.
 *
 * THE PROBLEM A MEMORY SYSTEM HAS AFTER A MONTH
 * ---------------------------------------------
 * Not forgetting. Remembering too much. A model told to save what matters saves
 * everything that was said, and by week three the recall context is forty lines
 * of "the user asked about their calendar on Tuesday" — which crowds out the
 * two facts that would have been useful and makes every answer worse.
 *
 * The imported taxonomy is the good answer to this, and it is good because it
 * is subtractive: it names four kinds of thing worth keeping and then spends
 * most of its length on what NOT to keep. The exclusions carry evaluation
 * evidence in the donor's own comments — one records a case that went from
 * failing to passing once the rule was added.
 *
 * WHAT WAS ADAPTED AND WHY
 * ------------------------
 * The donor's exclusions are written for a coding tool: do not remember file
 * paths because `git log` is authoritative, do not remember conventions because
 * they are in a project file. The REASONING transfers exactly — do not remember
 * what you can look up — and the examples do not, because OCADE's user is as
 * likely to be organising a trip as reading a repository. The rule is kept and
 * the examples are OCADE's.
 */

import { MEMORY_TYPES, parseMemoryType, type MemoryType } from "@/primary-logic/memory/memoryTypes";

export { MEMORY_TYPES, parseMemoryType };
export type { MemoryType };

/**
 * What each kind of memory is for, in words that fit this product.
 *
 * `reference` is the one people get wrong: it is a durable pointer to something
 * outside the conversation, not a copy of it. Remembering "their invoice
 * template lives in the Finance project" is useful next month; remembering the
 * contents of that template is a stale copy of a file that has since changed.
 */
export const MEMORY_TYPE_GUIDANCE: Record<MemoryType, string> = {
  user: "Something durable about the person: how they want to be addressed, how they like answers, constraints they always work under.",
  feedback: "A correction they made to OCADE's behaviour, so the same mistake is not repeated.",
  project: "Something durable about a piece of their work that is not written down anywhere else.",
  reference: "A durable pointer to where something lives, never a copy of what is in it.",
};

/**
 * The exclusions, as the system prompt states them.
 *
 * Kept as data rather than a template string so the same list can be asserted
 * by a test, shown in Settings, and used to explain a refusal — three places
 * that would otherwise drift.
 */
export const WHAT_NOT_TO_REMEMBER: readonly string[] = [
  "Anything OCADE can look up when it is next needed — the contents of a file, what is in a project, what a page says.",
  "What happened in this conversation. The conversation is already saved.",
  "Temporary state: what is in progress, what was just opened, where they are today.",
  "Activity summaries and lists. If they ask you to remember a list, ask what was surprising about it — that part is worth keeping.",
  "Anything they would not expect OCADE to still know in six months.",
];

/**
 * The memory instructions for the system prompt.
 *
 * Short on purpose. This is prepended to a prompt a small on-device model has
 * to hold alongside the actual request, and a long policy about memory is a
 * policy that crowds out the question.
 */
export function memoryPolicyPrompt(): string {
  return [
    "When you remember something, keep it to one of these:",
    ...MEMORY_TYPES.map((type) => `- ${type}: ${MEMORY_TYPE_GUIDANCE[type]}`),
    "",
    "Do not remember:",
    ...WHAT_NOT_TO_REMEMBER.map((line) => `- ${line}`),
    "",
    "These hold even when the person asks you to save something. Saying what you",
    "will keep instead is more useful than keeping the wrong thing.",
  ].join("\n");
}

/**
 * Whether a proposed memory is the kind worth keeping.
 *
 * Deliberately advisory rather than blocking: this is a heuristic over free
 * text, and refusing a person's explicit "remember this" because a regex
 * disagreed would be the interface overruling them about their own memory. It
 * returns a reason so the surface can say what it noticed and save anyway.
 */
export interface MemoryQualityNote {
  keep: boolean;
  /** Null when there is nothing to say. */
  reason: string | null;
}

const LOOKUP_SHAPED =
  /\b(the (file|document|page|project) (contains|says|has)|contents of|line \d+|as of (today|now))\b/i;
const EPHEMERAL =
  /\b(currently|right now|at the moment|today i|this (morning|afternoon|session)|in progress)\b/i;
const LIST_SHAPED = /^\s*(?:[-*•]|\d+[.)])\s+/m;

export function assessMemory(content: string): MemoryQualityNote {
  const text = content.trim();
  if (text.length === 0) return { keep: false, reason: "There is nothing to remember." };
  if (text.length > 500) {
    return {
      keep: true,
      reason:
        "That is long for a memory. OCADE will keep it, but a shorter note is easier to use later.",
    };
  }
  if (LOOKUP_SHAPED.test(text)) {
    return {
      keep: true,
      reason: "OCADE can look that up when it needs it, so it may be out of date next time.",
    };
  }
  if (EPHEMERAL.test(text)) {
    return { keep: true, reason: "That reads as something true today rather than in general." };
  }
  if (LIST_SHAPED.test(text)) {
    return {
      keep: true,
      reason: "Lists go stale. What was surprising about it is usually the part worth keeping.",
    };
  }
  return { keep: true, reason: null };
}

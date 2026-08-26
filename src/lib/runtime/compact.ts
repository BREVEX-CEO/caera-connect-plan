/**
 * `QueryDeps.compact`: making a long conversation shorter without making it
 * a different conversation.
 *
 * WHY THIS IS NOT A MODEL CALL
 * ----------------------------
 * The donor compacted by asking a model to summarise the transcript. That is
 * the better summary and the wrong trade here: OCADE's engine is the user's own
 * device, a summarisation pass costs a visible wait in the middle of somebody's
 * turn, and it fires precisely when the device is already struggling for
 * context. A compaction that takes twenty seconds to save four seconds is not
 * a saving.
 *
 * So this is structural. It keeps what a later turn actually needs and drops
 * what it does not, using facts about the transcript rather than a judgement
 * about its meaning.
 *
 * WHAT IS ALWAYS KEPT, AND WHY
 * ----------------------------
 * The FIRST user message, because it is the request everything since has been
 * about — a loop that forgets the original instruction starts solving a
 * different problem, which is the specific failure that makes long agent runs
 * wander.
 *
 * The LAST few exchanges, because that is where the conversation currently is.
 *
 * Every TOOL RESULT in the recent window, because those are observations of the
 * world and the next decision is made from them.
 *
 * What is dropped is the middle: the assistant's own prose from turns that have
 * already been superseded. It is the largest thing in a long transcript and the
 * least load-bearing.
 */

import type { QueryMessage } from "@/primary-logic/query/deps";
import { estimateTranscriptTokens } from "@/primary-logic/query/query";

/**
 * How many recent messages survive intact.
 *
 * Twelve covers roughly four exchanges plus their tool results, which is the
 * window in which a model's next decision is actually grounded. Fewer and it
 * loses the thread of what it just did; more and compaction stops saving
 * anything on the transcripts that need it.
 */
const KEEP_RECENT = 12;

/** Below this, compaction cannot save enough to be worth the disruption. */
const MIN_MESSAGES_TO_COMPACT = 16;

export async function compactTranscript(
  messages: readonly QueryMessage[],
): Promise<QueryMessage[] | null> {
  if (messages.length < MIN_MESSAGES_TO_COMPACT) return null;

  const first = messages.find((message) => message.role === "user");
  const recent = messages.slice(-KEEP_RECENT);
  const middle = messages.slice(0, -KEEP_RECENT).filter((message) => message !== first);
  if (middle.length === 0) return null;

  /*
   * The dropped middle is REPLACED, not deleted. A model handed a transcript
   * that jumps from turn two to turn nine with no acknowledgement will
   * confabulate the gap; told plainly that earlier steps were summarised, it
   * asks or works with what it has.
   */
  const droppedTools = middle.filter(
    (message) => typeof message.content === "string" && message.content.startsWith("Result of "),
  ).length;

  const summary: QueryMessage = {
    role: "user",
    content: [
      `[Earlier in this conversation: ${middle.length} messages were condensed to save room`,
      droppedTools > 0 ? `, including ${droppedTools} tool results` : "",
      ". The original request and the most recent exchanges are intact below.]",
    ].join(""),
  };

  const compacted = [...(first ? [first] : []), summary, ...recent];

  /*
   * Refuse a compaction that did not help. Returning a transcript the same size
   * would leave the loop compacting on every iteration, which is a busy loop
   * that also loses history.
   */
  if (estimateTranscriptTokens(compacted) >= estimateTranscriptTokens(messages) * 0.9) {
    return null;
  }
  return compacted;
}

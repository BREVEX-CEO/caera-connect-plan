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
import { microCompact } from "@/primary-logic/query/microCompact";

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

/**
 * How far the cut may move back to land on a round boundary.
 *
 * A long unbroken chain of tool calls has no boundary inside it, and walking
 * back to the start of the conversation looking for one would mean never
 * compacting the transcripts that need it most. Eight is generous enough to
 * clear an ordinary exchange and small enough that the search always ends.
 */
const MAX_BOUNDARY_SEARCH = 8;

/** A tool result, as this transcript writes them. */
function isToolResult(message: QueryMessage): boolean {
  return (
    message.role === "user" &&
    typeof message.content === "string" &&
    message.content.startsWith("Result of ")
  );
}

/**
 * Move a cut back to the start of an exchange.
 *
 * TAKEN FROM THE ARCHIVE, WHICH GROUPS ITS TRANSCRIPT BY ROUND BEFORE
 * COMPACTING FOR EXACTLY THIS REASON: a window that opens part-way through a
 * round begins with the RESULTS of a request the model can no longer see. It
 * then has observations with no question attached, and the reliable failure is
 * that it invents the question — usually a plausible one, which is worse.
 *
 * A round starts at a real user turn. A tool result is written as a user
 * message here, so it is explicitly not one.
 */
function roundBoundary(messages: readonly QueryMessage[], cut: number): number {
  const floor = Math.max(0, cut - MAX_BOUNDARY_SEARCH);
  for (let index = cut; index > floor; index -= 1) {
    const message = messages[index];
    if (message && message.role === "user" && !isToolResult(message)) return index;
  }
  return cut;
}

/** Whether a candidate saved enough to be worth the disruption. */
function savesEnough(
  candidate: readonly QueryMessage[],
  original: readonly QueryMessage[],
): boolean {
  return estimateTranscriptTokens(candidate) < estimateTranscriptTokens(original) * 0.9;
}

export async function compactTranscript(
  messages: readonly QueryMessage[],
): Promise<QueryMessage[] | null> {
  if (messages.length < MIN_MESSAGES_TO_COMPACT) return null;

  /*
   * EMPTY THE OLD OBSERVATIONS BEFORE FORGETTING THE TURNS.
   *
   * Clearing the body of a tool result from six steps ago keeps the shape of
   * what happened — which tools ran, in what order, whether they worked — and
   * throws away only the twelve thousand characters nobody is going to read
   * again. Dropping whole messages loses both. So the cheaper, less lossy pass
   * runs first, and the structural one only when it was not enough.
   *
   * The archive does this for a cache optimisation on hosted inference. Here
   * the saving is the point.
   */
  const trimmed = microCompact(messages);
  if (trimmed && savesEnough(trimmed, messages)) return trimmed;
  const working = trimmed ?? messages;

  const first = working.find((message) => message.role === "user");
  const cut = roundBoundary(working, working.length - KEEP_RECENT);
  const recent = working.slice(cut);
  const middle = working.slice(0, cut).filter((message) => message !== first);
  if (middle.length === 0) return null;

  /*
   * The dropped middle is REPLACED, not deleted. A model handed a transcript
   * that jumps from turn two to turn nine with no acknowledgement will
   * confabulate the gap; told plainly that earlier steps were summarised, it
   * asks or works with what it has.
   */
  const droppedTools = middle.filter(isToolResult).length;

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
  if (!savesEnough(compacted, messages)) return null;
  return compacted;
}

/**
 * Making a transcript safe to carry on from.
 *
 * Ported from the archive's `conversationRecovery.ts` and the message filters
 * it leans on -- `filterUnresolvedToolUses`,
 * `filterWhitespaceOnlyAssistantMessages`, and the interruption detection that
 * decides whether a session ended or merely stopped.
 *
 * WHY A RESUMED CONVERSATION NEEDS REPAIRING AT ALL
 * -------------------------------------------------
 * A run can end anywhere. Pressing stop mid-stream leaves an assistant turn
 * with no text in it; a tab closing between a tool finishing and the model
 * speaking leaves observations with no conclusion. Neither is a bug while the
 * run is alive -- it is simply where things stopped. Both become one the moment
 * that transcript is handed back to a model as history, because the model reads
 * an empty turn as its own silence and a dangling result as something it
 * already accounted for.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor worked on structured content blocks with tool-use ids, so it could
 * pair a call with its result exactly. OCADE's transcript is plain text: the
 * loop writes the assistant's words, then one `Result of <tool>` line per
 * result. So the rules here are the ones that survive that translation, and
 * nothing is inferred that the text cannot actually support.
 */

import type { QueryMessage } from './deps.js'

/** How the previous run ended, as far as the transcript can show. */
export type Interruption =
  /** It finished. The last thing said was the assistant's answer. */
  | 'none'
  /** Tools ran and nothing was said about them. Work was in flight. */
  | 'mid_turn'
  /** The user spoke last and got no reply at all. */
  | 'awaiting_reply'

export type RepairedTranscript = {
  messages: QueryMessage[]
  interruption: Interruption
  /** How many artefacts were removed. Zero on a clean transcript. */
  removed: number
}

function isToolResult(message: QueryMessage): boolean {
  return (
    message.role === 'user' &&
    typeof message.content === 'string' &&
    message.content.startsWith('Result of ')
  )
}

function isEmptyAssistant(message: QueryMessage): boolean {
  return (
    message.role === 'assistant' &&
    (typeof message.content !== 'string' || message.content.trim() === '')
  )
}

/**
 * Clean a stored transcript and say how the last run ended.
 *
 * Removes exactly two things:
 *
 *   1. Assistant turns with nothing in them. A stopped stream writes one every
 *      time, and a model handed its own empty turn treats it as a reply it
 *      already gave.
 *   2. Tool results at the very start, whose request is no longer present --
 *      the orphan case, which is observations with no question attached.
 *
 * It removes nothing else. In particular a dangling result in the MIDDLE is
 * kept: the assistant turn that asked for it is right there, and dropping the
 * pair would lose work that really happened.
 */
export function repairForResume(messages: readonly QueryMessage[]): RepairedTranscript {
  const kept: QueryMessage[] = []
  let removed = 0

  for (const message of messages) {
    if (isEmptyAssistant(message)) {
      removed += 1
      continue
    }
    // Orphan results only at the head: once anything else is kept, a result has
    // its context behind it.
    if (kept.length === 0 && isToolResult(message)) {
      removed += 1
      continue
    }
    kept.push(message)
  }

  const last = kept[kept.length - 1]
  const interruption: Interruption =
    last === undefined
      ? 'none'
      : isToolResult(last)
        ? 'mid_turn'
        : last.role === 'user'
          ? 'awaiting_reply'
          : 'none'

  return { messages: kept, interruption, removed }
}

/**
 * One line to show somebody reopening an interrupted conversation.
 *
 * Null when there is nothing to say, which is the common case. The wording
 * never blames the user or the machine: it says what happened and what will
 * happen next, because "something went wrong" is not a state anybody can act
 * on.
 */
export function describeInterruption(interruption: Interruption): string | null {
  if (interruption === 'mid_turn') {
    return 'This stopped while OCADE was working. Ask it to carry on and it will pick up from what it had done.'
  }
  if (interruption === 'awaiting_reply') {
    return 'This stopped before OCADE answered. Send it again to get a reply.'
  }
  return null
}

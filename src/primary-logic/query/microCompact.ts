/**
 * Making a transcript smaller by emptying old observations, not by forgetting
 * that they happened.
 *
 * Ported from the idea in the archive's `src/services/compact/microCompact.ts`:
 * before dropping messages wholesale, clear the CONTENT of old tool results
 * while keeping the most recent few intact, and leave a marker where the body
 * was.
 *
 * WHY THIS IS THE FIRST THING TO TRY
 * ----------------------------------
 * In a long agent run the largest thing in the transcript is almost always the
 * output of tools -- a directory listing, a file, a page of search results --
 * and the oldest of those are the least load-bearing. The model's next decision
 * is made from what it just saw, not from the twelve-thousand-character listing
 * it read four steps ago.
 *
 * Dropping whole messages loses the SHAPE of what happened: which tools ran, in
 * what order, and whether they worked. Emptying a body keeps all of that and
 * throws away only the part nobody is going to read again.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor gated this on a list of compactable tool names and on a cache-
 * editing API that only its hosted provider offers. OCADE has neither: its
 * transcript is plain text and its engine is on the device, so the rule here is
 * structural -- a tool result is a result whatever produced it -- and the
 * saving is real rather than a cache optimisation.
 */

import type { QueryMessage } from './deps.js'
import { analyseTranscript } from './contextAnalysis.js'

/** What replaces a cleared body. Deliberately says what happened. */
export const CLEARED_MARKER = '[Earlier tool output cleared to save room.]'

/**
 * How many recent tool results keep their content.
 *
 * Four covers the observations the next decision is actually made from. Fewer
 * and the model loses what it just looked at; more and there is nothing left to
 * clear on the transcripts that need it.
 */
const KEEP_INTACT = 4

/** Below this a body is not worth clearing -- the marker costs nearly as much. */
const MIN_BODY_LENGTH = 200

/**
 * A tool result, as this transcript writes them.
 *
 * The prefix is the one `runTools` produces. Matching on it rather than on a
 * list of tool names means a tool added tomorrow is covered today.
 */
export function isToolResult(message: QueryMessage): boolean {
  return (
    message.role === 'user' &&
    typeof message.content === 'string' &&
    message.content.startsWith('Result of ')
  )
}

/** The first line of a result, which names the tool and is worth keeping. */
function headlineOf(content: string): string {
  const newline = content.indexOf('\n')
  const headline = newline === -1 ? content : content.slice(0, newline)
  return headline.length > 200 ? `${headline.slice(0, 200)}…` : headline
}

/**
 * Empty the bodies of old tool results.
 *
 * Returns null when there was nothing worth clearing, so the caller can tell
 * "this did not help" from "this helped a little" without measuring twice.
 */
export function microCompact(
  messages: readonly QueryMessage[],
  keepIntact = KEEP_INTACT,
): QueryMessage[] | null {
  const resultIndexes: number[] = []
  messages.forEach((message, index) => {
    if (isToolResult(message)) resultIndexes.push(index)
  })

  /*
   * SUPERSEDED COPIES GO FIRST, WHATEVER THEIR AGE.
   *
   * The same file read three times is three copies of one fact, and only the
   * last is worth anything. Clearing the earlier ones costs nothing at all --
   * unlike clearing an old unique observation, which costs a little. So they
   * are cleared even when they fall inside the recent window that age alone
   * would protect.
   */
  const superseded = new Set(analyseTranscript(messages).supersededResults)
  const byAge = resultIndexes.slice(0, Math.max(0, resultIndexes.length - keepIntact))
  const clearable = [...new Set([...superseded, ...byAge])].sort((a, b) => a - b)
  if (clearable.length === 0) return null

  const toClear = new Set(
    clearable.filter((index) => {
      const content = messages[index]!.content
      return typeof content === 'string' && content.length >= MIN_BODY_LENGTH
    }),
  )
  if (toClear.size === 0) return null

  return messages.map((message, index) => {
    if (!toClear.has(index)) return message
    const content = message.content as string
    // The headline stays: "which tool ran, and on what" is the part a later
    // turn reasons about. Only the body it produced goes.
    return { ...message, content: `${headlineOf(content)}\n${CLEARED_MARKER}` }
  })
}

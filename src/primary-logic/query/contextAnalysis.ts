/**
 * Where a conversation's room actually went.
 *
 * Ported from the archive's `contextAnalysis.ts`, which breaks a transcript
 * down by what is taking the space: requests, results by tool, what the person
 * said, what the model said, and -- the interesting one -- the same thing read
 * more than once.
 *
 * WHY THE DUPLICATE COUNT IS THE PART WORTH HAVING
 * ------------------------------------------------
 * In a long run the biggest single waste is not that observations are large. It
 * is that the SAME observation is present several times: a file read at step
 * three, again at step nine because the model forgot, again at step fourteen to
 * check. Every copy costs the same as the first and only the last one is worth
 * anything.
 *
 * So this exists to be used, not displayed. Compaction asks it which results
 * are superseded copies and clears those first, which is a saving with no loss
 * at all -- unlike dropping turns, which always loses something.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor walked structured content blocks and could name the tool from the
 * block. OCADE's transcript is text, and the loop writes results as
 * `Result of <tool>: <body>`, so the tool name and the request it answered are
 * read from that line. Anything that does not match is counted as prose rather
 * than guessed at.
 */

import type { QueryMessage } from './deps.js'

const RESULT_PREFIX = /^Result of ([a-z0-9_]+): ?/i

export type TranscriptAnalysis = {
  /** Rough characters, which is what the estimator is proportional to. */
  total: number
  /** Characters spent on what the person said. */
  user: number
  /** Characters spent on what the model said. */
  assistant: number
  /** Characters spent on observations, by tool name. */
  byTool: Record<string, number>
  /**
   * Message indexes holding a result that a later message repeats verbatim.
   *
   * The LAST copy is never included: it is the current answer. Everything
   * before it is a stale copy of the same fact.
   */
  supersededResults: number[]
}

/** The tool a result came from, or null when the line is not a result. */
export function toolOfResult(message: QueryMessage): string | null {
  if (message.role !== 'user' || typeof message.content !== 'string') return null
  const match = message.content.match(RESULT_PREFIX)
  return match ? match[1]! : null
}

export function analyseTranscript(messages: readonly QueryMessage[]): TranscriptAnalysis {
  const analysis: TranscriptAnalysis = {
    total: 0,
    user: 0,
    assistant: 0,
    byTool: {},
    supersededResults: [],
  }

  /** Last index seen for each identical result, so earlier copies are stale. */
  const lastSeen = new Map<string, number>()

  messages.forEach((message, index) => {
    const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content)
    analysis.total += content.length

    const tool = toolOfResult(message)
    if (tool !== null) {
      analysis.byTool[tool] = (analysis.byTool[tool] ?? 0) + content.length
      const previous = lastSeen.get(content)
      if (previous !== undefined) analysis.supersededResults.push(previous)
      lastSeen.set(content, index)
      return
    }

    if (message.role === 'assistant') analysis.assistant += content.length
    else analysis.user += content.length
  })

  analysis.supersededResults.sort((a, b) => a - b)
  return analysis
}

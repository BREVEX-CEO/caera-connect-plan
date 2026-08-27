/**
 * When a conversation is worth remembering, and when it is not yet.
 *
 * Ported from the archive's `src/services/SessionMemory/sessionMemoryUtils.ts`.
 * The donor's thresholds are the interesting part and are kept exactly: a
 * conversation must have grown past a floor before anything is extracted at
 * all, and after that a further extraction needs BOTH real context growth and
 * some actual work having happened.
 *
 * Why both conditions, and why this is not a timer: a chat that is idle grows
 * no context and does no work, so it never extracts -- which is correct, since
 * there is nothing new to learn. A chat doing heavy work crosses both quickly.
 * A timer would fire on the first and miss the second.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor kept this state in module-level variables, because its process was
 * one conversation. OCADE holds several at once in one tab -- Chat and Cowork
 * at minimum -- so the state is a value passed in and returned, and the caller
 * keeps one per session. Nothing here reads or writes a global.
 */

export type SessionMemoryConfig = {
  /**
   * Minimum conversation size, in tokens, before session memory starts at all.
   * Below this there is not enough said to be worth summarising.
   */
  minimumTokensToInit: number
  /** Minimum context GROWTH between extractions, in tokens. */
  minimumTokensBetweenUpdates: number
  /** Minimum tool calls between extractions. */
  toolCallsBetweenUpdates: number
}

export const DEFAULT_SESSION_MEMORY_CONFIG: SessionMemoryConfig = {
  minimumTokensToInit: 10000,
  minimumTokensBetweenUpdates: 5000,
  toolCallsBetweenUpdates: 3,
}

export type SessionMemoryState = {
  initialized: boolean
  /** Context size the last time something was extracted. */
  tokensAtLastExtraction: number
  /** Tool calls seen since the last extraction. */
  toolCallsSinceExtraction: number
  /** True while an extraction is in flight, so two do not race. */
  extracting: boolean
}

export function createSessionMemoryState(): SessionMemoryState {
  return {
    initialized: false,
    tokensAtLastExtraction: 0,
    toolCallsSinceExtraction: 0,
    extracting: false,
  }
}

export function hasMetInitializationThreshold(
  tokenCount: number,
  config: SessionMemoryConfig = DEFAULT_SESSION_MEMORY_CONFIG,
): boolean {
  return tokenCount >= config.minimumTokensToInit
}

export function hasMetUpdateThreshold(
  state: SessionMemoryState,
  tokenCount: number,
  config: SessionMemoryConfig = DEFAULT_SESSION_MEMORY_CONFIG,
): boolean {
  const growth = tokenCount - state.tokensAtLastExtraction
  return (
    growth >= config.minimumTokensBetweenUpdates &&
    state.toolCallsSinceExtraction >= config.toolCallsBetweenUpdates
  )
}

/**
 * Should this turn extract?
 *
 * The first extraction waits only on size -- a long conversation with no tool
 * calls still contains things worth keeping. Every later one waits on growth
 * AND work, which is what stops a session from re-summarising itself every turn
 * once it is past the floor.
 */
export function shouldExtract(
  state: SessionMemoryState,
  tokenCount: number,
  config: SessionMemoryConfig = DEFAULT_SESSION_MEMORY_CONFIG,
): boolean {
  if (state.extracting) return false
  if (!state.initialized) return hasMetInitializationThreshold(tokenCount, config)
  return hasMetUpdateThreshold(state, tokenCount, config)
}

/** Count work done this turn, so the next threshold check can see it. */
export function noteToolCalls(
  state: SessionMemoryState,
  count: number,
): SessionMemoryState {
  if (count <= 0) return state
  return { ...state, toolCallsSinceExtraction: state.toolCallsSinceExtraction + count }
}

export function beginExtraction(state: SessionMemoryState): SessionMemoryState {
  return { ...state, extracting: true }
}

/**
 * Record that an extraction finished.
 *
 * The counters reset whether or not anything was actually learned. A turn that
 * produced nothing worth keeping has still been looked at, and looking at it
 * again immediately would cost the same and find the same nothing.
 */
export function completeExtraction(
  state: SessionMemoryState,
  tokenCount: number,
): SessionMemoryState {
  return {
    initialized: true,
    tokensAtLastExtraction: tokenCount,
    toolCallsSinceExtraction: 0,
    extracting: false,
  }
}

/** An extraction that failed leaves the thresholds where they were. */
export function abandonExtraction(state: SessionMemoryState): SessionMemoryState {
  return { ...state, extracting: false }
}

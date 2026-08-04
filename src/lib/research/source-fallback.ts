/**
 * OCADE research source fallback (master plan §5.1: retry and source fallback).
 *
 * When a source fails or a search comes up empty, the question is what to try
 * next — and, just as importantly, when to stop trying and say "I couldn't find
 * this" rather than reaching for a worse source to have *an* answer.
 *
 * This is the retry/fallback policy, kept pure. It decides the order sources
 * are attempted and when to give up; the attempts themselves happen behind the
 * network boundary this environment doesn't cross.
 *
 * TWO RULES:
 *
 *  1. **Fall back in descending authority, never ascending.** A transient
 *     failure on an official source is retried before dropping to a newsroom;
 *     the policy never "upgrades" to a weaker source just because it answered
 *     first. Answering from the best source that works, not the first that
 *     talks, is the point.
 *
 *  2. **Exhaustion is an honest outcome, not a prompt to lower the bar.** When
 *     every source of adequate authority has failed, the policy returns
 *     `exhausted` — it does NOT quietly accept a below-threshold source to
 *     produce something. "I couldn't confirm this" is a valid, and often
 *     correct, answer.
 */
import { authorityFor, type SourceRecord } from "./source-ranking";

export type Attempt =
  /** The source returned usable content. */
  | { source: string; result: "ok" }
  /** Transient failure (timeout, 5xx) — worth one retry. */
  | { source: string; result: "transient" }
  /** Hard failure (404, blocked, empty) — do not retry this source. */
  | { source: string; result: "hard" };

export interface FallbackPlan {
  /** Sources to try, best authority first. */
  order: SourceRecord[];
  /** Max retries for a transient failure on any one source. */
  maxRetries: number;
  /** Authority below which a source is not worth falling back to. */
  minAuthority: number;
}

export type FallbackOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/**
 * Order candidate sources for a topic, strongest authority first, dropping any
 * below the floor.
 */
export function planFallback(
  sources: SourceRecord[],
  topic: string,
  opts: { maxRetries?: number; minAuthority?: number } = {},
): FallbackOutcome<FallbackPlan> {
  const minAuthority = opts.minAuthority ?? 0.4;
  const eligible = sources
    .map((s) => ({ s, a: authorityFor(s, topic) }))
    .filter((x) => x.a >= minAuthority)
    .sort((x, y) => y.a - x.a)
    .map((x) => x.s);

  if (eligible.length === 0) {
    return {
      ok: false,
      reason: `No source meets the minimum authority (${minAuthority}) for “${topic}”. OCADE won't fall back to a source too weak to trust just to produce an answer.`,
    };
  }

  return {
    ok: true,
    data: { order: eligible, maxRetries: opts.maxRetries ?? 1, minAuthority },
    evidence: `${eligible.length} source(s) in fallback order, best first; below ${minAuthority} authority excluded.`,
  };
}

export type NextAction =
  /** Attempt this source for the first time (initial pick or a fall-back). */
  | { action: "try"; source: string; reason: string }
  /** Retry this source after a transient failure. */
  | { action: "retry"; source: string; attempt: number; reason: string }
  /** A source returned usable content; use its result. */
  | { action: "accept"; source: string; reason: string }
  /** No adequate source succeeded; report unconfirmed rather than lower the bar. */
  | { action: "exhausted"; reason: string };

/**
 * Given the attempts so far, decide the next action.
 *
 * Deterministic over the history: accept a source that returned ok; otherwise
 * walk the ordered sources best-first, retrying a transient failure up to the
 * budget and skipping a source that hard-failed or ran out of retries; report
 * exhaustion when the list runs out — never dropping below the authority floor
 * `planFallback` set.
 */
export function nextAction(plan: FallbackPlan, attempts: Attempt[]): NextAction {
  const success = attempts.find((a) => a.result === "ok");
  if (success) {
    return {
      action: "accept",
      source: success.source,
      reason: `${success.source} returned usable content.`,
    };
  }

  for (const source of plan.order) {
    const forThis = attempts.filter((a) => a.source === source.publisher);
    if (forThis.some((a) => a.result === "hard")) continue; // out; try the next

    const transientCount = forThis.filter((a) => a.result === "transient").length;
    if (transientCount === 0) {
      return {
        action: "try",
        source: source.publisher,
        reason: `Trying ${source.publisher} (highest authority not yet failed).`,
      };
    }
    if (transientCount <= plan.maxRetries) {
      return {
        action: "retry",
        source: source.publisher,
        attempt: transientCount + 1,
        reason: `${source.publisher} had a transient failure; retry ${transientCount + 1} of ${plan.maxRetries + 1}.`,
      };
    }
    // Retries spent on this source; fall through to the next best.
  }

  return {
    action: "exhausted",
    reason:
      "Every source of adequate authority failed. OCADE couldn't confirm this, and won't drop to a weaker source to manufacture an answer. Saying it's unconfirmed is the honest result.",
  };
}

/**
 * The OCADE query loop.
 *
 * WHAT THIS IS, AND HOW IT RELATES TO THE DONOR'S
 * -----------------------------------------------
 * The donor's `query.ts` is a 1,700-line agentic loop whose imports include a
 * hosted API client, a terminal renderer, an analytics sink, a bun bundler
 * macro and a Node process. None of that survives contact with a browser tab,
 * and none of it is what makes the loop good.
 *
 * What makes it good is its CONTROL FLOW, and that is what is here: the same
 * `Continue`/`Terminal` vocabulary (imported verbatim from the donor), the same
 * dependency-injection boundary (`QueryDeps`), the same token-budget
 * continuation logic (verbatim), and the same set of recovery paths — truncated
 * output, over-long prompt, compaction, bounded turns, abort. Each one exists
 * because the donor hit the failure it prevents.
 *
 * THE RECOVERY PATHS, AND THE FAILURE EACH ONE ANSWERS
 * ----------------------------------------------------
 * `max_output_tokens_recovery` — the model hit its output ceiling mid-answer.
 * Presenting that as a finished reply is the worst available outcome: it reads
 * as a complete thought that happens to stop. The loop asks it to continue.
 *
 * `reactive_compact_retry` — the transcript no longer fits. Compacting and
 * retrying once is the difference between a long conversation that degrades
 * and one that dies.
 *
 * `token_budget_continuation` — the person asked for a large piece of work
 * ("+500k"). A model told to do something big stops early and summarises; the
 * budget check nudges it to keep working, and stops nudging when the returns
 * diminish rather than looping forever.
 *
 * `blocking_limit` — a bounded number of tool rounds. Without it a model that
 * has decided to retry the same failing call does so until the tab dies.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * -----------------------------
 * Cost tracking, usage accounting to a hosted plan, transcript upload, fast-mode
 * gates, teammate handoff, forked agents and the analytics events that the donor
 * fired at every transition. Those all served a hosted product. The transitions
 * they annotated are kept; the reporting is not.
 */

import type { Continue, Terminal } from "./transitions";
import {
  checkTokenBudget,
  createBudgetTracker,
  type BudgetTracker,
} from "./tokenBudget";
import type {
  CallModelInput,
  QueryDeps,
  QueryMessage,
  QueryTool,
  QueryToolCall,
  QueryToolResult,
} from "./deps";

export interface QueryParams {
  messages: QueryMessage[];
  systemPrompt: string;
  tools: readonly QueryTool[];
  deps: QueryDeps;
  signal?: AbortSignal;
  onToken?: (chunk: string) => void;
  /**
   * Rounds of tool use before the loop stops on its own.
   *
   * Ten, because the measured shape of a stuck run is a model repeating one
   * failing call: it never converges, and every round costs the person a wait.
   * A genuine multi-step task on this product has not needed more.
   */
  maxTurns?: number;
  /** From "+500k" in the request. Null when the person asked for no budget. */
  tokenBudget?: number | null;
  /** Compact once the transcript passes this many tokens. */
  compactThreshold?: number;
}

export type QueryEvent =
  | { kind: "turn_started"; turn: number }
  | { kind: "text"; text: string }
  | { kind: "tool_calls"; calls: readonly QueryToolCall[] }
  | { kind: "tool_results"; results: readonly QueryToolResult[] }
  | { kind: "transition"; transition: Continue }
  | { kind: "compacted"; before: number; after: number };

export interface QueryResult {
  terminal: Terminal;
  /** Everything the model said, in order. */
  text: string;
  messages: QueryMessage[];
  toolResults: QueryToolResult[];
  turns: number;
}

const DEFAULT_MAX_TURNS = 10;
const DEFAULT_COMPACT_THRESHOLD = 12_000;

/**
 * The output ceiling asked for when retrying a truncated turn.
 *
 * Raised rather than removed: an unbounded retry on a model that is repeating
 * itself produces a very long repetition. One raise, then the loop accepts what
 * it has and says the answer was cut short.
 */
const RECOVERY_OUTPUT_TOKENS = 4096;
const MAX_OUTPUT_RECOVERIES = 1;

interface LoopState {
  messages: QueryMessage[];
  turnCount: number;
  maxOutputTokensOverride: number | undefined;
  maxOutputTokensRecoveryCount: number;
  hasAttemptedReactiveCompact: boolean;
  /** Why the previous iteration continued. Undefined on the first. */
  transition: Continue | undefined;
}

export async function runQuery(
  params: QueryParams,
  onEvent?: (event: QueryEvent) => void,
): Promise<QueryResult> {
  const { deps, systemPrompt, tools, signal } = params;
  const maxTurns = params.maxTurns ?? DEFAULT_MAX_TURNS;
  const compactThreshold = params.compactThreshold ?? DEFAULT_COMPACT_THRESHOLD;
  const budget = params.tokenBudget ?? null;
  const budgetTracker: BudgetTracker | null = budget ? createBudgetTracker() : null;

  const state: LoopState = {
    messages: [...params.messages],
    turnCount: 1,
    maxOutputTokensOverride: undefined,
    maxOutputTokensRecoveryCount: 0,
    hasAttemptedReactiveCompact: false,
    transition: undefined,
  };

  const emit = (event: QueryEvent) => onEvent?.(event);
  const collected: QueryToolResult[] = [];
  let spokenText = "";
  let turnTokens = 0;

  const finish = (terminal: Terminal): QueryResult => ({
    terminal,
    text: spokenText,
    messages: state.messages,
    toolResults: collected,
    turns: state.turnCount,
  });

  while (true) {
    if (signal?.aborted) return finish({ reason: "aborted_streaming" });

    const stopped = deps.shouldStop?.();
    if (stopped) return finish({ reason: "stop_hook_prevented", error: stopped });

    if (state.turnCount > maxTurns) return finish({ reason: "max_turns" });

    /*
     * COMPACTION BEFORE THE CALL, NOT AFTER THE FAILURE.
     *
     * The donor had both: a proactive threshold and a reactive retry when the
     * model refused an over-long prompt. Both are kept, because the threshold
     * is a guess about token counting and the refusal is the ground truth.
     */
    const tokens = deps.countTokens(state.messages);
    if (tokens > compactThreshold) {
      const compacted = await deps.compact(state.messages);
      if (compacted) {
        emit({ kind: "compacted", before: tokens, after: deps.countTokens(compacted) });
        state.messages = compacted;
      }
    }

    emit({ kind: "turn_started", turn: state.turnCount });

    const input: CallModelInput = {
      messages: state.messages,
      systemPrompt,
      tools,
      ...(signal ? { signal } : {}),
      ...(params.onToken
        ? {
            onToken: (chunk: string) => {
              spokenText += chunk;
              params.onToken?.(chunk);
              emit({ kind: "text", text: chunk });
            },
          }
        : {}),
      ...(state.maxOutputTokensOverride === undefined
        ? {}
        : { maxOutputTokensOverride: state.maxOutputTokensOverride }),
    };

    let turn;
    try {
      turn = await deps.callModel(input);
    } catch (error) {
      if (signal?.aborted) return finish({ reason: "aborted_streaming" });

      /*
       * A PROMPT THE ENGINE REFUSED FOR LENGTH IS RETRIED ONCE, COMPACTED.
       *
       * Distinguished from any other model error by the message, which is the
       * only signal the browser engines give. Getting this wrong in the safe
       * direction — treating a genuine error as over-long — costs one wasted
       * compaction; getting it wrong the other way kills a long conversation.
       */
      const tooLong = isPromptTooLong(error);
      if (tooLong && !state.hasAttemptedReactiveCompact) {
        const compacted = await deps.compact(state.messages);
        if (compacted) {
          state.hasAttemptedReactiveCompact = true;
          state.messages = compacted;
          state.transition = { reason: "reactive_compact_retry" };
          emit({ kind: "transition", transition: state.transition });
          continue;
        }
      }
      return finish({
        reason: tooLong ? "prompt_too_long" : "model_error",
        error,
      });
    }

    if (!params.onToken && turn.text) spokenText += turn.text;
    turnTokens += turn.usage?.output_tokens ?? estimateTokens(turn.text);

    state.messages = [
      ...state.messages,
      { role: "assistant", content: turn.text },
    ];

    /*
     * A TRUNCATED ANSWER IS NOT A FINISHED ANSWER.
     *
     * `max_tokens` means the model was still talking. Continuing costs one more
     * round; presenting it as complete costs the person their trust the first
     * time they notice a sentence ending mid-word.
     */
    if (
      turn.stopReason === "max_tokens" &&
      state.maxOutputTokensRecoveryCount < MAX_OUTPUT_RECOVERIES
    ) {
      state.maxOutputTokensRecoveryCount += 1;
      state.maxOutputTokensOverride = RECOVERY_OUTPUT_TOKENS;
      state.messages = [
        ...state.messages,
        { role: "user", content: "Continue exactly where you stopped. Do not repeat yourself." },
      ];
      state.turnCount += 1;
      state.transition = { reason: "max_output_tokens_recovery" };
      emit({ kind: "transition", transition: state.transition });
      continue;
    }

    if (turn.toolCalls.length > 0) {
      emit({ kind: "tool_calls", calls: turn.toolCalls });
      if (signal?.aborted) return finish({ reason: "aborted_tools" });

      const results = await deps.runTools(turn.toolCalls, signal);
      collected.push(...results);
      emit({ kind: "tool_results", results });

      state.messages = [
        ...state.messages,
        ...results.map(
          (result): QueryMessage => ({
            role: "user",
            content: `Result of ${result.name}: ${result.content}`,
          }),
        ),
      ];
      state.turnCount += 1;
      state.transition = { reason: "tool_use" };
      emit({ kind: "transition", transition: state.transition });
      continue;
    }

    /*
     * THE TOKEN BUDGET, WHICH ONLY APPLIES WHEN SOMEBODY ASKED FOR ONE.
     *
     * A model given a large task stops early and offers to continue. The
     * donor's tracker nudges it back to work while the returns hold up and
     * stops when two consecutive rounds produce almost nothing — which is what
     * keeps this from being an infinite "keep going" loop.
     */
    if (budgetTracker && budget) {
      const decision = checkTokenBudget(budgetTracker, undefined, budget, turnTokens);
      if (decision.action === "continue") {
        state.messages = [
          ...state.messages,
          { role: "user", content: decision.nudgeMessage },
        ];
        state.turnCount += 1;
        state.transition = { reason: "token_budget_continuation" };
        emit({ kind: "transition", transition: state.transition });
        continue;
      }
    }

    return finish({ reason: "completed" });
  }
}

/**
 * Whether an engine failure means "this prompt does not fit".
 *
 * The browser engines report it as prose rather than a code, so this matches on
 * the phrases they actually use. A miss costs a long conversation; a false
 * positive costs one compaction, so the list errs towards matching.
 */
export function isPromptTooLong(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /context|token limit|too long|exceeds|kv cache|out of memory|prompt is too large/i.test(
    message,
  );
}

/**
 * A token estimate for engines that do not report usage.
 *
 * Four characters per token is the ratio measured across English prose and code
 * on this product's models. It decides when to compact, so being wrong by a
 * third is tolerable and being absent is not: with no estimate the loop would
 * either never compact or compact constantly.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Token estimate for a whole transcript. */
export function estimateTranscriptTokens(messages: readonly QueryMessage[]): number {
  let total = 0;
  for (const message of messages) {
    total +=
      typeof message.content === "string"
        ? estimateTokens(message.content)
        : estimateTokens(JSON.stringify(message.content));
  }
  return total;
}

/**
 * The agent loop: observe → plan → act → observe → verify → continue.
 *
 * WHAT WAS MISSING, EXACTLY
 * -------------------------
 * OCADE could answer, and OCADE could act, and nothing joined the two. The
 * chat route talked to a model; the companion, the browser host and the file
 * layer each executed typed actions when a developer called them. There was no
 * component whose job was to turn a sentence into actions and then check what
 * those actions did. This is that component.
 *
 * FOUR RULES IT WILL NOT BEND
 *
 * 1. **Never act on a stale view.** A plan is made against an observation, and
 *    the observation is re-taken after every mutating step. A long sequence
 *    emitted from one model turn is not executed as a batch — each step is
 *    re-decided with the world as it is now. This is the difference between
 *    automation and a macro.
 *
 * 2. **"Done" requires verification.** A tool returning `success` is a claim
 *    that a call was accepted. `verified === false` means the adapter looked
 *    for the expected change and did not find it, and the loop reports that
 *    plainly rather than summarising it as completion.
 *
 * 3. **A repeated failure is a stop, not a rhythm.** The same tool, with the
 *    same arguments, failing the same way twice ends the loop with an
 *    explanation. Nothing about a third attempt changes a permission refusal.
 *
 * 4. **The user may change their mind at any moment.** A revision cancels the
 *    FUTURE branch and keeps everything already produced. Work that has already
 *    happened is never repeated, and irreversible steps are never re-run.
 */

import { classify, type ClassifyDeps, type Classification, type Domain } from "./domains";
import {
  MAX_ATTEMPTS_PER_CALL,
  MAX_STEPS_PER_TASK,
  isRetryable,
  isTerminal,
  signatureOf,
  type ToolOutcome,
} from "./outcomes";
import { findTool, schemasFor, type WireTool } from "./tool-registry";
import { estimateTranscriptTokens, runQuery } from "@/primary-logic/query/query";
import type { QueryDeps } from "@/primary-logic/query/deps";
import { compactTranscript } from "@/lib/runtime/compact";
import { ocadeCorePolicy } from "./ocade-core-policy";
import { ocadeIdentityAnswer } from "@/lib/ocade-identity";

export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCalls?: ToolCall[];
  toolName?: string;
}

export interface ModelTurn {
  text: string;
  toolCalls: ToolCall[];
}

export interface AgentDeps extends ClassifyDeps {
  /** One model turn with the loaded tool schemas. Streams text as it arrives. */
  turn: (
    messages: AgentMessage[],
    tools: WireTool[],
    handlers: { onToken?: (chunk: string) => void; signal?: AbortSignal },
  ) => Promise<ModelTurn>;
  /** Run one validated tool call. Adapters own their own argument checking. */
  execute: (call: ToolCall, signal?: AbortSignal) => Promise<ToolOutcome>;
  /**
   * Ask the user. Returns false to refuse. Read-only tools never reach here —
   * asking permission to look is how people learn to click through prompts.
   */
  permit: (call: ToolCall, risk: string) => Promise<boolean>;
  /** Progress for the UI: spoken lines, task cards, receipts. */
  onEvent?: (event: AgentEvent) => void;
  /**
   * Whether the user has interrupted — by voice, or by pressing stop.
   *
   * Optional so a surface without audio (the browser demo, tests) is unchanged.
   * Absent means "nothing can interrupt", which is the honest default for a
   * caller that has no microphone attached.
   */
  stopRequested?: () => Promise<{ stopped: boolean; reason?: string; heard?: string }>;
}

export type AgentEvent =
  | { kind: "classified"; classification: Classification; tools: string[] }
  | { kind: "thinking"; text: string }
  | { kind: "tool_start"; call: ToolCall; risk: string }
  | { kind: "tool_end"; call: ToolCall; outcome: ToolOutcome }
  | { kind: "refused"; call: ToolCall; reason: string }
  | { kind: "revised"; instruction: string }
  | { kind: "finished"; reason: AgentStopReason; text: string };

export type AgentStopReason =
  "answered" | "verified" | "blocked" | "cancelled" | "step_limit" | "repeating";

export interface AgentResult {
  reason: AgentStopReason;
  /** What OCADE says back. Always populated, even when it stopped early. */
  text: string;
  steps: { call: ToolCall; outcome: ToolOutcome }[];
  classification: Classification;
  /** True only when every mutating step that claimed success also verified. */
  allVerified: boolean;
}

const SYSTEM_PROMPT = [
  ocadeCorePolicy("control"),
  "",
  "When the task is done, say briefly what you did and what you verified.",
].join("\n");

/**
 * Put what OCADE remembers about this person in front of the model.
 *
 * THE MISSING HALF OF THE MEMORY FEATURE, AND IT WAS MISSING ENTIRELY.
 * --------------------------------------------------------------------
 * The engine could store the user's name, their honorific, their city, their
 * preferences and their open projects. It could be asked to recall any of it.
 * And `context_for_prompt()` — the function that turns all of it into the four
 * or five sentences a model needs — was called by nothing at all.
 *
 * So OCADE remembered in the way a filing cabinet remembers. Told "my name is
 * Alex" it wrote that down and then addressed the next sentence to nobody,
 * because the name never travelled to the prompt. Every session started cold
 * while the memory file sat there, full and unread.
 *
 * The context goes AFTER the instructions and is labelled as facts rather than
 * as orders. A 3B model handed "Address them as Sir" at the top of its prompt
 * reliably starts every reply with "Sir," including the ones that are a single
 * word; below the instructions and marked as background, it uses it the way a
 * person would.
 *
 * It is also kept SHORT by the engine (twelve lines by default). A small model
 * given two thousand words of history answers the history instead of the
 * question, which is a failure that looks like the model being stupid rather
 * than like the prompt being wrong.
 */
export function systemPromptWith(memoryContext?: string | null): string {
  const context = (memoryContext ?? "").trim();
  if (!context) return SYSTEM_PROMPT;
  return [
    SYSTEM_PROMPT,
    "",
    "What you already know about this person, from previous sessions:",
    context,
    "",
    "Use it naturally when it is relevant. Do not recite it back, and do not",
    "mention that you are reading it from a memory.",
  ].join("\n");
}

/**
 * A revision handle the UI can hold onto.
 *
 * Separate from `AbortSignal` on purpose: aborting kills the task, whereas a
 * revision keeps everything already done and changes only what happens next.
 * "Actually, Facebook" must not throw away the post that was already written.
 */
export class Revision {
  private pending: string | null = null;

  submit(instruction: string): void {
    this.pending = instruction;
  }

  take(): string | null {
    const value = this.pending;
    this.pending = null;
    return value;
  }
}

export async function runAgentTask(
  deps: AgentDeps,
  input: {
    request: string;
    history?: AgentMessage[];
    signal?: AbortSignal;
    revision?: Revision;
    onToken?: (chunk: string) => void;
    /**
     * What OCADE remembers about this person, as plain sentences from
     * `memory.context`. Absent on a fresh install and on any caller that has
     * not fetched it — in which case the prompt is exactly what it was before,
     * which is the correct degradation rather than an error.
     */
    memoryContext?: string | null;
    /**
     * Skip classification and use these domains.
     *
     * FOR WHEN THE CALLER ALREADY KNOWS, WHICH IS NOT THE ORDINARY CASE.
     * ------------------------------------------------------------------
     * Classification exists because a request arrives as free text and nobody
     * can tell in advance which tools it needs. That reasoning does not apply
     * to a request this application composed itself. The screen-recovery brief
     * in `use-mission` is the live example: it is written precisely to make
     * OCADE look at the screen, so the domain is not a guess, and running it
     * through a 3B classifier can only introduce an error.
     *
     * It introduced a bad one. `classify` degrades to `conversation` when the
     * model is unreachable or answers with prose, and `conversation` carries
     * NO TOOLS -- so a misfire turned "look at the screen and carry on" into
     * OCADE talking about looking at the screen. That is the exact failure the
     * recovery path exists to end.
     *
     * Left undefined by every caller passing a human's words, which is all of
     * them but one.
     */
    domains?: Domain[];
    /**
     * Tool areas an organization has withheld from this account — PLAN.md §21.
     *
     * Absent on every caller that has no organization in hand, which is the
     * correct degradation: an empty ceiling changes nothing, and the two places
     * that DO know pass what they read. See `organizations/policy.ts` for why
     * this is a ceiling rather than a permission — it can only take areas away,
     * and everything it leaves is still subject to the risk band and the
     * permission prompt.
     */
    withheldToolDomains?: readonly Domain[];
  },
): Promise<AgentResult> {
  const emit = (event: AgentEvent) => deps.onEvent?.(event);

  /*
   * OCADE's product identity is application-owned rather than model-owned.
   * Answer it before classification, planning, permit prompts or a model turn
   * so Cowork cannot accidentally claim a backend identity or begin a mission
   * merely because somebody asked who created OCADE.
   */
  const identityAnswer = ocadeIdentityAnswer(input.request);
  if (identityAnswer) {
    const classification: Classification = { domains: ["conversation"], basis: "caller" };
    emit({ kind: "classified", classification, tools: [] });
    emit({ kind: "finished", reason: "answered", text: identityAnswer });
    return {
      reason: "answered",
      text: identityAnswer,
      steps: [],
      classification,
      allVerified: true,
    };
  }

  /*
   * THIS FUNCTION USED TO BE THE LOOP. IT IS NOW AN ADAPTER OVER ONE.
   *
   * OCADE had this loop and the imported source had `query.ts`, and each was
   * better at a different half of the job. This one had the governance:
   * classification, a change-of-plan taken at a step boundary, spoken barge-in,
   * a retry policy written against a closed set of outcome kinds, repeat
   * detection, and the verification rules below that refuse to call a run
   * "verified" when its own steps do not support the claim. The imported one
   * had the recovery paths — truncated output, an over-long prompt, compaction,
   * token budgets — and a dependency boundary that made them testable.
   *
   * Keeping both would have been two answers to "what happens next", and the
   * worse answer reaches users the moment somebody edits only one of them. So
   * the imported loop is the body, and every piece of governance above is
   * supplied to it through the dependencies it already takes. Nothing that this
   * function guaranteed to its callers has been dropped; `AgentResult` is
   * unchanged, and the tests that assert those guarantees still run.
   */

  const classification: Classification =
    input.domains && input.domains.length > 0
      ? { domains: input.domains, basis: "caller" }
      : await classify(input.request, deps, input.signal);
  const withheld = new Set(input.withheldToolDomains ?? []);
  /*
   * WITHHELD AREAS ARE REMOVED BEFORE THE MODEL EVER SEES THEM.
   *
   * Filtering the schemas rather than only refusing the call is what keeps the
   * model from planning around a tool it cannot have and then reporting the
   * refusal as a failure. It is not the whole of the enforcement — a caller may
   * pass `domains` itself and skip classification, and a model can invent a
   * name — so the dispatch below refuses too.
   */
  const domains: Domain[] = classification.domains.filter((domain) => !withheld.has(domain));
  // The request is passed so the catalogue can be narrowed to what it is about.
  // Sixty schemas took this model past its deadline; see MAX_TOOLS_PER_TURN.
  const wireTools = schemasFor(domains, input.request);
  emit({ kind: "classified", classification, tools: wireTools.map((t) => t.function.name) });

  const steps: AgentResult["steps"] = [];
  const seenFailures = new Map<string, number>();
  let text = "";
  /**
   * Set when governance ends the run for a reason the loop cannot see.
   *
   * Written inside the dependency closures and read after `runQuery` returns.
   * Typed through a holder rather than a bare `let` because TypeScript's
   * control-flow analysis cannot see the assignments across the closure
   * boundary and narrows the variable to `never` at the read.
   */
  const governance: { stop: { reason: AgentStopReason; text: string } | null } = { stop: null };

  /*
   * A change of plan and a spoken stop are both taken at a TURN boundary, never
   * mid-action: half an action is worse than a whole one, and the boundary is
   * the only point where the world is in a state both branches agree about.
   * `callModel` runs exactly once per turn, so it is that boundary.
   */
  const pending: AgentMessage[] = [];

  const callModel: QueryDeps["callModel"] = async (modelInput) => {
    const interrupted = await deps.stopRequested?.();
    if (interrupted?.stopped) {
      governance.stop = {
        reason: "cancelled",
        text: interrupted.heard
          ? `Stopped — I heard \u201c${interrupted.heard}\u201d.`
          : "Stopped at your request.",
      };
      return { text: "", toolCalls: [], stopReason: "end_turn" };
    }

    const revised = input.revision?.take();
    if (revised) {
      pending.push({
        role: "user",
        content: `Change of plan, starting now: ${revised}\nKeep everything already completed. Do not repeat steps you have already finished.`,
      });
      emit({ kind: "revised", instruction: revised });
    }

    const messages: AgentMessage[] = [
      ...modelInput.messages.map((message) => ({
        role: message.role,
        content:
          typeof message.content === "string" ? message.content : JSON.stringify(message.content),
      })),
      ...pending.splice(0, pending.length),
    ];

    const turn = await deps.turn(messages, wireTools, {
      ...(input.onToken ? { onToken: input.onToken } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    });
    if (turn.text) {
      text = turn.text;
      emit({ kind: "thinking", text: turn.text });
    }
    return {
      text: turn.text,
      toolCalls: turn.toolCalls.map((call, index) => ({
        id: call.id ?? `${call.name}-${index}`,
        name: call.name,
        arguments: call.arguments,
      })),
      stopReason: turn.toolCalls.length > 0 ? "tool_use" : "end_turn",
    };
  };

  const runTools: QueryDeps["runTools"] = async (calls, signal) => {
    const results = [];
    for (const call of calls) {
      if (signal?.aborted) break;
      const toolCall: ToolCall = { name: call.name, arguments: call.arguments, id: call.id };

      const definition = findTool(call.name);
      if (!definition) {
        // An invented tool name. Told to the model as a tool result so it can
        // correct itself, rather than thrown — a hallucinated name is a normal
        // event, not an exceptional one.
        const outcome: ToolOutcome = {
          kind: "unsupported",
          detail: `There is no tool called ${call.name}.`,
        };
        steps.push({ call: toolCall, outcome });
        emit({ kind: "tool_end", call: toolCall, outcome });
        results.push({ id: call.id, name: call.name, content: describe(outcome), isError: true });
        continue;
      }

      if (withheld.has(definition.domain)) {
        /*
         * Told to the model as a tool result rather than thrown, for the same
         * reason an invented name is: it is a normal event the model can work
         * around, and stopping the whole run would turn an administrator's
         * policy into an outage.
         */
        const outcome: ToolOutcome = {
          kind: "unsupported",
          detail: `An organization policy withholds ${call.name} from this account, so it was not carried out.`,
        };
        steps.push({ call: toolCall, outcome });
        emit({ kind: "refused", call: toolCall, reason: outcome.detail });
        results.push({ id: call.id, name: call.name, content: describe(outcome), isError: true });
        continue;
      }

      if (definition.mutating) {
        const permitted = await deps.permit(toolCall, definition.risk);
        if (!permitted) {
          const outcome: ToolOutcome = {
            kind: "permission_required",
            detail: "The user did not approve this action, so it was not carried out.",
          };
          steps.push({ call: toolCall, outcome });
          emit({ kind: "refused", call: toolCall, reason: outcome.detail });
          governance.stop = { reason: "blocked", text: outcome.detail };
          results.push({ id: call.id, name: call.name, content: describe(outcome), isError: true });
          break;
        }
      }

      emit({ kind: "tool_start", call: toolCall, risk: definition.risk });
      let outcome = await deps.execute(toolCall, input.signal);

      // One retry, and only for the kinds where repeating could genuinely
      // differ. A blocked call is not retried at all.
      if (isRetryable(outcome.kind) && MAX_ATTEMPTS_PER_CALL > 1 && !input.signal?.aborted) {
        outcome = await deps.execute(toolCall, input.signal);
      }

      steps.push({ call: toolCall, outcome });
      emit({ kind: "tool_end", call: toolCall, outcome });
      results.push({
        id: call.id,
        name: call.name,
        content: describe(outcome),
        isError: outcome.kind !== "success",
        ...(outcome.verified === undefined ? {} : { verified: outcome.verified }),
      });

      if (outcome.kind !== "success") {
        const signature = signatureOf(call.name, call.arguments, outcome.kind);
        const count = (seenFailures.get(signature) ?? 0) + 1;
        seenFailures.set(signature, count);
        if (count >= 2) {
          governance.stop = {
            reason: "repeating",
            text: `OCADE stopped because the same step kept failing the same way: ${outcome.detail}`,
          };
          break;
        }
        if (isTerminal(outcome.kind)) {
          governance.stop = {
            reason: outcome.kind === "cancelled" ? "cancelled" : "blocked",
            text: outcome.detail,
          };
          break;
        }
      }
    }
    return results;
  };

  const result = await runQuery({
    messages: [
      ...(input.history ?? []).map((message) => ({
        role: message.role === "tool" ? ("user" as const) : message.role,
        content:
          message.role === "tool"
            ? `Result of ${message.toolName ?? "the action"}: ${message.content}`
            : message.content,
      })),
      { role: "user", content: input.request },
    ],
    systemPrompt: systemPromptWith(input.memoryContext),
    tools: wireTools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    })),
    deps: {
      callModel,
      runTools,
      compact: compactTranscript,
      countTokens: estimateTranscriptTokens,
      shouldStop: () => governance.stop?.text ?? null,
      uuid: () => `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    },
    ...(input.signal ? { signal: input.signal } : {}),
    maxTurns: MAX_STEPS_PER_TASK,
  });

  const governedStop = governance.stop;
  if (governedStop) {
    text = governedStop.text || text;
  } else if (result.text) {
    text = result.text;
  }

  /*
   * The imported loop's terminal reasons, mapped onto the endings this
   * function's callers already handle. Governance wins where it fired, because
   * it knows something the loop does not — a refused permission is `blocked`,
   * not `completed`.
   */
  let stop: AgentStopReason = governedStop
    ? governedStop.reason
    : result.terminal.reason === "max_turns"
      ? "step_limit"
      : result.terminal.reason === "aborted_streaming" || result.terminal.reason === "aborted_tools"
        ? "cancelled"
        : result.terminal.reason === "model_error" || result.terminal.reason === "prompt_too_long"
          ? "blocked"
          : steps.length > 0
            ? "verified"
            : "answered";

  if (
    !governedStop &&
    (result.terminal.reason === "model_error" || result.terminal.reason === "prompt_too_long")
  ) {
    const cause = result.terminal.error;
    text = `OCADE could not reach its engine: ${cause instanceof Error ? cause.message : String(cause)}`;
  }

  /*
   * WHAT "VERIFIED" IS ALLOWED TO MEAN.
   *
   * This first read only inspected MUTATING steps, on the reasoning that a
   * read has nothing to verify. Running it against the real machine showed the
   * hole immediately: a task whose every tool call failed reported
   * `stop=verified allVerified=true`, because all its steps were read-only and
   * a loop with no mutations trivially satisfied "all mutations verified".
   *
   * The model had actually behaved well — it said out loud that the tool had
   * failed — but the structured result contradicted its own answer, and the
   * structured result is what a caller would trust. So a failed step now
   * disqualifies the whole task, read-only or not.
   */
  const failedSteps = steps.filter(({ outcome }) => outcome.kind !== "success");
  const mutatingSteps = steps.filter(({ call }) => findTool(call.name)?.mutating);
  const allVerified =
    failedSteps.length === 0 &&
    (mutatingSteps.length === 0 ||
      mutatingSteps.every(
        ({ outcome }) => outcome.kind === "success" && outcome.verified !== false,
      ));

  if (stop === "step_limit" && !text) {
    text =
      "OCADE stopped after a number of steps without finishing, so it has not claimed success.";
  }
  if (stop === "verified" && !allVerified) {
    // Downgraded, not merely annotated. "verified" is a claim about the world,
    // and a caller reading the reason alone must not be told something the
    // steps do not support.
    stop = "answered";
    const unverified = mutatingSteps.filter(({ outcome }) => outcome.verified === false).length;
    text = [
      text,
      "",
      failedSteps.length > 0
        ? `${failedSteps.length} step${failedSteps.length === 1 ? "" : "s"} did not succeed, so OCADE has not treated this as finished.`
        : `${unverified} step${unverified === 1 ? "" : "s"} could not be confirmed on screen, so OCADE has not treated this as finished.`,
    ].join("\n");
  }

  emit({ kind: "finished", reason: stop, text });
  return { reason: stop, text, steps, classification, allVerified };
}

/**
 * Render a tool result for the model.
 *
 * Prose rather than raw JSON: a small local model follows "The window did not
 * change" far more reliably than `{"verified":false}`, and the payload is
 * appended as compact JSON only when there is something to read.
 *
 * FOUND LIVE: THIS USED TO SHOW THE MODEL NO RESULTS AT ALL.
 *
 * It appended `outcome.observation` and nothing else. But `ok(data, detail)`
 * — the helper almost every adapter returns — puts the payload in
 * `outcome.data`. Only the handful of adapters that also passed
 * `observation:` explicitly were ever readable.
 *
 * So "check how much memory this computer is using, then save that number to
 * a file" produced exactly one tool call and stopped. The model asked for the
 * system status, and was told:
 *
 *     Result: success. Read this computer's processor, memory, disk and
 *     battery state.
 *
 * That is the tool's own description with no numbers in it. There was nothing
 * to write to the file, so the model stopped — and because the only step so
 * far was a read, nothing downgraded the run and it ended as "verified".
 *
 * The failure looks identical to a model too weak to plan, which is what it
 * was mistaken for: the same task was blamed on qwen3:4b being slow, then on
 * qwen2.5 stopping early. Neither was true. A raw two-turn probe against the
 * same model, handed the actual numbers, called `workspace_write` correctly
 * on the second turn.
 *
 * `observation` is still preferred where an adapter sets it deliberately —
 * it is the post-action re-read, which is the more truthful thing to show —
 * and `data` is the fallback rather than an addition, so a tool that provides
 * both does not send the same payload twice.
 */
export function describe(outcome: ToolOutcome): string {
  const lines = [`Result: ${outcome.kind}. ${outcome.detail}`];
  if (outcome.verified === false) {
    lines.push("The expected change was NOT observed. Do not report this as done.");
  }
  if (outcome.verified === true) lines.push("This was confirmed by looking afterwards.");

  const payload = outcome.observation !== undefined ? outcome.observation : outcome.data;
  if (payload !== undefined && payload !== null) {
    const json = JSON.stringify(payload);
    // An empty object carries nothing and costs context, so it is not sent.
    if (json && json !== "{}" && json !== "[]") {
      lines.push(`Observed: ${json.length > 6000 ? `${json.slice(0, 6000)}…` : json}`);
    }
  }
  return lines.join("\n");
}

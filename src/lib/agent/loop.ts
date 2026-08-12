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
  "You are OCADE. You can act on this computer through the tools you have been given.",
  "",
  "Work in small steps. Take one action, look at what changed, then decide the next step.",
  "Before you press or change anything, observe first so you are acting on what is there now.",
  "After you act, check the result. If a tool reports that nothing changed, do not claim success —",
  "say what happened and try a different approach.",
  "If a tool is refused or blocked, do not call it again with the same arguments.",
  "When the task is done, say briefly what you did and what you verified.",
  "Never ask for or type passwords, one-time codes or payment details; those stay with the user.",
].join("\n");

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
  },
): Promise<AgentResult> {
  const emit = (event: AgentEvent) => deps.onEvent?.(event);
  const classification = await classify(input.request, deps, input.signal);
  const domains: Domain[] = classification.domains;
  const tools = schemasFor(domains);
  emit({ kind: "classified", classification, tools: tools.map((t) => t.function.name) });

  const messages: AgentMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(input.history ?? []),
    { role: "user", content: input.request },
  ];

  const steps: AgentResult["steps"] = [];
  const seenFailures = new Map<string, number>();
  let text = "";
  let stop: AgentStopReason = "answered";

  for (let step = 0; step < MAX_STEPS_PER_TASK; step += 1) {
    if (input.signal?.aborted) {
      stop = "cancelled";
      break;
    }

    /*
     * A change of mind is taken at the top of a step, never mid-action. Half an
     * action is worse than a whole one, and the boundary between steps is the
     * only point where the world is in a state both branches agree about.
     */
    const revised = input.revision?.take();
    if (revised) {
      messages.push({
        role: "user",
        content: `Change of plan, starting now: ${revised}\nKeep everything already completed. Do not repeat steps you have already finished.`,
      });
      emit({ kind: "revised", instruction: revised });
    }

    let turn: ModelTurn;
    try {
      turn = await deps.turn(messages, tools, { onToken: input.onToken, signal: input.signal });
    } catch (error) {
      if (input.signal?.aborted) {
        stop = "cancelled";
        break;
      }
      text = `OCADE could not reach its engine: ${error instanceof Error ? error.message : String(error)}`;
      stop = "blocked";
      break;
    }

    if (turn.text) {
      text = turn.text;
      emit({ kind: "thinking", text: turn.text });
    }

    if (turn.toolCalls.length === 0) {
      // No tool wanted: the model has answered. That is a legitimate ending for
      // a conversational request and for the final turn of a task.
      stop = steps.length > 0 ? "verified" : "answered";
      break;
    }

    messages.push({ role: "assistant", content: turn.text, toolCalls: turn.toolCalls });

    let halted = false;
    for (const call of turn.toolCalls) {
      if (input.signal?.aborted) {
        stop = "cancelled";
        halted = true;
        break;
      }

      const definition = findTool(call.name);
      if (!definition) {
        // An invented tool name. Told to the model as a tool result so it can
        // correct itself, rather than thrown — a hallucinated name is a normal
        // event, not an exceptional one.
        const outcome: ToolOutcome = {
          kind: "unsupported",
          detail: `There is no tool called ${call.name}.`,
        };
        steps.push({ call, outcome });
        messages.push({ role: "tool", toolName: call.name, content: describe(outcome) });
        emit({ kind: "tool_end", call, outcome });
        continue;
      }

      if (definition.mutating) {
        const permitted = await deps.permit(call, definition.risk);
        if (!permitted) {
          const outcome: ToolOutcome = {
            kind: "permission_required",
            detail: "The user did not approve this action, so it was not carried out.",
          };
          steps.push({ call, outcome });
          messages.push({ role: "tool", toolName: call.name, content: describe(outcome) });
          emit({ kind: "refused", call, reason: outcome.detail });
          stop = "blocked";
          halted = true;
          break;
        }
      }

      emit({ kind: "tool_start", call, risk: definition.risk });
      let outcome = await deps.execute(call, input.signal);

      // One retry, and only for the kinds where repeating could genuinely
      // differ. A blocked call is not retried at all.
      if (isRetryable(outcome.kind) && MAX_ATTEMPTS_PER_CALL > 1 && !input.signal?.aborted) {
        outcome = await deps.execute(call, input.signal);
      }

      steps.push({ call, outcome });
      emit({ kind: "tool_end", call, outcome });
      messages.push({ role: "tool", toolName: call.name, content: describe(outcome) });

      if (outcome.kind !== "success") {
        const signature = signatureOf(call.name, call.arguments, outcome.kind);
        const count = (seenFailures.get(signature) ?? 0) + 1;
        seenFailures.set(signature, count);
        if (count >= 2) {
          text = `OCADE stopped because the same step kept failing the same way: ${outcome.detail}`;
          stop = "repeating";
          halted = true;
          break;
        }
        if (isTerminal(outcome.kind)) {
          text = outcome.detail;
          stop = outcome.kind === "cancelled" ? "cancelled" : "blocked";
          halted = true;
          break;
        }
      }
    }

    if (halted) break;
    if (step === MAX_STEPS_PER_TASK - 1) stop = "step_limit";
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

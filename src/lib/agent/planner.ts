/**
 * Multi-step goals: decompose once, then work through the parts.
 *
 * WHAT THE SINGLE LOOP ALREADY DID, AND WHERE IT STOPPED
 * -------------------------------------------------------
 * `runAgentTask` chains tool calls perfectly well. Give it "open Notepad and
 * type an essay" and it opens, then types, then reports. What it does NOT do is
 * hold a shape in mind across a goal with distinct phases:
 *
 *     "Research quantum computing, summarise it, and WhatsApp it to H."
 *
 * That is three jobs with three different tool sets and a data dependency
 * running through them. A single flat loop handles it by keeping every tool
 * loaded, every intermediate result in one growing transcript, and every
 * decision made from a context that gets longer and noisier with each step.
 * Around step six a 3B model starts re-reading its own earlier output as though
 * it were new instructions.
 *
 * So the goal is decomposed ONCE, and each step runs in its own agent with only
 * the tools that step needs.
 *
 * THE CONTEXT PROBLEM, WHICH IS THE REAL REASON THIS EXISTS
 * ----------------------------------------------------------
 * Perception tools are extraordinarily verbose. One `screen_find` returns every
 * candidate with role, label, bounds, confidence and provenance; a `ui_tree` on
 * a browser returns hundreds of elements. All of it is essential to the step
 * doing the clicking and all of it is NOISE to the goal — the planner needs to
 * know "the Send button was clicked", not the eleven rectangles considered on
 * the way there.
 *
 * Each step therefore runs as a SUB-AGENT with its own message history, and
 * only its closing sentence is returned. The bounding-box arithmetic happens
 * inside a context that is thrown away. What reaches the main transcript is one
 * line per step, which is what keeps a six-step goal as fast at the end as it
 * was at the start.
 *
 * WHY DECOMPOSITION IS ONE CALL AND NOT A CONVERSATION
 * -----------------------------------------------------
 * A planner that re-plans after every step is a planner that can loop forever,
 * and on a small model it does: step three fails, the re-plan produces step
 * three again, and nothing else ever happens. Planning once and then EXECUTING
 * is bounded by construction. When a step fails, the failure is carried forward
 * to the next step as context rather than triggering a fresh plan — the later
 * steps usually still make sense, and a goal that is genuinely dead stops at
 * the end rather than spinning in the middle.
 */

import {
  runAgentTask,
  type AgentDeps,
  type AgentResult,
  type AgentStopReason,
  type Revision,
} from "./loop";
import type { Domain } from "./domains";

/**
 * THE TWO ENDINGS THAT MEAN THE STEP DID WHAT IT WAS ASKED.
 *
 * The loop ends a run that used no tools as `answered` and one that used tools
 * and could stand behind them as `verified` — the stronger of the two. Reading
 * success as `reason === "answered"` therefore called the BEST ending a
 * failure, and every step that touched anything was one: the plan reported
 * `ok: false` for work that had completed and verified, the mission panel
 * turned red for it, and the next step was handed "did not work" about a step
 * that had worked. Success is asked for by name, once, here.
 */
const succeeded = (reason: AgentStopReason): boolean =>
  reason === "answered" || reason === "verified";

/** One unit of work: a sentence, and the tools it is allowed to touch. */
export interface PlanStep {
  /** What this step achieves, phrased as an instruction. */
  instruction: string;
  /** Which tool families it needs. Narrow on purpose. */
  domains: Domain[];
}

export interface PlanStepResult {
  instruction: string;
  /** The sub-agent's closing sentence. One line, never its transcript. */
  summary: string;
  ok: boolean;
  /** How many tool calls happened inside — for latency reporting, not context. */
  toolCalls: number;
  verified: boolean;
  /**
   * How the sub-agent stopped, in its own words rather than reduced to `ok`.
   *
   * WHY THE REASON IS CARRIED AND NOT RECOMPUTED. A plan that the user
   * interrupted and a plan whose third step failed both end with `ok: false`,
   * and the caller then has nothing left to tell them apart — so pressing Stop
   * was reported as a failed run and charged for. The reason is known here, at
   * the only place that knows it, so it travels.
   */
  reason: AgentStopReason;
}

export interface PlanResult {
  goal: string;
  steps: PlanStepResult[];
  /** What OCADE says at the end, built from the step summaries. */
  text: string;
  ok: boolean;
  /** True when decomposition produced more than one step. */
  planned: boolean;
  /**
   * How the plan as a whole stopped. `cancelled` outranks every other ending:
   * a user who pressed Stop is not shown a failure, and is not charged for one.
   */
  reason: AgentStopReason;
  /** Every tool call across every step, so the caller can say how much was done. */
  toolCalls: number;
}

/**
 * Goals worth decomposing. Below this, planning costs more than it saves.
 *
 * A single-clause instruction goes straight to the ordinary loop: asking a
 * model to decompose "open Notepad" wastes a round trip to be told that it is
 * one step. The signal is a goal that names SEVERAL THINGS TO DO — a connector
 * between two verb phrases, or an explicit enumeration.
 */
const MULTI_STEP =
  /\b(?:and then|then|after that|afterwards|followed by|and (?:also )?(?:send|share|message|whatsapp|email|write|save|summari[sz]e|post|tell))\b/i;

/** Rough upper bound on steps. A plan longer than this is a misreading. */
export const MAX_STEPS = 6;

export function looksMultiStep(goal: string): boolean {
  const text = (goal ?? "").trim();
  if (text.length < 25) return false;
  return MULTI_STEP.test(text);
}

/**
 * The decomposition prompt.
 *
 * Constrained hard, for the same reason the domain classifier is: a small model
 * asked an open question about planning will write an essay about planning.
 * It is given the domain vocabulary explicitly because a step whose domains are
 * invented loads no tools at all and silently becomes a conversation.
 */
export function planPrompt(goal: string): string {
  return [
    "Break this goal into the fewest separate steps that actually do it.",
    "",
    `Goal: ${goal}`,
    "",
    'Answer with JSON only: {"steps":[{"do":"...","needs":["os_app"]}]}',
    "",
    'Each "do" is one instruction, phrased as a command, that can be carried out on its own.',
    'Each "needs" lists only the tool families that step requires:',
    "  os_app — applications, windows, typing, clicking, the screen",
    "  files  — reading and writing files on this computer",
    "  web    — searching the web and reading pages",
    "",
    "Rules:",
    `- At most ${MAX_STEPS} steps. Fewer is better.`,
    "- Do not invent steps the goal did not ask for.",
    "- If a later step needs something an earlier step produced, say so in the words of the instruction.",
    "- If the goal is really one action, return exactly one step.",
  ].join("\n");
}

const KNOWN_DOMAINS = new Set<Domain>(["os_app", "files", "web", "conversation"]);

/**
 * Read a plan out of the model's reply without trusting its formatting.
 *
 * Same tolerance as the domain classifier, for the same measured reason: small
 * local models wrap JSON in prose, in code fences, and in `<think>` blocks.
 * Returns null rather than a partial plan — half a plan executed is worse than
 * no plan, because the goal ends up half done and reported as finished.
 */
export function parsePlan(reply: string): PlanStep[] | null {
  const cleaned = (reply ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  const match = /\{[\s\S]*\}/.exec(cleaned);
  if (!match) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  const raw = (parsed as { steps?: unknown })?.steps;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const steps: PlanStep[] = [];
  for (const item of raw.slice(0, MAX_STEPS)) {
    if (!item || typeof item !== "object") continue;
    const instruction = String((item as { do?: unknown }).do ?? "").trim();
    if (!instruction) continue;
    const needs = (item as { needs?: unknown }).needs;
    const domains = (Array.isArray(needs) ? needs : [])
      .map((d) => String(d).trim().toLowerCase())
      .filter((d): d is Domain => KNOWN_DOMAINS.has(d as Domain));
    steps.push({
      instruction,
      // A step with no usable domains gets the computer, not nothing. An empty
      // list loads zero tools, which turns an action into a description of an
      // action — the failure this whole file exists to prevent.
      domains: domains.length > 0 ? [...new Set(domains)] : ["os_app"],
    });
  }
  return steps.length > 0 ? steps : null;
}

/**
 * Remove structured payloads from a step's closing text.
 *
 * TRUNCATION WAS NOT ENOUGH, AND THE TEST FOR THIS FILE PROVED IT.
 * A sub-agent that ends with "Found it. {"targets":[{"bounds":{...}} × 40]}"
 * was trimmed to 240 characters — 240 characters OF BOUNDING BOXES, handed
 * straight to the next step. The isolation was real only up to a length limit,
 * which is another way of saying it was not real.
 *
 * A step summary is prose by definition: a sentence about what happened. JSON
 * in it is a model quoting its own tool output, which is precisely the traffic
 * being isolated, so it is cut out rather than shortened.
 */
export function stripPayloads(text: string): string {
  return (
    text
      // Balanced-ish blocks of eighty characters or more. Short braces are left
      // alone because "{}" can legitimately appear in prose about code, and a
      // one-line object is not what floods a context.
      .replace(/[{[][\s\S]{80,}?[}\]]/g, " ")
      // A code fence is the other way models quote payloads.
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * The closing sentence of a sub-agent, trimmed to something a planner can hold.
 *
 * A step that returns four paragraphs defeats the isolation: the context saved
 * by running it separately is spent again by quoting it in full. One or two
 * sentences is what the next step actually needs.
 */
export function summarise(result: AgentResult, limit = 240): string {
  const text = stripPayloads(result.text ?? "");
  if (!text) {
    const last = result.steps[result.steps.length - 1];
    return last
      ? `Ran ${last.call.name}: ${last.outcome.detail}`.slice(0, limit)
      : "Nothing to report.";
  }
  if (text.length <= limit) return text;
  // Cut on a sentence boundary when there is one nearby, so the summary does
  // not end mid-clause.
  const cut = text.lastIndexOf(". ", limit);
  return cut > limit * 0.5 ? text.slice(0, cut + 1) : `${text.slice(0, limit).trim()}…`;
}

export interface PlanDeps extends AgentDeps {
  /** Called before each step runs, so the surface can show progress. */
  onStep?: (index: number, total: number, step: PlanStep) => void;
}

/**
 * Decompose a goal and work through it, one isolated sub-agent per step.
 *
 * Falls back to a single ordinary run whenever planning does not apply or does
 * not work — an unplanned goal still gets done, which is the behaviour that
 * existed before this file and must survive it.
 */
export async function runPlannedTask(
  deps: PlanDeps,
  input: {
    goal: string;
    signal?: AbortSignal;
    /**
     * The user changing their mind mid-task, exactly as an unplanned run
     * receives it.
     *
     * WITHOUT THIS THE COMPOSER WAS A FAKE CONTROL DURING A PLAN. Typing a new
     * sentence while OCADE worked recorded "New instruction" in the timeline
     * and then did nothing with it, because the handle was only ever passed to
     * the flat loop. The mailbox is one-shot, so handing the same one to every
     * step needs no coordination: whichever step is running takes it, and the
     * ones after it are told below.
     */
    revision?: Revision;
    memoryContext?: string | null;
  },
): Promise<PlanResult> {
  const goal = (input.goal ?? "").trim();

  let steps: PlanStep[] | null = null;
  if (looksMultiStep(goal)) {
    try {
      const reply = await deps.complete(planPrompt(goal), input.signal);
      steps = reply ? parsePlan(reply) : null;
    } catch {
      steps = null;
    }
  }

  // ONE STEP IS NOT A PLAN. Running the ordinary loop directly keeps the fast
  // path exactly as fast as it was, and avoids paying for isolation that has
  // nothing to isolate.
  if (!steps || steps.length < 2) {
    const single = await runAgentTask(deps, {
      request: goal,
      signal: input.signal,
      revision: input.revision,
      memoryContext: input.memoryContext,
    });
    return {
      goal,
      steps: [
        {
          instruction: goal,
          summary: summarise(single),
          ok: succeeded(single.reason),
          toolCalls: single.steps.length,
          verified: single.allVerified,
          reason: single.reason,
        },
      ],
      text: single.text,
      ok: succeeded(single.reason),
      planned: false,
      reason: single.reason,
      toolCalls: single.steps.length,
    };
  }

  const done: PlanStepResult[] = [];
  /*
   * WHAT ONE STEP TELLS THE NEXT.
   *
   * Only the summaries, never the transcripts. This is the line that keeps the
   * context lean: the sixth step is handed five sentences, not five agent
   * histories full of bounding boxes.
   */
  const carried: string[] = [];
  /*
   * WHAT THE USER CHANGED WHILE THE PLAN WAS RUNNING.
   *
   * The revision mailbox is emptied by whichever step is running, so only that
   * step would ever hear it — and the remaining steps would carry on executing
   * a plan the user has already corrected. The loop announces what it took, so
   * the correction is recorded here as it happens and handed to every step
   * after it, alongside what has already been done.
   */
  const corrections: string[] = [];
  const stepDeps: PlanDeps = {
    ...deps,
    onEvent: (event) => {
      if (event.kind === "revised") corrections.push(event.instruction);
      deps.onEvent?.(event);
    },
  };

  for (let index = 0; index < steps.length; index += 1) {
    if (input.signal?.aborted) break;
    const step = steps[index];
    deps.onStep?.(index, steps.length, step);

    const context = [
      step.instruction,
      carried.length > 0
        ? `Already done in this task:\n${carried.map((line, n) => `${n + 1}. ${line}`).join("\n")}`
        : null,
      corrections.length > 0
        ? `The user changed the plan while this task was running. Honour the latest of these over the instruction above where they conflict:\n${corrections
            .map((line, n) => `${n + 1}. ${line}`)
            .join("\n")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    let result: AgentResult;
    try {
      result = await runAgentTask(stepDeps, {
        // The sub-agent's own history starts here and dies here.
        request: context,
        signal: input.signal,
        revision: input.revision,
        memoryContext: input.memoryContext,
        // Told, not classified: the plan already said what this step needs, and
        // re-deriving it invites the classifier's `conversation` fallback,
        // which loads no tools at all.
        domains: step.domains,
      });
    } catch (cause) {
      const why = cause instanceof Error ? cause.message : "that step failed";
      done.push({
        instruction: step.instruction,
        summary: why,
        ok: false,
        toolCalls: 0,
        verified: false,
        // The sub-agent did not stop, it died. `step_limit` is the ending the
        // caller already treats as a visible failure, which is what this is.
        reason: "step_limit",
      });
      carried.push(`${step.instruction} — failed: ${why}`);
      continue;
    }

    const summary = summarise(result);
    const ok = succeeded(result.reason);
    done.push({
      instruction: step.instruction,
      summary,
      ok,
      toolCalls: result.steps.length,
      verified: result.allVerified,
      reason: result.reason,
    });
    // A failure is carried forward as plainly as a success. A later step that
    // depends on it can then say so, instead of quietly acting on nothing.
    carried.push(ok ? summary : `${step.instruction} — did not work: ${summary}`);

    if (result.reason === "cancelled") break;
  }

  const failed = done.filter((s) => !s.ok);
  const complete = failed.length === 0 && done.length === steps.length;
  /*
   * A STOP IS A STOP, WHATEVER ELSE HAPPENED.
   *
   * The loop leaves early on an abort, so an interrupted plan is also an
   * incomplete one — and reading incompleteness alone reported the user's own
   * Stop as a failed run. Cancellation is therefore checked first: the signal
   * for a stop between steps, a cancelled sub-agent for a stop inside one.
   * Only then does the first ending that was not a success speak for the plan.
   */
  const stopped = input.signal?.aborted === true || done.some((s) => s.reason === "cancelled");
  const reason: AgentStopReason = stopped
    ? "cancelled"
    : complete
      ? done.every((s) => s.reason === "verified")
        ? "verified"
        : "answered"
      : (done.find((s) => !succeeded(s.reason))?.reason ?? "step_limit");

  return {
    goal,
    steps: done,
    text: done.map((s) => s.summary).join(" "),
    ok: complete,
    planned: true,
    reason,
    toolCalls: done.reduce((total, s) => total + s.toolCalls, 0),
  };
}

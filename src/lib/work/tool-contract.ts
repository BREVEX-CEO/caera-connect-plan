/**
 * The gate every tool call passes before anything happens to the machine.
 *
 * THREE FAILURES THIS EXISTS TO STOP, ALL OBSERVED ON LIVE RUNS
 * --------------------------------------------------------------
 * 1. **An empty required argument.** A YouTube navigation went out with
 *    `search_query=` and OCADE opened a blank results page, then reported that
 *    it had searched. The schema said `query` was required; nothing checked.
 * 2. **The same action, again and again.** Asked to open a browser, the model
 *    called `browser_open` on three consecutive turns because each result read
 *    like a fresh start. Three Chrome windows, one task.
 * 3. **A narrated action.** "Now I will type…" with no call at all — handled in
 *    `tool-protocol.ts`, and mentioned here because the three together are the
 *    same underlying problem: the model's output was trusted as an instruction
 *    rather than checked as a request.
 *
 * WHERE THIS SITS
 * ---------------
 * Between the model and the adapters, on the client, and again on the server —
 * `runControlActionFn` re-checks, because a client is a thing that can be
 * bypassed. Argument validation is cheap and being wrong is expensive.
 */

import { findTool, type ToolDefinition } from "@/lib/agent/tool-registry";
import type { ToolCall } from "@/lib/agent/loop";

export type ContractVerdict =
  | { ok: true; call: ToolCall }
  | { ok: false; reason: string; code: "unknown_tool" | "bad_arguments" | "repeated" };

/** How many times one identical call may run within a single task. */
const MAX_IDENTICAL = 1;
/**
 * Tools that are legitimately repeated with the same arguments.
 *
 * Observation is the obvious case: "look again" is the entire point of
 * observe → act → observe, and blocking a second identical `screen_observe`
 * would break verification. Scrolling repeats by nature. Everything else that
 * repeats identically is a loop, not a plan.
 */
const REPEATABLE = new Set([
  "screen_observe",
  "window_list",
  "system_status",
  "display_list",
  "browser_read",
  "browser_tabs",
  "browser_scroll",
  "workspace_list",
  "control_find",
  "app_list_installed",
]);

function signature(call: ToolCall): string {
  const args = call.arguments ?? {};
  const ordered = Object.keys(args)
    .sort()
    .map((key) => `${key}=${JSON.stringify(args[key])}`)
    .join("&");
  return `${call.name}(${ordered})`;
}

/**
 * Check one call against its own schema.
 *
 * Required strings must be present AND non-empty AND contain something other
 * than punctuation. `enum` values must be one of the listed options. Unknown
 * argument names are dropped rather than refused — a model adding a stray
 * `reason` field is being chatty, not dangerous, and refusing the whole call
 * over it costs a step for nothing.
 */
export function validateArguments(
  definition: ToolDefinition,
  raw: Record<string, unknown>,
): { ok: true; arguments: Record<string, unknown> } | { ok: false; reason: string } {
  const schema = definition.parameters;
  const cleaned: Record<string, unknown> = {};

  for (const [name, spec] of Object.entries(schema.properties)) {
    const value = raw[name];
    if (value === undefined || value === null) continue;

    if (spec.type === "string") {
      const text = String(value).trim();
      if (text.length === 0) continue;
      /*
       * A runtime control directive is not an argument.
       *
       * Stripped in `tool-protocol` before parsing, and refused again here,
       * because this is the layer that guards the machine and it should not
       * depend on an earlier layer having done its job. A live run searched
       * YouTube for the literal string "/no_think".
       */
      if (/^\/(no_?think|think|nothink)$/i.test(text)) {
        return {
          ok: false,
          reason: `${name} was given an engine control token rather than a real value, so ${definition.name} was not run.`,
        };
      }
      if (spec.enum && !spec.enum.includes(text)) {
        return {
          ok: false,
          reason: `${name} must be one of: ${spec.enum.join(", ")}. OCADE was given “${text}”.`,
        };
      }
      cleaned[name] = text;
      continue;
    }
    cleaned[name] = value;
  }

  for (const required of schema.required ?? []) {
    const value = cleaned[required];
    const text = typeof value === "string" ? value : "";
    // The empty-argument rule. A blank search query is not a search.
    if (value === undefined || (typeof value === "string" && !/[\p{L}\p{N}]/u.test(text))) {
      return {
        ok: false,
        reason: `${definition.name} needs ${required}, and none was given. OCADE did not guess one.`,
      };
    }
  }

  return { ok: true, arguments: cleaned };
}

/**
 * One task's memory of what it has already done.
 *
 * Held per task rather than per mission: "open Notepad" twice in one
 * instruction is a loop, and "open Notepad" in a later instruction is a person
 * asking again, which is allowed.
 */
export class TaskLedger {
  private readonly counts = new Map<string, number>();

  /** Record a call that is about to run. */
  note(call: ToolCall): void {
    const key = signature(call);
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }

  timesSeen(call: ToolCall): number {
    return this.counts.get(signature(call)) ?? 0;
  }

  reset(): void {
    this.counts.clear();
  }
}

/**
 * Validate a call and decide whether it may run.
 *
 * Returns a REASON rather than a boolean, because the reason goes back to the
 * model as a tool result. "youtube_search needs query, and none was given" is
 * something a model can correct on the next turn; a bare refusal is something
 * it will retry identically until the step limit.
 */
export function checkCall(call: ToolCall, ledger?: TaskLedger): ContractVerdict {
  const definition = findTool(call.name);
  if (!definition) {
    return {
      ok: false,
      code: "unknown_tool",
      reason: `There is no action called ${call.name}.`,
    };
  }

  const validated = validateArguments(definition, call.arguments ?? {});
  if (!validated.ok) {
    return { ok: false, code: "bad_arguments", reason: validated.reason };
  }

  const checked: ToolCall = { ...call, arguments: validated.arguments };

  if (ledger && !REPEATABLE.has(call.name) && ledger.timesSeen(checked) >= MAX_IDENTICAL) {
    return {
      ok: false,
      code: "repeated",
      reason: `OCADE has already done exactly this in the current task (${definition.name}). Repeating it would do the same thing twice — check the last result and take a different step, or finish.`,
    };
  }

  return { ok: true, call: checked };
}

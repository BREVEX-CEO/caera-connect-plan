/**
 * `QueryDeps.runTools`: the only way the query loop can make anything happen.
 *
 * THIS IS WHERE THE TWO LOOPS BECAME ONE
 * --------------------------------------
 * OCADE had an agent loop (`lib/agent/loop.ts`) and the donor had one
 * (`query.ts`). Each was better at a different thing. The donor's loop had the
 * recovery paths — truncated output, over-long prompt, compaction, token
 * budget, bounded turns — and a dependency boundary that made them testable.
 * OCADE's had the governance: a closed set of outcome kinds, a retry policy
 * written against that set rather than against error prose, verification, and
 * repeat-signature detection.
 *
 * Keeping both would have been two answers to "what happens next". The donor's
 * loop is the heart, and OCADE's governance lives here, inside the one
 * dependency the loop uses to touch the world.
 *
 * THE RULES IT ENFORCES, AND WHY EACH ONE IS HERE
 *
 * 1. **Permission first, always.** Nothing reaches an executor before the
 *    permission layer has answered. The loop has no other route to a tool, so
 *    there is no path around this one.
 *
 * 2. **A refusal is a result, not an error.** The model is told plainly that
 *    the person said no, so it can adapt. A refusal that surfaces as a crash
 *    teaches the model nothing and ends the turn.
 *
 * 3. **A repeated identical failure stops the run.** The same tool, the same
 *    arguments, the same failure twice is a loop that has stopped learning.
 *    Nothing about a third attempt changes a permission refusal.
 *
 * 4. **Unverified success is reported as unverified.** `verified === false`
 *    means the adapter looked for the change and did not find it. Passing that
 *    back as plain success is how "Done" becomes a lie.
 */

import type { QueryToolCall, QueryToolResult } from "@/primary-logic/query/deps";
import { findTool, type ToolDefinition } from "@/lib/agent/tool-registry";
import {
  MAX_ATTEMPTS_PER_CALL,
  isTerminal,
  signatureOf,
  type ToolOutcome,
} from "@/lib/agent/outcomes";
import { describe as describeOutcome } from "@/lib/agent/loop";
import { executeToolCall, type ExecuteContext } from "./execute";
import { coerceArguments } from "@/primary-logic/text/semanticValues";
import { decide, type PermissionContext, type PermissionDecision } from "./permissions";

export interface ToolRunnerOptions {
  /** The live permission context. Read per call so a mid-run change applies. */
  permissions: () => PermissionContext;
  /** Ask the user. Absent means the runner can only run what a rule allows. */
  requestApproval?: (call: QueryToolCall, decision: PermissionDecision) => Promise<boolean>;
  /** Record an approval outcome so denial tracking accumulates. */
  onDecision?: (allowed: boolean) => void;
  executeContext: () => Omit<ExecuteContext, "confirmed">;
  onEvent?: (event: ToolRunnerEvent) => void;
}

export type ToolRunnerEvent =
  | { kind: "permission"; call: QueryToolCall; decision: PermissionDecision }
  | { kind: "started"; call: QueryToolCall }
  | { kind: "finished"; call: QueryToolCall; outcome: ToolOutcome }
  | { kind: "refused"; call: QueryToolCall; reason: string }
  | { kind: "repeating"; call: QueryToolCall };

export interface ToolRunner {
  run: (calls: readonly QueryToolCall[], signal?: AbortSignal) => Promise<QueryToolResult[]>;
  /** True once the runner has seen the same failure twice. */
  isStuck: () => boolean;
  /** Why it stopped, when it did. */
  stuckReason: () => string | null;
  reset: () => void;
}

/** What each argument is declared to be, from the tool's own schema. */
function declaredTypes(tool: ToolDefinition): Record<string, string | undefined> {
  const types: Record<string, string | undefined> = {};
  for (const [name, schema] of Object.entries(tool.parameters.properties)) {
    types[name] = schema.type;
  }
  return types;
}

export function createToolRunner(options: ToolRunnerOptions): ToolRunner {
  const attempts = new Map<string, number>();
  let stuck: string | null = null;

  const emit = (event: ToolRunnerEvent) => options.onEvent?.(event);

  const run = async (
    calls: readonly QueryToolCall[],
    signal?: AbortSignal,
  ): Promise<QueryToolResult[]> => {
    const results: QueryToolResult[] = [];

    for (const rawCall of calls) {
      if (signal?.aborted) break;

      const tool = findTool(rawCall.name);
      /*
       * READ THE ARGUMENTS THE WAY THE MODEL MEANT THEM, ONCE, HERE.
       *
       * A model quoting a value — `"allowOcr": "false"`, `"limit": "30"` — is
       * ordinary, and every naive read of it goes wrong in the same direction:
       * `!== false` is true for the string, `=== true` is false for it, and
       * `Number("")` is zero. Adapters were each learning this separately, one
       * argument at a time, which is how `allowVision` ended up unreachable
       * from the loop for a while.
       *
       * The coercion is schema-driven: only an argument the tool DECLARES as a
       * boolean or a number is touched, so a search term that happens to be the
       * word "false" stays a search term. It happens before the permission
       * layer as well as before the adapter, so both judge the same call.
       */
      const call =
        tool === null
          ? rawCall
          : {
              ...rawCall,
              arguments: coerceArguments(rawCall.arguments ?? {}, declaredTypes(tool)),
            };
      const decision = decide(call, tool, options.permissions());
      emit({ kind: "permission", call, decision });

      if (decision.outcome === "deny") {
        emit({ kind: "refused", call, reason: decision.reason });
        results.push({
          id: call.id,
          name: call.name,
          content: `Not allowed: ${decision.reason}`,
          isError: true,
        });
        /*
         * A block is terminal for this call, and repeating it is pointless, so
         * it is recorded against the repeat detector immediately rather than
         * waiting for a second identical refusal.
         */
        stuck ??= decision.reason;
        continue;
      }

      if (decision.outcome === "ask") {
        const approve = options.requestApproval;
        if (!approve) {
          emit({ kind: "refused", call, reason: "No way to ask." });
          results.push({
            id: call.id,
            name: call.name,
            content: "Not allowed: OCADE could not check this with you here.",
            isError: true,
          });
          continue;
        }
        const allowed = await approve(call, decision);
        options.onDecision?.(allowed);
        if (!allowed) {
          emit({ kind: "refused", call, reason: "You said no." });
          results.push({
            id: call.id,
            name: call.name,
            /*
             * Told plainly, so the model can offer something else instead of
             * treating this as a fault to work around. "The user declined" is
             * information; a stack trace is not.
             */
            content: "The person declined this action. Do not retry it; suggest an alternative.",
            isError: true,
          });
          continue;
        }
      }

      emit({ kind: "started", call });
      let outcome: ToolOutcome;
      try {
        outcome = await executeToolCall(call, {
          ...options.executeContext(),
          confirmed: decision.outcome === "ask" || tool?.risk === "high",
        });
      } catch (error) {
        outcome = {
          kind: "retryable_failure",
          detail: error instanceof Error ? error.message : "That action could not be carried out.",
        };
      }
      emit({ kind: "finished", call, outcome });

      if (outcome.kind !== "success") {
        const signature = signatureOf(call.name, call.arguments, outcome.kind);
        const seen = (attempts.get(signature) ?? 0) + 1;
        attempts.set(signature, seen);
        if (isTerminal(outcome.kind) || seen >= MAX_ATTEMPTS_PER_CALL) {
          emit({ kind: "repeating", call });
          stuck ??= outcome.detail;
        }
      }

      results.push({
        id: call.id,
        name: call.name,
        content: contentFor(outcome),
        isError: outcome.kind !== "success",
        ...(outcome.verified === undefined ? {} : { verified: outcome.verified }),
      });
    }

    return results;
  };

  return {
    run,
    isStuck: () => stuck !== null,
    stuckReason: () => stuck,
    reset: () => {
      attempts.clear();
      stuck = null;
    },
  };
}

/**
 * What the model is told about a result.
 *
 * The observation is included when there is one, because the next decision is
 * made from it — a loop told only "clicked successfully" is planning against a
 * screen it has not seen since before it acted. It is bounded, because a full
 * accessibility tree will consume the context the conversation needs.
 */
function contentFor(outcome: ToolOutcome): string {
  const lines = [describeOutcome(outcome)];
  if (outcome.verified === false) {
    lines.push("OCADE looked for the expected change afterwards and did not find it.");
  }
  if (outcome.observation !== undefined && outcome.observation !== null) {
    const rendered =
      typeof outcome.observation === "string"
        ? outcome.observation
        : JSON.stringify(outcome.observation);
    lines.push(rendered.length > 4_000 ? `${rendered.slice(0, 4_000)}…` : rendered);
  }
  return lines.join("\n");
}

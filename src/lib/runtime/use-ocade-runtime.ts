/**
 * The OCADE runtime: one engine, one tool registry, one permission layer, one
 * query loop — handed to whichever room asked.
 *
 * WHAT WAS TRUE BEFORE THIS FILE
 * ------------------------------
 * Cowork could act and could not hold a conversation. Chat could talk and could
 * not act. The split was not a design; it was where two features happened to
 * stop. A person in Chat who typed "put this in a file on my desktop" got a
 * paragraph explaining how they might do that themselves, from a product that
 * was, in another tab, capable of doing it.
 *
 * WHAT DRIVES A TURN NOW
 * ----------------------
 * The imported query loop (`primary-logic/query`). It owns the control flow —
 * tool rounds, truncation recovery, compaction, token budgets, bounded turns,
 * abort — through the donor's own dependency boundary. This file supplies the
 * three dependencies that cross a runtime boundary and therefore cannot live
 * inside it:
 *
 *   `callModel`  → OCADE's on-device engine. No hosted inference on any path.
 *   `runTools`   → permission decision, then the correct executor, then
 *                  OCADE's outcome governance. The loop has no other way to
 *                  touch the world, so there is no route around the gate.
 *   `compact`    → transcript reduction, so a long conversation degrades
 *                  instead of dying.
 *
 * WHAT STAYS DIFFERENT BETWEEN THE ROOMS, AND WHY THAT IS NOT A SECOND RUNTIME
 * ---------------------------------------------------------------------------
 * Cowork deliberates less (`surface: "control"` — the turn must produce a call,
 * not an essay about one), and Cowork holds a mission on the companion for the
 * length of a task. Chat deliberates by default and holds no mission until a
 * request needs the machine. Those are arguments to the same runtime.
 *
 * WHEN CHAT USES A TOOL AT ALL
 * ----------------------------
 * Only when the request asks for something a tool can do. The classifier's
 * `conversation` domain means "no tool needed", and a chat turn that classifies
 * that way never loads a schema and costs nothing extra. A product that reached
 * for the machine on "how are you" would be worse than one that never reached
 * for it at all.
 */

import { useCallback, useMemo, useRef } from "react";
import { useLocalChatEngine } from "@/lib/chat/use-local-chat-engine";
import { classifyDeterministic, type Domain } from "@/lib/agent/domains";
import { findTool, schemasFor, selectTools } from "@/lib/agent/tool-registry";
import { ocadeCorePolicy } from "@/lib/agent/ocade-core-policy";
import type { OcadeSurface } from "@/lib/local/fixed-model";
import {
  estimateTranscriptTokens,
  runQuery,
  type QueryEvent,
  type QueryResult,
} from "@/primary-logic/query/query";
import { parseTokenBudget } from "@/primary-logic/query/budgetText";
import type { QueryDeps, QueryMessage, QueryTool, QueryToolCall } from "@/primary-logic/query/deps";
import { createCallModel } from "./call-model";
import { createToolRunner, type ToolRunnerEvent } from "./tool-runner";
import { compactTranscript } from "./compact";
import {
  noteApproved,
  noteDenied,
  type PermissionContext,
  type PermissionDecision,
} from "./permissions";
import { currentPermissionContext } from "./permission-settings";
import { consume } from "@/lib/limits/use-limits";
import { memoryPolicyPrompt } from "@/lib/memory/quality";
import { considerSessionMemory, noteWork } from "@/lib/memory/session-memory";
import { addLocalMemory, inspectLocalMemory } from "@/lib/local-memory";

export interface RuntimeApproval {
  call: QueryToolCall;
  decision: PermissionDecision;
  /** A question in words about the thing, not about the tool. */
  question: string;
}

export type RuntimeEvent = QueryEvent | ToolRunnerEvent;

export interface RuntimeOptions {
  surface: OcadeSurface;
  /**
   * Ask the user. Returning false refuses the call.
   *
   * A surface that supplies nothing here gets a runtime that can only read:
   * every call the layer wants checked is refused rather than silently allowed.
   * That default is deliberate — forgetting to wire an approval UI must fail
   * closed.
   */
  onApprovalNeeded?: (approval: RuntimeApproval) => Promise<boolean>;
  onEvent?: (event: RuntimeEvent) => void;
  /** The live companion session, when the surface holds one. */
  missionId?: () => string | null;
  /** What OCADE already knows about this person, for the system prompt. */
  memoryContext?: () => string | null;
  /** True while the person has pressed stop or pause. */
  shouldStop?: () => string | null;
}

export interface RuntimeRun {
  /** False when the request needed no tool; the caller answers normally. */
  used: boolean;
  result?: QueryResult;
}

/**
 * Whether a request plainly needs no tool.
 *
 * Deliberately conservative and deterministic: it only answers "no tools" for
 * requests the keyword pass recognises as conversation, and defers everything
 * else to the classifier. Guessing "no tools" wrongly is the expensive mistake
 * — it is the one that puts the product back to explaining instead of doing.
 */
export function plainlyConversational(request: string): boolean {
  const domains = classifyDeterministic(request);
  return domains !== null && domains.length === 1 && domains[0] === "conversation";
}

/** The tools to offer this turn, in the query loop's schema shape. */
export function toolsForRequest(request: string, domains: readonly Domain[]): QueryTool[] {
  return selectTools(domains, request).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

export function useOcadeRuntime(options: RuntimeOptions) {
  const engine = useLocalChatEngine({ surface: options.surface });
  const permissionRef = useRef<PermissionContext>(currentPermissionContext());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const runner = useMemo(
    () =>
      createToolRunner({
        permissions: () => permissionRef.current,
        executeContext: () => ({ missionId: optionsRef.current.missionId?.() ?? null }),
        onEvent: (event) => optionsRef.current.onEvent?.(event),
        onDecision: (allowed) => {
          permissionRef.current = allowed
            ? noteApproved(permissionRef.current)
            : noteDenied(permissionRef.current);
        },
        requestApproval: async (call, decision) => {
          const ask = optionsRef.current.onApprovalNeeded;
          if (!ask) return false;
          return await ask({ call, decision, question: approvalQuestionFor(call, decision) });
        },
      }),
    [],
  );

  const deps = useMemo<QueryDeps>(
    () => ({
      callModel: createCallModel(engine),
      runTools: (calls, signal) => runner.run(calls, signal),
      compact: compactTranscript,
      countTokens: estimateTranscriptTokens,
      /*
       * Two independent reasons to stop, checked as one. The surface's own stop
       * (a pressed button) and the runner's (the same call failing the same way
       * twice) both mean "do not start another round", and the loop should not
       * have to know which.
       */
      shouldStop: () => optionsRef.current.shouldStop?.() ?? runner.stuckReason(),
      uuid: () =>
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }),
    [engine, runner],
  );

  /**
   * Keep what this conversation taught OCADE about the person having it.
   *
   * The policy decides whether the moment has come; this supplies the three
   * things it cannot know — how to ask the engine, what is already remembered,
   * and how to save. Every failure path is silent on purpose: note-taking that
   * interrupts is worse than note-taking that occasionally misses.
   */
  const learn = useCallback(
    async (history: readonly QueryMessage[], result: QueryResult) => {
      const surface = optionsRef.current.surface;
      noteWork(surface, result.toolResults.length);

      const transcript = [...history, ...result.messages].map((message) => ({
        role: message.role,
        content:
          typeof message.content === "string" ? message.content : JSON.stringify(message.content),
      }));

      await considerSessionMemory(surface, {
        tokenCount: estimateTranscriptTokens(transcript),
        transcript,
        deps: {
          complete: async (prompt) => {
            let text = "";
            const reply = await engine.send({
              messages: [{ role: "user", content: prompt }],
              onToken: (chunk) => {
                text += chunk;
              },
              /*
               * OCADE asking on its own behalf. It must not cancel the user's
               * next message, and it must not announce itself in the engine
               * status — note-taking that interrupts is worse than note-taking
               * that occasionally misses.
               */
              background: true,
            });
            return reply.ok ? text : null;
          },
          existing: () => {
            const held = inspectLocalMemory();
            return held.ok ? held.data.rows.map((row) => row.content) : [];
          },
          // `source: "imported"` because OCADE inferred it rather than being
          // told it. The distinction is visible in Privacy settings, where a
          // person deciding what to delete deserves to know which is which.
          save: (content) => addLocalMemory({ content, source: "imported" }).ok,
        },
      });
    },
    [engine],
  );

  /**
   * Run a request that may need tools.
   *
   * Returns `used: false` without touching the engine when the request is
   * plainly conversation, so the caller can answer on its own path.
   */
  const run = useCallback(
    async (
      request: string,
      opts: {
        signal?: AbortSignal;
        domains?: readonly Domain[];
        history?: readonly QueryMessage[];
        onToken?: (chunk: string) => void;
      } = {},
    ): Promise<RuntimeRun> => {
      if (plainlyConversational(request)) return { used: false };

      // Re-read the policy per request; keep the denial history for the session.
      permissionRef.current = {
        ...currentPermissionContext(),
        denials: permissionRef.current.denials,
      };
      runner.reset();

      const domains = opts.domains ?? classifyDeterministic(request) ?? ["conversation"];
      const tools = toolsForRequest(request, domains);
      if (tools.length === 0) return { used: false };

      /*
       * THE RESOURCE GOVERNOR, ASKED ONCE PER REQUEST RATHER THAN PER TURN.
       *
       * A single request can spend a dozen model turns, and charging each one
       * would make a legitimate multi-step task look like abuse. What the limit
       * is protecting against is a loop that got away, and a runaway shows up
       * as many REQUESTS, not as one thorough one.
       *
       * A rejection is returned rather than thrown, and carries the engine's own
       * sentence, so every surface says the same thing about the same limit.
       */
      const allowance = consume("inference");
      if (allowance.outcome === "rejected") {
        return {
          used: true,
          result: {
            terminal: { reason: "blocking_limit", error: allowance.message },
            text: allowance.message ?? "OCADE needs a moment before it can do that again.",
            messages: [],
            toolResults: [],
            turns: 0,
          },
        };
      }

      const memory = optionsRef.current.memoryContext?.() ?? null;
      const history = [...(opts.history ?? []), { role: "user" as const, content: request }];
      const result = await runQuery(
        {
          messages: history,
          systemPrompt: systemPromptWith(optionsRef.current.surface, memory),
          tools,
          deps,
          ...(opts.signal ? { signal: opts.signal } : {}),
          ...(opts.onToken ? { onToken: opts.onToken } : {}),
          /*
           * A budget only exists when the person wrote one. "+500k" in a
           * request is an explicit instruction to keep working past the point
           * a model would normally stop and offer to continue.
           */
          tokenBudget: parseTokenBudget(request),
        },
        (event) => optionsRef.current.onEvent?.(event),
      );
      /*
       * LEARN SOMETHING FROM THE CONVERSATION, IF THERE IS ANYTHING TO LEARN.
       *
       * Not awaited. This is a second model call on the same device as the one
       * the user is waiting on, and making them wait for OCADE to take notes
       * would be a strange thing to charge them for. It runs at most once every
       * few thousand tokens — see the thresholds in the imported policy.
       */
      void learn(history, result);
      return { used: true, result };
    },
    [deps, runner, learn],
  );

  return useMemo(
    () => ({
      engine,
      run,
      schemasFor,
      permissions: () => permissionRef.current,
      stop: engine.stop,
      warm: engine.warm,
    }),
    [engine, run],
  );
}

/**
 * The system prompt for a turn that may use tools.
 *
 * Memory goes AFTER the instructions and is labelled as background rather than
 * as orders. A small model handed "Address them as Sir" at the top of its
 * prompt starts every reply with "Sir,", including the one-word ones; below the
 * instructions and marked as context, it uses it the way a person would.
 */
export function systemPromptWith(surface: OcadeSurface, memoryContext: string | null): string {
  const parts = [
    ocadeCorePolicy(surface === "control" ? "control" : "chat"),
    "",
    "When the task is done, say briefly what you did and what you verified.",
  ];
  /*
   * The memory policy travels with the memory, not on its own.
   *
   * A model told what not to remember, in a turn where it has nothing to
   * remember and no tool to do it with, is a model spending context on a rule
   * it cannot apply. The rule appears when memory does.
   */
  const context = (memoryContext ?? "").trim();
  if (context) {
    parts.push("", memoryPolicyPrompt());
    parts.push(
      "",
      "What you already know about this person, from previous sessions:",
      context,
      "",
      "Use it naturally when it is relevant. Do not recite it back, and do not",
      "mention that you are reading it from a memory.",
    );
  }
  return parts.join("\n");
}

/**
 * The approval sentence, in words about the thing rather than about the tool.
 *
 * "Allow file_write?" is a question nobody can answer. "Save notes.md to your
 * Documents folder?" is one everybody can. The permission layer already worked
 * out the subject of the call, so the sentence is built from that plus what the
 * layer decided.
 */
function approvalQuestionFor(call: QueryToolCall, decision: PermissionDecision): string {
  const tool = findTool(call.name);
  const subject = typeof call.arguments?.name === "string" ? call.arguments.name : null;
  const base = tool?.description?.split(/[.!?]/)[0]?.trim();
  const what = subject ? `${base ?? call.name} — ${subject}` : (base ?? call.name);
  return decision.warning ? `${what}. ${decision.warning}. Go ahead?` : `${what}?`;
}

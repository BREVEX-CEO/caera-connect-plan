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
 *   `callModel`  → OCADE Intelligence, carrying the surface's one permit and
 *                  current privacy/mode policy through every internal turn.
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
import { createOcadeIntelligence } from "@/lib/intelligence/router";
import { createOnlineIntelligenceTransport } from "@/lib/intelligence/online-client";
import { createEngineIntelligenceTransport } from "@/lib/intelligence/engine-transport";
import type { IntelligenceMode, IntelligencePrivacyPolicy } from "@/lib/intelligence/contract";
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
import { mayRemember } from "@/lib/chat/incognito";
import { repairForResume } from "@/primary-logic/query/resume";
import { QueryGuard } from "@/primary-logic/query/queryGuard";
import { addMemory, readMemory } from "@/lib/ocade-projects.functions";
import type { BilledRequest } from "@/lib/commercial/use-generation-permit";

/**
 * Runtime backstop for callers outside React's type system (generated clients,
 * stale bundles and malicious direct calls). The commercial gate must run
 * before classification or engine initialization, not merely before a surface
 * happens to render its loading state.
 */
export function requireRuntimeGenerationPermit(
  permit: BilledRequest["permit"] | null | undefined,
): BilledRequest["permit"] {
  if (
    !permit?.id ||
    !permit.generationId ||
    !permit.idempotencyKey ||
    !permit.surface ||
    !["server", "offline_lease"].includes(permit.source)
  ) {
    throw new Error("A commercial generation permit is required before intelligence runs.");
  }
  return permit;
}

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
  memoryContext?: () => string | null | Promise<string | null>;
  /** True while the person has pressed stop or pause. */
  shouldStop?: () => string | null;
  /**
   * True for a conversation OCADE must not learn from — PLAN.md §8.
   *
   * Read at the moment of learning rather than at mount, because a person can
   * start an incognito conversation without remounting the runtime, and the
   * value that mattered is the one in force when the turn ended.
   */
  incognito?: () => boolean;
  /** Read at request time so privacy and mode changes need no remount. */
  intelligenceMode?: () => IntelligenceMode;
  intelligencePrivacy?: () => IntelligencePrivacyPolicy;
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

/** How long a new request waits for the previous one to let go. */
const SUPERSEDE_WAIT_MS = 2_000;

/** Resolves true once the guard is free. */
function waitUntilIdle(guard: QueryGuard): Promise<boolean> {
  if (!guard.isActive()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const unsubscribe = guard.subscribe(() => {
      if (guard.isActive()) return;
      unsubscribe();
      resolve(true);
    });
  });
}

export function useOcadeRuntime(options: RuntimeOptions) {
  /*
   * One run at a time, across both rooms that share this hook. A ref rather
   * than state: nothing renders from it, and it must survive re-renders that
   * happen while a run is in flight.
   */
  const guardRef = useRef(new QueryGuard());
  const guard = guardRef.current;
  const engine = useLocalChatEngine({ surface: options.surface });
  const intelligence = useMemo(
    () =>
      createOcadeIntelligence({
        online: createOnlineIntelligenceTransport(),
        local: createEngineIntelligenceTransport(engine),
      }),
    [engine],
  );
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

  /**
   * Keep what this conversation taught OCADE about the person having it.
   *
   * The policy decides whether the moment has come; this supplies the three
   * things it cannot know — how to ask the engine, what is already remembered,
   * and how to save. Every failure path is silent on purpose: note-taking that
   * interrupts is worse than note-taking that occasionally misses.
   */
  const learn = useCallback(
    async (
      history: readonly QueryMessage[],
      result: QueryResult,
      permit: BilledRequest["permit"],
    ) => {
      const surface = optionsRef.current.surface;
      /*
       * AN INCOGNITO CONVERSATION TEACHES OCADE NOTHING — PLAN.md §8.
       *
       * Before `noteWork`, not after: that counter is itself a record of the
       * conversation having happened, and the whole promise is that there is
       * none.
       */
      if (!mayRemember(optionsRef.current.incognito?.() ?? false)) return;
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
            const reply = await intelligence.generate({
              permit,
              generationId: permit.generationId,
              idempotencyKey: permit.idempotencyKey,
              surface: permit.surface,
              mode: "local_only",
              messages: [{ role: "user", content: prompt }],
              tools: [],
              attachments: [],
              privacy: {
                onlineInferenceConsented: false,
                sealed: true,
              },
              background: true,
              /*
               * OCADE asking on its own behalf. It must not cancel the user's
               * next message, and it must not announce itself in the engine
               * status — note-taking that interrupts is worse than note-taking
               * that occasionally misses.
               */
            });
            return reply.ok ? reply.response.text : null;
          },
          existing: async () => {
            /*
             * Read from the account rather than from anything this tab is
             * holding. A second device may have added the same fact an hour
             * ago, and an extraction that could not see it would save it again
             * — memory that grows a duplicate every session is the failure
             * that makes recall useless.
             */
            try {
              const held = await readMemory();
              return held.rows.map((row) => row.content);
            } catch {
              return [];
            }
          },
          /*
           * `source: "imported"` because OCADE inferred it rather than being
           * told it. The distinction is visible in Privacy settings, where a
           * person deciding what to delete deserves to know which is which.
           *
           * A refusal is an ordinary answer here, not an error: the server
           * declines when memory is switched off, and note-taking must not
           * surface that to somebody who is in the middle of something else.
           */
          save: async (content) => {
            try {
              await addMemory({ data: { content, source: "imported" } });
              return true;
            } catch {
              return false;
            }
          },
        },
      });
    },
    [intelligence],
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
        /** Required proof that the surface acquired usage before this runtime. */
        permit: BilledRequest["permit"];
        signal?: AbortSignal;
        domains?: readonly Domain[];
        history?: readonly QueryMessage[];
        onToken?: (chunk: string) => void;
      },
    ): Promise<RuntimeRun> => {
      requireRuntimeGenerationPermit(opts.permit);
      if (plainlyConversational(request)) return { used: false };

      /*
       * ONE RUN AT A TIME, INCLUDING DURING THE GAP BEFORE ONE STARTS.
       *
       * `runner.reset()` below clears the repeat-detection and stuck-reason
       * protecting whatever is currently inside a tool call. Two requests a
       * second apart meant the first run losing the state that stops it
       * looping — silently, with nothing in any log.
       *
       * The newer request wins, as it already does at the engine, which aborts
       * the call in flight. This waits for the older run to let go first so the
       * two never share the runner, and gives up waiting after a moment rather
       * than hanging on an engine that never returns.
       */
      if (guard.isActive()) {
        const releasedInTime = await Promise.race([
          waitUntilIdle(guard),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SUPERSEDE_WAIT_MS)),
        ]);
        // The older run did not let go. Take the guard anyway: a request the
        // person is waiting on must not be held hostage by an engine that
        // never returned.
        if (!releasedInTime) guard.forceEnd();
      }
      const generation = guard.tryStart();

      try {
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

        const memory = (await optionsRef.current.memoryContext?.()) ?? null;
        /*
         * REPAIR THE HISTORY BEFORE THE MODEL SEES IT.
         *
         * A conversation reopened from storage can carry artefacts of how the
         * last run ended — an empty assistant turn left by a stopped stream, or
         * tool results whose request was compacted away. Neither is a bug while
         * the run is alive; both become one when a model reads them as its own
         * past behaviour. The imported repair drops exactly those two and leaves
         * everything else alone.
         */
        const repaired = repairForResume(opts.history ?? []);
        const history = [...repaired.messages, { role: "user" as const, content: request }];
        const deps: QueryDeps = {
          callModel: createCallModel({
            intelligence,
            permit: opts.permit,
            mode: optionsRef.current.intelligenceMode?.() ?? "local_only",
            privacy: optionsRef.current.intelligencePrivacy?.() ?? {
              onlineInferenceConsented: false,
              sealed: true,
            },
          }),
          runTools: (calls, signal) => runner.run(calls, signal),
          compact: compactTranscript,
          countTokens: estimateTranscriptTokens,
          shouldStop: () => optionsRef.current.shouldStop?.() ?? runner.stuckReason(),
          uuid: () =>
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        };
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
        void learn(history, result, opts.permit);
        return { used: true, result };
      } finally {
        // Release only if this run is still the one holding it: a superseded
        // run finishing late must not free the guard a newer run now holds.
        if (generation !== null) guard.end(generation);
      }
    },
    [runner, intelligence, learn, guard],
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

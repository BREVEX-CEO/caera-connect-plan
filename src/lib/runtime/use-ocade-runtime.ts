/**
 * The OCADE runtime: one engine, one tool registry, one permission layer, one
 * agent loop — handed to whichever room asked.
 *
 * WHAT WAS TRUE BEFORE THIS FILE
 * ------------------------------
 * Cowork could act and could not talk about anything. Chat could talk and could
 * not act. The split was not a design; it was where two features happened to
 * stop. A person in Chat who typed "put this in a file on my desktop" got a
 * paragraph explaining how they might do that themselves, from a product that
 * was, in another tab, capable of doing it.
 *
 * They now share this. The engine is the one `useLocalChatEngine` resolves —
 * on-device, WebGPU or WASM, no hosted inference on any path. The tools are the
 * one registry. The permission answer comes from one layer. The loop is
 * `runAgentTask`, which was already Cowork's and is now both rooms'.
 *
 * WHAT STAYS DIFFERENT BETWEEN THE ROOMS, AND WHY THAT IS NOT A SECOND RUNTIME
 * ---------------------------------------------------------------------------
 * Cowork deliberates less (`surface: "control"` — the turn must produce a call,
 * not an essay about one), and Cowork holds a mission on the companion for the
 * length of a task. Chat deliberates by default and holds no mission until a
 * request needs the machine. Those are arguments to the same runtime, not
 * different runtimes.
 *
 * WHEN CHAT USES A TOOL AT ALL
 * ----------------------------
 * Only when the request asks for something a tool can do. The classifier's
 * `conversation` domain means "no tool needed", and a chat turn that classifies
 * that way never loads a schema, never starts a mission and costs nothing extra.
 * A product that reached for the machine on "how are you" would be worse than
 * one that never reached for it at all.
 */

import { useCallback, useMemo, useRef } from "react";
import { useLocalChatEngine } from "@/lib/chat/use-local-chat-engine";
import { classifyDeterministic, type Domain } from "@/lib/agent/domains";
import { findTool, schemasFor } from "@/lib/agent/tool-registry";
import {
  runAgentTask,
  type AgentEvent,
  type AgentMessage,
  type AgentResult,
  type ToolCall,
} from "@/lib/agent/loop";
import type { BrainMessage } from "@/lib/brain/adapter";
import type { OcadeSurface } from "@/lib/local/fixed-model";
import { executeToolCall } from "./execute";
import {
  decide,
  noteApproved,
  noteDenied,
  type PermissionContext,
  type PermissionDecision,
} from "./permissions";
import { currentPermissionContext } from "./permission-settings";

export interface RuntimeApproval {
  call: ToolCall;
  decision: PermissionDecision;
  /** A question in words about the thing, not about the tool. */
  question: string;
}

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
  onEvent?: (event: AgentEvent) => void;
  /** The live companion session, when the surface holds one. */
  missionId?: () => string | null;
  /** What OCADE already knows about this person, for the system prompt. */
  memoryContext?: () => string | null;
}

export interface RuntimeRun {
  /** False when the request needed no tool; the caller answers normally. */
  used: boolean;
  result?: AgentResult;
}

/**
 * Whether a request plainly needs no tool.
 *
 * Deliberately conservative and deterministic: it only answers "no tools" for
 * requests the keyword pass recognises as conversation, and defers everything
 * else to the loop's own classifier, which can ask the model. Guessing "no
 * tools" wrongly is the expensive mistake — it is the one that puts the product
 * back to explaining instead of doing.
 */
export function plainlyConversational(request: string): boolean {
  const domains = classifyDeterministic(request);
  return domains !== null && domains.length === 1 && domains[0] === "conversation";
}

export function useOcadeRuntime(options: RuntimeOptions) {
  const engine = useLocalChatEngine({ surface: options.surface });
  const permissionRef = useRef<PermissionContext>(currentPermissionContext());
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /**
   * One model turn, with tool schemas when there are any.
   *
   * The engine constrains the reply into a real call when it can carry tools,
   * so a call either arrives well-formed or does not arrive. Text is
   * accumulated because `send` streams and resolves with a status; the loop
   * needs the whole reply to decide what happened.
   */
  const turn = useCallback<Parameters<typeof runAgentTask>[0]["turn"]>(
    async (messages, tools, handlers) => {
      let text = "";
      const toolCalls: ToolCall[] = [];
      const result = await engine.send({
        messages: forEngine(messages),
        onToken: (chunk) => {
          text += chunk;
          handlers.onToken?.(chunk);
        },
        ...(tools.length
          ? {
              tools,
              onToolCall: (call) =>
                toolCalls.push({
                  name: call.name,
                  arguments: call.arguments,
                  ...(call.id ? { id: call.id } : {}),
                }),
            }
          : {}),
      });
      if (!result.ok && !result.cancelled) {
        /*
         * A failed turn returns whatever streamed rather than throwing. The
         * loop reads an empty reply as "nothing to do" and stops, which is the
         * correct end for an engine that could not answer — and it lets the
         * surface show the partial text instead of losing it.
         */
        return { text, toolCalls: [] };
      }
      return { text, toolCalls };
    },
    [engine],
  );

  /**
   * One short completion, for the loop's classifier.
   *
   * Non-streaming from the caller's point of view: the tokens are collected and
   * the whole string returned. Returns null when the engine cannot answer, and
   * the classifier then falls back rather than guessing.
   */
  const complete = useCallback(
    async (prompt: string, signal?: AbortSignal): Promise<string | null> => {
      let text = "";
      const result = await engine.send({
        messages: [{ role: "user", content: prompt }],
        onToken: (chunk) => {
          text += chunk;
        },
        ...(signal ? { signal } : {}),
      });
      return result.ok ? text : null;
    },
    [engine],
  );

  const permit = useCallback(async (call: ToolCall): Promise<boolean> => {
    const tool = findTool(call.name);
    const decision = decide(call, tool, permissionRef.current);
    if (decision.outcome === "allow") return true;
    if (decision.outcome === "deny") return false;

    const ask = optionsRef.current.onApprovalNeeded;
    if (!ask) return false;

    const allowed = await ask({ call, decision, question: approvalQuestionFor(call, decision) });
    permissionRef.current = allowed
      ? noteApproved(permissionRef.current)
      : noteDenied(permissionRef.current);
    return allowed;
  }, []);

  const execute = useCallback(async (call: ToolCall, signal?: AbortSignal) => {
    void signal;
    const tool = findTool(call.name);
    return await executeToolCall(call, {
      missionId: optionsRef.current.missionId?.() ?? null,
      /*
       * The companion refuses an unconfirmed high-risk call. By the time a call
       * reaches here the permission layer has either asked the user or matched
       * a rule the user wrote, and both are a person's decision — which is what
       * the flag is for.
       */
      confirmed: tool?.risk === "high",
    });
  }, []);

  /**
   * Run a request that may need tools.
   *
   * Returns `used: false` without touching the engine when the request is
   * plainly conversation, so the caller can answer on its own path.
   */
  const run = useCallback(
    async (
      request: string,
      opts: { signal?: AbortSignal; domains?: readonly Domain[] } = {},
    ): Promise<RuntimeRun> => {
      if (plainlyConversational(request)) return { used: false };

      // Re-read the policy per request; keep the denial history for the session.
      permissionRef.current = {
        ...currentPermissionContext(),
        denials: permissionRef.current.denials,
      };

      const result = await runAgentTask(
        {
          complete,
          turn,
          execute,
          permit,
          ...(optionsRef.current.onEvent ? { onEvent: optionsRef.current.onEvent } : {}),
        },
        {
          request,
          ...(opts.signal ? { signal: opts.signal } : {}),
          ...(opts.domains ? { domains: [...opts.domains] } : {}),
          memoryContext: optionsRef.current.memoryContext?.() ?? null,
        },
      );
      return { used: true, result };
    },
    [complete, execute, permit, turn],
  );

  return useMemo(
    () => ({
      engine,
      run,
      /** For a surface that wants to show what it could do before it does it. */
      schemasFor,
      permissions: () => permissionRef.current,
      stop: engine.stop,
      warm: engine.warm,
    }),
    [engine, run],
  );
}

/**
 * The loop's transcript, in the three roles an on-device engine understands.
 *
 * THE ADAPTER IS FOUR LINES AND IT IS LOAD-BEARING.
 *
 * `runAgentTask` writes a fourth role, `tool`, carrying what a call returned.
 * The browser engines take the three chat roles and nothing else — a `tool`
 * message reaches them as an unknown role and is dropped, which is the worst
 * possible outcome: the loop believes the model saw the result of its action,
 * the model saw nothing, and it repeats the call. So a tool result is folded
 * into a user-role message that names the tool, which is how the model reads
 * it as an observation rather than as an instruction.
 *
 * Rewriting the loop to emit three roles was the alternative and it is worse:
 * the fourth role is correct, engines that support it should get it, and the
 * narrowing belongs at the boundary that needs it.
 */
function forEngine(messages: readonly AgentMessage[]): BrainMessage[] {
  return messages.map((message) =>
    message.role === "tool"
      ? {
          role: "user" as const,
          content: `Result of ${message.toolName ?? "the action"}: ${message.content}`,
        }
      : { role: message.role, content: message.content },
  );
}

/**
 * The approval sentence, in words about the thing rather than about the tool.
 *
 * "Allow file_write?" is a question nobody can answer. "Save notes.md to your
 * Documents folder?" is one everybody can. The permission layer already worked
 * out the subject of the call, so the sentence is built from that plus what the
 * layer decided.
 */
function approvalQuestionFor(call: ToolCall, decision: PermissionDecision): string {
  const tool = findTool(call.name);
  const subject = typeof call.arguments?.name === "string" ? call.arguments.name : null;
  const base = tool?.description?.split(/[.!?]/)[0]?.trim();
  const what = subject ? `${base ?? call.name} — ${subject}` : (base ?? call.name);
  return decision.warning ? `${what}. ${decision.warning}. Go ahead?` : `${what}?`;
}

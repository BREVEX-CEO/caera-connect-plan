/**
 * The planning loop's real bindings: OCADE's Online boundary, the commercial
 * gate on the `jarvis` surface, and the JARVIS server functions.
 */
import { createOnlineIntelligenceTransport } from "@/lib/intelligence/online-client";
import { beginBilledRequest } from "@/lib/commercial/use-generation-permit";
import type { NormalizedToolCall } from "@/lib/intelligence/contract";
import { Stopped, type AgentDeps } from "./agent";
import { jarvisTools } from "./protocol";
import {
  cancelJarvisAction,
  decideJarvisAction,
  queueJarvisAction,
  readJarvisAction,
  readJarvisFrame,
  readJarvisTask,
  rememberJarvis,
  startJarvisTask,
  updateJarvisTask,
} from "./jarvis.functions";

const online = createOnlineIntelligenceTransport();

export class ModelRefused extends Error {}

/**
 * OCADE's Online capacity is unavailable or exhausted right now. Said in
 * OCADE's own words, never the provider's: the reason stays on the server.
 */
export class Unavailable extends Error {
  constructor() {
    super("OCADE JARVIS is busy right now. Nothing was charged.");
  }
}

export function liveDeps(conversationId: string): AgentDeps {
  return {
    async model({ messages, memory, attachments, signal, onText }) {
      const billed = await beginBilledRequest({ surface: "jarvis" });
      if (!billed) return null;
      let text = "";
      const toolCalls: NormalizedToolCall[] = [];
      let refusal: { reason: string; code: string; retryable: boolean } | null = null;
      try {
        for await (const event of online.stream({
          permit: billed.permit,
          generationId: billed.permit.generationId,
          idempotencyKey: billed.permit.idempotencyKey,
          surface: "jarvis",
          mode: "online",
          messages,
          tools: jarvisTools(memory),
          attachments,
          privacy: { onlineInferenceConsented: true, sealed: false },
          conversationId,
          signal,
        })) {
          if (event.type === "token") {
            text += event.text;
            onText?.(text);
          } else if (event.type === "tool_call") toolCalls.push(event.call);
          else if (event.type === "refusal") refusal = event;
          else if (event.type === "final") {
            text = event.response.text || text;
            if (toolCalls.length === 0) toolCalls.push(...event.response.toolCalls);
          }
        }
        billed.recordDelivery({
          answer: text || (toolCalls.length ? JSON.stringify(toolCalls) : ""),
        });
      } finally {
        await billed.settle();
      }
      if (refusal && !text && toolCalls.length === 0) {
        if (
          refusal.retryable &&
          [
            "provider_rate_limited",
            "online_unavailable",
            "empty_response",
            "provider_failed",
          ].includes(refusal.code)
        ) {
          throw new Unavailable();
        }
        throw new ModelRefused(refusal.reason);
      }
      return { text, toolCalls };
    },
    startTask: (data) => startJarvisTask({ data }),
    updateTask: async (data) => {
      const task = await updateJarvisTask({ data });
      if (!task) throw new Stopped(true); // another tab or device took over this task
      return task;
    },
    cancelAction: (id) => cancelJarvisAction({ data: { id } }),
    readTaskStatus: async (id) => (await readJarvisTask({ data: { id } })).status,
    queue: (data) => queueJarvisAction({ data }),
    readAction: (id) => readJarvisAction({ data: { id } }),
    decide: (data) => decideJarvisAction({ data }),
    frame: async (taskId) => (await readJarvisFrame({ data: { taskId } })).frame,
    remember: (content) => rememberJarvis({ data: { content } }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

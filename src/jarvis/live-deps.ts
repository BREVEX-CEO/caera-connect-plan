/**
 * The planning loop's real bindings: OCADE's Online boundary, the commercial
 * gate on the `jarvis` surface, and the JARVIS server functions.
 */
import { createOnlineIntelligenceTransport } from "@/lib/intelligence/online-client";
import { beginBilledRequest } from "@/lib/commercial/use-generation-permit";
import type { NormalizedToolCall } from "@/lib/intelligence/contract";
import type { AgentDeps } from "./agent";
import { jarvisTools } from "./protocol";
import {
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

export function liveDeps(conversationId: string): AgentDeps {
  return {
    async model({ messages, memory, attachments, signal }) {
      const billed = await beginBilledRequest({ surface: "jarvis" });
      if (!billed) return null;
      let text = "";
      const toolCalls: NormalizedToolCall[] = [];
      let refusal: string | null = null;
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
          if (event.type === "token") text += event.text;
          else if (event.type === "tool_call") toolCalls.push(event.call);
          else if (event.type === "refusal") refusal = event.reason;
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
      if (refusal && !text && toolCalls.length === 0) throw new ModelRefused(refusal);
      return { text, toolCalls };
    },
    startTask: (data) => startJarvisTask({ data }),
    updateTask: (data) => updateJarvisTask({ data }),
    readTaskStatus: async (id) => (await readJarvisTask({ data: { id } })).status,
    queue: (data) => queueJarvisAction({ data: data as never }),
    readAction: (id) => readJarvisAction({ data: { id } }),
    decide: (data) => decideJarvisAction({ data }),
    frame: async (taskId) => (await readJarvisFrame({ data: { taskId } })).frame,
    remember: (content) => rememberJarvis({ data: { content } }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
}

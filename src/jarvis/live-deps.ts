/**
 * The planning loop's real bindings: OCADE's Online boundary, the commercial
 * gate on the `jarvis` surface, and the JARVIS server functions.
 */
import { createOnlineIntelligenceTransport } from "@/lib/intelligence/online-client";
import { beginBilledRequest } from "@/lib/commercial/use-generation-permit";
import type { NormalizedToolCall } from "@/lib/intelligence/contract";
import { Stopped, type AgentDeps } from "./agent";
import { jarvisTools } from "./protocol";
import { actionChanged } from "./changes";
import {
  cancelJarvisAction,
  decideJarvisAction,
  queueJarvisAction,
  readJarvisAction,
  readJarvisDocs,
  readJarvisFrame,
  readJarvisTask,
  rememberJarvis,
  scheduleJarvis,
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

/**
 * A busy answer (rate limited, unavailable) is waited out a little and asked again, of
 * the same model, before the task pauses: a per-minute limit usually clears within these
 * (live cloud runs, 13 Oct). Each failed attempt is released, never charged; STOP ends
 * the wait at once.
 */
export const BUSY_WAITS_MS = [15_000, 30_000];

export function waitOrStop(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

/** Asks again after each busy answer, then lets the task pause with the last one. */
export async function askThroughBusy<T>(
  ask: () => Promise<T>,
  signal?: AbortSignal,
  waits: readonly number[] = BUSY_WAITS_MS,
): Promise<T> {
  for (const pause of waits) {
    try {
      return await ask();
    } catch (error) {
      if (!(error instanceof Unavailable)) throw error;
      await waitOrStop(pause, signal);
    }
  }
  return ask();
}

export function liveDeps(conversationId: string): AgentDeps {
  return {
    model: (input) => askThroughBusy(() => askOnce(input, conversationId), input.signal),
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
    readDocs: (data) => readJarvisDocs({ data }),
    schedule: (data) => scheduleJarvis({ data }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    changed: actionChanged,
  };
}

async function askOnce(
  { messages, memory, attachments, signal, onText }: Parameters<AgentDeps["model"]>[0],
  conversationId: string,
): ReturnType<AgentDeps["model"]> {
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
      ["provider_rate_limited", "online_unavailable", "empty_response", "provider_failed"].includes(
        refusal.code,
      )
    ) {
      throw new Unavailable();
    }
    throw new ModelRefused(refusal.reason);
  }
  return { text, toolCalls };
}

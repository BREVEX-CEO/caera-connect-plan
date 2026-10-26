import { DEFAULT_ONLINE_MODEL } from "@/lib/intelligence/online-models";
import { HIGH_WARNING_VERSION } from "@/lib/intelligence/quality";
/**
 * The planning loop's real bindings: OCADE's Online boundary, the commercial
 * gate on the `jarvis` surface, and the JARVIS server functions.
 */
import { createOnlineIntelligenceTransport } from "@/lib/intelligence/online-client";
import { beginBilledRequest } from "@/lib/commercial/use-generation-permit";
import type { NormalizedAssistantPart, NormalizedToolCall } from "@/lib/intelligence/contract";
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
  recordJarvisResearch,
  readJarvisDeliveries,
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
  /** When capacity returns, when it is known to be a long way off (a daily limit). */
  constructor(readonly retryAfterMs?: number) {
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
      // Not busy, busy until long after these waits, or busy with no wait named (OCADE's server
      // has already retried it, DEB-19-01): the task pauses now and continues by itself.
      if (
        !(error instanceof Unavailable) ||
        error.retryAfterMs === undefined ||
        error.retryAfterMs > pause
      )
        throw error;
      await waitOrStop(pause, signal);
    }
  }
  return ask();
}

/**
 * Until when web search is not offered, per account and Standard model. A plan without it (the
 * free tier: grounding is "Not available") refuses the first search; for a while after, that
 * account is not offered it here, so no later task spends a turn on a tool that cannot answer.
 * It expires, so an upgraded plan or a passing provider limit is not remembered as a permanent
 * lack, and another account or a new Standard model starts afresh (plan.md §4.5, audit F11).
 */
const noWebSearchUntil = new Map<string, number>();
export const RESEARCH_RECHECK_MS = 30 * 60_000;
const searchKey = (accountId: string) => `${accountId}:${DEFAULT_ONLINE_MODEL}`;
export const webSearchOffered = (accountId: string) =>
  Date.now() >= (noWebSearchUntil.get(searchKey(accountId)) ?? 0);

export function liveDeps(conversationId: string, accountId: string): AgentDeps {
  return {
    model: (input) => askThroughBusy(() => askOnce(input, conversationId, accountId), input.signal),
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
    deliveries: (taskId) => readJarvisDeliveries({ data: { taskId } }),
    remember: (content) => rememberJarvis({ data: { content } }),
    readDocs: (data) => readJarvisDocs({ data }),
    research: webSearchOffered(accountId) ? research(conversationId, accountId) : undefined,
    schedule: (data) => scheduleJarvis({ data }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    changed: actionChanged,
  };
}

function research(conversationId: string, accountId: string): AgentDeps["research"] {
  return async ({ question, signal, taskId }) => {
    const found = await askThroughBusy(
      () => researchOnce(question, conversationId, accountId, taskId, signal),
      signal,
    );
    // The sources the answer cited, counted from its own list: progress says only what happened.
    const hosts =
      "answer" in found
        ? [...found.answer.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map((m) => {
            try {
              return new URL(m[1]!).hostname;
            } catch {
              return "";
            }
          })
        : [];
    await recordJarvisResearch({
      data: {
        taskId,
        question,
        hosts: hosts.filter(Boolean),
        ok: "answer" in found,
        ...("answer" in found ? { answer: found.answer } : {}),
      },
    }).catch(() => undefined);
    return found;
  };
}

/** One grounded web search on the Online boundary: the answer and its sources, as text. */
async function researchOnce(
  question: string,
  conversationId: string,
  accountId: string,
  taskId: string,
  signal?: AbortSignal,
): Promise<{ answer: string } | { error: string }> {
  const billed = await beginBilledRequest({ surface: "jarvis", taskId });
  if (!billed) return { error: "Research is not available right now." };
  let text = "";
  let complete = false;
  let refusal: { reason: string; code: string; retryable: boolean; retryAfterMs?: number } | null =
    null;
  try {
    for await (const event of online.stream({
      permit: billed.permit,
      generationId: billed.permit.generationId,
      idempotencyKey: billed.permit.idempotencyKey,
      surface: "jarvis",
      mode: "online",
      messages: [{ role: "user", content: question }],
      tools: [],
      attachments: [],
      privacy: { onlineInferenceConsented: true, sealed: false },
      conversationId,
      research: true,
      signal,
    })) {
      if (event.type === "token") text += event.text;
      else if (event.type === "refusal") refusal = event;
      else if (event.type === "final") {
        complete = true;
        text = event.response.text || text;
      }
    }
    if (complete && text.trim() && !refusal) billed.recordDelivery({ answer: text });
  } finally {
    await billed.settle();
  }
  // Partial research is neither a delivered answer nor evidence for task completion.
  if (!complete || !text.trim() || refusal) {
    if (!refusal || refusal.retryable) throw new Unavailable(refusal?.retryAfterMs);
    if (refusal.code === "research_unavailable") {
      noWebSearchUntil.set(searchKey(accountId), Date.now() + RESEARCH_RECHECK_MS);
      return {
        error:
          "Web search is not available. Open the pages you need with the browser and read them with find_text; do not call research again in this task.",
      };
    }
    return { error: refusal.reason };
  }
  return { answer: text.slice(0, 8000) };
}

/** Refusals about the request itself: asking again would get the same answer. */
const FINAL_REFUSALS = [
  "content_blocked",
  "cancelled",
  "online_not_consented",
  "research_unavailable",
  "high_unavailable",
];

async function askOnce(
  {
    messages,
    tools: upstream = [],
    memory,
    attachments,
    signal,
    onText,
    taskId,
    quality = "standard",
  }: Parameters<AgentDeps["model"]>[0],
  conversationId: string,
  accountId: string,
): ReturnType<AgentDeps["model"]> {
  const billed = await beginBilledRequest({ surface: "jarvis", taskId });
  if (!billed) return null;
  let text = "";
  let complete = false;
  const toolCalls: NormalizedToolCall[] = [];
  let parts: NormalizedAssistantPart[] | undefined;
  let refusal: { reason: string; code: string; retryable: boolean; retryAfterMs?: number } | null =
    null;
  try {
    for await (const event of online.stream({
      permit: billed.permit,
      generationId: billed.permit.generationId,
      idempotencyKey: billed.permit.idempotencyKey,
      surface: "jarvis",
      mode: "online",
      quality,
      ...(quality === "high" ? { highModeAcknowledged: HIGH_WARNING_VERSION } : {}),
      messages,
      tools: [
        ...jarvisTools(memory, true, webSearchOffered(accountId) && quality !== "high"),
        ...upstream,
      ],
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
        complete = true;
        parts = event.response.parts;
        text = event.response.text || text;
        if (toolCalls.length === 0) toolCalls.push(...event.response.toolCalls);
      }
    }
    if (complete) {
      billed.recordDelivery({
        answer: text || (toolCalls.length ? JSON.stringify(toolCalls) : ""),
      });
    }
  } finally {
    await billed.settle();
  }
  // Only a turn that ended complete is planned from. One cut short released no call, so asking
  // again is safe (Unavailable); a refusal about the request itself is not asked again.
  if (!complete) {
    if (refusal && FINAL_REFUSALS.includes(refusal.code)) throw new ModelRefused(refusal.reason);
    throw new Unavailable(refusal?.retryAfterMs);
  }
  return { text, toolCalls, ...(parts ? { parts } : {}), permitKey: billed.permit.idempotencyKey };
}

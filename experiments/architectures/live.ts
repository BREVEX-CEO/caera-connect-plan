/**
 * Real-model runs of JARVIS's control loop against OCADE's staging Online boundary.
 *
 * Architecture A is the product's own loop (src/jarvis/agent.ts: its prompt, tools, sequences,
 * continuity and refusal rules) with the product's online transport. Architecture F is
 * experiments/architectures/engine-f.ts. Both call the same staging edge function with the
 * same disposable account and act through the same real device executor (device_server.py).
 *
 * Not the product's server: there is no task authority here, so a finish is recorded as the
 * model said it and judged afterwards by the task's independent oracle, never by the model.
 *
 * Usage (bundled by esbuild): node live.mjs <arch A|F> <task.json> <permits.json> <out.json> <port>
 * Env: OCADE_SUPABASE_URL, OCADE_SUPABASE_KEY, OCADE_TOKEN_FILE, OCADE_ORIGIN.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { runJarvisTurn, type AgentDeps } from "../../src/jarvis/agent";
import type { JarvisTaskRow } from "../../src/jarvis/jarvis.functions";
import { BROWSER_ACTION_NAMES, jarvisTools } from "../../src/jarvis/protocol";
import { createOnlineIntelligenceTransport } from "../../src/lib/intelligence/online-client";
import type {
  NormalizedAssistantPart,
  NormalizedMessage,
  NormalizedToolCall,
} from "../../src/lib/intelligence/contract";
import { programs, runEngineF } from "./engine-f";

const [, , arch, taskFile, permitsFile, outFile, port] = process.argv;
const task = JSON.parse(readFileSync(taskFile!, "utf8")) as { id: string; text: string };
const permits = JSON.parse(readFileSync(permitsFile!, "utf8")) as { id: string; key: string }[];
const token = (JSON.parse(readFileSync(process.env.OCADE_TOKEN_FILE!, "utf8")) as {
  access_token: string;
}).access_token;

export const transport = createOnlineIntelligenceTransport({
  configuration: () =>
    ({
      configured: true,
      url: process.env.OCADE_SUPABASE_URL!,
      publishableKey: process.env.OCADE_SUPABASE_KEY!,
    }) as never,
  getAccessToken: async () => token,
  online: () => true,
  askConsent: async () => true,
  // A browser sends its origin itself; the boundary admits only the staging origin.
  fetch: (input, init) =>
    fetch(input, {
      ...init,
      headers: { ...(init?.headers as Record<string, string>), origin: process.env.OCADE_ORIGIN! },
    }),
});

/** Every model call: how long, how big, what came back. */
export const calls: {
  ms: number;
  inputTokens?: number;
  outputTokens?: number;
  promptChars: number;
  ok: boolean;
  why?: string;
}[] = [];

/** One complete model turn through the boundary, as the product's askOnce asks it. */
export async function ask(
  messages: NormalizedMessage[],
  tools: ReturnType<typeof jarvisTools>,
  signal?: AbortSignal,
): Promise<{ text: string; toolCalls: NormalizedToolCall[]; parts?: NormalizedAssistantPart[] }> {
  const permit = permits.shift();
  if (!permit) throw new Error("permit pool empty");
  const started = performance.now();
  let text = "";
  const toolCalls: NormalizedToolCall[] = [];
  let parts: NormalizedAssistantPart[] | undefined;
  let usage: { inputTokens?: number; outputTokens?: number } = {};
  let refusal: string | undefined;
  let complete = false;
  for await (const event of transport.stream({
    permit: {
      id: permit.id,
      generationId: permit.key,
      idempotencyKey: permit.key,
      source: "server",
      surface: "jarvis",
    } as never,
    generationId: permit.key,
    idempotencyKey: permit.key,
    surface: "jarvis",
    mode: "online",
    quality: "standard",
    messages,
    tools,
    attachments: [],
    privacy: { onlineInferenceConsented: true, sealed: false },
    conversationId: task.id,
    signal,
  } as never)) {
    if (event.type === "token") text += event.text;
    else if (event.type === "tool_call") toolCalls.push(event.call);
    else if (event.type === "usage") usage = event.usage as typeof usage;
    else if (event.type === "refusal") refusal = `${event.code}: ${event.reason}`;
    else if (event.type === "final") {
      complete = true;
      parts = event.response.parts;
      text = event.response.text || text;
      if (!toolCalls.length) toolCalls.push(...event.response.toolCalls);
    }
  }
  calls.push({
    ms: Math.round(performance.now() - started),
    ...usage,
    promptChars: JSON.stringify(messages).length + JSON.stringify(tools).length,
    ok: complete,
    ...(refusal ? { why: refusal } : {}),
  });
  if (!complete) throw new Error(refusal ?? "incomplete model turn");
  return { text, toolCalls, ...(parts ? { parts } : {}) };
}

/** The device: one real action, through the executor's door. */
export async function device(family: "browser" | "computer", action: object) {
  const response = await fetch(`http://127.0.0.1:${port}/act`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ family, action }),
  });
  return (await response.json()) as { result: Record<string, unknown>; ms: number };
}

let row: JarvisTaskRow | null = null;
let approvals = 0;
let takeOvers = 0;

function deps(): AgentDeps {
  const queued = new Map<string, { action: object; run?: Promise<Record<string, unknown>> }>();
  const execute = (id: string) => {
    const item = queued.get(id)!;
    const family = BROWSER_ACTION_NAMES.has(String((item.action as { action: string }).action))
      ? "browser"
      : "computer";
    item.run ??= device(family, item.action).then((answer) => answer.result);
    return item.run;
  };
  let n = 0;
  return {
    model: async ({ messages, signal }) => ask(messages, jarvisTools(false, false, false), signal),
    startTask: async (input) => {
      row = {
        id: "task-1",
        conversation_id: input.conversationId,
        device_id: "device-1",
        title: input.title,
        plan: input.plan,
        current_step: 0,
        status: "running",
        blocker: null,
        result: null,
        browser_mode: "isolated",
        checkpoint: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as JarvisTaskRow;
      return {
        ok: true,
        task: row,
        device: { name: "Cloud test computer", platform: "Linux", can: ["files", "apps", "terminal"] },
      };
    },
    updateTask: async (change) => {
      row = {
        ...row!,
        ...(change.status ? { status: change.status } : {}),
        ...(change.result !== undefined ? { result: change.result } : {}),
        ...(change.currentStep !== undefined ? { current_step: change.currentStep } : {}),
        ...(change.blocker !== undefined ? { blocker: change.blocker } : {}),
      };
      return row;
    },
    readTaskStatus: async () => row!.status,
    queue: async ({ action }) => {
      const id = `a${++n}`;
      queued.set(id, { action });
      return { ok: true, id };
    },
    readAction: async (id) => {
      const result = await execute(id);
      const status = String(result.status);
      return {
        status: status === "done" || status === "human_required" ? status : "failed",
        summary: String(result.summary ?? ""),
        result,
        taskStatus: row!.status,
      };
    },
    decide: async () => undefined,
    cancelAction: async (id) => queued.delete(id),
    frame: async () =>
      ((await (await fetch(`http://127.0.0.1:${port}/frame`)).json()) as { frame: string | null })
        .frame,
    remember: async () => ({ ok: false, message: "Memory is off in this run." }),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    changed: async (id, ms) => {
      await Promise.race([execute(id), new Promise((resolve) => setTimeout(resolve, ms))]);
    },
  };
}

async function runA() {
  const controller = new AbortController();
  const out = await runJarvisTurn(
    {
      conversationId: task.id,
      history: [],
      text: task.text,
      memories: [],
      memoryEnabled: false,
      task: null,
      timeZone: "UTC",
      now: new Date(),
    },
    {
      signal: controller.signal,
      onText: () => undefined,
      onTask: () => undefined,
      onActivity: () => undefined,
      confirm: async () => {
        approvals += 1;
        return true;
      },
      takeOver: async () => {
        takeOvers += 1;
        return "stop";
      },
    },
    deps(),
  );
  return { answer: out.answer, status: out.task?.status ?? row?.status ?? null };
}

const started = performance.now();
let outcome: { answer: string; status: string | null } | { error: string };
try {
  outcome = arch === "F" ? await runEngineF(task.text) : await runA();
} catch (error) {
  outcome = { error: String(error).slice(0, 500) };
}
const wallMs = Math.round(performance.now() - started);
// A permit is used once: the pool keeps only what this run did not spend.
writeFileSync(permitsFile!, JSON.stringify(permits));
const stats = await (await fetch(`http://127.0.0.1:${port}/stats`)).json();
writeFileSync(
  outFile!,
  JSON.stringify(
    {
      arch,
      task: task.id,
      wallMs,
      modelMs: calls.reduce((sum, c) => sum + c.ms, 0),
      calls,
      approvals: approvals + (stats as { approvals: number }).approvals,
      takeOvers,
      device: stats,
      outcome,
      permitsLeft: permits.length,
      programs,
    },
    null,
    1,
  ),
);
console.log(JSON.stringify({ arch, task: task.id, wallMs, calls: calls.length, outcome }).slice(0, 600));
process.exit(0);

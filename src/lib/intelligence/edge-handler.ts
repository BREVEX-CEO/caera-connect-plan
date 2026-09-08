import type {
  IntelligenceEvent,
  IntelligencePermit,
  IntelligencePrivacyPolicy,
  NormalizedAttachment,
  NormalizedMessage,
  NormalizedToolCall,
  NormalizedToolDefinition,
  NormalizedUsage,
} from "./contract.ts";
import { DEFAULT_ONLINE_MODEL, isAllowedOnlineModel, type OnlineModelId } from "./online-models.ts";

const MAX_BODY_BYTES = 1_048_576;
const MAX_MESSAGES = 256;
const MAX_TOOLS = 128;
const PROVIDER_TIMEOUT_MS = 110_000;
const MAX_PROVIDER_ATTEMPTS = 3;

interface OnlineRequestBody {
  permit: IntelligencePermit;
  generationId: string;
  idempotencyKey: string;
  surface: IntelligencePermit["surface"];
  messages: NormalizedMessage[];
  tools: NormalizedToolDefinition[];
  attachments: NormalizedAttachment[];
  privacy: IntelligencePrivacyPolicy;
  projectId?: string;
  conversationId?: string;
  taskId?: string;
}

export interface OnlineHandlerDependencies {
  allowedOrigins: ReadonlySet<string>;
  providerReady: boolean;
  model?: string;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  verifyJwt(token: string): Promise<{ userId: string } | null>;
  claimPermit(input: {
    userId: string;
    permit: IntelligencePermit;
  }): Promise<{ ok: true } | { ok: false; reason: string }>;
  callProvider(input: {
    model: OnlineModelId;
    body: Record<string, unknown>;
    signal: AbortSignal;
  }): Promise<Response>;
}

function json(status: number, body: Record<string, unknown>, origin?: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(origin ? cors(origin) : {}),
    },
  });
}

function cors(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600",
  };
}

function bearer(request: Request): string | null {
  const value = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(value);
  return match?.[1] ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}

function parseBody(value: unknown): OnlineRequestBody | null {
  if (!isRecord(value) || !isRecord(value.permit) || !isRecord(value.privacy)) return null;
  const permit = value.permit;
  const privacy = value.privacy;
  if (
    !boundedString(permit.id, 200) ||
    !boundedString(permit.generationId, 200) ||
    !boundedString(permit.idempotencyKey, 200) ||
    permit.source !== "server" ||
    !boundedString(value.generationId, 200) ||
    !boundedString(value.idempotencyKey, 200) ||
    permit.generationId !== value.generationId ||
    permit.idempotencyKey !== value.idempotencyKey ||
    permit.surface !== value.surface ||
    typeof value.surface !== "string" ||
    ![
      "chat",
      "cowork",
      "code",
      "task",
      "automation",
      "background_agent",
      "voice",
      "artifact",
    ].includes(value.surface) ||
    !Array.isArray(value.messages) ||
    value.messages.length === 0 ||
    value.messages.length > MAX_MESSAGES ||
    !Array.isArray(value.tools) ||
    value.tools.length > MAX_TOOLS ||
    !Array.isArray(value.attachments) ||
    privacy.onlineInferenceConsented !== true ||
    privacy.sealed !== false ||
    !["browser_only", "pc_vault", "private_sync"].includes(String(privacy.storageMode))
  ) {
    return null;
  }
  if (
    value.messages.some(
      (message) =>
        !isRecord(message) ||
        !["system", "user", "assistant"].includes(String(message.role)) ||
        typeof message.content !== "string" ||
        message.content.length > 200_000,
    ) ||
    value.tools.some(
      (tool) =>
        !isRecord(tool) ||
        !boundedString(tool.name, 128) ||
        typeof tool.description !== "string" ||
        !isRecord(tool.inputSchema),
    )
  ) {
    return null;
  }
  return value as unknown as OnlineRequestBody;
}

function providerBody(body: OnlineRequestBody): Record<string, unknown> {
  const system = body.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  const contents = body.messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [
        { text: message.content },
        ...(message.images ?? []).map((data) => ({ inline_data: { mime_type: "image/*", data } })),
      ],
    }));
  return {
    contents,
    ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
    ...(body.tools.length
      ? {
          tools: [
            {
              function_declarations: body.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              })),
            },
          ],
        }
      : {}),
  };
}

function retryAfter(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get("retry-after"));
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1_000, 2_000);
  return Math.min(250 * 2 ** attempt, 2_000);
}

async function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

function sse(event: IntelligenceEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

function nextSseBoundary(buffer: string): { index: number; length: number } | null {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf < 0 && crlf < 0) return null;
  if (crlf >= 0 && (lf < 0 || crlf < lf)) return { index: crlf, length: 4 };
  return { index: lf, length: 2 };
}

function normalizeProviderChunk(
  value: unknown,
  backend: "gemini_online",
  toolIndex: { value: number },
): IntelligenceEvent[] {
  if (!isRecord(value)) return [];
  const candidates = Array.isArray(value.candidates) ? value.candidates : [];
  const first = isRecord(candidates[0]) ? candidates[0] : null;
  const content = first && isRecord(first.content) ? first.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  const events: IntelligenceEvent[] = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    if (typeof part.text === "string" && part.text.length > 0) {
      events.push({ type: "token", text: part.text });
    }
    if (isRecord(part.functionCall) && boundedString(part.functionCall.name, 128)) {
      const call: NormalizedToolCall = {
        id: `provider-tool-${toolIndex.value++}`,
        name: part.functionCall.name,
        arguments: isRecord(part.functionCall.args) ? part.functionCall.args : {},
      };
      events.push({ type: "tool_call", call });
    }
  }
  if (isRecord(value.usageMetadata)) {
    const usage: NormalizedUsage = {};
    if (typeof value.usageMetadata.promptTokenCount === "number") {
      usage.inputTokens = value.usageMetadata.promptTokenCount;
    }
    if (typeof value.usageMetadata.candidatesTokenCount === "number") {
      usage.outputTokens = value.usageMetadata.candidatesTokenCount;
    }
    events.push({ type: "usage", usage });
  }
  if (first && typeof first.finishReason === "string" && first.finishReason !== "STOP") {
    events.push({
      type: "refusal",
      code: "provider_failed",
      reason: "Online Intelligence stopped before completing the response.",
      retryable: false,
    });
  }
  void backend;
  return events;
}

function normalizedProviderStream(
  provider: Response,
  signal: AbortSignal,
  cleanup: () => void,
  cancelProvider: (reason: unknown) => void,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      const toolCalls: NormalizedToolCall[] = [];
      let usage: NormalizedUsage | undefined;
      const toolIndex = { value: 0 };
      try {
        if (!provider.body) throw new Error("Provider returned no stream.");
        controller.enqueue(sse({ type: "status", backend: "gemini_online", state: "generating" }));
        const reader = provider.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        while (true) {
          if (signal.aborted) throw signal.reason;
          const { value, done } = await reader.read();
          if (done) break;
          buffer += value;
          let boundary = nextSseBoundary(buffer);
          while (boundary) {
            const frame = buffer.slice(0, boundary.index);
            buffer = buffer.slice(boundary.index + boundary.length);
            for (const line of frame.split(/\r?\n/)) {
              if (!line.startsWith("data:")) continue;
              const raw = line.slice(5).trim();
              if (!raw || raw === "[DONE]") continue;
              for (const event of normalizeProviderChunk(
                JSON.parse(raw),
                "gemini_online",
                toolIndex,
              )) {
                if (event.type === "token") answer += event.text;
                if (event.type === "tool_call") toolCalls.push(event.call);
                if (event.type === "usage") usage = event.usage;
                controller.enqueue(sse(event));
              }
            }
            boundary = nextSseBoundary(buffer);
          }
        }
        if (buffer.trim()) throw new Error("Provider ended with an incomplete stream event.");
        if (!answer.trim() && toolCalls.length === 0) {
          controller.enqueue(
            sse({
              type: "refusal",
              code: "empty_response",
              reason: "Online Intelligence returned no response.",
              retryable: true,
            }),
          );
        } else {
          controller.enqueue(
            sse({
              type: "final",
              response: {
                text: answer,
                toolCalls,
                toolResults: [],
                backend: "gemini_online",
                ...(usage ? { usage } : {}),
                stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
              },
            }),
          );
        }
      } catch {
        controller.enqueue(
          sse({
            type: "refusal",
            code: signal.aborted ? "cancelled" : "provider_failed",
            reason: signal.aborted
              ? "Stopped by the user."
              : "Online Intelligence stopped before completing the response.",
            retryable: !signal.aborted && !answer.trim() && toolCalls.length === 0,
          }),
        );
      } finally {
        cleanup();
        controller.close();
      }
    },
    cancel(reason) {
      cancelProvider(reason);
      cleanup();
    },
  });
}

/** Portable authenticated handler used by the Supabase Edge entry point. */
export async function handleOnlineIntelligence(
  request: Request,
  deps: OnlineHandlerDependencies,
): Promise<Response> {
  const origin = request.headers.get("origin") ?? "";
  if (!origin || !deps.allowedOrigins.has(origin))
    return json(403, { error: "origin_not_allowed" });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json(415, { error: "content_type_required" }, origin);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(413, { error: "request_too_large" }, origin);
  }
  const token = bearer(request);
  if (!token) return json(401, { error: "authentication_required" }, origin);

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return json(413, { error: "request_too_large" }, origin);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }
  const body = parseBody(parsed);
  if (!body) return json(400, { error: "invalid_request" }, origin);
  const identity = await deps.verifyJwt(token);
  if (!identity) return json(401, { error: "authentication_required" }, origin);

  const configured = deps.model ?? DEFAULT_ONLINE_MODEL;
  if (!deps.providerReady || !isAllowedOnlineModel(configured)) {
    return json(503, { error: "online_unavailable" }, origin);
  }
  const claimed = await deps.claimPermit({ userId: identity.userId, permit: body.permit });
  if (!claimed.ok) return json(409, { error: "permit_refused", reason: claimed.reason }, origin);

  const controller = new AbortController();
  const abort = () => controller.abort(request.signal.reason);
  request.signal.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Provider timeout", "TimeoutError")),
    PROVIDER_TIMEOUT_MS,
  );
  const sleep = deps.sleep ?? defaultSleep;
  let handedOff = false;
  const cleanup = () => {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
  };
  try {
    let provider: Response | null = null;
    for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt += 1) {
      provider = await deps.callProvider({
        model: configured,
        body: providerBody(body),
        signal: controller.signal,
      });
      if (provider.ok) break;
      if (
        !(provider.status === 429 || provider.status >= 500) ||
        attempt === MAX_PROVIDER_ATTEMPTS - 1
      ) {
        return json(provider.status === 429 ? 429 : 503, { error: "provider_unavailable" }, origin);
      }
      await sleep(retryAfter(provider, attempt), controller.signal);
    }
    if (!provider?.ok) return json(503, { error: "provider_unavailable" }, origin);
    handedOff = true;
    return new Response(
      normalizedProviderStream(provider, controller.signal, cleanup, (reason) => {
        if (!controller.signal.aborted) controller.abort(reason);
      }),
      {
        status: 200,
        headers: {
          ...cors(origin),
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          Connection: "keep-alive",
        },
      },
    );
  } finally {
    // A successful response still has work in flight after this function
    // returns. Its stream owns cleanup; early refusals clean up here.
    if (!handedOff) cleanup();
  }
}

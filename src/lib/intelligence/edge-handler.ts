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
import {
  DEFAULT_ONLINE_MODEL,
  isAllowedOnlineModel,
  PROVIDER_KEY_SLOTS,
  type OnlineModelId,
  type ProviderKeySlot,
} from "./online-models.ts";
import {
  buildHealthRecord,
  type ErrorClass,
  type HealthRecord,
  type ProviderSlot,
} from "../telemetry/operation-health.ts";

/**
 * THE SURFACES THIS BOUNDARY WILL ACCEPT A REQUEST FROM.
 *
 * Restated here rather than imported because Deno runs this file from
 * `supabase/functions` and cannot follow the `@/` alias the product uses.
 * `surfaces-agree.test.ts` fails if this list and `GENERATION_SURFACES` ever
 * disagree, so the duplication cannot drift into a second opinion.
 *
 * It listed eight while Code, Tasks, Automations, background agents, Voice and
 * Artifacts were separate products. Six of those cannot emit a request any
 * more, and a value nothing can send is a value this validator was accepting
 * from anybody who asked.
 */
const ALLOWED_SURFACES: readonly string[] = ["chat", "cowork"];

/**
 * THE CEILING ON ONE REQUEST.
 *
 * It was one mebibyte, which was right while a request was only text and wrong
 * the moment an attachment could ride in one: a single photograph is several
 * times that. Twenty-four is generous enough for the attachment budget below
 * and small enough that an isolate cannot be exhausted by a flood of them.
 */
const MAX_BODY_BYTES = 24 * 1_048_576;
const MAX_MESSAGES = 256;
const MAX_TOOLS = 128;

/**
 * WHAT ONE USE MAY CARRY IN.
 *
 * `maxOutputTokens` bounds what a request can produce; these bound what it can
 * consume, which is the other half of the same promise. A person pays one use
 * whatever they attach, so without a ceiling the price of that one use is
 * whatever they can drag onto the composer.
 */
const MAX_ATTACHMENTS = 8;
/** Extracted text per attachment. Roughly fifty pages of prose. */
const MAX_ATTACHMENT_TEXT = 200_000;
/** Base64 image per attachment, before decoding. */
const MAX_ATTACHMENT_IMAGE = 7 * 1_048_576;
/**
 * THE CEILING ON WHAT ONE USE CAN COST.
 *
 * Everything going IN is already bounded — a megabyte of body, 256 messages,
 * 128 tools — but nothing bounded what came back. One successful request costs
 * the customer exactly one use whatever its length, so without a cap the price
 * of that one use to OCADE is whatever the provider feels like generating, and
 * a prompt that induces an endless answer is a bill rather than a bug.
 *
 * Generous enough that no ordinary answer meets it — a long technical reply
 * with code is a few thousand tokens — and low enough that a runaway one stops.
 */
const MAX_OUTPUT_TOKENS = 8_192;
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
  conversationId?: string;
  research?: boolean;
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
  /**
   * The slots that actually hold a key, in the order they may be tried.
   *
   * Supplied by the deployment rather than assumed, because two of the three
   * are OPTIONAL: a project with one key must not have failover invented for
   * it, and a project with three must not have the third ignored. Absent or
   * empty means the caller has not said, and one primary attempt is made.
   */
  providerSlots?: readonly ProviderKeySlot[];
  callProvider(input: {
    model: OnlineModelId;
    body: Record<string, unknown>;
    signal: AbortSignal;
    /** Which key to present. The handler decides; the caller holds the keys. */
    slot: ProviderKeySlot;
  }): Promise<Response>;
  /**
   * Where one structured health record per request goes.
   *
   * `PLAN.md` Phase 16 asks for Edge Function health "without secrets or
   * unnecessary content", and the record it receives is built by
   * `operation-health.ts`: enumerated values only, no prompt, no key, no user
   * id, no message. The deployment decides what to do with it -- the function
   * writes it to its own log -- so this module stays testable and holds no
   * opinion about a logging service.
   */
  observe?(record: HealthRecord): void;
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
    !ALLOWED_SURFACES.includes(value.surface) ||
    !Array.isArray(value.messages) ||
    value.messages.length === 0 ||
    value.messages.length > MAX_MESSAGES ||
    !Array.isArray(value.tools) ||
    value.tools.length > MAX_TOOLS ||
    !Array.isArray(value.attachments) ||
    value.attachments.length > MAX_ATTACHMENTS ||
    privacy.onlineInferenceConsented !== true ||
    privacy.sealed !== false
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
    ) ||
    /*
     * ATTACHMENTS ARE VALIDATED LIKE EVERYTHING ELSE, and until now they were
     * validated and then dropped: `parseBody` accepted the array and
     * `providerBody` never read it, so a file a person attached reached the
     * boundary and went nowhere. It carries one of text or an image, never
     * both and never neither.
     */
    value.attachments.some(
      (attachment) =>
        !isRecord(attachment) ||
        !boundedString(attachment.name, 256) ||
        !boundedString(attachment.mime, 128) ||
        typeof attachment.sizeBytes !== "number" ||
        attachment.sizeBytes < 0 ||
        (typeof attachment.text === "string") === (typeof attachment.image === "string") ||
        (typeof attachment.text === "string" && attachment.text.length > MAX_ATTACHMENT_TEXT) ||
        (typeof attachment.image === "string" &&
          (attachment.image.length > MAX_ATTACHMENT_IMAGE ||
            !attachment.mime.startsWith("image/"))),
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
      parts: [{ text: message.content }],
    }));

  /*
   * ATTACHMENTS RIDE WITH THE LAST QUESTION, AND THEY ARE LABELLED.
   *
   * The name goes in with the text so an answer can say which file a number
   * came from, and so a person can check it. An unlabelled blob of extracted
   * text is a citation nobody can follow.
   */
  const last = contents[contents.length - 1];
  if (last) {
    for (const attachment of body.attachments) {
      if (attachment.image) {
        last.parts.push({
          inline_data: { mime_type: attachment.mime, data: attachment.image },
        } as never);
      } else if (attachment.text) {
        last.parts.push({
          text: `\n\n--- attached file: ${attachment.name} ---\n${attachment.text}\n--- end of ${attachment.name} ---`,
        });
      }
    }
  }
  return {
    contents,
    generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    /*
     * RESEARCH IS THE PROVIDER'S OWN GROUNDED SEARCH.
     *
     * OCADE does not crawl. A browsing tool of its own would be a second Chat
     * engine, a fetch loop to bound, and a server-side request forgery surface
     * pointed at whatever a model asked for. Grounding keeps the one request,
     * the one permit and the one cancellation, and returns the sources with
     * the answer.
     *
     * It is mutually exclusive with declared functions, which is why this is an
     * either/or rather than both: OCADE sends no function declarations today,
     * and a request that carried both would be refused by the provider.
     */
    ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
    ...(body.research ? { tools: [{ google_search: {} }] } : {}),
    ...(!body.research && body.tools.length
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
  backend: "online",
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
  /*
   * SOURCES TRAVEL WITH THE ANSWER, NOT BESIDE IT.
   *
   * Grounded search returns where it looked. Appended to the text rather than
   * carried in a new event type, so Copy, export, persistence and the
   * transcript all keep them without learning a second shape — and a person
   * reading the answer later can still check it. Markdown links already render.
   */
  if (first && isRecord(first.groundingMetadata)) {
    const chunks = Array.isArray(first.groundingMetadata.groundingChunks)
      ? first.groundingMetadata.groundingChunks
      : [];
    const sources: string[] = [];
    for (const chunk of chunks) {
      if (!isRecord(chunk) || !isRecord(chunk.web)) continue;
      const uri = chunk.web.uri;
      const title = chunk.web.title;
      if (!boundedString(uri, 2_000) || !/^https:\/\//i.test(uri)) continue;
      const label = boundedString(title, 200) ? title : uri;
      const line = `- [${label.replace(/[[\]]/g, "")}](${uri})`;
      if (!sources.includes(line)) sources.push(line);
    }
    if (sources.length > 0) {
      events.push({ type: "token", text: `\n\nSources\n\n${sources.join("\n")}\n` });
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
  /*
   * A LENGTH LIMIT IS NOT A FAILURE.
   *
   * Every finish reason other than STOP used to become a refusal, which was
   * right while nothing bounded the answer. `MAX_OUTPUT_TOKENS` now stops a
   * runaway answer, and that stop arrives as `MAX_TOKENS` — so the old rule
   * would put an error under a complete-looking answer the person had just
   * read, and the client would treat a delivered answer as a failure. The
   * answer is real, it is charged, and it ends where it ends.
   */
  if (
    first &&
    typeof first.finishReason === "string" &&
    first.finishReason !== "STOP" &&
    first.finishReason !== "MAX_TOKENS"
  ) {
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
        controller.enqueue(sse({ type: "status", backend: "online", state: "generating" }));
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
              for (const event of normalizeProviderChunk(JSON.parse(raw), "online", toolIndex)) {
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
                backend: "online",
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
/** How a refusal reads to an operator, from the status it answered with. */
function errorClassForStatus(status: number): ErrorClass {
  if (status < 400) return "none";
  if (status === 401) return "auth";
  if (status === 403) return "permission";
  if (status === 429) return "quota";
  if (status === 400 || status === 413 || status === 415 || status === 422) return "validation";
  if (status === 405) return "validation";
  if (status === 503 || status === 502) return "upstream";
  if (status === 504) return "timeout";
  return "internal";
}

/**
 * ONE STRUCTURED HEALTH RECORD PER REQUEST -- PLAN.md Phase 16.
 *
 * Wrapping the handler rather than instrumenting each `return` is deliberate:
 * there are fourteen ways out of this function and a per-return call site is a
 * per-return chance to forget one. Whatever it answers, exactly one record is
 * emitted.
 *
 * THE LATENCY IS TIME TO THE ANSWER, not time to the last token. A streamed
 * response is handed off and finishes long after this returns; "how long
 * before the provider started answering" is the number that tells an operator
 * whether the path is healthy, and the only one this function can honestly
 * know.
 */
export async function handleOnlineIntelligence(
  request: Request,
  deps: OnlineHandlerDependencies,
): Promise<Response> {
  const clock = deps.now ?? (() => Date.now());
  const startedAt = clock();
  // Zero until a provider is actually called: a request refused for its origin
  // or its token never reached one, and reporting an attempt it never made
  // would put phantom provider load in the numbers.
  const attempted: ProviderAttempt = { slot: "none", attempts: 0 };
  const response = await runOnlineIntelligence(request, deps, attempted);
  deps.observe?.(
    buildHealthRecord({
      component: "edge_function",
      operation: "generation",
      outcome:
        response.status < 400
          ? "succeeded"
          : response.status === 401 || response.status === 403
            ? "refused"
            : "failed",
      errorClass: errorClassForStatus(response.status),
      durationMs: clock() - startedAt,
      providerSlot: attempted.slot,
      attempts: attempted.attempts,
    }),
  );
  return response;
}

/** Which slot ended up serving, and how many provider calls it took. */
interface ProviderAttempt {
  slot: ProviderSlot;
  attempts: number;
}

async function runOnlineIntelligence(
  request: Request,
  deps: OnlineHandlerDependencies,
  attempted: ProviderAttempt,
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
    /*
     * PRIMARY FIRST, AND ONLY FOR THE RIGHT REASONS.
     *
     * `docs/TRD.md` allows failover for "key-local authentication/health or
     * pre-output provider/transport failure" and forbids it for quota:
     * "Project/provider-wide quota must not trigger key rotation to evade
     * quota." Those are different failures that look similar from here, so
     * they are separated by status rather than lumped into "the call did not
     * work":
     *
     *   401 / 403  — THIS KEY is refused. Nothing about the next one is
     *                implied, so move on immediately; retrying a revoked key
     *                is only a delay.
     *   5xx, throw — the provider or the transport failed. The next key may
     *                reach a healthier path, so retry this slot and then move
     *                on.
     *   429        — quota, and quota belongs to the PROJECT. Every key would
     *                meet the same wall, and trying them anyway is exactly the
     *                evasion the plan names. Retry this slot, then answer 429
     *                honestly.
     *   anything   — a real refusal about this request. Reported as-is.
     *   else
     *
     * ALL OF THIS IS PRE-OUTPUT BY CONSTRUCTION. The loop ends the moment a
     * response is ok; the stream is handed off after it, and nothing here runs
     * again once a single token has reached the person.
     */
    const slots: readonly ProviderKeySlot[] =
      deps.providerSlots && deps.providerSlots.length > 0
        ? deps.providerSlots
        : [PROVIDER_KEY_SLOTS[0]];
    let provider: Response | null = null;
    let quotaExhausted = false;

    outer: for (const slot of slots) {
      for (let attempt = 0; attempt < MAX_PROVIDER_ATTEMPTS; attempt += 1) {
        let response: Response;
        try {
          attempted.slot = slot;
          attempted.attempts += 1;
          response = await deps.callProvider({
            model: configured,
            body: providerBody(body),
            signal: controller.signal,
            slot,
          });
        } catch (cause) {
          /*
           * A THROW IS A TRANSPORT FAILURE OF THIS SLOT — unless we asked for
           * it. An abort is the person leaving or the timeout firing, and
           * trying the next key after that would be spending their allowance
           * on a request nobody is waiting for.
           */
          if (controller.signal.aborted) throw cause;
          if (attempt === MAX_PROVIDER_ATTEMPTS - 1) continue outer;
          await sleep(retryAfter(new Response(null, { status: 503 }), attempt), controller.signal);
          continue;
        }

        provider = response;
        if (response.ok) break outer;

        /*
         * A REFUSED ATTEMPT'S BODY IS STILL AN OPEN STREAM.
         *
         * Nothing reads it — only its status decides what happens next — and a
         * body that is neither read nor cancelled holds its connection until the
         * runtime collects it. Three attempts across three keys is nine of them
         * per request, and a provider outage is exactly when every request takes
         * all nine.
         */
        void response.body?.cancel().catch(() => undefined);

        if (response.status === 401 || response.status === 403) continue outer;

        if (response.status === 429) {
          quotaExhausted = true;
          if (attempt === MAX_PROVIDER_ATTEMPTS - 1) break outer;
          await sleep(retryAfter(response, attempt), controller.signal);
          continue;
        }

        if (response.status >= 500) {
          if (attempt === MAX_PROVIDER_ATTEMPTS - 1) continue outer;
          await sleep(retryAfter(response, attempt), controller.signal);
          continue;
        }

        return json(503, { error: "provider_unavailable" }, origin);
      }
    }

    if (!provider?.ok) {
      return json(quotaExhausted ? 429 : 503, { error: "provider_unavailable" }, origin);
    }
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

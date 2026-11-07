import { workersAiBody, workersAiResponse } from "./workers-ai.ts";
import { readBoundedRequestText } from "../read-bounded-request.ts";
import { HIGH_WARNING_VERSION, type IntelligenceQuality } from "./quality.ts";
import type {
  IntelligenceEvent,
  IntelligencePermit,
  IntelligencePrivacyPolicy,
  NormalizedAttachment,
  NormalizedAssistantPart,
  NormalizedMessage,
  NormalizedToolCall,
  NormalizedToolDefinition,
  NormalizedUsage,
} from "./contract.ts";
import { SERVICE_USER_HEADER, sseData } from "./contract.ts";
import {
  HIGH_ONLINE_MODEL,
  PROVIDER_KEY_SLOTS,
  modelRoute,
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
 * `supabase/functions` and cannot follow the `@/` alias the product uses. Keep
 * it equal to `GENERATION_SURFACES`.
 */
const ALLOWED_SURFACES: readonly string[] = ["chat", "jarvis"];

/**
 * THE CEILING ON ONE REQUEST.
 *
 * It was one mebibyte, which was right while a request was only text and wrong
 * the moment an attachment could ride in one: a single photograph is several
 * times that. Twenty-four is generous enough for the attachment budget below
 * and enforced while reading, including when Content-Length is absent or false.
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
 * Everything going IN is already bounded — 24 mebibytes of body, 256 messages,
 * 128 tools — but nothing bounded what came back. One successful request costs
 * the customer exactly one use whatever its length, so without a cap the price
 * of that one use to OCADE is whatever the provider feels like generating, and
 * a prompt that induces an endless answer is a bill rather than a bug.
 *
 * Generous enough that no ordinary answer meets it — a long technical reply
 * with code is a few thousand tokens — and low enough that a runaway one stops.
 */
const MAX_OUTPUT_TOKENS = 16_384;
/**
 * How hard the model thinks before answering. Thinking counts against the output cap
 * above, which is why the cap is twice an ordinary answer. "medium": JARVIS turns are
 * planning steps that need it; "minimal" is refused by the pinned model.
 */
const THINKING_LEVEL = "medium";
/** A call id OCADE made because the provider gave none: never sent back as the provider's. */
const LOCAL_CALL_ID = "provider-tool-";
/** Google's documented value for a call whose real signature does not exist (thought-signatures docs). */
const SKIP_SIGNATURE = "skip_thought_signature_validator";
/**
 * One turn's whole deadline, kept under the Edge Function's 150 s wall clock. Larger models
 * (the owner's comparison, plan.md §19.4) take tens of seconds per planning turn.
 */
const PROVIDER_TIMEOUT_MS = 140_000;
/**
 * How long one key may take to START answering before the next key is tried. Measured
 * 7 Nov 2026: gemma-4-31b-it often needs more than 25 s to its first byte on a full planning
 * prompt, so 25 s failed every key over and spent the turn's deadline on retries.
 */
const ATTEMPT_TIMEOUT_MS = 60_000;
/** Finish reasons that mean the content itself was refused: never a capacity problem. */
const BLOCKED_FINISH = new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]);
/**
 * Upstream requests for ONE boundary request, across every key: the keys are credential
 * redundancy, not more quota, so a failover spends from the same three.
 */
const MAX_PROVIDER_ATTEMPTS = 3;
/** A provider wait longer than this is not slept here: the caller is told when to ask again. */
const MAX_INLINE_WAIT_MS = 2_000;

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
  quality?: IntelligenceQuality;
  highModeAcknowledged?: string;
}

export interface OnlineHandlerDependencies {
  allowedOrigins: ReadonlySet<string>;
  providerReady: boolean;
  /** Must verify included-only eligibility before every High request. Unknown is unavailable. */
  highAvailable?(signal: AbortSignal): Promise<boolean>;
  model?: string;
  now?: () => number;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  verifyJwt(token: string): Promise<{ userId: string } | null>;
  /**
   * OCADE's own server calling for a person (the planning loop a computer
   * carries on with after OCADE was closed). Supplied only by the function
   * deployed for that; the browser's function has no such door. The permit is
   * still claimed for that person, so this cannot spend what the gate did not grant.
   */
  verifyService?(request: Request): Promise<{ userId: string } | null>;
  /**
   * Whether this account has agreed that what it sends may be used by the model's
   * provider (the free tier's terms, 20261013091000). Nothing is sent without it.
   */
  consented?(userId: string): Promise<boolean>;
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
  /**
   * When each model's project quota returns, as the provider last named it (ms since epoch).
   * The deployment holds one for its instance, so a request inside a named wait is answered
   * at once: no permit claimed, no provider call spent against a quota already known spent.
   */
  quotaReturnsAt?: Map<OnlineModelId, number>;
  /**
   * A limit the provider named when it refused for quota (its QuotaFailure detail): the only
   * place OCADE learns a project's real RPM, TPM or RPD. Nothing here is assumed or hardcoded.
   */
  discoveredLimit?(limit: DiscoveredLimit): void;
  /**
   * Why a provider attempt or stream did not give a usable turn, as identifiers only (HTTP status,
   * finish reason, timeout kind): the operator's diagnosis, never a prompt, key or answer.
   */
  providerIssue?(issue: { model: string; slot: string; kind: string }): void;
  /** Models whose provider refused the request's thinking setting: asked again without one. */
  withoutThinking?: Set<string>;
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
  /**
   * Charge the permit the moment an answer was delivered. The server decides,
   * not the browser: a client that "releases" after reading an answer would
   * otherwise use OCADE for free.
   */
  finalizePermit?(input: { userId: string; permit: IntelligencePermit }): Promise<void>;
  /** Give the permit back when the claimed transport ended without any output. */
  releasePermit?(input: { userId: string; permit: IntelligencePermit }): Promise<void>;
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

/** Whether `presented` is one of OCADE's own server keys, compared by digest in constant time. */
export async function isServiceKey(
  presented: string | null,
  keys: readonly string[],
): Promise<boolean> {
  if (!presented) return false;
  const digest = async (value: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const given = await digest(presented);
  let matched = false;
  for (const key of keys) {
    if (!key) continue;
    const known = await digest(key);
    let difference = 0;
    for (let i = 0; i < known.length; i += 1) difference |= known[i]! ^ given[i]!;
    matched = difference === 0 || matched;
  }
  return matched;
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

/** An assistant turn's native calls: what the provider returned, bounded, nothing more. */
function validCalls(message: Record<string, unknown>): boolean {
  const calls = message.toolCalls;
  return (
    message.role === "assistant" &&
    Array.isArray(calls) &&
    calls.length > 0 &&
    calls.length <= 32 &&
    calls.every(
      (call) =>
        isRecord(call) &&
        boundedString(call.id, 200) &&
        boundedString(call.name, 128) &&
        isRecord(call.arguments) &&
        (call.signature === undefined || boundedString(call.signature, 100_000)),
    )
  );
}

/** Continuation is bounded context, never an arbitrary provider payload or tool authority. */
function validParts(message: Record<string, unknown>): boolean {
  const parts = message.parts;
  if (
    message.role !== "assistant" ||
    !Array.isArray(parts) ||
    !parts.length ||
    parts.length > 16_384
  )
    return false;
  let textSize = 0;
  let signatureSize = 0;
  const ids: string[] = [];
  for (const part of parts) {
    if (!isRecord(part)) return false;
    if ("callId" in part) {
      if (Object.keys(part).length !== 1 || !boundedString(part.callId, 200)) return false;
      ids.push(part.callId);
    } else {
      if (
        Object.keys(part).some((key) => !["text", "signature", "thought"].includes(key)) ||
        typeof part.text !== "string" ||
        (part.thought !== undefined && typeof part.thought !== "boolean") ||
        (part.signature !== undefined && !boundedString(part.signature, 100_000))
      )
        return false;
      textSize += part.text.length;
      signatureSize += typeof part.signature === "string" ? part.signature.length : 0;
    }
  }
  const calls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
  return (
    textSize <= 200_000 &&
    signatureSize <= 1_000_000 &&
    ids.length === calls.length &&
    new Set(ids).size === ids.length &&
    ids.every((id, index) => isRecord(calls[index]) && id === calls[index].id)
  );
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
    privacy.sealed !== false ||
    (value.quality !== undefined && value.quality !== "standard" && value.quality !== "high") ||
    (value.quality === "high" && value.highModeAcknowledged !== HIGH_WARNING_VERSION)
  ) {
    return null;
  }
  if (
    value.messages.some(
      (message) =>
        !isRecord(message) ||
        !["system", "user", "assistant"].includes(String(message.role)) ||
        typeof message.content !== "string" ||
        message.content.length > 200_000 ||
        (message.toolCalls !== undefined && !validCalls(message)) ||
        (message.parts !== undefined && !validParts(message)) ||
        (message.toolResult !== undefined &&
          (message.role !== "user" ||
            !isRecord(message.toolResult) ||
            !boundedString(message.toolResult.callId, 200) ||
            !boundedString(message.toolResult.name, 128))),
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

function providerBody(body: OnlineRequestBody, thinking = true): Record<string, unknown> {
  const system = body.messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");
  /*
   * NATIVE CALLS GO BACK AS THE PROVIDER SENT THEM (PLAN Phase 04 V05).
   *
   * A call travels as a functionCall part with its own id and opaque thought
   * signature, and its result as a functionResponse, rather than as prose
   * ("Called …", "Result of …") the model has to reread and may imitate. The
   * answers to one turn's parallel calls share one content, in call order. A
   * call that came back without a signature (written as text, or rebuilt from
   * the task's saved steps) carries the provider's documented skip value on
   * the first call of its turn, so a rebuilt history is still accepted.
   */
  type Part = Record<string, unknown>;
  const contents: { role: string; parts: Part[] }[] = [];
  const nativeId = (id: string) => (id.startsWith(LOCAL_CALL_ID) ? {} : { id });
  const callPart = (call: NormalizedToolCall, signature = call.signature): Part => ({
    functionCall: { ...nativeId(call.id), name: call.name, args: call.arguments },
    ...(signature ? { thoughtSignature: signature } : {}),
  });
  for (const message of body.messages) {
    if (message.role === "system") continue;
    if (message.parts) {
      contents.push({
        role: "model",
        parts: message.parts.map((part) => {
          if ("callId" in part) {
            const call = message.toolCalls!.find((call) => call.id === part.callId)!;
            const first = message.parts!.find((p) => "callId" in p) === part;
            return callPart(call, call.signature ?? (first ? SKIP_SIGNATURE : undefined));
          }
          return {
            text: part.text,
            ...(part.signature ? { thoughtSignature: part.signature } : {}),
            ...(part.thought !== undefined ? { thought: part.thought } : {}),
          };
        }),
      });
      continue;
    }
    if (message.toolResult) {
      const part = {
        functionResponse: {
          ...nativeId(message.toolResult.callId),
          name: message.toolResult.name,
          response: { result: message.content },
        },
      };
      const previous = contents.at(-1);
      if (previous?.parts.every((p) => "functionResponse" in p)) previous.parts.push(part);
      else contents.push({ role: "user", parts: [part] });
      continue;
    }
    const parts: Part[] = message.toolCalls && !message.content ? [] : [{ text: message.content }];
    message.toolCalls?.forEach((call, index) => {
      const signature = call.signature ?? (index === 0 ? SKIP_SIGNATURE : undefined);
      parts.push(callPart(call, signature));
    });
    contents.push({ role: message.role === "assistant" ? "model" : "user", parts });
  }

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
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      ...(thinking ? { thinkingConfig: { thinkingLevel: THINKING_LEVEL } } : {}),
    },
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

/**
 * How long the provider says to wait, in ms, or undefined when it does not say: Retry-After as
 * seconds (fractions kept) or an HTTP date, else the body's `retryDelay` ("12.5s").
 */
export function providerWait(
  response: Response,
  detail = "",
  now = Date.now(),
): number | undefined {
  const header = response.headers.get("retry-after")?.trim();
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1_000;
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, at - now);
  }
  const body = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(detail)?.[1];
  return body === undefined ? undefined : Number(body) * 1_000;
}

/** One limit a quota refusal named, with the project (key slot) and model it belongs to. */
export interface DiscoveredLimit {
  slot: ProviderKeySlot;
  model: string;
  /** The provider's quota id, e.g. "GenerateRequestsPerDayPerProjectPerModel-FreeTier". */
  quotaId: string;
  /** The limit's value as the provider stated it; absent when it did not say. */
  value?: number;
  metric?: string;
}

/**
 * What a 429 body says about the quota it hit: every QuotaFailure violation, and, when one of
 * them is a per-day quota, how long until it resets (midnight Pacific, the provider's documented
 * reset). A per-day quota is never retried within the day on a short `retryDelay`.
 */
export function providerQuota(
  detail: string,
  now = Date.now(),
): { limits: Omit<DiscoveredLimit, "slot" | "model">[]; dailyResetMs?: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(detail);
  } catch {
    return { limits: [] };
  }
  const error = isRecord(parsed) && isRecord(parsed.error) ? parsed.error : null;
  const details = error && Array.isArray(error.details) ? error.details : [];
  const limits: Omit<DiscoveredLimit, "slot" | "model">[] = [];
  for (const entry of details) {
    if (!isRecord(entry) || !Array.isArray(entry.violations)) continue;
    for (const violation of entry.violations) {
      // Identifiers only, so a limit can be logged: no provider prose and no request content.
      const identifier = (value: unknown) =>
        boundedString(value, 200) && /^[\w./-]+$/.test(value) ? value : undefined;
      if (!isRecord(violation) || !identifier(violation.quotaId)) continue;
      const value = Number(violation.quotaValue);
      limits.push({
        quotaId: violation.quotaId as string,
        ...(Number.isFinite(value) && value >= 0 ? { value } : {}),
        ...(identifier(violation.quotaMetric) ? { metric: violation.quotaMetric as string } : {}),
      });
    }
  }
  const daily = limits.some((limit) => /PerDay/i.test(limit.quotaId));
  return { limits, ...(daily ? { dailyResetMs: untilPacificMidnight(now) } : {}) };
}

/**
 * Milliseconds until the next midnight in America/Los_Angeles.
 * ponytail: uses the current UTC offset, so on a DST-change night it can be an hour off;
 * the next refusal corrects it.
 */
function untilPacificMidnight(now: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(new Date(now))
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  const wall = Date.UTC(
    parts.year!,
    parts.month! - 1,
    parts.day!,
    parts.hour!,
    parts.minute!,
    parts.second!,
  );
  const offset = wall - (now - (now % 1_000));
  return Date.UTC(parts.year!, parts.month! - 1, parts.day! + 1) - offset - now;
}

/** Without a provider instruction: 250 ms, then 500, never more than 2 s. */
const backoff = (attempt: number) => Math.min(250 * 2 ** attempt, MAX_INLINE_WAIT_MS);

async function defaultSleep(ms: number, signal: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop); // a finished wait leaves no listener behind
      resolve();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}

function sse(event: IntelligenceEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

function normalizeProviderChunk(
  value: unknown,
  backend: "online",
  toolIndex: { value: number; textSize: number; signatureSize: number },
  assistantParts: NormalizedAssistantPart[],
): IntelligenceEvent[] {
  if (!isRecord(value)) return [];
  const candidates = Array.isArray(value.candidates) ? value.candidates : [];
  const first = isRecord(candidates[0]) ? candidates[0] : null;
  const content = first && isRecord(first.content) ? first.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  const events: IntelligenceEvent[] = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    if (
      (part.thoughtSignature !== undefined && !boundedString(part.thoughtSignature, 100_000)) ||
      (part.thought !== undefined && typeof part.thought !== "boolean")
    ) {
      throw new Error("Provider returned invalid continuation metadata.");
    }
    toolIndex.textSize += typeof part.text === "string" ? part.text.length : 0;
    toolIndex.signatureSize +=
      typeof part.thoughtSignature === "string" ? part.thoughtSignature.length : 0;
    if (
      toolIndex.textSize > 200_000 ||
      toolIndex.signatureSize > 1_000_000 ||
      assistantParts.length >= 16_384
    ) {
      throw new Error("Provider returned excessive assistant parts.");
    }
    if (typeof part.text === "string") {
      assistantParts.push({
        text: part.text,
        ...(part.thoughtSignature !== undefined
          ? { signature: part.thoughtSignature as string }
          : {}),
        ...(part.thought !== undefined ? { thought: part.thought as boolean } : {}),
      });
      if (part.text.length > 0 && part.thought !== true)
        events.push({ type: "token", text: part.text });
    }
    if (isRecord(part.functionCall) && boundedString(part.functionCall.name, 128)) {
      const call: NormalizedToolCall = {
        id: boundedString(part.functionCall.id, 200)
          ? part.functionCall.id
          : `${LOCAL_CALL_ID}${toolIndex.value++}`,
        name: part.functionCall.name,
        arguments: isRecord(part.functionCall.args) ? part.functionCall.args : {},
        ...(boundedString(part.thoughtSignature, 100_000)
          ? { signature: part.thoughtSignature }
          : {}),
      };
      assistantParts.push({ callId: call.id });
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
  const blockedPrompt =
    isRecord(value.promptFeedback) && typeof value.promptFeedback.blockReason === "string";
  if (
    blockedPrompt ||
    (first && typeof first.finishReason === "string" && BLOCKED_FINISH.has(first.finishReason))
  ) {
    // The request itself was refused. Retrying it, or treating it as an outage, never helps.
    events.push({
      type: "refusal",
      code: "content_blocked",
      reason: "OCADE can't help with that request. Try asking in a different way.",
      retryable: false,
    });
  } else if (
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
  surface: IntelligencePermit["surface"],
  signal: AbortSignal,
  cleanup: () => void,
  cancelProvider: (reason: unknown) => void,
  delivered: (toolCalls: NormalizedToolCall[]) => Promise<void> = async () => undefined,
  undelivered: () => Promise<void> = async () => undefined,
  report: (kind: string) => void = () => undefined,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      let refused = false;
      let finishReason: string | undefined;
      let completed = false;
      const toolCalls: NormalizedToolCall[] = [];
      const parts: NormalizedAssistantPart[] = [];
      let usage: NormalizedUsage | undefined;
      const toolIndex = { value: 0, textSize: 0, signatureSize: 0 };
      /*
       * THE CLAIMED PERMIT IS SETTLED HERE, however the stream ends.
       * Chat retains its partial-answer policy. JARVIS must complete the provider
       * turn before settling: partial planning text is not a completed task or answer.
       * The browser can no longer release a permit once claimed.
       */
      let settled = false;
      const settle = async () => {
        if (settled) return;
        settled = true;
        const anything = completed || (surface === "chat" && answer.trim() !== "");
        await (anything ? delivered(completed ? toolCalls : []) : undelivered()).catch(
          () => undefined,
        );
      };
      try {
        if (!provider.body) throw new Error("Provider returned no stream.");
        controller.enqueue(sse({ type: "status", backend: "online", state: "generating" }));
        for await (const raw of sseData(
          provider.body,
          "Provider ended with an incomplete stream event.",
          signal,
        )) {
          const chunk: unknown = JSON.parse(raw);
          const candidate =
            isRecord(chunk) && Array.isArray(chunk.candidates) ? chunk.candidates[0] : null;
          if (
            finishReason &&
            isRecord(candidate) &&
            isRecord(candidate.content) &&
            Array.isArray(candidate.content.parts) &&
            candidate.content.parts.length
          )
            throw new Error("Provider sent content after its terminal result.");
          if (isRecord(candidate) && typeof candidate.finishReason === "string") {
            finishReason = candidate.finishReason;
          }
          for (const event of normalizeProviderChunk(chunk, "online", toolIndex, parts)) {
            // A call is held until the turn ends complete: a turn cut short or refused
            // after a call must never hand that call to anything that would act on it.
            if (event.type === "tool_call") {
              toolCalls.push(event.call);
              continue;
            }
            if (event.type === "token") answer += event.text;
            if (event.type === "usage") usage = event.usage;
            if (event.type === "refusal") {
              refused = true;
              report(`refusal_${event.code}_${finishReason ?? "none"}`);
            }
            controller.enqueue(sse(event));
          }
        }
        if (refused) {
          // Refused with its real reason already sent: no final answer, and no call is released.
        } else if (
          finishReason !== "STOP" &&
          !(surface === "chat" && finishReason === "MAX_TOKENS" && toolCalls.length === 0)
        ) {
          // EOF can land between complete SSE frames. Only the provider's terminal result
          // closes the turn. JARVIS can also interpret exact tool text, so even a
          // text-only token-capped turn must never be released as a completed reply.
          report(`finish_${finishReason ?? "none"}`);
          throw new Error("Provider ended before completing the turn.");
        } else if (!answer.trim() && toolCalls.length === 0) {
          controller.enqueue(
            sse({
              type: "refusal",
              code: "empty_response",
              reason: "Online Intelligence returned no response.",
              retryable: true,
            }),
          );
        } else {
          if (
            !validParts({ role: "assistant", parts, toolCalls }) ||
            (toolCalls.length && !validCalls({ role: "assistant", toolCalls }))
          ) {
            throw new Error("Provider returned invalid assistant parts.");
          }
          signal.throwIfAborted();
          for (const call of toolCalls) controller.enqueue(sse({ type: "tool_call", call }));
          completed = true;
          // Charged by the server before the person is told it is complete.
          await settle();
          controller.enqueue(
            sse({
              type: "final",
              response: {
                text: answer,
                toolCalls,
                parts,
                toolResults: [],
                backend: "online",
                ...(usage ? { usage } : {}),
                stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
              },
            }),
          );
        }
      } catch {
        report(signal.aborted ? "stream_aborted" : "stream_error");
        const timedOut =
          signal.reason instanceof DOMException && signal.reason.name === "TimeoutError";
        controller.enqueue(
          sse({
            type: "refusal",
            code: signal.aborted && !timedOut ? "cancelled" : "provider_failed",
            reason:
              signal.aborted && !timedOut
                ? "Stopped by the user."
                : "Online Intelligence stopped before completing the response.",
            retryable: !signal.aborted && !answer.trim() && toolCalls.length === 0,
          }),
        );
      } finally {
        // First: a stream the person already left throws on enqueue and close.
        await settle();
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
  // A browser's CORS preflight is not a generation: counted, it read as a success served by no slot.
  if (request.method === "OPTIONS") return response;
  // A handed-off stream is only the start of an answer: its own end records how it finished.
  const streaming = (response.headers.get("content-type") ?? "").startsWith("text/event-stream");
  deps.observe?.(
    buildHealthRecord({
      component: "edge_function",
      operation: streaming ? "generation_start" : "generation",
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
  // A server-to-server call has no browser behind it: no origin, no CORS, and
  // it proves itself to `verifyService` below instead of with a session.
  const service = Boolean(deps.verifyService) && request.headers.has(SERVICE_USER_HEADER);
  const origin = service ? "" : (request.headers.get("origin") ?? "");
  if (!service) {
    if (!origin || !deps.allowedOrigins.has(origin))
      return json(403, { error: "origin_not_allowed" });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cors(origin) });
  }
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json(415, { error: "content_type_required" }, origin);
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json(413, { error: "request_too_large" }, origin);
  }
  const token = service ? null : bearer(request);
  if (!service && !token) return json(401, { error: "authentication_required" }, origin);

  const text = await readBoundedRequestText(request, MAX_BODY_BYTES);
  if (text === null) {
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
  const identity = service ? await deps.verifyService!(request) : await deps.verifyJwt(token!);
  if (!identity) return json(401, { error: "authentication_required" }, origin);
  // The server door exists for JARVIS work on a computer, and for nothing else.
  if (service && body.surface !== "jarvis") return json(400, { error: "invalid_request" });

  const high = body.quality === "high";
  // The server's own route (`GEMINI_MODEL`), never the request's: one model, or "a,b" in order.
  const route: readonly OnlineModelId[] | undefined = high
    ? [HIGH_ONLINE_MODEL]
    : modelRoute(deps.model);
  if (high && body.research) return json(403, { error: "research_unavailable" }, origin);
  if (high && !(await deps.highAvailable?.(request.signal).catch(() => false))) {
    return json(503, { error: "high_unavailable" }, origin);
  }
  if (!high && (!deps.providerReady || !route)) {
    return json(503, { error: "online_unavailable" }, origin);
  }
  // Before anything is claimed or sent: the account's own agreement, read on the server.
  if (deps.consented && !(await deps.consented(identity.userId))) {
    return json(403, { error: "online_not_consented" }, origin);
  }
  // A model whose quota the provider named as spent is not asked until it returns.
  const spentFor = (model: OnlineModelId) =>
    (deps.quotaReturnsAt?.get(model) ?? 0) - (deps.now ?? Date.now)();
  const open = route!.filter((model) => spentFor(model) <= 0);
  if (!open.length) {
    const retryAfterSeconds = Math.ceil(Math.min(...route!.map(spentFor)) / 1_000);
    return json(429, { error: "provider_unavailable", retryAfterSeconds }, origin);
  }
  const claimed = await deps.claimPermit({ userId: identity.userId, permit: body.permit });
  if (!claimed.ok) return json(409, { error: "permit_refused", reason: claimed.reason }, origin);

  const controller = new AbortController();
  const abort = () => controller.abort(request.signal.reason);
  request.signal.addEventListener("abort", abort, { once: true });
  // Stopped while the allowance was being claimed: no provider is called, the claim is released.
  if (request.signal.aborted) abort();
  const begun = (deps.now ?? (() => Date.now()))();
  const ended = (outcome: "succeeded" | "failed") =>
    deps.observe?.(
      buildHealthRecord({
        component: "edge_function",
        operation: "generation",
        outcome,
        errorClass:
          outcome === "succeeded" ? "none" : controller.signal.aborted ? "cancelled" : "upstream",
        durationMs: (deps.now ?? (() => Date.now()))() - begun,
        providerSlot: attempted.slot,
        attempts: attempted.attempts,
      }),
    );
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
     * `docs/ARCHITECTURE.md` allows failover for "key-local authentication/health or
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
    const slots: readonly ProviderKeySlot[] = high
      ? ["primary"]
      : deps.providerSlots && deps.providerSlots.length > 0
        ? deps.providerSlots
        : [PROVIDER_KEY_SLOTS[0]];
    let provider: Response | null = null;
    let quotaExhausted = false;
    let capacityReturnsIn = 0;
    /** How the last model that could not answer ended, when that was not capacity. */
    let refusedAs: "provider_rejected_request" | "provider_unavailable" | undefined;
    const served = { model: "", slot: "" };
    controller.signal.throwIfAborted(); // stopped during the claim: no provider is called

    /*
     * THE ROUTE IS TRIED IN ORDER, AND ONLY BEFORE ANY OUTPUT.
     * Each model has its own quota and its own attempt budget; the next model is asked only
     * when this one cannot answer this turn. A model is never switched once a stream begins.
     */
    models: for (const configured of open) {
      provider = null;
      refusedAs = undefined;
      let thinking = !deps.withoutThinking?.has(configured);
      let modelAttempts = 0;
      let slotIndex = 0;
      while (modelAttempts < MAX_PROVIDER_ATTEMPTS && slotIndex < slots.length) {
        const slot = slots[slotIndex]!;
        const attempt = modelAttempts;
        const last = attempt === MAX_PROVIDER_ATTEMPTS - 1;
        let response: Response;
        /*
         * One key that hangs must not hold the whole request: it has its own
         * deadline to START answering. Only to start: the timer is cleared the
         * moment headers arrive, so a long answer is never cut off by it.
         */
        const hung = new AbortController();
        const attemptTimer = setTimeout(
          () => hung.abort(new DOMException("Provider key timeout", "TimeoutError")),
          ATTEMPT_TIMEOUT_MS,
        );
        try {
          attempted.slot = slot;
          attempted.attempts += 1; // counted before the request, so a failed transport counts too
          modelAttempts += 1;
          response = await deps.callProvider({
            model: configured,
            body: high ? workersAiBody(body, MAX_OUTPUT_TOKENS) : providerBody(body, thinking),
            signal: AbortSignal.any([controller.signal, hung.signal]),
            slot,
          });
        } catch (cause) {
          /*
           * A THROW IS A TRANSPORT FAILURE OF THIS SLOT — unless we asked for
           * it. An abort is the person leaving or the whole request's deadline,
           * and trying the next key after that would be spending their
           * allowance on a request nobody is waiting for. A key that hung or
           * could not be reached is failed over, within the same budget.
           */
          if (controller.signal.aborted) throw cause;
          deps.providerIssue?.({
            model: configured,
            slot,
            kind: hung.signal.aborted ? "first_byte_timeout" : "transport",
          });
          slotIndex += 1;
          continue;
        } finally {
          clearTimeout(attemptTimer);
        }

        if (high && response.status === 412) {
          await response.body?.cancel();
          return json(503, { error: "high_unavailable" }, origin);
        }
        provider = high ? workersAiResponse(response, controller.signal) : response;
        if (response.ok) {
          Object.assign(served, { model: configured, slot });
          break;
        }
        // A refusal's provider message, reduced to lowercase words, names what was refused.
        const said =
          response.status >= 400 && response.status !== 429
            ? (
                await response
                  .clone()
                  .text()
                  .catch(() => "")
              )
                .toLowerCase()
                .replace(/[^a-z_ ]+/g, " ")
                .trim()
                .replace(/\s+/g, "_")
                .slice(0, 80)
            : "";
        deps.providerIssue?.({
          model: configured,
          slot,
          kind: `status_${response.status}${said ? `_${said}` : ""}`,
        });

        /*
         * A REFUSED ATTEMPT'S BODY IS STILL AN OPEN STREAM: read for its reason where the status
         * needs one, otherwise cancelled so it does not hold its connection.
         */
        if (response.status === 429) {
          quotaExhausted = true;
          const detail = await response.text().catch(() => "");
          const quota = providerQuota(detail, (deps.now ?? Date.now)());
          for (const limit of quota.limits)
            deps.discoveredLimit?.({ ...limit, slot, model: configured });
          const named = providerWait(response, detail);
          // A spent per-day quota returns at its reset, whatever shorter wait the body suggests.
          const wait =
            quota.dailyResetMs !== undefined ? Math.max(named ?? 0, quota.dailyResetMs) : named;
          /*
           * A WEB SEARCH THE PLAN DOES NOT INCLUDE IS NOT A BUSY PROVIDER.
           *
           * On the free tier, grounding with Google Search is "Not available" (Google's pricing
           * page): every grounded request is a 429 with no time to wait, and JARVIS spent
           * minutes retrying one as if it were busy (live cloud runs, 13 Oct 2026). Said once,
           * not retried; it answers again if the plan ever includes it.
           */
          if (body.research && !wait) {
            return json(403, { error: "research_unavailable" }, origin);
          }
          // Quota belongs to the PROJECT: the same key is retried, never another one. A wait the
          // provider asks for that is longer than a moment is not slept here, and never cut short.
          if (wait !== undefined && wait > MAX_INLINE_WAIT_MS) {
            const seconds = Math.ceil(wait / 1_000);
            capacityReturnsIn = capacityReturnsIn ? Math.min(capacityReturnsIn, seconds) : seconds;
            deps.quotaReturnsAt?.set(configured, (deps.now ?? Date.now)() + wait);
            break;
          }
          if (last) break;
          await sleep(wait ?? backoff(attempt), controller.signal);
          continue;
        }

        if (response.status === 400) {
          // Google reports a bad or expired key as 400: that is THIS key, not the request.
          const detail = await response.text().catch(() => "");
          if (/API_KEY_INVALID|API key (not valid|expired)/i.test(detail)) {
            slotIndex += 1;
            continue;
          }
          // The model does not take this thinking setting: the same request once without one.
          if (thinking && /thinking/i.test(detail)) {
            thinking = false;
            deps.withoutThinking?.add(configured);
            continue;
          }
          // The request itself was refused by this model: the next model in the route may take it.
          refusedAs = "provider_rejected_request";
          continue models;
        }
        const wait = providerWait(response);
        void response.body?.cancel().catch(() => undefined);

        // THIS key is refused: the next one may not be.
        if (response.status === 401 || response.status === 403) {
          slotIndex += 1;
          continue;
        }

        // The provider is overloaded or failing. Every key reaches the same provider, so the same
        // key is retried, as long as the budget lasts and the provider allows it.
        if (response.status >= 500) {
          if (wait !== undefined && wait > MAX_INLINE_WAIT_MS) {
            const seconds = Math.ceil(wait / 1_000);
            capacityReturnsIn = capacityReturnsIn ? Math.min(capacityReturnsIn, seconds) : seconds;
            break;
          }
          if (last) break;
          await sleep(wait ?? backoff(attempt), controller.signal);
          continue;
        }

        refusedAs = "provider_unavailable";
        continue models;
      }
      if (provider?.ok) break;
    }

    if (!provider?.ok && refusedAs) {
      return json(
        refusedAs === "provider_rejected_request" ? 400 : 503,
        { error: refusedAs },
        origin,
      );
    }
    if (!provider?.ok) {
      return json(
        quotaExhausted ? 429 : 503,
        {
          error: "provider_unavailable",
          ...(capacityReturnsIn ? { retryAfterSeconds: capacityReturnsIn } : {}),
        },
        origin,
      );
    }
    handedOff = true;
    return new Response(
      normalizedProviderStream(
        provider,
        body.surface,
        controller.signal,
        cleanup,
        (reason) => {
          if (!controller.signal.aborted) controller.abort(reason);
        },
        () => {
          ended("succeeded");
          return (
            deps.finalizePermit?.({ userId: identity.userId, permit: body.permit }) ??
            Promise.resolve()
          );
        },
        () => {
          ended("failed");
          return (
            deps.releasePermit?.({ userId: identity.userId, permit: body.permit }) ??
            Promise.resolve()
          );
        },
        (kind) => deps.providerIssue?.({ ...served, kind }),
      ),
      {
        status: 200,
        headers: {
          ...(origin ? cors(origin) : {}),
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          Connection: "keep-alive",
        },
      },
    );
  } catch (cause) {
    // The person left, or the whole deadline passed, before any answer began:
    // an honest refusal the browser can read, never an unhandled 500 without CORS.
    if (controller.signal.aborted) return json(503, { error: "provider_unavailable" }, origin);
    throw cause;
  } finally {
    // A successful response still has work in flight after this function
    // returns. Its stream owns cleanup and settling; early refusals do both here.
    if (!handedOff) {
      cleanup();
      await deps
        .releasePermit?.({ userId: identity.userId, permit: body.permit })
        .catch(() => undefined);
    }
  }
}

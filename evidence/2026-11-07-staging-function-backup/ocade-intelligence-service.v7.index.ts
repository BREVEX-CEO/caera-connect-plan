// ../../../../Desktop/caera-connect-plan/src/lib/intelligence/contract.ts
var SERVICE_USER_HEADER = "x-ocade-user";
async function* sseData(body, incomplete, signal) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => {
    });
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      if (signal?.aborted) throw signal.reason;
      const { value, done } = await reader.read();
      if (signal?.aborted) throw signal.reason;
      if (done) break;
      buffer += value;
      if (buffer.length > 2e6)
        throw new Error("Intelligence stream frame exceeded its limit.");
      for (let at = boundary(buffer); at; at = boundary(buffer)) {
        const frame = buffer.slice(0, at.index);
        buffer = buffer.slice(at.index + at.length);
        for (const line of frame.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (payload && payload !== "[DONE]") yield payload;
        }
      }
    }
    if (buffer.trim()) throw new Error(incomplete);
  } finally {
    signal?.removeEventListener("abort", abort);
    await reader.cancel().catch(() => {
    });
    reader.releaseLock();
  }
}
function boundary(buffer) {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf < 0 && crlf < 0) return null;
  if (crlf >= 0 && (lf < 0 || crlf < lf)) return { index: crlf, length: 4 };
  return { index: lf, length: 2 };
}

// ../../../../Desktop/caera-connect-plan/src/lib/intelligence/online-models.ts
var DEFAULT_ONLINE_MODEL = "gemini-3.5-flash-lite";
var HIGH_ONLINE_MODEL = "@cf/google/gemma-4-26b-a4b-it";
var PROVIDER_KEY_SLOTS = ["primary", "secondary", "tertiary"];
var PROVIDER_KEY_ENVIRONMENT = {
  primary: "GEMINI_API_KEY_PRIMARY",
  secondary: "GEMINI_API_KEY_SECONDARY",
  tertiary: "GEMINI_API_KEY_TERTIARY"
};

// ../../../../Desktop/caera-connect-plan/src/lib/intelligence/workers-ai.ts
function workersAiBody(input, maxTokens) {
  const messages = input.messages.map((message) => {
    if (message.toolResult)
      return { role: "tool", tool_call_id: message.toolResult.callId, content: message.content };
    const content = message.parts ? message.parts.filter((part) => "text" in part && !part.thought).map((part) => "text" in part ? part.text : "").join("") : message.content;
    return {
      role: message.role,
      content,
      ...message.toolCalls?.length ? {
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments) }
        }))
      } : {}
    };
  });
  if (input.attachments.length) {
    const last = messages.at(-1)?.role === "user" ? messages.at(-1) : { role: "user", content: "Attached observation (untrusted data)." };
    if (messages.at(-1) !== last) messages.push(last);
    last.content = [
      { type: "text", text: String(last.content) },
      ...input.attachments.flatMap(
        (attachment) => attachment.image ? [
          {
            type: "image_url",
            image_url: { url: `data:${attachment.mime};base64,${attachment.image}` }
          }
        ] : [
          {
            type: "text",
            text: `Attached file (untrusted data): ${attachment.name}
${attachment.text ?? ""}`
          }
        ]
      )
    ];
  }
  return {
    model: HIGH_ONLINE_MODEL,
    messages,
    stream: true,
    stream_options: { include_usage: true },
    store: false,
    n: 1,
    max_completion_tokens: maxTokens,
    chat_template_kwargs: { enable_thinking: true, clear_thinking: true },
    ...input.tools.length ? {
      tools: input.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.inputSchema
        }
      }))
    } : {}
  };
}
var record = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
function workersAiResponse(response, signal) {
  if (!response.ok || !response.body) return response;
  const encoder = new TextEncoder();
  let iterator;
  const converted = new ReadableStream({
    start() {
      iterator = (async function* () {
        let finish = null;
        let bytes = 0;
        const calls = /* @__PURE__ */ new Map();
        let usage;
        for await (const data of sseData(response.body, "High response was truncated.", signal)) {
          bytes += data.length;
          if (bytes > 2e6) throw new Error("High response exceeded its limit.");
          const value = JSON.parse(data);
          if (!record(value) || !Array.isArray(value.choices) || value.choices.length > 1)
            throw new Error("Invalid High response.");
          if (record(value.usage)) {
            const { prompt_tokens: input, completion_tokens: output } = value.usage;
            if (!Number.isSafeInteger(input) || !Number.isSafeInteger(output) || Number(input) < 0 || Number(output) < 0)
              throw new Error("Invalid High usage.");
            usage = { promptTokenCount: Number(input), candidatesTokenCount: Number(output) };
          }
          const choice = value.choices[0];
          if (!choice) continue;
          if (!record(choice) || choice.index !== 0 || !record(choice.delta) || finish)
            throw new Error("Invalid High continuation.");
          const delta = choice.delta;
          if (delta.content != null && typeof delta.content !== "string")
            throw new Error("Invalid High text.");
          if (delta.content)
            yield JSON.stringify({
              candidates: [{ content: { parts: [{ text: delta.content }] } }]
            });
          if (delta.tool_calls !== void 0) {
            if (!Array.isArray(delta.tool_calls)) throw new Error("Invalid High calls.");
            for (const call of delta.tool_calls) {
              if (!record(call) || !Number.isInteger(call.index) || Number(call.index) < 0 || Number(call.index) >= 32 || call.type !== void 0 && call.type !== "function")
                throw new Error("Invalid High call.");
              const index = Number(call.index);
              const accumulated = calls.get(index) ?? { id: "", name: "", args: "" };
              if (call.id !== void 0) {
                if (typeof call.id !== "string" || accumulated.id)
                  throw new Error("Invalid High call id.");
                accumulated.id = call.id;
              }
              if (call.function !== void 0) {
                if (!record(call.function)) throw new Error("Invalid High function.");
                for (const [field, key] of [
                  ["name", "name"],
                  ["arguments", "args"]
                ]) {
                  if (call.function[field] !== void 0) {
                    if (typeof call.function[field] !== "string")
                      throw new Error("Invalid High argument.");
                    accumulated[key] += call.function[field];
                  }
                }
              }
              if (accumulated.id.length > 200 || accumulated.name.length > 128 || accumulated.args.length > 2e5)
                throw new Error("High call exceeded its limit.");
              calls.set(index, accumulated);
            }
          }
          if (choice.finish_reason != null) {
            if (!["stop", "tool_calls", "length", "content_filter"].includes(
              String(choice.finish_reason)
            ))
              throw new Error("Invalid High terminal.");
            finish = String(choice.finish_reason);
          }
        }
        signal.throwIfAborted();
        if (!finish) throw new Error("High response has no terminal.");
        const parts = [];
        const ids = /* @__PURE__ */ new Set();
        if (finish === "tool_calls" || finish === "stop") {
          for (const [, call] of [...calls].sort(([a], [b]) => a - b)) {
            const args = JSON.parse(call.args);
            if (!record(args) || !call.id || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(call.name) || ids.has(call.id))
              throw new Error("Invalid High completed call.");
            ids.add(call.id);
            parts.push({ functionCall: { id: call.id, name: call.name, args } });
          }
        }
        yield JSON.stringify({
          candidates: [
            {
              content: { parts },
              finishReason: finish === "length" ? "MAX_TOKENS" : finish === "content_filter" ? "SAFETY" : "STOP"
            }
          ],
          ...usage ? { usageMetadata: usage } : {}
        });
      })();
    },
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(`data: ${next.value}

`));
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await response.body?.cancel().catch(() => {
      });
      await iterator.return("");
    }
  });
  return new Response(converted, {
    status: response.status,
    headers: { "Content-Type": "text/event-stream" }
  });
}

// ../../../../Desktop/caera-connect-plan/src/lib/read-bounded-request.ts
async function readBoundedRequestText(request, maxBytes) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return null;
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  const abortRead = () => {
    void reader?.cancel(request.signal.reason).catch(() => void 0);
  };
  request.signal.addEventListener("abort", abortRead, { once: true });
  try {
    request.signal.throwIfAborted();
    while (reader) {
      const chunk = await reader.read();
      request.signal.throwIfAborted();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) return null;
      text += decoder.decode(chunk.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    request.signal.removeEventListener("abort", abortRead);
    await reader?.cancel().catch(() => void 0);
    reader?.releaseLock();
  }
}

// ../../../../Desktop/caera-connect-plan/src/lib/intelligence/quality.ts
var HIGH_WARNING_VERSION = "2026-10-19-v1";
var HIGH_WARNING_INTERVAL_MS = 5 * 6e4;

// ../../../../Desktop/caera-connect-plan/src/lib/release.ts
var OCADE_RELEASE_VERSION = "0.1.0";
var OCADE_COMMIT = typeof __OCADE_COMMIT__ === "string" && __OCADE_COMMIT__ ? __OCADE_COMMIT__ : "unknown";

// ../../../../Desktop/caera-connect-plan/src/lib/telemetry/operation-health.ts
var HEALTH_COMPONENTS = ["web", "edge_function"];
var HEALTH_OPERATIONS = [
  /** A generation's terminal outcome: an answer delivered, or a failure/refusal/stop. */
  "generation",
  /** The provider began answering (the stream was handed off): not yet an answer. */
  "generation_start",
  "offline_allowance",
  /** Finalising or releasing a reservation after a generation ended. */
  "usage_settlement"
];
var ERROR_CLASSES = [
  "none",
  "auth",
  "permission",
  "validation",
  "conflict",
  "quota",
  "timeout",
  "transport",
  "upstream",
  "internal",
  "cancelled"
];
var PROVIDER_SLOTS = ["primary", "secondary", "tertiary", "local", "none"];
function latencyBucketFor(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs < 0) return "under_100ms";
  if (durationMs < 100) return "under_100ms";
  if (durationMs < 500) return "under_500ms";
  if (durationMs < 1e3) return "under_1s";
  if (durationMs < 3e3) return "under_3s";
  if (durationMs < 1e4) return "under_10s";
  if (durationMs < 3e4) return "under_30s";
  return "over_30s";
}
var MAX_ATTEMPTS = 99;
function oneOf(allowed, value, fallback) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}
function buildHealthRecord(observation) {
  const outcome = oneOf(
    ["succeeded", "failed", "refused"],
    observation.outcome,
    "failed"
  );
  const declared = oneOf(ERROR_CLASSES, observation.errorClass, "internal");
  return {
    schemaVersion: 1,
    release: OCADE_RELEASE_VERSION,
    component: oneOf(HEALTH_COMPONENTS, observation.component, "web"),
    operation: oneOf(HEALTH_OPERATIONS, observation.operation, "generation"),
    outcome,
    // A success has no error class, whatever the caller passed.
    errorClass: outcome === "succeeded" ? "none" : declared === "none" ? "internal" : declared,
    latencyBucket: latencyBucketFor(observation.durationMs ?? 0),
    providerSlot: oneOf(PROVIDER_SLOTS, observation.providerSlot, "none"),
    attempts: Math.min(
      MAX_ATTEMPTS,
      Math.max(1, Math.trunc(Number(observation.attempts ?? 1)) || 1)
    )
  };
}

// ../../../../Desktop/caera-connect-plan/src/lib/intelligence/edge-handler.ts
var ALLOWED_SURFACES = ["chat", "jarvis"];
var MAX_BODY_BYTES = 24 * 1048576;
var MAX_MESSAGES = 256;
var MAX_TOOLS = 128;
var MAX_ATTACHMENTS = 8;
var MAX_ATTACHMENT_TEXT = 2e5;
var MAX_ATTACHMENT_IMAGE = 7 * 1048576;
var MAX_OUTPUT_TOKENS = 16384;
var THINKING_LEVEL = "medium";
var LOCAL_CALL_ID = "provider-tool-";
var SKIP_SIGNATURE = "skip_thought_signature_validator";
var PROVIDER_TIMEOUT_MS = 11e4;
var ATTEMPT_TIMEOUT_MS = 25e3;
var BLOCKED_FINISH = /* @__PURE__ */ new Set(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]);
var MAX_PROVIDER_ATTEMPTS = 3;
var MAX_INLINE_WAIT_MS = 2e3;
function json(status, body, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...origin ? cors(origin) : {}
    }
  });
}
function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "600"
  };
}
async function isServiceKey(presented, keys) {
  if (!presented) return false;
  const digest = async (value) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const given = await digest(presented);
  let matched = false;
  for (const key of keys) {
    if (!key) continue;
    const known = await digest(key);
    let difference = 0;
    for (let i = 0; i < known.length; i += 1) difference |= known[i] ^ given[i];
    matched = difference === 0 || matched;
  }
  return matched;
}
function bearer(request) {
  const value = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+([^\s]+)$/i.exec(value);
  return match?.[1] ?? null;
}
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function boundedString(value, maximum) {
  return typeof value === "string" && value.length > 0 && value.length <= maximum;
}
function validCalls(message) {
  const calls = message.toolCalls;
  return message.role === "assistant" && Array.isArray(calls) && calls.length > 0 && calls.length <= 32 && calls.every(
    (call) => isRecord(call) && boundedString(call.id, 200) && boundedString(call.name, 128) && isRecord(call.arguments) && (call.signature === void 0 || boundedString(call.signature, 1e5))
  );
}
function validParts(message) {
  const parts = message.parts;
  if (message.role !== "assistant" || !Array.isArray(parts) || !parts.length || parts.length > 16384)
    return false;
  let textSize = 0;
  let signatureSize = 0;
  const ids = [];
  for (const part of parts) {
    if (!isRecord(part)) return false;
    if ("callId" in part) {
      if (Object.keys(part).length !== 1 || !boundedString(part.callId, 200)) return false;
      ids.push(part.callId);
    } else {
      if (Object.keys(part).some((key) => !["text", "signature", "thought"].includes(key)) || typeof part.text !== "string" || part.thought !== void 0 && typeof part.thought !== "boolean" || part.signature !== void 0 && !boundedString(part.signature, 1e5))
        return false;
      textSize += part.text.length;
      signatureSize += typeof part.signature === "string" ? part.signature.length : 0;
    }
  }
  const calls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
  return textSize <= 2e5 && signatureSize <= 1e6 && ids.length === calls.length && new Set(ids).size === ids.length && ids.every((id, index) => isRecord(calls[index]) && id === calls[index].id);
}
function parseBody(value) {
  if (!isRecord(value) || !isRecord(value.permit) || !isRecord(value.privacy)) return null;
  const permit = value.permit;
  const privacy = value.privacy;
  if (!boundedString(permit.id, 200) || !boundedString(permit.generationId, 200) || !boundedString(permit.idempotencyKey, 200) || permit.source !== "server" || !boundedString(value.generationId, 200) || !boundedString(value.idempotencyKey, 200) || permit.generationId !== value.generationId || permit.idempotencyKey !== value.idempotencyKey || permit.surface !== value.surface || typeof value.surface !== "string" || !ALLOWED_SURFACES.includes(value.surface) || !Array.isArray(value.messages) || value.messages.length === 0 || value.messages.length > MAX_MESSAGES || !Array.isArray(value.tools) || value.tools.length > MAX_TOOLS || !Array.isArray(value.attachments) || value.attachments.length > MAX_ATTACHMENTS || privacy.onlineInferenceConsented !== true || privacy.sealed !== false || value.quality !== void 0 && value.quality !== "standard" && value.quality !== "high" || value.quality === "high" && value.highModeAcknowledged !== HIGH_WARNING_VERSION) {
    return null;
  }
  if (value.messages.some(
    (message) => !isRecord(message) || !["system", "user", "assistant"].includes(String(message.role)) || typeof message.content !== "string" || message.content.length > 2e5 || message.toolCalls !== void 0 && !validCalls(message) || message.parts !== void 0 && !validParts(message) || message.toolResult !== void 0 && (message.role !== "user" || !isRecord(message.toolResult) || !boundedString(message.toolResult.callId, 200) || !boundedString(message.toolResult.name, 128))
  ) || value.tools.some(
    (tool) => !isRecord(tool) || !boundedString(tool.name, 128) || typeof tool.description !== "string" || !isRecord(tool.inputSchema)
  ) || /*
   * ATTACHMENTS ARE VALIDATED LIKE EVERYTHING ELSE, and until now they were
   * validated and then dropped: `parseBody` accepted the array and
   * `providerBody` never read it, so a file a person attached reached the
   * boundary and went nowhere. It carries one of text or an image, never
   * both and never neither.
   */
  value.attachments.some(
    (attachment) => !isRecord(attachment) || !boundedString(attachment.name, 256) || !boundedString(attachment.mime, 128) || typeof attachment.sizeBytes !== "number" || attachment.sizeBytes < 0 || typeof attachment.text === "string" === (typeof attachment.image === "string") || typeof attachment.text === "string" && attachment.text.length > MAX_ATTACHMENT_TEXT || typeof attachment.image === "string" && (attachment.image.length > MAX_ATTACHMENT_IMAGE || !attachment.mime.startsWith("image/"))
  )) {
    return null;
  }
  return value;
}
function providerBody(body) {
  const system = body.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const contents = [];
  const nativeId = (id) => id.startsWith(LOCAL_CALL_ID) ? {} : { id };
  const callPart = (call, signature = call.signature) => ({
    functionCall: { ...nativeId(call.id), name: call.name, args: call.arguments },
    ...signature ? { thoughtSignature: signature } : {}
  });
  for (const message of body.messages) {
    if (message.role === "system") continue;
    if (message.parts) {
      contents.push({
        role: "model",
        parts: message.parts.map((part) => {
          if ("callId" in part) {
            const call = message.toolCalls.find((call2) => call2.id === part.callId);
            const first = message.parts.find((p) => "callId" in p) === part;
            return callPart(call, call.signature ?? (first ? SKIP_SIGNATURE : void 0));
          }
          return {
            text: part.text,
            ...part.signature ? { thoughtSignature: part.signature } : {},
            ...part.thought !== void 0 ? { thought: part.thought } : {}
          };
        })
      });
      continue;
    }
    if (message.toolResult) {
      const part = {
        functionResponse: {
          ...nativeId(message.toolResult.callId),
          name: message.toolResult.name,
          response: { result: message.content }
        }
      };
      const previous = contents.at(-1);
      if (previous?.parts.every((p) => "functionResponse" in p)) previous.parts.push(part);
      else contents.push({ role: "user", parts: [part] });
      continue;
    }
    const parts = message.toolCalls && !message.content ? [] : [{ text: message.content }];
    message.toolCalls?.forEach((call, index) => {
      const signature = call.signature ?? (index === 0 ? SKIP_SIGNATURE : void 0);
      parts.push(callPart(call, signature));
    });
    contents.push({ role: message.role === "assistant" ? "model" : "user", parts });
  }
  const last = contents[contents.length - 1];
  if (last) {
    for (const attachment of body.attachments) {
      if (attachment.image) {
        last.parts.push({
          inline_data: { mime_type: attachment.mime, data: attachment.image }
        });
      } else if (attachment.text) {
        last.parts.push({
          text: `

--- attached file: ${attachment.name} ---
${attachment.text}
--- end of ${attachment.name} ---`
        });
      }
    }
  }
  return {
    contents,
    generationConfig: {
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      thinkingConfig: { thinkingLevel: THINKING_LEVEL }
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
    ...system ? { system_instruction: { parts: [{ text: system }] } } : {},
    ...body.research ? { tools: [{ google_search: {} }] } : {},
    ...!body.research && body.tools.length ? {
      tools: [
        {
          function_declarations: body.tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema
          }))
        }
      ]
    } : {}
  };
}
function providerWait(response, detail = "", now = Date.now()) {
  const header = response.headers.get("retry-after")?.trim();
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1e3;
    const at = Date.parse(header);
    if (Number.isFinite(at)) return Math.max(0, at - now);
  }
  const body = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(detail)?.[1];
  return body === void 0 ? void 0 : Number(body) * 1e3;
}
var backoff = (attempt) => Math.min(250 * 2 ** attempt, MAX_INLINE_WAIT_MS);
async function defaultSleep(ms, signal) {
  await new Promise((resolve, reject) => {
    const stop = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", stop);
      resolve();
    }, ms);
    signal.addEventListener("abort", stop, { once: true });
  });
}
function sse(event) {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}

`);
}
function normalizeProviderChunk(value, backend, toolIndex, assistantParts) {
  if (!isRecord(value)) return [];
  const candidates = Array.isArray(value.candidates) ? value.candidates : [];
  const first = isRecord(candidates[0]) ? candidates[0] : null;
  const content = first && isRecord(first.content) ? first.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  const events = [];
  for (const part of parts) {
    if (!isRecord(part)) continue;
    if (part.thoughtSignature !== void 0 && !boundedString(part.thoughtSignature, 1e5) || part.thought !== void 0 && typeof part.thought !== "boolean") {
      throw new Error("Provider returned invalid continuation metadata.");
    }
    toolIndex.textSize += typeof part.text === "string" ? part.text.length : 0;
    toolIndex.signatureSize += typeof part.thoughtSignature === "string" ? part.thoughtSignature.length : 0;
    if (toolIndex.textSize > 2e5 || toolIndex.signatureSize > 1e6 || assistantParts.length >= 16384) {
      throw new Error("Provider returned excessive assistant parts.");
    }
    if (typeof part.text === "string") {
      assistantParts.push({
        text: part.text,
        ...part.thoughtSignature !== void 0 ? { signature: part.thoughtSignature } : {},
        ...part.thought !== void 0 ? { thought: part.thought } : {}
      });
      if (part.text.length > 0 && part.thought !== true)
        events.push({ type: "token", text: part.text });
    }
    if (isRecord(part.functionCall) && boundedString(part.functionCall.name, 128)) {
      const call = {
        id: boundedString(part.functionCall.id, 200) ? part.functionCall.id : `${LOCAL_CALL_ID}${toolIndex.value++}`,
        name: part.functionCall.name,
        arguments: isRecord(part.functionCall.args) ? part.functionCall.args : {},
        ...boundedString(part.thoughtSignature, 1e5) ? { signature: part.thoughtSignature } : {}
      };
      assistantParts.push({ callId: call.id });
      events.push({ type: "tool_call", call });
    }
  }
  if (first && isRecord(first.groundingMetadata)) {
    const chunks = Array.isArray(first.groundingMetadata.groundingChunks) ? first.groundingMetadata.groundingChunks : [];
    const sources = [];
    for (const chunk of chunks) {
      if (!isRecord(chunk) || !isRecord(chunk.web)) continue;
      const uri = chunk.web.uri;
      const title = chunk.web.title;
      if (!boundedString(uri, 2e3) || !/^https:\/\//i.test(uri)) continue;
      const label = boundedString(title, 200) ? title : uri;
      const line = `- [${label.replace(/[[\]]/g, "")}](${uri})`;
      if (!sources.includes(line)) sources.push(line);
    }
    if (sources.length > 0) {
      events.push({ type: "token", text: `

Sources

${sources.join("\n")}
` });
    }
  }
  if (isRecord(value.usageMetadata)) {
    const usage = {};
    if (typeof value.usageMetadata.promptTokenCount === "number") {
      usage.inputTokens = value.usageMetadata.promptTokenCount;
    }
    if (typeof value.usageMetadata.candidatesTokenCount === "number") {
      usage.outputTokens = value.usageMetadata.candidatesTokenCount;
    }
    events.push({ type: "usage", usage });
  }
  const blockedPrompt = isRecord(value.promptFeedback) && typeof value.promptFeedback.blockReason === "string";
  if (blockedPrompt || first && typeof first.finishReason === "string" && BLOCKED_FINISH.has(first.finishReason)) {
    events.push({
      type: "refusal",
      code: "content_blocked",
      reason: "OCADE can't help with that request. Try asking in a different way.",
      retryable: false
    });
  } else if (first && typeof first.finishReason === "string" && first.finishReason !== "STOP" && first.finishReason !== "MAX_TOKENS") {
    events.push({
      type: "refusal",
      code: "provider_failed",
      reason: "Online Intelligence stopped before completing the response.",
      retryable: false
    });
  }
  void backend;
  return events;
}
function normalizedProviderStream(provider, surface, signal, cleanup, cancelProvider, delivered = async () => void 0, undelivered = async () => void 0) {
  return new ReadableStream({
    async start(controller) {
      let answer = "";
      let refused = false;
      let finishReason;
      let completed = false;
      const toolCalls = [];
      const parts = [];
      let usage;
      const toolIndex = { value: 0, textSize: 0, signatureSize: 0 };
      let settled = false;
      const settle2 = async () => {
        if (settled) return;
        settled = true;
        const anything = completed || surface === "chat" && answer.trim() !== "";
        await (anything ? delivered(completed ? toolCalls : []) : undelivered()).catch(
          () => void 0
        );
      };
      try {
        if (!provider.body) throw new Error("Provider returned no stream.");
        controller.enqueue(sse({ type: "status", backend: "online", state: "generating" }));
        for await (const raw of sseData(
          provider.body,
          "Provider ended with an incomplete stream event.",
          signal
        )) {
          const chunk = JSON.parse(raw);
          const candidate = isRecord(chunk) && Array.isArray(chunk.candidates) ? chunk.candidates[0] : null;
          if (finishReason && isRecord(candidate) && isRecord(candidate.content) && Array.isArray(candidate.content.parts) && candidate.content.parts.length)
            throw new Error("Provider sent content after its terminal result.");
          if (isRecord(candidate) && typeof candidate.finishReason === "string") {
            finishReason = candidate.finishReason;
          }
          for (const event of normalizeProviderChunk(chunk, "online", toolIndex, parts)) {
            if (event.type === "tool_call") {
              toolCalls.push(event.call);
              continue;
            }
            if (event.type === "token") answer += event.text;
            if (event.type === "usage") usage = event.usage;
            if (event.type === "refusal") refused = true;
            controller.enqueue(sse(event));
          }
        }
        if (refused) {
        } else if (finishReason !== "STOP" && !(surface === "chat" && finishReason === "MAX_TOKENS" && toolCalls.length === 0)) {
          throw new Error("Provider ended before completing the turn.");
        } else if (!answer.trim() && toolCalls.length === 0) {
          controller.enqueue(
            sse({
              type: "refusal",
              code: "empty_response",
              reason: "Online Intelligence returned no response.",
              retryable: true
            })
          );
        } else {
          if (!validParts({ role: "assistant", parts, toolCalls }) || toolCalls.length && !validCalls({ role: "assistant", toolCalls })) {
            throw new Error("Provider returned invalid assistant parts.");
          }
          signal.throwIfAborted();
          for (const call of toolCalls) controller.enqueue(sse({ type: "tool_call", call }));
          completed = true;
          await settle2();
          controller.enqueue(
            sse({
              type: "final",
              response: {
                text: answer,
                toolCalls,
                parts,
                toolResults: [],
                backend: "online",
                ...usage ? { usage } : {},
                stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn"
              }
            })
          );
        }
      } catch {
        const timedOut = signal.reason instanceof DOMException && signal.reason.name === "TimeoutError";
        controller.enqueue(
          sse({
            type: "refusal",
            code: signal.aborted && !timedOut ? "cancelled" : "provider_failed",
            reason: signal.aborted && !timedOut ? "Stopped by the user." : "Online Intelligence stopped before completing the response.",
            retryable: !signal.aborted && !answer.trim() && toolCalls.length === 0
          })
        );
      } finally {
        await settle2();
        cleanup();
        controller.close();
      }
    },
    cancel(reason) {
      cancelProvider(reason);
      cleanup();
    }
  });
}
function errorClassForStatus(status) {
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
async function handleOnlineIntelligence(request, deps) {
  const clock = deps.now ?? (() => Date.now());
  const startedAt = clock();
  const attempted = { slot: "none", attempts: 0 };
  const response = await runOnlineIntelligence(request, deps, attempted);
  if (request.method === "OPTIONS") return response;
  const streaming = (response.headers.get("content-type") ?? "").startsWith("text/event-stream");
  deps.observe?.(
    buildHealthRecord({
      component: "edge_function",
      operation: streaming ? "generation_start" : "generation",
      outcome: response.status < 400 ? "succeeded" : response.status === 401 || response.status === 403 ? "refused" : "failed",
      errorClass: errorClassForStatus(response.status),
      durationMs: clock() - startedAt,
      providerSlot: attempted.slot,
      attempts: attempted.attempts
    })
  );
  return response;
}
async function runOnlineIntelligence(request, deps, attempted) {
  const service = Boolean(deps.verifyService) && request.headers.has(SERVICE_USER_HEADER);
  const origin = service ? "" : request.headers.get("origin") ?? "";
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
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }
  const body = parseBody(parsed);
  if (!body) return json(400, { error: "invalid_request" }, origin);
  const identity = service ? await deps.verifyService(request) : await deps.verifyJwt(token);
  if (!identity) return json(401, { error: "authentication_required" }, origin);
  if (service && body.surface !== "jarvis") return json(400, { error: "invalid_request" });
  const high = body.quality === "high";
  const configured = high ? HIGH_ONLINE_MODEL : DEFAULT_ONLINE_MODEL;
  if (high && body.research) return json(403, { error: "research_unavailable" }, origin);
  if (high && !await deps.highAvailable?.(request.signal).catch(() => false)) {
    return json(503, { error: "high_unavailable" }, origin);
  }
  if (!high && (!deps.providerReady || deps.model !== void 0 && deps.model !== DEFAULT_ONLINE_MODEL)) {
    return json(503, { error: "online_unavailable" }, origin);
  }
  if (deps.consented && !await deps.consented(identity.userId)) {
    return json(403, { error: "online_not_consented" }, origin);
  }
  const claimed = await deps.claimPermit({ userId: identity.userId, permit: body.permit });
  if (!claimed.ok) return json(409, { error: "permit_refused", reason: claimed.reason }, origin);
  const controller = new AbortController();
  const abort = () => controller.abort(request.signal.reason);
  request.signal.addEventListener("abort", abort, { once: true });
  if (request.signal.aborted) abort();
  const begun = (deps.now ?? (() => Date.now()))();
  const ended = (outcome) => deps.observe?.(
    buildHealthRecord({
      component: "edge_function",
      operation: "generation",
      outcome,
      errorClass: outcome === "succeeded" ? "none" : controller.signal.aborted ? "cancelled" : "upstream",
      durationMs: (deps.now ?? (() => Date.now()))() - begun,
      providerSlot: attempted.slot,
      attempts: attempted.attempts
    })
  );
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Provider timeout", "TimeoutError")),
    PROVIDER_TIMEOUT_MS
  );
  const sleep = deps.sleep ?? defaultSleep;
  let handedOff = false;
  const cleanup = () => {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", abort);
  };
  try {
    const slots = high ? ["primary"] : deps.providerSlots && deps.providerSlots.length > 0 ? deps.providerSlots : [PROVIDER_KEY_SLOTS[0]];
    let provider = null;
    let quotaExhausted = false;
    let capacityReturnsIn = 0;
    controller.signal.throwIfAborted();
    let slotIndex = 0;
    while (attempted.attempts < MAX_PROVIDER_ATTEMPTS && slotIndex < slots.length) {
      const slot = slots[slotIndex];
      const attempt = attempted.attempts;
      const last = attempt === MAX_PROVIDER_ATTEMPTS - 1;
      let response;
      const hung = new AbortController();
      const attemptTimer = setTimeout(
        () => hung.abort(new DOMException("Provider key timeout", "TimeoutError")),
        ATTEMPT_TIMEOUT_MS
      );
      try {
        attempted.slot = slot;
        attempted.attempts += 1;
        response = await deps.callProvider({
          model: configured,
          body: high ? workersAiBody(body, MAX_OUTPUT_TOKENS) : providerBody(body),
          signal: AbortSignal.any([controller.signal, hung.signal]),
          slot
        });
      } catch (cause) {
        if (controller.signal.aborted) throw cause;
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
      if (response.ok) break;
      if (response.status === 429) {
        quotaExhausted = true;
        const detail = await response.text().catch(() => "");
        const wait2 = providerWait(response, detail);
        if (body.research && !wait2) {
          return json(403, { error: "research_unavailable" }, origin);
        }
        if (wait2 !== void 0 && wait2 > MAX_INLINE_WAIT_MS) {
          capacityReturnsIn = Math.ceil(wait2 / 1e3);
          break;
        }
        if (last) break;
        await sleep(wait2 ?? backoff(attempt), controller.signal);
        continue;
      }
      if (response.status === 400) {
        const detail = await response.text().catch(() => "");
        if (/API_KEY_INVALID|API key (not valid|expired)/i.test(detail)) {
          slotIndex += 1;
          continue;
        }
        return json(400, { error: "provider_rejected_request" }, origin);
      }
      const wait = providerWait(response);
      void response.body?.cancel().catch(() => void 0);
      if (response.status === 401 || response.status === 403) {
        slotIndex += 1;
        continue;
      }
      if (response.status >= 500) {
        if (wait !== void 0 && wait > MAX_INLINE_WAIT_MS) {
          capacityReturnsIn = Math.ceil(wait / 1e3);
          break;
        }
        if (last) break;
        await sleep(wait ?? backoff(attempt), controller.signal);
        continue;
      }
      return json(503, { error: "provider_unavailable" }, origin);
    }
    if (!provider?.ok) {
      return json(
        quotaExhausted ? 429 : 503,
        {
          error: "provider_unavailable",
          ...capacityReturnsIn ? { retryAfterSeconds: capacityReturnsIn } : {}
        },
        origin
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
        (toolCalls) => {
          ended("succeeded");
          return deps.finalizePermit?.({
            userId: identity.userId,
            permit: body.permit,
            startsTask: toolCalls.some((call) => call.name === "start_task")
          }) ?? Promise.resolve();
        },
        () => {
          ended("failed");
          return deps.releasePermit?.({ userId: identity.userId, permit: body.permit }) ?? Promise.resolve();
        }
      ),
      {
        status: 200,
        headers: {
          ...origin ? cors(origin) : {},
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
          Connection: "keep-alive"
        }
      }
    );
  } catch (cause) {
    if (controller.signal.aborted) return json(503, { error: "provider_unavailable" }, origin);
    throw cause;
  } finally {
    if (!handedOff) {
      cleanup();
      await deps.releasePermit?.({ userId: identity.userId, permit: body.permit }).catch(() => void 0);
    }
  }
}

// ../../../../Desktop/caera-connect-plan/supabase/functions/_shared/workers-ai.ts
function hardFreePlan(value) {
  if (!value || typeof value !== "object") return false;
  const envelope = value;
  if (envelope.success !== true || !Array.isArray(envelope.result)) return false;
  const workers = envelope.result.filter((entry) => {
    const name = entry?.rate_plan?.public_name;
    return typeof name === "string" && /workers/i.test(name);
  }).filter(
    (entry) => !["Cancelled", "Expired", "Failed"].includes(String(entry?.state))
  );
  if (workers.length !== 1) return false;
  const plan = workers[0];
  return plan?.rate_plan?.public_name === "Workers Free" && plan.rate_plan.scope === "account" && plan.price === 0 && plan.state === "Provisioned" && Array.isArray(plan.component_values) && plan.component_values.every((part) => part?.price === 0);
}
async function highIncluded(account, token, signal, request = fetch) {
  if (!/^[a-f0-9]{32}$/.test(account) || !token) return false;
  try {
    const response = await request(
      `https://api.cloudflare.com/client/v4/accounts/${account}/subscriptions`,
      {
        headers: { Authorization: `Bearer ${token}` },
        redirect: "error",
        signal: AbortSignal.any([signal, AbortSignal.timeout(5e3)])
      }
    );
    if (!response.ok || Number(response.headers.get("content-length")) > 1e6) {
      await response.body?.cancel();
      return false;
    }
    const reader = response.body?.getReader();
    if (!reader) return false;
    const chunks = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 1e6) return false;
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {
      });
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let at = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, at);
      at += chunk.byteLength;
    }
    return hardFreePlan(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return false;
  }
}

// ../../../../Desktop/caera-connect-plan/supabase/functions/_shared/boundary.ts
import { createClient } from "npm:@supabase/supabase-js@2.110.7";

// ../../../../Desktop/caera-connect-plan/src/lib/intelligence/online-consent-version.ts
var ONLINE_CONSENT_VERSION = "2026-10-19-high";

// ../../../../Desktop/caera-connect-plan/supabase/functions/_shared/boundary.ts
var SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
function namedPlatformKey(pluralName) {
  const encoded = Deno.env.get(pluralName);
  if (!encoded) return "";
  try {
    const values = JSON.parse(encoded);
    return typeof values.default === "string" ? values.default : "";
  } catch {
    return "";
  }
}
var SUPABASE_PUBLISHABLE_KEY = namedPlatformKey("SUPABASE_PUBLISHABLE_KEYS") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
var SUPABASE_SERVICE_ROLE_KEY = namedPlatformKey("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SECRET_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
var PROVIDER_KEYS = {
  primary: Deno.env.get(PROVIDER_KEY_ENVIRONMENT.primary) ?? "",
  secondary: Deno.env.get(PROVIDER_KEY_ENVIRONMENT.secondary) ?? "",
  tertiary: Deno.env.get(PROVIDER_KEY_ENVIRONMENT.tertiary) ?? ""
};
var CONFIGURED_SLOTS = PROVIDER_KEY_SLOTS.filter((slot) => PROVIDER_KEYS[slot].length > 0);
var CF_ACCOUNT = Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "";
var CF_TOKEN = Deno.env.get("CLOUDFLARE_WORKERS_AI_TOKEN") ?? "";
var GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") ?? DEFAULT_ONLINE_MODEL;
var allowedOrigins = new Set(
  (Deno.env.get("OCADE_ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean)
);
var SERVICE_KEYS = [
  ...Object.values(
    (() => {
      try {
        return JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
      } catch {
        return {};
      }
    })()
  ).filter((value) => typeof value === "string"),
  Deno.env.get("SUPABASE_SECRET_KEY") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
].filter(Boolean);
async function settle(rpc, body) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${rpc}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          "Content-Type": "application/json",
          ...!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_") ? { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } : {}
        },
        body: JSON.stringify(body)
      });
      const answer = await response.json().catch(() => void 0);
      if (response.ok && answer !== void 0) return;
      if (response.status < 500) break;
    } catch {
    }
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
  observe(
    buildHealthRecord({
      component: "edge_function",
      operation: "usage_settlement",
      outcome: "failed",
      errorClass: "upstream",
      durationMs: 0,
      providerSlot: "none",
      attempts: 3
    })
  );
}
function observe(record2) {
  console.log("ocade.health", JSON.stringify(record2));
}
async function verifyOcadeServer(request) {
  const userId = request.headers.get(SERVICE_USER_HEADER) ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null;
  return await isServiceKey(request.headers.get("apikey"), SERVICE_KEYS) ? { userId } : null;
}
var boundary2 = {
  allowedOrigins,
  providerReady: Boolean(
    SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY && SUPABASE_SERVICE_ROLE_KEY && CONFIGURED_SLOTS.length > 0
  ),
  providerSlots: CONFIGURED_SLOTS,
  highAvailable: (signal) => highIncluded(CF_ACCOUNT, CF_TOKEN, signal),
  observe,
  model: GEMINI_MODEL,
  async consented(userId) {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=online_ai_consent_at,online_ai_consent_version`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          ...!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_") ? { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } : {}
        }
      }
    );
    if (!response.ok) return false;
    const rows = await response.json().catch(() => []);
    return Boolean(rows[0]?.online_ai_consent_at) && rows[0]?.online_ai_consent_version === ONLINE_CONSENT_VERSION;
  },
  async claimPermit({ userId, permit }) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ocade_claim_generation_transport`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        "Content-Type": "application/json",
        // New sb_secret keys must not be presented as bearer JWTs. Legacy
        // service-role JWTs still require the header on older projects.
        ...!SUPABASE_SERVICE_ROLE_KEY.startsWith("sb_secret_") ? { Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } : {}
      },
      body: JSON.stringify({
        p_user_id: userId,
        p_permit_id: permit.id,
        p_generation_id: permit.generationId,
        p_idempotency_key: permit.idempotencyKey,
        p_surface: permit.surface
      })
    });
    if (!response.ok) {
      return {
        ok: false,
        reason: "The generation permit could not be verified."
      };
    }
    const value = await response.json().catch(() => false);
    return value === true ? { ok: true } : {
      ok: false,
      reason: "The generation permit is invalid or was already used."
    };
  },
  finalizePermit({ userId, permit, startsTask }) {
    return settle("ocade_finalize_generation_permit", {
      p_user_id: userId,
      p_idempotency_key: permit.idempotencyKey,
      p_cost_hundredths: startsTask && permit.surface === "jarvis" ? 0 : 100
    });
  },
  releasePermit({ userId, permit }) {
    return settle("ocade_release_generation_permit", {
      p_user_id: userId,
      p_idempotency_key: permit.idempotencyKey,
      p_reason: "transport_ended_without_output"
    });
  },
  async callProvider({ model, body, signal, slot }) {
    if (model === HIGH_ONLINE_MODEL) {
      if (!await highIncluded(CF_ACCOUNT, CF_TOKEN, signal)) {
        return new Response(null, { status: 412 });
      }
      return fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/v1/chat/completions`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${CF_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
          redirect: "error"
        }
      );
    }
    if (model !== DEFAULT_ONLINE_MODEL) return new Response(null, { status: 400 });
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      {
        method: "POST",
        // The slot the handler chose. The key itself never leaves this file,
        // and never appears in a log line, a response or an error.
        headers: { "Content-Type": "application/json", "x-goog-api-key": PROVIDER_KEYS[slot] },
        body: JSON.stringify(body),
        redirect: "error",
        signal
      }
    );
  }
};

// ../../../../Desktop/caera-connect-plan/supabase/functions/ocade-intelligence-service/index.ts
Deno.serve(
  (request) => handleOnlineIntelligence(request, {
    ...boundary2,
    allowedOrigins: /* @__PURE__ */ new Set(),
    verifyJwt: () => Promise.resolve(null),
    verifyService: verifyOcadeServer
  })
);

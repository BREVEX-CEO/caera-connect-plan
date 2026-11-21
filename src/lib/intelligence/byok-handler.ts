/**
 * SETTINGS > BYOK, ON THE SERVER (plan 14B.1A.3-5, 14B.1B.5-7).
 *
 * The only place a customer's key arrives: once, in a signed-in request's body, straight into
 * Vault through a server-only database function. Nothing here returns it, logs it or keeps it.
 * A connection is tested with two small calls to the customer's own provider (a tool call, and an
 * image of four coloured stripes), each of which may use the customer's quota; what they prove is recorded and
 * is the only thing the product ever claims about the connection.
 */
import type { CustomerRoute } from "./edge-handler.ts";
import type { ProviderProtocol } from "./online-models.ts";

const PROTOCOLS: readonly ProviderProtocol[] = ["gemini", "openai", "anthropic", "responses"];
import { bearer, cors, json } from "./edge-handler.ts";
import { gatewayAddress } from "./gateway-address.ts";
import { plannerModel } from "./online-models.ts";

export interface ByokDependencies {
  allowedOrigins: ReadonlySet<string>;
  verifyJwt(token: string): Promise<{ userId: string } | null>;
  save(input: {
    userId: string;
    connectionId: string | null;
    alias: string;
    protocol: ProviderProtocol;
    endpoint: string;
    model: string;
    key: string | null;
  }): Promise<string>;
  /** The person's own connection by id, key held by the deployment; null when it is not theirs. */
  route(userId: string, connectionId: string): Promise<CustomerRoute | null>;
  /** One request to the connection's checked address (421 when the address is refused). */
  send(route: CustomerRoute, body: unknown, signal: AbortSignal): Promise<Response>;
  record(
    userId: string,
    connectionId: string,
    status: string,
    seesImages: boolean | null,
    callsTools: boolean | null,
  ): Promise<void>;
  enable(userId: string, connectionId: string, enabled: boolean): Promise<boolean>;
  choose(userId: string, surface: "chat" | "jarvis", connectionId: string | null): Promise<void>;
  remove(userId: string, connectionId: string): Promise<boolean>;
  /** The provider's model list for the connection's key (GET, the same checked address). */
  list(route: CustomerRoute, signal: AbortSignal): Promise<Response>;
  saveModels(userId: string, connectionId: string, models: ListedModel[]): Promise<number>;
  setModel(input: {
    userId: string;
    connectionId: string;
    model: string;
    permitted: boolean;
    inputPrice: number | null;
    outputPrice: number | null;
    currency: string | null;
  }): Promise<boolean>;
  recordModel(
    userId: string,
    connectionId: string,
    model: string,
    callsTools: boolean | null,
    seesImages: boolean | null,
  ): Promise<void>;
  policy(userId: string, connectionId: string, policy: SpendingPolicy): Promise<boolean>;
  now?: () => number;
}

/** One model a provider listed for a key; anything it did not say is left out (unknown). */
export interface ListedModel {
  model: string;
  label?: string;
  free?: boolean;
  /** US dollars per million tokens, as the provider listed them. */
  inputPrice?: number;
  outputPrice?: number;
  callsTools?: boolean;
  seesImages?: boolean;
}

export interface SpendingPolicy {
  modelMode: "manual" | "auto";
  spendMode: "free_only" | "custom" | "unlimited";
  freeTier: boolean;
  currency: string;
  timeZone: string;
  task: number | null;
  day: number | null;
  month: number | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 16_384;
const PROBE_TIMEOUT_MS = 30_000;
const MAX_ANSWER_BYTES = 65_536;
/** A provider's whole model list (OpenRouter's is a few megabytes), and how many are kept. */
const MAX_LIST_BYTES = 8_388_608;
const MAX_MODELS = 1000;
/** Tests a person may run per minute: each one may spend their own provider quota. */
const TESTS_PER_MINUTE = 6;
const tests = new Map<string, number[]>();

/** Why a provider answered as it did, as the connection's status. */
export function statusOf(code: number): string {
  if (code === 401 || code === 403) return "invalid";
  if (code === 402) return "credits_unavailable";
  if (code === 404 || code === 400 || code === 422) return "incompatible";
  if (code === 421) return "blocked";
  if (code === 429) return "rate_limited";
  return "unreachable";
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((size, part) => size + part.byteLength, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}

async function boundedJson(response: Response, limit = MAX_ANSWER_BYTES): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(new TextDecoder().decode(concat(chunks)));
  } catch {
    return null;
  }
}

/** The tool-call probe for a protocol, and the name of the tool it must call. */
export function toolProbe(protocol: ProviderProtocol, model: string): unknown {
  if (protocol === "responses") {
    return {
      model,
      stream: false,
      store: false,
      max_output_tokens: 64,
      tool_choice: "required",
      input: "Call the ok tool.",
      tools: [
        {
          type: "function",
          name: "ok",
          description: "Say the test passed.",
          parameters: { type: "object", properties: {} },
        },
      ],
    };
  }
  if (protocol === "anthropic") {
    return {
      model,
      stream: false,
      max_tokens: 64,
      tool_choice: { type: "any" },
      messages: [{ role: "user", content: "Call the ok tool." }],
      tools: [
        {
          name: "ok",
          description: "Say the test passed.",
          input_schema: { type: "object", properties: {} },
        },
      ],
    };
  }
  return protocol === "openai"
    ? {
        model,
        stream: false,
        max_tokens: 64,
        tool_choice: "required",
        messages: [{ role: "user", content: "Call the ok tool." }],
        tools: [
          {
            type: "function",
            function: {
              name: "ok",
              description: "Say the test passed.",
              parameters: { type: "object", properties: {} },
            },
          },
        ],
      }
    : {
        contents: [{ role: "user", parts: [{ text: "Call the ok function." }] }],
        tools: [
          {
            functionDeclarations: [
              {
                name: "ok",
                description: "Say the test passed.",
                parameters: { type: "object", properties: {} },
              },
            ],
          },
        ],
        toolConfig: { functionCallingConfig: { mode: "ANY" } },
        generationConfig: { maxOutputTokens: 64 },
      };
}

/** One field of an untrusted answer, by path; undefined when any step is missing. */
function at(value: unknown, ...path: (string | number)[]): unknown {
  let here = value;
  for (const step of path) {
    if (!here || typeof here !== "object") return undefined;
    here = (here as Record<string | number, unknown>)[step];
  }
  return here;
}

/** Whether an answer called the probe's tool; null when it is not a recognisable answer at all. */
export function calledTool(protocol: ProviderProtocol, answer: unknown): boolean | null {
  if (protocol === "responses") {
    const output = at(answer, "output");
    if (!Array.isArray(output)) return null;
    return output.some((item) => at(item, "type") === "function_call" && at(item, "name") === "ok");
  }
  if (protocol === "anthropic") {
    const content = at(answer, "content");
    if (!Array.isArray(content)) return null;
    return content.some((block) => at(block, "type") === "tool_use" && at(block, "name") === "ok");
  }
  if (protocol === "openai") {
    const message = at(answer, "choices", 0, "message");
    if (!message) return null;
    const calls = at(message, "tool_calls");
    return Array.isArray(calls) && calls.some((call) => at(call, "function", "name") === "ok");
  }
  const parts = at(answer, "candidates", 0, "content", "parts");
  if (!Array.isArray(parts)) return null;
  return parts.some((part) => at(part, "functionCall", "name") === "ok");
}

/** The text of an answer, either protocol. */
export function answerText(protocol: ProviderProtocol, answer: unknown): string {
  if (protocol === "responses") {
    const output = at(answer, "output");
    if (!Array.isArray(output)) return "";
    return output
      .flatMap((item) =>
        Array.isArray(at(item, "content")) ? (at(item, "content") as unknown[]) : [],
      )
      .map((part) => (at(part, "type") === "output_text" ? String(at(part, "text") ?? "") : ""))
      .join("");
  }
  if (protocol === "anthropic") {
    const content = at(answer, "content");
    return Array.isArray(content)
      ? content
          .map((block) => (at(block, "type") === "text" ? String(at(block, "text") ?? "") : ""))
          .join("")
      : "";
  }
  if (protocol === "openai") {
    const content = at(answer, "choices", 0, "message", "content");
    return typeof content === "string" ? content : "";
  }
  const parts = at(answer, "candidates", 0, "content", "parts");
  return Array.isArray(parts)
    ? parts.map((part) => (typeof at(part, "text") === "string" ? at(part, "text") : "")).join("")
    : "";
}

const COLOURS: [string, [number, number, number]][] = [
  ["red", [220, 20, 20]],
  ["green", [20, 170, 40]],
  ["blue", [20, 40, 220]],
  ["yellow", [240, 220, 20]],
  ["black", [0, 0, 0]],
  ["white", [255, 255, 255]],
];

function crc32(bytes: Uint8Array): number {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

async function zlib(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A 64x16 PNG of vertical stripes of equal width, one colour each, left to right. */
export async function stripesPng(stripes: [number, number, number][]): Promise<string> {
  const width = 64;
  const height = 16;
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3);
    for (let x = 0; x < width; x += 1)
      raw.set(stripes[Math.floor((x * stripes.length) / width)]!, row + 1 + x * 3);
  }
  const chunk = (type: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(new TextEncoder().encode(type), 4);
    out.set(data, 8);
    view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
    return out;
  };
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const png = concat([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", await zlib(raw)),
    chunk("IEND", new Uint8Array()),
  ]);
  return btoa(String.fromCharCode(...png));
}

const STRIPES = 4;

/**
 * The image probe: four stripes, each a different colour from its neighbour, that a model can only
 * name by seeing them. A text-only model guessing is right once in 750 tries.
 */
export async function visionProbe(
  protocol: ProviderProtocol,
  model: string,
  pick: () => number,
): Promise<{ body: unknown; colours: string[] }> {
  const chosen: number[] = [];
  for (let i = 0; i < STRIPES; i += 1) {
    const previous = chosen.at(-1);
    const choices = COLOURS.map((_, index) => index).filter((index) => index !== previous);
    chosen.push(choices[Math.floor(pick() * choices.length) % choices.length]!);
  }
  const colours = chosen.map((index) => COLOURS[index]![0]);
  const image = await stripesPng(chosen.map((index) => COLOURS[index]![1]));
  const question =
    "This image has four vertical stripes. Name the colour of each, left to right, as four words.";
  const body =
    protocol === "responses"
      ? {
          model,
          stream: false,
          store: false,
          max_output_tokens: 32,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: question },
                { type: "input_image", image_url: `data:image/png;base64,${image}` },
              ],
            },
          ],
        }
      : protocol === "anthropic"
        ? {
            model,
            stream: false,
            max_tokens: 32,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: question },
                  {
                    type: "image",
                    source: { type: "base64", media_type: "image/png", data: image },
                  },
                ],
              },
            ],
          }
        : protocol === "openai"
          ? {
              model,
              stream: false,
              max_tokens: 32,
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: question },
                    { type: "image_url", image_url: { url: `data:image/png;base64,${image}` } },
                  ],
                },
              ],
            }
          : {
              contents: [
                {
                  role: "user",
                  parts: [
                    { text: question },
                    { inline_data: { mime_type: "image/png", data: image } },
                  ],
                },
              ],
              generationConfig: { maxOutputTokens: 32 },
            };
  return { body, colours };
}

/** Whether an answer named exactly these colours, in this order (other words are ignored). */
export function sawColours(text: string, colours: string[]): boolean {
  const names = new Set(COLOURS.map(([name]) => name));
  const named = (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((word) => names.has(word));
  return named.join(" ") === colours.join(" ");
}

/** Where a protocol lists the models a key may use. */
export function listPath(protocol: ProviderProtocol): string {
  if (protocol === "gemini") return "/models?pageSize=1000";
  if (protocol === "anthropic") return "/models?limit=1000";
  return "/models";
}

/** A listed price in dollars per token, as dollars per million; undefined when not a number. */
function perMillion(value: unknown): number | undefined {
  const price = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(price) && price >= 0 && price < 1 ? price * 1_000_000 : undefined;
}

/**
 * The models in a provider's list answer, of any supported protocol (untrusted JSON): only valid
 * model names, at most 1000, and only what the provider itself said about each.
 */
export function listedModels(protocol: ProviderProtocol, answer: unknown): ListedModel[] | null {
  const rows = at(answer, protocol === "gemini" ? "models" : "data");
  if (!Array.isArray(rows)) return null;
  const models: ListedModel[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (models.length >= MAX_MODELS) break;
    const raw =
      protocol === "gemini"
        ? String(at(row, "name") ?? "").replace(/^models\//, "")
        : at(row, "id");
    const model = typeof raw === "string" && raw ? plannerModel(raw) : undefined;
    if (!model || seen.has(model)) continue;
    if (protocol === "gemini") {
      const methods = at(row, "supportedGenerationMethods");
      if (Array.isArray(methods) && !methods.includes("generateContent")) continue;
    }
    seen.add(model);
    const entry: ListedModel = { model };
    const label = at(
      row,
      protocol === "gemini" ? "displayName" : protocol === "anthropic" ? "display_name" : "name",
    );
    if (typeof label === "string" && label.trim()) entry.label = label.trim().slice(0, 200);
    // OpenRouter-style metadata: prices in dollars per token, parameters and input kinds.
    const input = perMillion(at(row, "pricing", "prompt"));
    const output = perMillion(at(row, "pricing", "completion"));
    if (input !== undefined && output !== undefined) {
      entry.free = input === 0 && output === 0;
      if (!entry.free) Object.assign(entry, { inputPrice: input, outputPrice: output });
    }
    const parameters = at(row, "supported_parameters");
    if (Array.isArray(parameters)) entry.callsTools = parameters.includes("tools");
    const modalities = at(row, "architecture", "input_modalities");
    if (Array.isArray(modalities)) entry.seesImages = modalities.includes("image");
    models.push(entry);
  }
  return models;
}

/** A refreshed model list for a connection: read from its provider and kept, or why not. */
async function refreshModels(
  deps: ByokDependencies,
  userId: string,
  route: CustomerRoute,
): Promise<{ count: number } | { status: string }> {
  let response: Response;
  try {
    response = await deps.list(route, AbortSignal.timeout(PROBE_TIMEOUT_MS));
  } catch {
    return { status: "unreachable" };
  }
  if (!response.ok) return { status: statusOf(response.status) };
  const models = listedModels(route.protocol, await boundedJson(response, MAX_LIST_BYTES));
  // A provider without a model list keeps the connection's own model, known from its test.
  if (!models) return { status: "incompatible" };
  return { count: await deps.saveModels(userId, route.id!, models) };
}

function amount(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 1_000_000_000 ? n : undefined;
}

function knownTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || !zone || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The spending policy a request asks for, or undefined when any part of it is not valid. */
export function spendingPolicy(body: Record<string, unknown>): SpendingPolicy | undefined {
  const modelMode =
    body.modelMode === "auto" ? "auto" : body.modelMode === "manual" ? "manual" : undefined;
  const spendMode = (["free_only", "custom", "unlimited"] as const).find(
    (m) => m === body.spendMode,
  );
  const currency = typeof body.currency === "string" ? body.currency.toUpperCase() : "";
  const [task, day, month] = [amount(body.task), amount(body.day), amount(body.month)];
  if (!modelMode || !spendMode || !/^[A-Z]{3}$/.test(currency) || !knownTimeZone(body.timeZone))
    return undefined;
  if (task === undefined || day === undefined || month === undefined) return undefined;
  if (spendMode === "custom" && task === null && day === null && month === null) return undefined;
  return {
    modelMode,
    spendMode,
    freeTier: body.freeTier === true,
    currency,
    timeZone: body.timeZone,
    task,
    day,
    month,
  };
}

function allowedTest(userId: string, now: number): boolean {
  const recent = (tests.get(userId) ?? []).filter((at) => now - at < 60_000);
  if (recent.length >= TESTS_PER_MINUTE) return false;
  tests.set(userId, [...recent, now]);
  return true;
}

/** Test a connection: what it proved, recorded and returned (never the key). */
async function testConnection(
  deps: ByokDependencies,
  userId: string,
  route: CustomerRoute,
  /** Another model of the connection's list, tested for Auto; its result is that model's only. */
  other?: string,
): Promise<{ status: string; seesImages: boolean | null; callsTools: boolean | null }> {
  if (other) route.model = other;
  const model = route.model!;
  const call = async (body: unknown) => {
    try {
      const response = await deps.send(route, body, AbortSignal.timeout(PROBE_TIMEOUT_MS));
      return { code: response.status, answer: response.ok ? await boundedJson(response) : null };
    } catch {
      return { code: 0, answer: null };
    }
  };
  const tools = await call(toolProbe(route.protocol, model));
  let status = tools.code === 200 ? "connected" : statusOf(tools.code);
  let callsTools: boolean | null = null;
  let seesImages: boolean | null = null;
  if (tools.code === 200) {
    const called = calledTool(route.protocol, tools.answer);
    // A 200 that is not this protocol's answer is an address that speaks something else.
    if (called === null) status = "incompatible";
    else callsTools = called;
  }
  if (status === "connected") {
    const probe = await visionProbe(route.protocol, model, Math.random);
    const seen = await call(probe.body);
    // Only an answer naming every colour in order proves sight; a refusal or a wrong answer is text-only.
    seesImages =
      seen.code === 200 && sawColours(answerText(route.protocol, seen.answer), probe.colours);
  }
  if (other) await deps.recordModel(userId, route.id!, model, callsTools, seesImages);
  else await deps.record(userId, route.id!, status, seesImages, callsTools);
  return { status, seesImages, callsTools };
}

export async function handleByok(request: Request, deps: ByokDependencies): Promise<Response> {
  const origin = request.headers.get("origin") ?? "";
  if (!origin || !deps.allowedOrigins.has(origin))
    return json(403, { error: "origin_not_allowed" });
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors(origin) });
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);
  const token = bearer(request);
  const identity = token ? await deps.verifyJwt(token) : null;
  if (!identity) return json(401, { error: "authentication_required" }, origin);
  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { error: "request_too_large" }, origin);
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }
  const userId = identity.userId;
  const id =
    typeof body.connectionId === "string" && UUID.test(body.connectionId)
      ? body.connectionId
      : null;
  try {
    switch (body.action) {
      case "save": {
        const alias = typeof body.alias === "string" ? body.alias.trim() : "";
        const protocol = PROTOCOLS.find((known) => known === body.protocol);
        const address = typeof body.endpoint === "string" ? gatewayAddress(body.endpoint) : null;
        const model = typeof body.model === "string" ? plannerModel(body.model) : undefined;
        const key = typeof body.key === "string" && body.key.trim() ? body.key.trim() : null;
        if (!alias || alias.length > 60) return json(400, { error: "alias_invalid" }, origin);
        if (!protocol) return json(400, { error: "protocol_invalid" }, origin);
        if (!address?.ok)
          return json(
            400,
            { error: "endpoint_refused", reason: address?.reason ?? "malformed" },
            origin,
          );
        if (!model) return json(400, { error: "model_invalid" }, origin);
        if (!id && !key) return json(400, { error: "key_required" }, origin);
        if (key && (key.length < 8 || key.length > 4096 || /[\s\p{Cc}]/u.test(key)))
          return json(400, { error: "key_invalid" }, origin);
        const saved = await deps.save({
          userId,
          connectionId: id,
          alias,
          protocol,
          endpoint: address.url,
          model,
          key,
        });
        return json(200, { connectionId: saved }, origin);
      }
      case "test": {
        if (!id) return json(400, { error: "connection_required" }, origin);
        if (!allowedTest(userId, (deps.now ?? Date.now)()))
          return json(429, { error: "too_many_tests", retryAfterSeconds: 60 }, origin);
        const other = typeof body.model === "string" ? plannerModel(body.model) : undefined;
        if (body.model !== undefined && !other)
          return json(400, { error: "model_invalid" }, origin);
        const route = await deps.route(userId, id);
        if (!route) return json(404, { error: "connection_not_found" }, origin);
        return json(200, await testConnection(deps, userId, route, other), origin);
      }
      case "models": {
        if (!id) return json(400, { error: "connection_required" }, origin);
        if (!allowedTest(userId, (deps.now ?? Date.now)()))
          return json(429, { error: "too_many_tests", retryAfterSeconds: 60 }, origin);
        const route = await deps.route(userId, id);
        if (!route) return json(404, { error: "connection_not_found" }, origin);
        const refreshed = await refreshModels(deps, userId, route);
        return "count" in refreshed
          ? json(200, refreshed, origin)
          : json(502, { error: "models_unavailable", status: refreshed.status }, origin);
      }
      case "model": {
        const model = typeof body.model === "string" ? plannerModel(body.model) : undefined;
        const inputPrice = amount(body.inputPrice);
        const outputPrice = amount(body.outputPrice);
        const currency =
          typeof body.currency === "string" && /^[A-Z]{3}$/.test(body.currency)
            ? body.currency
            : null;
        if (!id || !model || typeof body.permitted !== "boolean")
          return json(400, { error: "invalid_request" }, origin);
        if (
          inputPrice === undefined ||
          outputPrice === undefined ||
          ((inputPrice ?? outputPrice) !== null && !currency)
        )
          return json(400, { error: "price_invalid" }, origin);
        return (await deps.setModel({
          userId,
          connectionId: id,
          model,
          permitted: body.permitted,
          inputPrice,
          outputPrice,
          currency,
        }))
          ? json(200, { ok: true }, origin)
          : json(404, { error: "model_not_found" }, origin);
      }
      case "policy": {
        const policy = spendingPolicy(body);
        if (!id || !policy) return json(400, { error: "policy_invalid" }, origin);
        return (await deps.policy(userId, id, policy))
          ? json(200, { ok: true }, origin)
          : json(404, { error: "connection_not_found" }, origin);
      }
      case "enable": {
        if (!id || typeof body.enabled !== "boolean")
          return json(400, { error: "invalid_request" }, origin);
        return (await deps.enable(userId, id, body.enabled))
          ? json(200, { ok: true }, origin)
          : json(404, { error: "connection_not_found" }, origin);
      }
      case "choose": {
        if (body.surface !== "chat" && body.surface !== "jarvis")
          return json(400, { error: "invalid_request" }, origin);
        if (body.connectionId !== null && !id)
          return json(400, { error: "invalid_request" }, origin);
        await deps.choose(userId, body.surface, id);
        return json(200, { ok: true }, origin);
      }
      case "delete": {
        if (!id) return json(400, { error: "connection_required" }, origin);
        return (await deps.remove(userId, id))
          ? json(200, { ok: true }, origin)
          : json(404, { error: "connection_not_found" }, origin);
      }
      default:
        return json(400, { error: "invalid_request" }, origin);
    }
  } catch (error) {
    // The database's own refusals (not tested, at most 20, not theirs), never a stack or a key.
    const code = (error as { code?: string }).code;
    return json(
      code === "check_violation" ? 409 : code === "no_data_found" ? 404 : 503,
      {
        error:
          code === "check_violation"
            ? "not_allowed"
            : code === "no_data_found"
              ? "connection_not_found"
              : "byok_unavailable",
      },
      origin,
    );
  }
}

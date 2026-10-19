#!/usr/bin/env node
/**
 * PLAN Phase 04: the provider contract against REAL Gemini, through OCADE's own boundary code
 * (edge-handler.ts). Parallel calls, thought signatures, functionResponse continuation, a
 * three-turn tool chain, a rebuilt unsigned call, a rejected request that is never retried, a
 * screen image after a tool result, and STOP before a turn ends. About a dozen small requests.
 *
 *   OCADE_LIVE_GEMINI_KEY=<staging key> node scripts/e2e/gemini-contract.mjs
 *
 * A session whose network proxy injects the key: any placeholder value and NODE_USE_ENV_PROXY=1.
 * The key is sent only as Google's header and never printed.
 * OCADE_LIVE_GEMINI_MODEL pins either approved model. Gemma requires the candidate
 * OCADE_AI_GATEWAY_ACCOUNT_ID / OCADE_AI_GATEWAY_ID / OCADE_AI_GATEWAY_TOKEN settings.
 * Run only after independently confirming included/free capacity for that staging project.
 */
const KEY = process.env.OCADE_LIVE_GEMINI_KEY;
if (!KEY) {
  console.log("BLOCKED  Gemini contract — no staging Gemini key (OCADE_LIVE_GEMINI_KEY)");
  process.exit(3);
}
const { handleOnlineIntelligence } = await import("../../src/lib/intelligence/edge-handler.ts");
const { isAllowedOnlineModel } = await import("../../src/lib/intelligence/online-models.ts");
const { cloudflareProviderRequest } = await import("../../supabase/functions/_shared/gateway.ts");
const MODEL = process.env.OCADE_LIVE_GEMINI_MODEL || "gemini-3.5-flash-lite";
if (!isAllowedOnlineModel(MODEL)) {
  console.log("FAIL  native provider contract — unapproved model");
  process.exit(1);
}
const gateway = {
  accountId: process.env.OCADE_AI_GATEWAY_ACCOUNT_ID ?? "",
  gatewayId: process.env.OCADE_AI_GATEWAY_ID ?? "",
  token: process.env.OCADE_AI_GATEWAY_TOKEN ?? "",
};
const throughGateway = Object.values(gateway).some(Boolean);
if (
  (throughGateway || MODEL.startsWith("gemma-")) &&
  !cloudflareProviderRequest({
    ...gateway,
    key: KEY,
    model: MODEL,
    body: {},
    signal: new AbortController().signal,
  })
) {
  console.log(
    "BLOCKED  native provider contract — complete authenticated gateway configuration required",
  );
  process.exit(3);
}
const URL_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
async function fetchProvider(body, signal, stream = true) {
  const request = throughGateway
    ? cloudflareProviderRequest({
        ...gateway,
        key: KEY,
        model: MODEL,
        body,
        signal: signal ?? new AbortController().signal,
      })
    : null;
  const url = request?.url ?? `${URL_BASE}/${MODEL}:streamGenerateContent?alt=sse`;
  return fetch(stream ? url : url.replace(":streamGenerateContent?alt=sse", ":generateContent"), {
    method: "POST",
    redirect: "error",
    headers: request?.headers ?? { "content-type": "application/json", "x-goog-api-key": KEY },
    body: JSON.stringify(body),
    signal,
  });
}
const redact = (value) =>
  [KEY, gateway.token]
    .filter(Boolean)
    .reduce((text, secret) => text.replaceAll(secret, "[redacted]"), String(value));
const times = [];
const totals = { upstream: 0, input: 0, output: 0, requests: 0 };
let lastSent = null;
let results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${String(detail).slice(0, 400)}` : ""}`,
  );
};

const TOOLS = [
  {
    name: "get_weather",
    description: "Current weather for one city.",
    inputSchema: { type: "object", properties: { city: { type: "string" } }, required: ["city"] },
  },
  {
    name: "add",
    description: "a + b",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
  {
    name: "multiply",
    description: "a * b",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
  },
];

async function ask(messages, { tools = TOOLS, attachments = [], abortAfter } = {}) {
  totals.requests += 1;
  const id = crypto.randomUUID();
  const permit = {
    id: crypto.randomUUID(),
    generationId: id,
    idempotencyKey: id,
    surface: "jarvis",
    source: "server",
  };
  const controller = new AbortController();
  const started = performance.now();
  let upstream = 0;
  const response = await handleOnlineIntelligence(
    new Request("https://boundary.test/functions/v1/ocade-intelligence", {
      method: "POST",
      headers: {
        Origin: "https://ocade.test",
        Authorization: "Bearer t",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        permit,
        generationId: id,
        idempotencyKey: id,
        surface: "jarvis",
        messages,
        tools,
        attachments,
        privacy: { onlineInferenceConsented: true, sealed: false },
      }),
      signal: controller.signal,
    }),
    {
      allowedOrigins: new Set(["https://ocade.test"]),
      providerReady: true,
      model: MODEL,
      providerSlots: ["primary"],
      verifyJwt: async () => ({ userId: "probe" }),
      claimPermit: async () => ({ ok: true }),
      finalizePermit: async () => undefined,
      releasePermit: async () => undefined,
      callProvider: ({ model, body, signal }) => {
        if (model !== MODEL) throw new Error("Contract probe changed its pinned model");
        upstream += 1;
        totals.upstream += 1;
        lastSent = body;
        return fetchProvider(body, signal);
      },
    },
  );
  const out = {
    status: response.status,
    text: "",
    calls: [],
    refusal: null,
    final: null,
    upstream,
    ms: 0,
    events: [],
  };
  if (response.status !== 200) {
    out.body = redact(await response.text());
    out.ms = performance.now() - started;
    times.push(out.ms);
    return out;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let at;
    while ((at = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, at);
      buffer = buffer.slice(at + 2);
      if (!frame.startsWith("data: ")) continue;
      const event = JSON.parse(frame.slice(6));
      out.events.push(event.type);
      if (event.type === "token") out.text += event.text;
      if (event.type === "tool_call") out.calls.push(event.call);
      if (event.type === "refusal") out.refusal = event;
      if (event.type === "usage") {
        totals.input += event.usage.inputTokens ?? 0;
        totals.output += event.usage.outputTokens ?? 0;
      }
      if (event.type === "final") out.final = event.response;
      if (abortAfter && event.type === abortAfter) {
        await reader.cancel("STOP");
        out.upstream = upstream;
        out.ms = performance.now() - started;
        times.push(out.ms);
        return out;
      }
    }
  }
  out.upstream = upstream;
  out.ms = performance.now() - started;
  times.push(out.ms);
  return out;
}

const sys = {
  role: "system",
  content: "You are a precise assistant. Use the provided tools exactly as asked.",
};
const result = (call, value) => ({
  role: "user",
  content: value,
  toolResult: { callId: call.id, name: call.name },
});
const turn = (r) => ({
  role: "assistant",
  content: r.final?.text ?? r.text,
  toolCalls: r.final?.toolCalls ?? r.calls,
  ...(r.final?.parts ? { parts: r.final.parts } : {}),
});

// --- V05: parallel calls, signatures, correlated results --------------------------------------
const q1 = {
  role: "user",
  content:
    "What is the weather in Paris and in Tokyo? Call get_weather once for each city, both calls in this one reply.",
};
const a = await ask([sys, q1]);
console.log(
  `INFO  turn 1: ${a.status} ${a.ms.toFixed(0)} ms, calls ${JSON.stringify(a.calls.map((c) => ({ id: c.id, name: c.name, args: c.arguments, signed: Boolean(c.signature), sigLen: c.signature?.length ?? 0 })))}`,
);
check(
  "real provider returns parallel calls in one turn",
  a.final?.toolCalls?.length >= 2,
  a.final?.toolCalls?.length,
);
check(
  "the first call carries a thought signature, kept exactly",
  Boolean(a.final?.toolCalls?.[0]?.signature),
);
check(
  "calls are released only with the completed turn (V07)",
  a.events.indexOf("tool_call") > -1 && a.events.indexOf("tool_call") < a.events.indexOf("final"),
);
const weather = { Paris: "21 C and sunny", Tokyo: "9 C with heavy rain" };
const replies = a.final.toolCalls.map((c) =>
  result(
    c,
    JSON.stringify({ city: c.arguments.city, weather: weather[c.arguments.city] ?? "unknown" }),
  ),
);
const b = await ask([sys, q1, turn(a), ...replies]);
const sentParts = lastSent.contents.map(
  (c) =>
    `${c.role}:${c.parts
      .map((p) =>
        Object.keys(p)
          .filter((k) => k !== "text" || p.text)
          .join("+"),
      )
      .join(",")}`,
);
console.log(`INFO  turn 2 sent as: ${sentParts.join(" | ")}`);
check(
  "real provider accepts native functionCall + functionResponse continuation",
  b.status === 200 && Boolean(b.final),
  b.body ?? b.refusal?.reason,
);
check(
  "the answer matches each result to its own call",
  /Paris[^.]*21|21[^.]*Paris/i.test(b.text) && /Tokyo[^.]*9|9[^.]*Tokyo/i.test(b.text),
  b.text,
);

// --- V05: three-step sequential continuity -----------------------------------------------------
const q2 = {
  role: "user",
  content:
    "Compute (17 + 25) * 3 with the tools: call add first, then call multiply with its result. Then state the final number.",
};
let history = [sys, q2];
let steps = 0;
let finalText = "";
const order = [];
for (; steps < 5; steps += 1) {
  const r = await ask(history);
  if (r.status !== 200 || !r.final) {
    check("multi-step turn completes", false, r.body ?? r.refusal?.reason);
    break;
  }
  if (r.final.toolCalls.length === 0) {
    finalText = r.final.text;
    break;
  }
  history = [...history, turn(r)];
  for (const c of r.final.toolCalls) {
    order.push(c.name);
    const value = c.name === "add" ? c.arguments.a + c.arguments.b : c.arguments.a * c.arguments.b;
    history.push(result(c, JSON.stringify({ result: value })));
  }
}
check(
  "three-turn tool continuity reaches the right answer",
  /\b126\b/.test(finalText),
  `${order.join(" > ")} · ${finalText}`,
);
check("add then multiply, in that order", order.join(",") === "add,multiply", order.join(","));

// --- the signature is required, and the documented skip value is accepted ---------------------
const unsigned = structuredClone(history.slice(0, 3)); // sys, q2, first model turn
const raw = {
  system_instruction: { parts: [{ text: sys.content }] },
  contents: [
    { role: "user", parts: [{ text: q2.content }] },
    {
      role: "model",
      parts: unsigned[2].toolCalls.map((c) => ({
        functionCall: { name: c.name, args: c.arguments },
      })),
    },
    {
      role: "user",
      parts: unsigned[2].toolCalls.map((c) => ({
        functionResponse: { name: c.name, response: { result: '{"result":42}' } },
      })),
    },
  ],
  tools: [
    {
      function_declarations: TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      })),
    },
  ],
  generationConfig: {
    maxOutputTokens: 2048,
    thinkingConfig: { thinkingLevel: MODEL.startsWith("gemma-") ? "high" : "medium" },
  },
};
totals.upstream += 1;
const noSig = await fetchProvider(raw, undefined, false);
const noSigBody = redact(await noSig.text());
console.log(
  `INFO  current-turn call without any signature, sent raw: HTTP ${noSig.status} ${noSigBody.slice(0, 200).replace(/\s+/g, " ")}`,
);
const rebuilt = [
  sys,
  q2,
  {
    role: "assistant",
    content: "",
    toolCalls: unsigned[2].toolCalls.map((c, i) => ({
      id: `provider-tool-row-${i}`,
      name: c.name,
      arguments: c.arguments,
    })),
  },
  ...unsigned[2].toolCalls.map((c, i) => ({
    role: "user",
    content: JSON.stringify({ result: 42 }),
    toolResult: { callId: `provider-tool-row-${i}`, name: c.name },
  })),
];
const sk = await ask(rebuilt);
check(
  "a rebuilt call (Background Mode, no saved signature) is accepted with the skip value",
  sk.status === 200 && Boolean(sk.final),
  sk.body ?? sk.refusal?.reason,
);

// --- V06: a request the provider rejects is answered 400 once, never retried -------------------
const forged = structuredClone(history.slice(0, 3));
forged[2].toolCalls[0].signature = MODEL.startsWith("gemma-")
  ? "ocade-continuation:1:Zm9yZ2Vk"
  : "Zm9yZ2Vk";
const fr = await ask([...forged, ...forged[2].toolCalls.map((c) => result(c, '{"result":42}'))]);
console.log(
  `INFO  forged signature: boundary ${fr.status} ${fr.body ?? fr.refusal?.code ?? "accepted"}, upstream attempts ${fr.upstream}`,
);
check("a forged signature is never retried (one upstream attempt)", fr.upstream === 1, fr.upstream);
check("and is not reported as an outage", fr.status !== 503, `${fr.status} ${fr.body ?? ""}`);

// --- an image attached after a tool result (Background Mode's screen look) ---------------------
const png = (await import("node:zlib")).deflateSync(
  Buffer.from(
    Array.from({ length: 16 }, () => [
      0,
      ...Array.from({ length: 16 }, () => [220, 20, 20]).flat(),
    ]).flat(),
  ),
);
const crc = (buf) => {
  let c,
    t = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  let x = 0xffffffff;
  for (const byte of buf) x = t[(x ^ byte) & 0xff] ^ (x >>> 8);
  return (x ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(16, 0);
ihdr.writeUInt32BE(16, 4);
ihdr[8] = 8;
ihdr[9] = 2;
const image = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", png),
  chunk("IEND", Buffer.alloc(0)),
]).toString("base64");
const q3 = { role: "user", content: "Call get_weather for Paris." };
const c1 = await ask([sys, q3]);
const c2 = await ask(
  [
    sys,
    {
      role: "user",
      content:
        "Look at the screen with get_weather for Paris, then tell me the dominant colour of the attached screen image in one word.",
    },
    turn(c1),
    ...c1.final.toolCalls.map((c) => result(c, '{"weather":"see screen"}')),
  ],
  { attachments: [{ name: "screen.png", mime: "image/png", sizeBytes: image.length, image }] },
);
check(
  "a screen image after a tool result is accepted and read",
  c2.status === 200 && /red/i.test(c2.text),
  c2.body ?? c2.text,
);

// --- V07: STOP mid-stream releases no call ---------------------------------------------------
const s = await ask([sys, q1], { abortAfter: "status" });
check(
  "STOP before the turn ends releases no call",
  !s.events.includes("tool_call"),
  s.events.join(","),
);

console.log(
  `TOTALS boundary requests ${totals.requests} · upstream requests ${totals.upstream} · input tokens ${totals.input} · output tokens ${totals.output}`,
);
const orderedTimes = [...times].sort((a, b) => a - b);
const percentile = (p) => orderedTimes[Math.max(0, Math.ceil(orderedTimes.length * p) - 1)] ?? 0;
console.log(
  `CONTRACT ONLY model ${MODEL} · gateway ${throughGateway} · requests ${times.length} · p50 ${percentile(0.5).toFixed(0)} ms · p95 ${percentile(0.95).toFixed(0)} ms; not a real-task success rate`,
);
console.log(`${results.filter(Boolean).length} PASS, ${results.filter((x) => !x).length} FAIL`);
process.exit(results.every(Boolean) ? 0 : 1);

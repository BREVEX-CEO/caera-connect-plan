/**
 * Owner-directed model comparison (plan.md §19.4, configurations A/B/C): the server's ordered
 * model route, per-project quota discovery from the provider's own QuotaFailure detail, the
 * thinking-setting retry, and one planning turn over a live session. Scripted provider and a
 * fake socket only: this proves the boundary's handling, never a model's behaviour.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  handleOnlineIntelligence,
  providerQuota,
  type DiscoveredLimit,
  type OnlineHandlerDependencies,
} from "../../src/lib/intelligence/edge-handler.ts";
import {
  liveSetup,
  liveTurn,
  servedAsLiveSession,
  type LiveSocket,
} from "../../src/lib/intelligence/live-session.ts";
import { modelRoute } from "../../src/lib/intelligence/online-models.ts";

const user = "00000000-0000-4000-8000-000000000001";

function request(): Request {
  const permit = {
    id: "p1",
    generationId: "g1",
    idempotencyKey: "k1",
    surface: "jarvis",
    source: "server",
  };
  return new Request("http://service/", {
    method: "POST",
    headers: { "content-type": "application/json", "x-ocade-user": user },
    body: JSON.stringify({
      permit,
      generationId: "g1",
      idempotencyKey: "k1",
      surface: "jarvis",
      messages: [
        { role: "system", content: "Plan." },
        { role: "user", content: "Do the task." },
      ],
      tools: [{ name: "finish", description: "Finish.", inputSchema: { type: "object" } }],
      attachments: [],
      privacy: { onlineInferenceConsented: true, sealed: false },
    }),
  });
}

const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const callChunk = sse({
  candidates: [
    {
      content: { role: "model", parts: [{ functionCall: { id: "c1", name: "finish", args: {} } }] },
      finishReason: "STOP",
    },
  ],
});

function deps(
  model: string,
  callProvider: OnlineHandlerDependencies["callProvider"],
  extra: Partial<OnlineHandlerDependencies> = {},
): OnlineHandlerDependencies {
  return {
    allowedOrigins: new Set(),
    providerReady: true,
    providerSlots: ["primary", "secondary", "tertiary"],
    model,
    verifyJwt: async () => null,
    verifyService: async () => ({ userId: user }),
    claimPermit: async () => ({ ok: true }),
    sleep: async () => undefined,
    callProvider,
    ...extra,
  };
}

async function events(response: Response): Promise<{ type: string; [key: string]: unknown }[]> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)));
}

const dailyQuota = JSON.stringify({
  error: {
    code: 429,
    status: "RESOURCE_EXHAUSTED",
    details: [
      {
        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
        violations: [
          {
            quotaMetric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
            quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
            quotaValue: "1500",
          },
        ],
      },
      { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "12s" },
    ],
  },
});

test("the model route is the server's allowlisted order, and nothing else", () => {
  assert.deepEqual(modelRoute(undefined), ["gemini-3.5-flash-lite"]);
  assert.deepEqual(modelRoute("gemma-4-31b-it"), ["gemma-4-31b-it"]);
  assert.deepEqual(modelRoute(" gemma-4-31b-it , gemini-3.8-live-extended-thinking "), [
    "gemma-4-31b-it",
    "gemini-3.8-live-extended-thinking",
  ]);
  assert.equal(modelRoute("gemini-9-ultra"), undefined, "unknown model");
  assert.equal(modelRoute("gemma-4-31b-it,gemma-4-31b-it"), undefined, "duplicate");
  assert.equal(modelRoute("@cf/google/gemma-4-26b-a4b-it"), undefined, "High is not routable");
});

test("a quota refusal names its real limit; a per-day quota waits for the Pacific reset", () => {
  const now = Date.UTC(2026, 10, 7, 20, 0, 0); // 12:00 PST
  const quota = providerQuota(dailyQuota, now);
  assert.deepEqual(quota.limits, [
    {
      quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
      value: 1500,
      metric: "generativelanguage.googleapis.com/generate_content_free_tier_requests",
    },
  ]);
  assert.equal(quota.dailyResetMs, 12 * 3_600_000);
  const minute = providerQuota(dailyQuota.replace("PerDay", "PerMinute"), now);
  assert.equal(minute.dailyResetMs, undefined);
  assert.deepEqual(providerQuota("not json").limits, []);
});

test("configuration C: a spent model is skipped for the next, never another project", async () => {
  const calls: string[] = [];
  const limits: DiscoveredLimit[] = [];
  const quotaReturnsAt = new Map();
  const route = "gemma-4-31b-it,gemini-3.8-live-extended-thinking";
  const handler = deps(
    route,
    async ({ model, slot }) => {
      calls.push(`${model}@${slot}`);
      return model === "gemma-4-31b-it"
        ? new Response(dailyQuota, { status: 429 })
        : new Response(callChunk, { headers: { "content-type": "text/event-stream" } });
    },
    { quotaReturnsAt, discoveredLimit: (limit) => limits.push(limit) },
  );
  const answer = await events(await handleOnlineIntelligence(request(), handler));
  assert.deepEqual(calls, ["gemma-4-31b-it@primary", "gemini-3.8-live-extended-thinking@primary"]);
  assert.equal(answer.at(-1)?.type, "final");
  assert.equal(limits[0]?.slot, "primary");
  assert.equal(limits[0]?.model, "gemma-4-31b-it");
  assert.equal(limits[0]?.value, 1500);
  assert.ok(quotaReturnsAt.get("gemma-4-31b-it") > Date.now());

  // The next turn does not ask the spent model at all.
  calls.length = 0;
  await events(await handleOnlineIntelligence(request(), handler));
  assert.deepEqual(calls, ["gemini-3.8-live-extended-thinking@primary"]);
});

test("every model of the route spent: an honest 429 with the soonest return", async () => {
  const quotaReturnsAt = new Map([["gemma-4-31b-it", Date.now() + 90_000]]);
  const response = await handleOnlineIntelligence(
    request(),
    deps("gemma-4-31b-it", async () => assert.fail("a spent model was asked"), { quotaReturnsAt }),
  );
  assert.equal(response.status, 429);
  assert.ok(((await response.json()) as { retryAfterSeconds: number }).retryAfterSeconds >= 89);
});

test("a refused thinking setting is retried once without one, and remembered", async () => {
  const bodies: Record<string, unknown>[] = [];
  const withoutThinking = new Set<string>();
  const handler = deps(
    "gemma-4-31b-it",
    async ({ body }) => {
      bodies.push(body);
      const config = body.generationConfig as Record<string, unknown>;
      return config.thinkingConfig
        ? new Response('{"error":{"message":"thinking_level medium is not supported"}}', {
            status: 400,
          })
        : new Response(callChunk, { headers: { "content-type": "text/event-stream" } });
    },
    { withoutThinking },
  );
  const answer = await events(await handleOnlineIntelligence(request(), handler));
  assert.equal(answer.at(-1)?.type, "final");
  assert.equal(bodies.length, 2);
  assert.ok(withoutThinking.has("gemma-4-31b-it"));
  await events(await handleOnlineIntelligence(request(), handler));
  assert.equal(bodies.length, 3, "remembered: no second refused attempt");
});

test("a misconfigured route serves nothing; a rejected request is still reported as such", async () => {
  const none = await handleOnlineIntelligence(
    request(),
    deps("gemini-9-ultra", async () => assert.fail("misconfigured route called a provider")),
  );
  assert.equal(none.status, 503);
  const rejected = await handleOnlineIntelligence(
    request(),
    deps("gemma-4-31b-it", async () => new Response("{}", { status: 400 })),
  );
  assert.equal(rejected.status, 400);
  assert.deepEqual(await rejected.json(), { error: "provider_rejected_request" });
});

class FakeSocket implements LiveSocket {
  binaryType = "blob";
  sent: Record<string, unknown>[] = [];
  closed = false;
  url = "";
  private listeners = new Map<string, ((event: never) => void)[]>();
  addEventListener(type: string, listener: (event: never) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, event: unknown = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event as never);
  }
  server(message: unknown) {
    this.emit("message", { data: new TextEncoder().encode(JSON.stringify(message)).buffer });
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.closed = true;
  }
}

test("live models are recognised from the provider's own metadata", () => {
  assert.equal(servedAsLiveSession(["bidiGenerateContent"]), true);
  assert.equal(servedAsLiveSession(["generateContent", "countTokens"]), false);
  assert.equal(servedAsLiveSession(["generateContent", "bidiGenerateContent"]), false);
});

test("a live turn: audio modality with a transcript, asynchronous calls, audio discarded", async () => {
  const socket = new FakeSocket();
  const pending = liveTurn({
    key: "synthetic-key",
    model: "gemini-3.8-live-extended-thinking",
    body: {
      contents: [{ role: "user", parts: [{ text: "Do the task." }] }],
      system_instruction: { parts: [{ text: "Plan." }] },
      generationConfig: { maxOutputTokens: 100, thinkingConfig: { thinkingLevel: "medium" } },
      tools: [{ function_declarations: [{ name: "finish", description: "Finish." }] }],
    },
    signal: new AbortController().signal,
    connect: (url) => {
      socket.url = url;
      return socket;
    },
  });
  socket.emit("open");
  const setup = socket.sent[0]!.setup as {
    model: string;
    outputAudioTranscription: unknown;
    generationConfig: { responseModalities: string[]; thinkingConfig: { thinkingLevel: string } };
    tools: { functionDeclarations: { behavior: string }[] }[];
  };
  assert.deepEqual(setup.generationConfig.responseModalities, ["AUDIO"]);
  assert.deepEqual(setup.outputAudioTranscription, {});
  assert.equal(setup.tools[0].functionDeclarations[0].behavior, "NON_BLOCKING");
  assert.equal(setup.generationConfig.thinkingConfig.thinkingLevel, "medium");
  assert.equal(setup.model, "models/gemini-3.8-live-extended-thinking");
  socket.server({ setupComplete: {} });
  const response = await pending;
  assert.equal(response.status, 200);
  assert.deepEqual(socket.sent[1], {
    clientContent: {
      turns: [{ role: "user", parts: [{ text: "Do the task." }] }],
      turnComplete: true,
    },
  });
  socket.server({
    serverContent: {
      modelTurn: { parts: [{ inlineData: { mimeType: "audio/pcm", data: "AAAA" } }] },
      outputTranscription: { text: "Finishing now." },
    },
  });
  socket.server({ toolCall: { functionCalls: [{ id: "f1", name: "finish", args: {} }] } });
  socket.server({ usageMetadata: { promptTokenCount: 12, responseTokenCount: 7 } });
  socket.server({ serverContent: { turnComplete: true, interactionStatus: "IN_PROGRESS" } });
  const text = await response.text();
  assert.ok(!text.includes("AAAA"), "audio never leaves the adapter");
  assert.ok(text.includes("Finishing now."));
  const final = JSON.parse(text.trim().split("\n\n").at(-1)!.slice(6));
  assert.deepEqual(final.candidates[0].content.parts, [
    { functionCall: { id: "f1", name: "finish", args: {} } },
  ]);
  assert.equal(final.candidates[0].finishReason, "STOP");
  assert.deepEqual(final.usageMetadata, { promptTokenCount: 12, candidatesTokenCount: 7 });
  assert.ok(socket.closed);
});

test("a live session refused before setup answers with the status a request would have", async () => {
  for (const [reason, status] of [
    ["RESOURCE_EXHAUSTED: quota exceeded", 429],
    ["API key not valid. Please pass a valid API key.", 400],
    ["thinking_level minimal is not supported", 400],
    ["", 503],
  ] as const) {
    const socket = new FakeSocket();
    const pending = liveTurn({
      key: "k",
      model: "m",
      body: {},
      signal: new AbortController().signal,
      connect: () => socket,
    });
    socket.emit("close", { code: 1008, reason });
    const response = await pending;
    assert.equal(response.status, status, reason);
    if (reason) assert.ok((await response.text()).includes(reason.slice(0, 20)));
  }
});

test("a live session through the boundary: the turn's call reaches the planner as final", async () => {
  const socket = new FakeSocket();
  const handler = deps("gemini-3.8-live-extended-thinking", async ({ model, body, signal }) => {
    const pending = liveTurn({ key: "k", model, body, signal, connect: () => socket });
    queueMicrotask(() => {
      socket.emit("open");
      socket.server({ setupComplete: {} });
      queueMicrotask(() => {
        socket.server({ toolCall: { functionCalls: [{ id: "f9", name: "finish", args: {} }] } });
        socket.server({ serverContent: { turnComplete: true } });
      });
    });
    return pending;
  });
  const answer = await events(await handleOnlineIntelligence(request(), handler));
  const final = answer.at(-1) as { type: string; response: { toolCalls: { id: string }[] } };
  assert.equal(final.type, "final");
  assert.deepEqual(
    final.response.toolCalls.map((call) => call.id),
    ["f9"],
  );
  assert.ok(liveSetup("m", {}).setup);
});

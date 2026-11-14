/**
 * The server's planner model (plan.md O2/O14: Gemini 3.5 Flash-Lite by default, Gemma 4 31B by
 * configuration, each alone), per-project quota discovery from the provider's own QuotaFailure
 * detail, and the thinking-setting retry. Scripted provider only: this proves the boundary's
 * handling, never a model's behaviour.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  handleOnlineIntelligence,
  providerQuota,
  type DiscoveredLimit,
  type OnlineHandlerDependencies,
  type ProviderFeature,
} from "../../src/lib/intelligence/edge-handler.ts";
import { plannerModel } from "../../src/lib/intelligence/online-models.ts";

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
      tools: [
        {
          name: "finish",
          description: "Finish.",
          inputSchema: {
            $schema: "https://json-schema.org/draft/2020-12/schema",
            type: "object",
            additionalProperties: false,
            properties: { why: { const: "done", maxLength: 9 } },
          },
        },
      ],
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

test("the planner is one allowlisted model, chosen by the server, never a route", () => {
  assert.equal(plannerModel(undefined), "gemini-3.5-flash-lite");
  assert.equal(plannerModel(" gemma-4-31b-it "), "gemma-4-31b-it");
  assert.equal(plannerModel("gemini-3.5-flash-lite"), "gemini-3.5-flash-lite");
  assert.equal(plannerModel("gemma-4-31b-it,gemini-3.5-flash-lite"), undefined, "no hybrid");
  assert.equal(plannerModel("gemini-3.8-live-extended-thinking"), undefined, "retired");
  assert.equal(plannerModel("gemini-9-ultra"), undefined, "unknown model");
  assert.equal(plannerModel("@cf/google/gemma-4-26b-a4b-it"), undefined, "High is not routable");
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

test("a spent model is never answered by another model or another project", async () => {
  const calls: string[] = [];
  const limits: DiscoveredLimit[] = [];
  const quotaReturnsAt = new Map();
  const handler = deps(
    "gemma-4-31b-it",
    async ({ model, slot }) => {
      calls.push(`${model}@${slot}`);
      return new Response(dailyQuota, { status: 429 });
    },
    { quotaReturnsAt, discoveredLimit: (limit) => limits.push(limit) },
  );
  const response = await handleOnlineIntelligence(request(), handler);
  assert.equal(response.status, 429);
  assert.deepEqual(calls, ["gemma-4-31b-it@primary"]);
  assert.equal(limits[0]?.model, "gemma-4-31b-it");
  assert.ok(quotaReturnsAt.get("gemma-4-31b-it") > Date.now());

  // The next turn does not ask the spent model at all.
  calls.length = 0;
  assert.equal((await handleOnlineIntelligence(request(), handler)).status, 429);
  assert.deepEqual(calls, []);
});

test("the planner model spent: an honest 429 with the soonest return", async () => {
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
  const refused = new Map<string, Set<ProviderFeature>>();
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
    { refused },
  );
  const answer = await events(await handleOnlineIntelligence(request(), handler));
  assert.equal(answer.at(-1)?.type, "final");
  assert.equal(bodies.length, 2);
  assert.ok(refused.get("gemma-4-31b-it")?.has("thinking"));
  await events(await handleOnlineIntelligence(request(), handler));
  assert.equal(bodies.length, 3, "remembered: no second refused attempt");
});

test("a JARVIS turn must answer with a call, and every operation carries its complete schema", async () => {
  const bodies: Record<string, unknown>[] = [];
  const handler = deps("gemini-3.5-flash-lite", async ({ body }) => {
    bodies.push(body);
    return new Response(callChunk, { headers: { "content-type": "text/event-stream" } });
  });
  await events(await handleOnlineIntelligence(request(), handler));
  const sent = bodies[0]!;
  assert.deepEqual(sent.toolConfig, { functionCallingConfig: { mode: "ANY" } });
  const [declaration] = (sent.tools as { function_declarations: Record<string, unknown>[] }[])[0]!
    .function_declarations;
  assert.deepEqual(declaration, {
    name: "finish",
    description: "Finish.",
    parametersJsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: { why: { const: "done", maxLength: 9 } },
    },
  });
});

for (const [feature, refusal] of [
  ["forced_call", "Invalid value at 'tool_config.function_calling_config.mode'"],
  ["json_schema", 'Unknown name "parametersJsonSchema" at function_declarations[0]'],
] as const) {
  test(`a model that refuses ${feature} is asked once without it, and only it`, async () => {
    const bodies: Record<string, unknown>[] = [];
    const refused = new Map<string, Set<ProviderFeature>>();
    const handler = deps(
      "gemma-4-31b-it",
      async ({ body }) => {
        bodies.push(body);
        const text = JSON.stringify(body);
        const carries = feature === "forced_call" ? "toolConfig" : "parametersJsonSchema";
        return text.includes(carries)
          ? new Response(JSON.stringify({ error: { message: refusal } }), { status: 400 })
          : new Response(callChunk, { headers: { "content-type": "text/event-stream" } });
      },
      { refused },
    );
    const answer = await events(await handleOnlineIntelligence(request(), handler));
    assert.equal(answer.at(-1)?.type, "final");
    assert.equal(bodies.length, 2, "the refusal is learning, not a spent attempt");
    assert.deepEqual([...refused.get("gemma-4-31b-it")!], [feature]);
    const retried = JSON.stringify(bodies[1]);
    if (feature === "json_schema") {
      // The provider's subset: the rule a model needs survives, the unsupported words do not.
      assert.match(
        retried,
        /"parameters":\{"type":"object","properties":\{"why":\{"enum":\["done"\]/,
      );
      assert.match(retried, /toolConfig/);
    } else {
      assert.match(retried, /parametersJsonSchema/);
      assert.doesNotMatch(retried, /toolConfig/);
    }
  });
}

test("Chat is never forced to call a function", async () => {
  const bodies: Record<string, unknown>[] = [];
  const value = JSON.parse(await request().text());
  value.surface = value.permit.surface = "chat";
  const origin = "https://ocade.example";
  const handler = deps(
    "gemini-3.5-flash-lite",
    async ({ body }) => {
      bodies.push(body);
      return new Response(callChunk, { headers: { "content-type": "text/event-stream" } });
    },
    {
      allowedOrigins: new Set([origin]),
      verifyService: undefined,
      verifyJwt: async () => ({ userId: user }),
      consented: async () => true,
    },
  );
  const response = await handleOnlineIntelligence(
    new Request("http://browser/", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer t", origin },
      body: JSON.stringify(value),
    }),
    handler,
  );
  await response.text();
  assert.equal(bodies.length, 1, `status ${response.status}`);
  assert.equal(bodies[0]!.toolConfig, undefined);
  assert.ok(JSON.stringify(bodies[0]).includes("parametersJsonSchema"));
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

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
import {
  keySlots,
  plannerKeys,
  plannerModel,
  plannerProvider,
} from "../../src/lib/intelligence/online-models.ts";

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

test("the planner is any one model the server names, never a route", () => {
  assert.equal(plannerModel(undefined), "gemini-3.5-flash-lite");
  assert.equal(plannerModel(" gemma-4-31b-it "), "gemma-4-31b-it");
  assert.equal(plannerModel("openai/gpt-oss-120b"), "openai/gpt-oss-120b", "any compatible model");
  assert.equal(plannerModel("@cf/google/gemma-4-26b-a4b-it"), "@cf/google/gemma-4-26b-a4b-it");
  assert.equal(plannerModel("gemma-4-31b-it,gemini-3.5-flash-lite"), undefined, "no hybrid");
  assert.equal(plannerModel("gemma-4-31b-it gemini-3.5-flash-lite"), undefined, "no hybrid");
  assert.equal(plannerModel(""), undefined);
});

test("any HTTPS provider endpoint and any number of keys, up to eight, from the server only", () => {
  const env = (values: Record<string, string>) => (name: string) => values[name];
  assert.deepEqual(plannerProvider(env({})), {
    protocol: "gemini",
    endpoint: "https://generativelanguage.googleapis.com/v1beta",
  });
  assert.deepEqual(
    plannerProvider(
      env({ OCADE_MODEL_PROTOCOL: "openai", OCADE_MODEL_ENDPOINT: "https://api.example.test/v1/" }),
    ),
    { protocol: "openai", endpoint: "https://api.example.test/v1" },
  );
  for (const endpoint of [
    "http://api.example.test/v1",
    "https://user:pass@api.example.test/v1",
    "https://api.example.test/v1?key=x",
  ])
    assert.equal(
      plannerProvider(env({ OCADE_MODEL_PROTOCOL: "openai", OCADE_MODEL_ENDPOINT: endpoint })),
      undefined,
      endpoint,
    );
  assert.equal(plannerProvider(env({ OCADE_MODEL_PROTOCOL: "openai" })), undefined, "no endpoint");
  assert.equal(plannerProvider(env({ OCADE_MODEL_PROTOCOL: "soap" })), undefined);
  assert.deepEqual(plannerKeys(env({ OCADE_MODEL_API_KEYS: '["a","b","a",""]' })), ["a", "b"]);
  assert.deepEqual(plannerKeys(env({ OCADE_MODEL_API_KEYS: "a, b\nc" })), ["a", "b", "c"]);
  assert.equal(
    plannerKeys(
      env({ OCADE_MODEL_API_KEYS: Array.from({ length: 12 }, (_, i) => `k${i}`).join(",") }),
    ).length,
    8,
  );
  assert.deepEqual(
    plannerKeys(env({ GEMINI_API_KEY_PRIMARY: "p", GEMINI_API_KEY_TERTIARY: "t" })),
    ["p", "t"],
    "the older secrets still serve",
  );
  assert.deepEqual(keySlots(5), ["primary", "secondary", "tertiary", "key4", "key5"]);
});

test("an OpenAI-compatible planner: forced call, full schema, and what it refused is learned once", async () => {
  const bodies: Record<string, unknown>[] = [];
  const learned: string[] = [];
  const handler = deps(
    "openai/gpt-oss-120b",
    async ({ body }) => {
      bodies.push(body);
      if ("reasoning_effort" in body)
        return new Response(
          JSON.stringify({ error: { message: "Unsupported parameter: 'reasoning_effort'" } }),
          { status: 400 },
        );
      const chunk = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
      return new Response(
        chunk({
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "c1",
                    type: "function",
                    function: { name: "finish", arguments: "{}" },
                  },
                ],
              },
            },
          ],
        }) + chunk({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }),
        { headers: { "content-type": "text/event-stream" } },
      );
    },
    {
      protocol: "openai",
      refused: new Map(),
      capabilities: {
        load: async () => [],
        learn: async (model, feature) => void learned.push(`${model}:${feature}`),
      },
    },
  );
  const answer = await events(await handleOnlineIntelligence(request(), handler));
  assert.equal(answer.at(-1)?.type, "final");
  assert.equal(bodies.length, 2);
  const [first, second] = bodies as Record<string, unknown>[];
  assert.equal(first!.model, "openai/gpt-oss-120b");
  assert.equal(first!.tool_choice, "required");
  assert.deepEqual(
    (first!.messages as { role: string }[]).map((m) => m.role),
    ["system", "user"],
  );
  const [tool] = first!.tools as { function: { parameters: Record<string, unknown> } }[];
  assert.equal(tool!.function.parameters.additionalProperties, false, "the full schema");
  assert.equal("$schema" in tool!.function.parameters, false);
  assert.equal("reasoning_effort" in second!, false);
  assert.equal("chat_template_kwargs" in first!, false);
  assert.deepEqual(learned, ["openai/gpt-oss-120b:thinking"], "saved for every instance");
});

test("a cold instance reads what a model refused before its first call", async () => {
  const bodies: Record<string, unknown>[] = [];
  const handler = deps(
    "gemma-4-31b-it",
    async ({ body }) => {
      bodies.push(body);
      return new Response(callChunk, { headers: { "content-type": "text/event-stream" } });
    },
    {
      refused: new Map(),
      capabilities: { load: async () => ["forced_call", "thinking"], learn: async () => undefined },
    },
  );
  assert.equal(
    (await events(await handleOnlineIntelligence(request(), handler))).at(-1)?.type,
    "final",
  );
  assert.equal(bodies.length, 1);
  assert.doesNotMatch(JSON.stringify(bodies[0]), /toolConfig|thinkingConfig/);
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

test("a model that takes no system instruction reads it in the first user turn", async () => {
  const bodies: Record<string, unknown>[] = [];
  const refused = new Map<string, Set<ProviderFeature>>();
  const handler = deps(
    "gemma-4-31b-it",
    async ({ body }) => {
      bodies.push(body);
      return body.system_instruction
        ? new Response(
            '{"error":{"message":"Developer instruction is not enabled for models/gemma"}}',
            {
              status: 400,
            },
          )
        : new Response(callChunk, { headers: { "content-type": "text/event-stream" } });
    },
    { refused },
  );
  assert.equal(
    (await events(await handleOnlineIntelligence(request(), handler))).at(-1)?.type,
    "final",
  );
  assert.equal(bodies.length, 2);
  const [first] = bodies[1]!.contents as { role: string; parts: { text?: string }[] }[];
  assert.equal(first!.role, "user");
  assert.deepEqual(
    first!.parts.map((part) => part.text),
    ["Plan.\n\n", "Do the task."],
  );
  assert.ok(refused.get("gemma-4-31b-it")?.has("system_instruction"));
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

test("a key its provider refused is tried last on later turns, never dropped", async () => {
  const keyRefusedUntil = new Map<string, number>();
  const asked: string[] = [];
  let now = 1_000;
  const handler = deps(
    "gemini-3.5-flash-lite",
    async ({ slot }) => {
      asked.push(slot);
      return slot === "primary"
        ? new Response(null, { status: 403 })
        : new Response(callChunk, { headers: { "content-type": "text/event-stream" } });
    },
    { keyRefusedUntil, now: () => now },
  );
  await events(await handleOnlineIntelligence(request(), handler));
  assert.deepEqual(asked, ["primary", "secondary"]);
  await events(await handleOnlineIntelligence(request(), handler));
  assert.deepEqual(asked.slice(2), ["secondary"], "the healthy key first");
  now += 11 * 60_000;
  await events(await handleOnlineIntelligence(request(), handler));
  assert.deepEqual(asked.slice(3), ["primary", "secondary"], "asked again after its rest");
});

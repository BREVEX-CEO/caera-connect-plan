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

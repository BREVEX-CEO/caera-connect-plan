/**
 * A customer's own connection (BYOK, plan 14B.1A/B): once chosen, every call of the turn goes to
 * it and to nothing else, its failures are reported under its own name, the turn is marked as
 * served by the customer's key, and a choice that cannot be read sends nothing. Scripted provider
 * only: this proves the boundary's routing, never a model's behaviour.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  handleOnlineIntelligence,
  type CustomerRoute,
  type OnlineHandlerDependencies,
} from "../../src/lib/intelligence/edge-handler.ts";
import { HIGH_WARNING_VERSION } from "../../src/lib/intelligence/quality.ts";

const alice = "00000000-0000-4000-8000-00000000000a";

function request(extra: Record<string, unknown> = {}): Request {
  const permit = {
    id: "p1",
    generationId: "g1",
    idempotencyKey: "k1",
    surface: "jarvis",
    source: "server",
  };
  return new Request("http://service/", {
    method: "POST",
    headers: { "content-type": "application/json", "x-ocade-user": alice },
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
      ...extra,
    }),
  });
}

const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const openaiCall =
  sse({
    choices: [
      {
        index: 0,
        delta: {
          tool_calls: [
            { index: 0, id: "c1", type: "function", function: { name: "finish", arguments: "{}" } },
          ],
        },
      },
    ],
  }) + sse({ choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] });

const chosen = (over: Partial<CustomerRoute> = {}): CustomerRoute => ({
  id: "conn-a1",
  enabled: true,
  status: "connected",
  protocol: "openai",
  model: "vendor/alice-model",
  seesImages: null,
  ...over,
});

interface Seen {
  calls: { model: string; slot: string; customer?: string }[];
  bound: string[];
  recorded: string[];
  released: number;
}

function deps(
  route: () => Promise<CustomerRoute | null>,
  answer: () => Response,
  seen: Seen,
  extra: Partial<OnlineHandlerDependencies> = {},
): OnlineHandlerDependencies {
  return {
    allowedOrigins: new Set(),
    providerReady: true,
    providerSlots: ["primary", "secondary"],
    model: "gemini-3.5-flash-lite",
    verifyJwt: async () => null,
    verifyService: async () => ({ userId: alice }),
    claimPermit: async () => ({ ok: true }),
    releasePermit: async () => void (seen.released += 1),
    sleep: async () => undefined,
    byok: {
      route,
      bind: async (_user, _permit, id) => (seen.bound.push(id), true),
      record: async (_user, id, status) => void seen.recorded.push(`${id}:${status}`),
    },
    callProvider: async ({ model, slot, customer }) => {
      seen.calls.push({ model, slot, ...(customer ? { customer: customer.id! } : {}) });
      return answer();
    },
    ...extra,
  };
}

const fresh = (): Seen => ({ calls: [], bound: [], recorded: [], released: 0 });

test("a chosen connection serves the whole turn; no OCADE key is ever presented", async () => {
  const seen = fresh();
  const calls: unknown[] = [];
  const handler = deps(
    async () => chosen({ status: "rate_limited" }),
    () => new Response(openaiCall, { headers: { "content-type": "text/event-stream" } }),
    seen,
    { recordCall: async (call) => void calls.push(call) },
  );
  const response = await handleOnlineIntelligence(request(), handler);
  const text = await response.text();
  assert.match(text, /"type":"final"/);
  assert.deepEqual(seen.calls, [
    { model: "vendor/alice-model", slot: "customer", customer: "conn-a1" },
  ]);
  assert.deepEqual(seen.bound, ["conn-a1"], "the permit is marked as the customer's key");
  assert.deepEqual(seen.recorded, ["conn-a1:connected"], "a working key clears its old status");
  assert.deepEqual(calls, [
    {
      userId: alice,
      surface: "jarvis",
      source: "customer",
      credential: "conn-a1",
      model: "vendor/alice-model",
      inputTokens: null,
      outputTokens: null,
    },
  ]);
});

test("High quality is OCADE's model: with a customer's connection chosen it is not used", async () => {
  const seen = fresh();
  const handler = deps(
    async () => chosen(),
    () => new Response(openaiCall, { headers: { "content-type": "text/event-stream" } }),
    seen,
    { highAvailable: async () => true },
  );
  await (
    await handleOnlineIntelligence(
      request({ quality: "high", highModeAcknowledged: HIGH_WARNING_VERSION }),
      handler,
    )
  ).text();
  assert.deepEqual(
    seen.calls.map((call) => call.slot),
    ["customer"],
  );
});

test("a refused, spent or unreachable customer key is reported as such, never replaced", async () => {
  for (const [status, error, code, recorded] of [
    [401, "byok_invalid", 502, "invalid"],
    [403, "byok_invalid", 502, "invalid"],
    [402, "byok_credits_unavailable", 502, "credits_unavailable"],
    [404, "byok_incompatible", 502, "incompatible"],
    [429, "byok_rate_limited", 429, "rate_limited"],
    [503, "byok_unreachable", 502, "unreachable"],
    [421, "byok_blocked", 502, "blocked"],
  ] as const) {
    const seen = fresh();
    const handler = deps(
      async () => chosen(),
      () => new Response("{}", { status }),
      seen,
    );
    const response = await handleOnlineIntelligence(request(), handler);
    assert.equal(response.status, code, String(status));
    const body = (await response.json()) as { error: string; connection: string };
    assert.equal(body.error, error);
    assert.equal(body.connection, "conn-a1");
    assert.ok(
      seen.calls.every((call) => call.slot === "customer"),
      `${status}: only the customer's key`,
    );
    assert.deepEqual(seen.recorded, [`conn-a1:${recorded}`]);
  }
});

test("a deleted, turned-off or refused chosen connection sends nothing at all", async () => {
  for (const [route, error] of [
    [chosen({ id: null }), "byok_missing"],
    [chosen({ enabled: false }), "byok_disabled"],
    [chosen({ status: "invalid" }), "byok_invalid"],
    [chosen({ status: "credits_unavailable" }), "byok_credits_unavailable"],
  ] as const) {
    const seen = fresh();
    const handler = deps(
      async () => route,
      () => new Response(openaiCall),
      seen,
    );
    const response = await handleOnlineIntelligence(request(), handler);
    assert.equal(response.status, 409);
    assert.equal(((await response.json()) as { error: string }).error, error);
    assert.equal(seen.calls.length, 0, error);
  }
});

test("a choice that cannot be read, or a permit that cannot be marked, sends nothing", async () => {
  const unread = fresh();
  const failing = deps(
    async () => {
      throw new Error("database unavailable");
    },
    () => new Response(openaiCall),
    unread,
  );
  const response = await handleOnlineIntelligence(request(), failing);
  assert.equal(response.status, 503);
  assert.equal(((await response.json()) as { error: string }).error, "byok_unavailable");
  assert.equal(unread.calls.length, 0, "an unread choice is never taken to be OCADE's");

  const unbound = fresh();
  const handler = deps(
    async () => chosen(),
    () => new Response(openaiCall),
    unbound,
  );
  handler.byok!.bind = async () => false;
  const refused = await handleOnlineIntelligence(request(), handler);
  assert.equal(refused.status, 503);
  assert.equal(unbound.calls.length, 0);
  assert.equal(unbound.released, 1, "the claimed permit is given back");
});

test("nothing chosen: OCADE's own keys serve, and no customer connection is touched", async () => {
  const seen = fresh();
  const handler = deps(
    async () => null,
    () => new Response("{}", { status: 503 }),
    seen,
  );
  await handleOnlineIntelligence(request(), handler);
  assert.ok(seen.calls.length > 0 && seen.calls.every((call) => call.slot !== "customer"));
  assert.deepEqual(seen.bound, []);
});

test("a customer model's quota and refusals are its own, never another connection's", async () => {
  const quotaReturnsAt = new Map<string, number>();
  const seen = fresh();
  const busy = deps(
    async () => chosen(),
    () => new Response("{}", { status: 429, headers: { "retry-after": "600" } }),
    seen,
    { quotaReturnsAt },
  );
  assert.equal((await handleOnlineIntelligence(request(), busy)).status, 429);
  assert.deepEqual([...quotaReturnsAt.keys()], ["customer:conn-a1"]);
  // The same model id behind Bob's connection, or OCADE's, is not held back by Alice's quota.
  const other = fresh();
  const bob = deps(
    async () => chosen({ id: "conn-b1" }),
    () => new Response(openaiCall, { headers: { "content-type": "text/event-stream" } }),
    other,
    { quotaReturnsAt },
  );
  await (await handleOnlineIntelligence(request(), bob)).text();
  assert.equal(other.calls.length, 1);
});

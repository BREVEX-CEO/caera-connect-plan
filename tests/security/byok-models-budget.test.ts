/**
 * All the models under one customer key, and the person's spending policy for it (plan 14D.4A):
 * a provider's list is read only for what it says; a policy is kept only when every part is
 * valid; and a call on the key is reserved before it is sent, refused by the policy with nothing
 * sent, and settled after with the provider-reported usage. Scripted provider and database only.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  handleByok,
  listPath,
  listedModels,
  spendingPolicy,
  type ByokDependencies,
  type ListedModel,
} from "../../src/lib/intelligence/byok-handler.ts";
import {
  handleOnlineIntelligence,
  type CustomerRoute,
  type OnlineHandlerDependencies,
} from "../../src/lib/intelligence/edge-handler.ts";
import { BYOK_REFUSALS } from "../../src/lib/byok/refusals.ts";

const origin = "https://ocade.example";
const alice = "00000000-0000-4000-8000-00000000000a";
const conn = "11111111-2222-4333-8444-555555555555";

test("OpenRouter-style lists give prices, free models, tools and images; nothing is invented", () => {
  const models = listedModels("openai", {
    data: [
      {
        id: "vendor/free:free",
        name: "Free one",
        pricing: { prompt: "0", completion: "0" },
        supported_parameters: ["tools", "temperature"],
        architecture: { input_modalities: ["text", "image"] },
      },
      { id: "vendor/paid", pricing: { prompt: "0.000002", completion: "0.00001" } },
      { id: "plain-model" },
      { id: "bad id with spaces" },
      { id: "plain-model" },
      { id: 42 },
    ],
  });
  assert.deepEqual(models, [
    {
      model: "vendor/free:free",
      label: "Free one",
      free: true,
      callsTools: true,
      seesImages: true,
    },
    { model: "vendor/paid", free: false, inputPrice: 2, outputPrice: 10 },
    { model: "plain-model" },
  ]);
  assert.equal(listedModels("openai", { error: "nope" }), null, "not a list is not an empty list");
});

test("Gemini and Anthropic lists, each in its own shape", () => {
  assert.deepEqual(
    listedModels("gemini", {
      models: [
        {
          name: "models/gemini-x",
          displayName: "Gemini X",
          supportedGenerationMethods: ["generateContent", "countTokens"],
        },
        { name: "models/embed-y", supportedGenerationMethods: ["embedContent"] },
      ],
    }),
    [{ model: "gemini-x", label: "Gemini X" }],
  );
  assert.deepEqual(
    listedModels("anthropic", { data: [{ id: "claude-x", display_name: "Claude X" }] }),
    [{ model: "claude-x", label: "Claude X" }],
  );
  assert.equal(listPath("gemini"), "/models?pageSize=1000");
  assert.equal(listPath("responses"), "/models");
  const many = { data: Array.from({ length: 1500 }, (_, i) => ({ id: `m${i}` })) };
  assert.equal(listedModels("openai", many)?.length, 1000, "a list is capped");
});

test("a spending policy is kept only when every part of it is valid", () => {
  const base = {
    modelMode: "auto",
    spendMode: "custom",
    currency: "inr",
    timeZone: "Asia/Kolkata",
    task: 50,
    day: "",
    month: 2000,
  };
  assert.deepEqual(spendingPolicy(base), {
    modelMode: "auto",
    spendMode: "custom",
    freeTier: false,
    currency: "INR",
    timeZone: "Asia/Kolkata",
    task: 50,
    day: null,
    month: 2000,
  });
  assert.equal(spendingPolicy({ ...base, timeZone: "Mars/Olympus" }), undefined);
  assert.equal(spendingPolicy({ ...base, task: -1 }), undefined);
  assert.equal(spendingPolicy({ ...base, currency: "rupees" }), undefined);
  assert.equal(spendingPolicy({ ...base, spendMode: "lots" }), undefined);
  assert.equal(
    spendingPolicy({ ...base, task: null, month: null }),
    undefined,
    "Custom needs an amount",
  );
  assert.equal(
    spendingPolicy({ ...base, spendMode: "unlimited", task: null, month: null })?.spendMode,
    "unlimited",
  );
});

function byokDeps(log: unknown[], list: () => Response): ByokDependencies {
  const route: CustomerRoute = {
    id: conn,
    enabled: true,
    status: "connected",
    protocol: "openai",
    model: "vendor/main",
    seesImages: null,
  };
  return {
    allowedOrigins: new Set([origin]),
    verifyJwt: async (token) => (token === "alice" ? { userId: alice } : null),
    save: async () => conn,
    route: async (userId, id) => (userId === alice && id === conn ? { ...route } : null),
    send: async (r) =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "",
                tool_calls: [{ function: { name: r.model === "vendor/tools" ? "ok" : "no" } }],
              },
            },
          ],
        }),
      ),
    record: async (...args) => void log.push(["record", ...args]),
    enable: async () => true,
    choose: async () => undefined,
    remove: async () => true,
    list: async () => list(),
    saveModels: async (_u, _c, models: ListedModel[]) => (
      log.push(["models", models]),
      models.length
    ),
    setModel: async (input) => (log.push(["model", input]), input.connectionId === conn),
    recordModel: async (...args) => void log.push(["recordModel", ...args]),
    policy: async (_u, id, policy) => (log.push(["policy", policy]), id === conn),
  };
}

const post = (body: unknown, token = "alice") =>
  new Request("https://fn/ocade-byok", {
    method: "POST",
    headers: { origin, authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

test("Settings reads a key's model list, permits models and sets the policy", async () => {
  const log: unknown[] = [];
  const handler = byokDeps(
    log,
    () => new Response(JSON.stringify({ data: [{ id: "vendor/a" }, { id: "vendor/tools" }] })),
  );
  const listed = await handleByok(post({ action: "models", connectionId: conn }), handler);
  assert.deepEqual(await listed.json(), { count: 2 });
  assert.deepEqual(log.shift(), ["models", [{ model: "vendor/a" }, { model: "vendor/tools" }]]);

  const refused = byokDeps(log, () => new Response("{}", { status: 401 }));
  const answer = await handleByok(post({ action: "models", connectionId: conn }), refused);
  assert.equal(answer.status, 502);
  assert.deepEqual(await answer.json(), { error: "models_unavailable", status: "invalid" });

  assert.equal(
    (
      await handleByok(
        post({
          action: "model",
          connectionId: conn,
          model: "vendor/a",
          permitted: true,
          inputPrice: 1,
        }),
        handler,
      )
    ).status,
    400,
    "a price needs its currency",
  );
  assert.equal(
    (
      await handleByok(
        post({
          action: "model",
          connectionId: conn,
          model: "vendor/a",
          permitted: true,
          inputPrice: 1,
          outputPrice: 4,
          currency: "INR",
        }),
        handler,
      )
    ).status,
    200,
  );
  assert.deepEqual(log.pop(), [
    "model",
    {
      userId: alice,
      connectionId: conn,
      model: "vendor/a",
      permitted: true,
      inputPrice: 1,
      outputPrice: 4,
      currency: "INR",
    },
  ]);
  assert.equal(
    (
      await handleByok(
        post({
          action: "policy",
          connectionId: conn,
          modelMode: "auto",
          spendMode: "free_only",
          currency: "USD",
          timeZone: "UTC",
        }),
        handler,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await handleByok(
        post({
          action: "policy",
          connectionId: conn,
          modelMode: "auto",
          spendMode: "custom",
          currency: "USD",
          timeZone: "UTC",
        }),
        handler,
      )
    ).status,
    400,
  );
  assert.equal(
    (await handleByok(post({ action: "models", connectionId: conn }, "mallory"), handler)).status,
    401,
  );
});

test("testing another model of the list records that model only, never the connection", async () => {
  const log: unknown[] = [];
  const handler = byokDeps(log, () => new Response("{}"));
  const answer = await handleByok(
    post({ action: "test", connectionId: conn, model: "vendor/tools" }),
    handler,
  );
  assert.equal((await answer.json()).callsTools, true);
  assert.equal(log.filter((entry) => (entry as unknown[])[0] === "record").length, 0);
  assert.deepEqual(
    (log.find((entry) => (entry as unknown[])[0] === "recordModel") as unknown[]).slice(0, 5),
    ["recordModel", alice, conn, "vendor/tools", true],
  );
});

// --- the boundary: reserve before, settle after, refuse with nothing sent ---

const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const answered =
  sse({ choices: [{ index: 0, delta: { content: "Hello" } }] }) +
  sse({
    choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    usage: { prompt_tokens: 7, completion_tokens: 3 },
  });

function chatRequest(): Request {
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
    }),
  });
}

function boundary(
  route: CustomerRoute,
  reserve: () => Promise<{ reservation: string } | { refusal: string }>,
  answer: () => Response,
  log: unknown[],
): OnlineHandlerDependencies {
  return {
    allowedOrigins: new Set([origin]),
    providerReady: true,
    providerSlots: ["primary"],
    model: "gemini-3.5-flash-lite",
    verifyJwt: async () => null,
    verifyService: async () => ({ userId: alice }),
    claimPermit: async () => ({ ok: true }),
    releasePermit: async () => void log.push("released"),
    finalizePermit: async () => void log.push("finalized"),
    sleep: async () => undefined,
    byok: {
      route: async () => route,
      bind: async () => true,
      record: async () => undefined,
      reserve: async (input) => (
        log.push(["reserve", input.model, input.outputTokens > 0]),
        reserve()
      ),
      settle: async (input) =>
        void log.push(["settle", input.reservation, input.sent, input.usage?.inputTokens ?? null]),
    },
    callProvider: async () => (log.push("sent"), answer()),
  };
}

const route = (over: Partial<CustomerRoute> = {}): CustomerRoute => ({
  id: conn,
  enabled: true,
  status: "connected",
  protocol: "openai",
  model: "vendor/paid",
  seesImages: false,
  ...over,
});

test("a call the person's policy refuses is never sent, and says why in their words", async () => {
  for (const refusal of ["free_only_paid", "budget_day", "price_unknown"]) {
    const log: unknown[] = [];
    const response = await handleOnlineIntelligence(
      chatRequest(),
      boundary(
        route(),
        async () => ({ refusal }),
        () => new Response(answered),
        log,
      ),
    );
    assert.equal(response.status, 402);
    const { error } = await response.json();
    assert.equal(error, `byok_${refusal}`);
    assert.ok(BYOK_REFUSALS[error], "the person is told why");
    assert.ok(!log.includes("sent"), "nothing reached the provider");
    assert.ok(log.includes("released"), "the OCADE permit is given back");
  }
});

test("Auto with no permitted model refuses before reserving or sending", async () => {
  const log: unknown[] = [];
  const response = await handleOnlineIntelligence(
    chatRequest(),
    boundary(
      route({ model: null }),
      async () => ({ reservation: "r1" }),
      () => new Response(answered),
      log,
    ),
  );
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "byok_no_model");
  assert.deepEqual(log, []);
});

test("an answered call is settled with the provider's usage; a refused one is given back", async () => {
  const log: unknown[] = [];
  const response = await handleOnlineIntelligence(
    chatRequest(),
    boundary(
      route(),
      async () => ({ reservation: "r1" }),
      () => new Response(answered, { headers: { "content-type": "text/event-stream" } }),
      log,
    ),
  );
  await response.text();
  assert.deepEqual(log[0], ["reserve", "vendor/paid", true]);
  assert.deepEqual(
    log.find((entry) => Array.isArray(entry) && entry[0] === "settle"),
    ["settle", "r1", true, 7],
  );

  const failed: unknown[] = [];
  const refused = await handleOnlineIntelligence(
    chatRequest(),
    boundary(
      route(),
      async () => ({ reservation: "r2" }),
      () => new Response("{}", { status: 402 }),
      failed,
    ),
  );
  assert.equal((await refused.json()).error, "byok_credits_unavailable");
  assert.deepEqual(
    failed.find((entry) => Array.isArray(entry) && entry[0] === "settle"),
    ["settle", "r2", false, null],
  );
});

test("a policy that cannot be read sends nothing", async () => {
  const log: unknown[] = [];
  const response = await handleOnlineIntelligence(
    chatRequest(),
    boundary(
      route(),
      async () => Promise.reject(new Error("db down")),
      () => new Response(answered),
      log,
    ),
  );
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "byok_unavailable");
  assert.ok(!log.includes("sent"));
});

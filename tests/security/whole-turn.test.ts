/**
 * A planner turn is answered whole or not at all (benchmark round 4, plan.md §19.4): the
 * service door reads the provider's turn to its end before anything is delivered, so a turn
 * that breaks midway is asked again of the same model within one bounded budget, and one
 * without the call the planner asked for goes back to the planner (plan.md O2: one model). A stream a person is
 * reading keeps its own rules. Scripted provider only: the boundary's handling, never a model's.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  handleOnlineIntelligence,
  type OnlineHandlerDependencies,
} from "../../src/lib/intelligence/edge-handler.ts";

const user = "00000000-0000-4000-8000-000000000001";
const GEMMA = "gemma-4-31b-it";

function body(surface: "jarvis" | "chat", extra: Record<string, unknown> = {}) {
  const permit = { id: "p1", generationId: "g1", idempotencyKey: "k1", surface, source: "server" };
  return JSON.stringify({
    ...extra,
    permit,
    generationId: "g1",
    idempotencyKey: "k1",
    surface,
    messages: [
      { role: "system", content: "Plan." },
      { role: "user", content: "Do the task." },
    ],
    tools:
      surface === "jarvis"
        ? [{ name: "finish", description: "Finish.", inputSchema: { type: "object" } }]
        : [],
    attachments: [],
    privacy: { onlineInferenceConsented: true, sealed: false },
  });
}

/** OCADE's own server asking for a planning turn. */
const plannerRequest = (extra: Record<string, unknown> = {}) =>
  new Request("http://service/", {
    method: "POST",
    headers: { "content-type": "application/json", "x-ocade-user": user },
    body: body("jarvis", extra),
  });

const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
const stream = (text: string) =>
  new Response(text, { headers: { "content-type": "text/event-stream" } });
const part = (parts: unknown[], finishReason?: string) =>
  sse({
    candidates: [{ content: { role: "model", parts }, ...(finishReason ? { finishReason } : {}) }],
  });
const called = () =>
  stream(part([{ functionCall: { id: "c1", name: "finish", args: {} } }], "STOP"));
const spoken = (text: string) => stream(part([{ text }], "STOP"));
/** A stream that ends without the provider's terminal result. */
const broken = () => stream(part([{ text: "I will" }]));

function harness(model: string, answers: (model: string) => Response) {
  const log = { calls: [] as string[], issues: [] as string[], finalized: 0, released: 0 };
  const deps: OnlineHandlerDependencies = {
    allowedOrigins: new Set(["https://ocade.example"]),
    providerReady: true,
    providerSlots: ["primary"],
    model,
    verifyJwt: async () => ({ userId: user }),
    verifyService: async () => ({ userId: user }),
    claimPermit: async () => ({ ok: true }),
    sleep: async () => undefined,
    providerIssue: (issue) => log.issues.push(`${issue.model}:${issue.kind}`),
    finalizePermit: async () => void (log.finalized += 1),
    releasePermit: async () => void (log.released += 1),
    callProvider: async ({ model: asked }) => {
      log.calls.push(asked);
      return answers(asked);
    },
  };
  return { deps, log };
}

async function events(response: Response) {
  return (await response.text())
    .split("\n\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; [key: string]: unknown });
}

test("a planner turn that breaks midway is asked again; only the complete answer is delivered", async () => {
  let asked = 0;
  const { deps, log } = harness(GEMMA, () => (++asked === 1 ? broken() : called()));
  const answer = await events(await handleOnlineIntelligence(plannerRequest(), deps));
  assert.deepEqual(log.calls, [GEMMA, GEMMA]);
  assert.deepEqual(
    answer.map((event) => event.type),
    ["status", "tool_call", "final"],
    "nothing of the broken attempt reaches the planner",
  );
  assert.deepEqual(log.issues, [`${GEMMA}:finish_none`]);
  assert.deepEqual([log.finalized, log.released], [1, 0], "settled once, for the answer");
});

test("one model per task: a hybrid or retired route serves nothing and calls no provider", async () => {
  for (const route of [`${GEMMA},gemini-3.5-flash-lite`, "gemini-3.8-live-extended-thinking"]) {
    const { deps, log } = harness(route, () => called());
    const response = await handleOnlineIntelligence(plannerRequest(), deps);
    assert.equal(response.status, 503, route);
    assert.deepEqual(await response.json(), { error: "online_unavailable" });
    assert.deepEqual(log.calls, [], route);
  }
});

test("a turn without the call the planner asked for goes back to the planner, not to the model again", async () => {
  const { deps, log } = harness(GEMMA, () => spoken("Setting the goal now."));
  const answer = await events(await handleOnlineIntelligence(plannerRequest(), deps));
  assert.deepEqual(log.calls, [GEMMA], "never the same thing twice, never another model");
  assert.deepEqual(log.issues, [`${GEMMA}:no_call`]);
  const final = answer.at(-1) as { response: { stopReason: string; text: string } };
  assert.equal(final.response.stopReason, "end_turn");
  assert.equal(final.response.text, "Setting the goal now.");
});

test("a repair after the verifier refused the work is the task's own model", async () => {
  const { deps, log } = harness(GEMMA, () => called());
  await events(await handleOnlineIntelligence(plannerRequest({ repair: true }), deps));
  assert.deepEqual(log.calls, [GEMMA]);
  const refused = await handleOnlineIntelligence(plannerRequest({ repair: "yes" }), deps);
  assert.equal(refused.status, 400);
});

test("a turn that never completes is a retryable failure: bounded, nothing delivered, permit released", async () => {
  const { deps, log } = harness(GEMMA, () => broken());
  const response = await handleOnlineIntelligence(plannerRequest(), deps);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "provider_failed" });
  assert.equal(log.calls.length, 3, "one budget for the model, before and after its stream begins");
  assert.deepEqual([log.finalized, log.released], [0, 1]);
});

test("learning that a model takes no thinking setting does not spend the turn's attempts", async () => {
  const withoutThinking = new Set<string>();
  const { deps, log } = harness(GEMMA, () => broken());
  let first = true;
  const scripted = deps.callProvider;
  deps.withoutThinking = withoutThinking;
  deps.callProvider = async (input) => {
    if (first) {
      first = false;
      log.calls.push("thinking-refused");
      return new Response('{"error":{"message":"thinking_level is not supported"}}', {
        status: 400,
      });
    }
    return scripted(input);
  };
  await handleOnlineIntelligence(plannerRequest(), deps);
  assert.deepEqual(log.calls, ["thinking-refused", GEMMA, GEMMA, GEMMA]);
});

test("refused content is not retried", async () => {
  const { deps, log } = harness(GEMMA, () => stream(part([], "SAFETY")));
  const answer = await events(await handleOnlineIntelligence(plannerRequest(), deps));
  assert.deepEqual(log.calls, [GEMMA]);
  const refusal = answer.at(-1) as { type: string; code: string; retryable: boolean };
  assert.deepEqual(
    [refusal.type, refusal.code, refusal.retryable],
    ["refusal", "content_blocked", false],
  );
  assert.deepEqual([log.finalized, log.released], [0, 1]);
});

test("a stream a person is reading keeps its rules: text as it arrives, a break is said, never replayed", async () => {
  const browserRequest = () =>
    new Request("https://functions/", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://ocade.example",
        authorization: "Bearer session",
      },
      body: body("chat"),
    });
  const cut = harness(GEMMA, () => broken());
  const partial = await events(await handleOnlineIntelligence(browserRequest(), cut.deps));
  assert.deepEqual(
    partial.map((event) => event.type),
    ["status", "token", "refusal"],
  );
  assert.equal(cut.log.calls.length, 1, "what a person already read is never asked again");
  assert.equal((partial.at(-1) as { retryable: boolean }).retryable, false);
  assert.deepEqual([cut.log.finalized, cut.log.released], [1, 0], "Chat's partial-answer policy");

  const whole = harness(GEMMA, () => spoken("Hello."));
  const complete = await events(await handleOnlineIntelligence(browserRequest(), whole.deps));
  assert.deepEqual(
    complete.map((event) => event.type),
    ["status", "token", "final"],
  );
  assert.deepEqual([whole.log.finalized, whole.log.released], [1, 0]);
});

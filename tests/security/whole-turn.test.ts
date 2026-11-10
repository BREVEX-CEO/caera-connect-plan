/**
 * A planner turn is answered whole or not at all (benchmark round 4, plan.md §19.4): the
 * service door reads the provider's turn to its end before anything is delivered, so a turn
 * that breaks midway, comes back empty or lacks the call the planner asked for is asked again
 * or answered by the route's next model, within one bounded budget. A stream a person is
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
const LIVE = "gemini-3.8-live-extended-thinking";

function body(surface: "jarvis" | "chat") {
  const permit = { id: "p1", generationId: "g1", idempotencyKey: "k1", surface, source: "server" };
  return JSON.stringify({
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
const plannerRequest = () =>
  new Request("http://service/", {
    method: "POST",
    headers: { "content-type": "application/json", "x-ocade-user": user },
    body: body("jarvis"),
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

test("configuration C: the second model answers the turn the first broke after its stream began", async () => {
  const { deps, log } = harness(`${GEMMA},${LIVE}`, (model) =>
    model === GEMMA ? broken() : called(),
  );
  const answer = await events(await handleOnlineIntelligence(plannerRequest(), deps));
  // Before: a model was switched only before the first byte, so C behaved like its first model.
  assert.deepEqual(log.calls, [GEMMA, LIVE]);
  assert.equal(answer.at(-1)?.type, "final");
  assert.deepEqual([log.finalized, log.released], [1, 0]);
});

test("configuration C: a turn without the call the planner asked for goes to the other model", async () => {
  const { deps, log } = harness(`${LIVE},${GEMMA}`, (model) =>
    model === LIVE ? spoken("Setting the goal now.") : called(),
  );
  const answer = await events(await handleOnlineIntelligence(plannerRequest(), deps));
  assert.deepEqual(log.calls, [LIVE, GEMMA]);
  assert.deepEqual(log.issues, [`${LIVE}:no_call`], "which model gave no call is recorded");
  const final = answer.at(-1) as { response: { stopReason: string; toolCalls: unknown[] } };
  assert.equal(final.response.stopReason, "tool_use");
  assert.equal(final.response.toolCalls.length, 1);
});

test("no model gives a call: the first complete answer goes back for the planner to correct", async () => {
  const { deps, log } = harness(`${GEMMA},${LIVE}`, (model) => spoken(`${model} says hello`));
  const answer = await events(await handleOnlineIntelligence(plannerRequest(), deps));
  assert.deepEqual(
    log.calls,
    [GEMMA, LIVE],
    "each model is asked once, never the same thing twice",
  );
  const final = answer.at(-1) as { response: { stopReason: string; text: string } };
  assert.equal(final.response.stopReason, "end_turn");
  assert.equal(final.response.text, `${GEMMA} says hello`);
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

test("refused content is not retried and no other model is asked", async () => {
  const { deps, log } = harness(`${GEMMA},${LIVE}`, () => stream(part([], "SAFETY")));
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

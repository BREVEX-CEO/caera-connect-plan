/**
 * Provider failures (166): an unreachable, refusing, garbled or cut-off provider answer is a
 * named PlannerUnavailable, never a decision; a call refused before any output releases its
 * usage permit, and a provider's Retry-After is kept. Loopback fake provider; no model.
 */
import assert from "node:assert/strict";
import { createServer, type ServerResponse } from "node:http";
import { test } from "node:test";
import {
  compileGoal,
  PlannerUnavailable,
  plannerAccess,
} from "../../src/lib/jarvis/planner.server.ts";

const check = {
  id: "out",
  description: "Saved",
  kind: "file_exists",
  params: { path: "OCADE output/a.txt" },
};
const call = { id: "c1", name: "set_goal", arguments: { checks: [check] } };
const frame = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
const final = frame({
  type: "final",
  response: { backend: "online", stopReason: "tool_use", toolCalls: [call] },
});

async function provider(t: { after: (fn: () => Promise<void>) => void }) {
  const state = { answer: (_: ServerResponse) => {}, released: 0 };
  const server = createServer(async (request, response) => {
    for await (const _ of request);
    state.answer(response);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const saved = { ...plannerAccess };
  const { port } = server.address() as { port: number };
  plannerAccess.serviceUrl = () => `http://127.0.0.1:${port}`;
  plannerAccess.serviceKey = () => "synthetic-loopback-key";
  plannerAccess.acquirePermit = async (_user, key) => ({
    permit: {
      id: "p",
      generationId: key,
      idempotencyKey: key,
      surface: "jarvis",
      source: "server",
    },
    release: async () => {
      state.released++;
    },
  });
  t.after(async () => {
    Object.assign(plannerAccess, saved);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return { state, port };
}

async function refusal(goal: Promise<unknown>) {
  try {
    await goal;
  } catch (error) {
    assert.ok(error instanceof PlannerUnavailable, String(error));
    return error;
  }
  assert.fail("a failed provider turn became a decision");
}

test("every way a provider answer can fail is named, and nothing is decided", async (t) => {
  const { state } = await provider(t);
  const cases: [string, (response: ServerResponse) => void, string][] = [
    [
      "quota exhausted with a retry time",
      (r) => {
        r.writeHead(429, { "content-type": "application/json" });
        r.end(JSON.stringify({ error: "quota_exhausted", retryAfterSeconds: 30 }));
      },
      "quota_exhausted",
    ],
    ["outage without a body", (r) => r.writeHead(503).end(), "planner_http_503"],
    [
      "refusal in the stream",
      (r) => {
        r.writeHead(200, { "content-type": "text/event-stream" });
        r.end(frame({ type: "refusal", code: "provider_unavailable" }));
      },
      "provider_unavailable",
    ],
    [
      "garbled event",
      (r) => {
        r.writeHead(200, { "content-type": "text/event-stream" });
        r.end("data: {not json\r\n\r\n");
      },
      "planner_stream_failed",
    ],
    [
      "cut off before the final answer (partial tool execution)",
      (r) => {
        r.writeHead(200, { "content-type": "text/event-stream" });
        r.end(frame({ type: "tool_call", call }));
      },
      "planner_stream_incomplete",
    ],
    [
      "final answer with a different proposal",
      (r) => {
        r.writeHead(200, { "content-type": "text/event-stream" });
        r.end(frame({ type: "tool_call", call: { ...call, id: "other" } }) + final);
      },
      "planner_final_mismatch",
    ],
  ];
  for (const [name, answer, code] of cases) {
    await t.test(name, async () => {
      state.answer = answer;
      const error = await refusal(compileGoal("u", "Write a note", ["files"]));
      assert.match(error.message, new RegExp(code), name);
    });
  }
  state.released = 0;
  state.answer = (r) =>
    r.writeHead(429).end(JSON.stringify({ error: "quota_exhausted", retryAfterSeconds: 30 }));
  const quota = await refusal(compileGoal("u", "Write a note", ["files"]));
  assert.equal(quota.retryAfterMs, 30_000, "the provider's retry time is kept");
  assert.ok(state.released >= 1, "a call refused before output releases its usage permit");
});

test("an unreachable provider is named as unreachable", async (t) => {
  const { port } = await provider(t);
  plannerAccess.serviceUrl = () => `http://127.0.0.1:${port === 1 ? 2 : 1}`;
  const error = await refusal(compileGoal("u", "Write a note", ["files"]));
  assert.match(error.message, /planner_unreachable/);
});

test("an answer with no call is asked again once, with a new key, never charged twice", async (t) => {
  const { state } = await provider(t);
  const keys: string[] = [];
  const acquire = plannerAccess.acquirePermit;
  plannerAccess.acquirePermit = async (user, key) => {
    keys.push(key);
    return acquire(user, key);
  };
  let answers = 0;
  state.answer = (response) => {
    answers++;
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      answers === 1
        ? frame({
            type: "final",
            response: { backend: "online", stopReason: "end_turn", text: "Sure.", toolCalls: [] },
          })
        : frame({ type: "tool_call", call }) + final,
    );
  };
  const goal = await compileGoal("u", "Write a note", ["files"]);
  assert.equal(answers, 2);
  assert.equal(new Set(keys).size, 2, "the second ask is a new permit, not a duplicate");
  assert.ok(goal);
});

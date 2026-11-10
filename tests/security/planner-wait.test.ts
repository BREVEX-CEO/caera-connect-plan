/**
 * Who asks the model, and what a task does when the planner gives no answer (D10, benchmark
 * round 4): one request holds a planning turn at a time; every model call has its own permit
 * key; a failure that passes by itself is retried by itself; anything else waits for the person.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { advance, type Admin } from "../../src/lib/jarvis/authority.server.ts";
import { PlannerUnavailable, plannerAccess } from "../../src/lib/jarvis/planner.server.ts";

/** A running task whose checks are fixed; `turn` is what the database answers a turn request. */
function taskAdmin(turn: number | null = 7) {
  const recorded: { name: string; args: Record<string, unknown> }[] = [];
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      recorded.push({ name, args });
      return {
        data:
          name === "jarvis_task_state"
            ? {
                id: "task",
                userId: "u",
                status: "running",
                controller: "epoch",
                title: "Summarise notes.txt",
                outcome: [
                  {
                    id: "out",
                    description: "Out",
                    kind: "file_exists",
                    params: { path: "OCADE output/a.txt" },
                  },
                ],
                grants: ["files"],
                engines: [],
                mcp: [],
                steps: [],
              }
            : name === "jarvis_planner_turn"
              ? turn
              : null,
        error: null,
      };
    },
  } as unknown as Admin;
  return { admin, recorded };
}

async function withPlanner(run: () => Promise<void>) {
  const saved = { ...plannerAccess };
  plannerAccess.serviceUrl = () => "http://127.0.0.1:9";
  plannerAccess.serviceKey = () => "test-only";
  try {
    await run();
  } finally {
    Object.assign(plannerAccess, saved);
  }
}

test("a failure that passes by itself is retried by itself; anything else waits for the person", () =>
  withPlanner(async () => {
    for (const [code, expected] of [
      ["rate_limited", "jarvis_task_wait_until"],
      // Round 4: one broken provider stream, or a dead service instance, parked the whole task.
      ["provider_failed", "jarvis_task_wait_until"],
      ["planner_stream_incomplete", "jarvis_task_wait_until"],
      ["planner_http_503", "jarvis_task_wait_until"],
      ["permit_refused", "jarvis_task_wait_until"],
      ["planner_http_400", "jarvis_task_wait"],
      ["allowance_exhausted", "jarvis_task_wait"],
      ["online_not_consented", "jarvis_task_wait"],
    ] as const) {
      plannerAccess.acquirePermit = async () => {
        throw new PlannerUnavailable(code, 45_000);
      };
      const { admin, recorded } = taskAdmin();
      await advance(admin, "task");
      const waits = recorded.filter((r) => r.name.startsWith("jarvis_task_wait"));
      assert.deepEqual(
        waits.map((r) => r.name),
        [expected],
        code,
      );
      if (expected === "jarvis_task_wait_until") {
        const at = Date.parse(String(waits[0].args.p_retry_at));
        assert.ok(
          at - Date.now() > 40_000 && at - Date.now() < 50_000,
          "the provider's own retry time",
        );
      }
      // The holder gives the turn back, and an unanswered turn is not counted as progress.
      assert.deepEqual(recorded.at(-1), {
        name: "jarvis_planner_turn_end",
        args: { p_task: "task", p_turn: 7, p_answered: false },
      });
    }
  }));

test("a planning turn another request holds is left alone: no model call, no wait, no permit", () =>
  withPlanner(async () => {
    let permits = 0;
    plannerAccess.acquirePermit = async () => {
      permits += 1;
      throw new PlannerUnavailable("planner_not_configured");
    };
    const { admin, recorded } = taskAdmin(null);
    await advance(admin, "task");
    assert.equal(permits, 0, "the model is not asked twice for one turn");
    assert.deepEqual(
      recorded.map((r) => r.name),
      ["jarvis_task_state", "jarvis_planner_turn"],
      "the task is not parked and nothing is ended that this request never held",
    );
  }));

test("every model call has its own permit key; the corrective ask keeps the turn", async (t) => {
  // A loopback service: the first answer has no call (corrected once), the second lists a folder.
  const frame = (value: unknown) => `data: ${JSON.stringify(value)}\r\n\r\n`;
  const listing = { id: "c1", name: "fs_list", arguments: { path: "." } };
  let answers = 0;
  const service = createServer(async (request, response) => {
    for await (const _ of request);
    answers += 1;
    response.writeHead(200, { "content-type": "text/event-stream" });
    const toolCalls = answers === 1 ? [] : [listing];
    response.end(
      toolCalls.map((call) => frame({ type: "tool_call", call })).join("") +
        frame({
          type: "final",
          response: {
            backend: "online",
            stopReason: toolCalls.length ? "tool_use" : "end_turn",
            toolCalls,
          },
        }),
    );
  });
  await new Promise<void>((resolve) => service.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise<void>((resolve) => service.close(() => resolve())));
  const saved = { ...plannerAccess };
  t.after(() => void Object.assign(plannerAccess, saved));
  const { port } = service.address() as { port: number };
  plannerAccess.serviceUrl = () => `http://127.0.0.1:${port}`;
  plannerAccess.serviceKey = () => "synthetic-loopback-key";
  const keys: string[] = [];
  plannerAccess.acquirePermit = async (_user, key) => {
    keys.push(key);
    return {
      permit: {
        id: key,
        generationId: key,
        idempotencyKey: key,
        surface: "jarvis",
        source: "server",
      },
      release: async () => undefined,
    };
  };

  const { admin, recorded } = taskAdmin(7);
  await advance(admin, "task");
  // Before the fix both asks of a turn derived from one key, and any retry reused the first.
  assert.deepEqual(keys, ["jarvis-plan:task:7:1", "jarvis-plan:task:7:2"]);
  const turns = recorded.filter((r) => r.name === "jarvis_planner_turn").map((r) => r.args);
  assert.deepEqual(turns, [
    { p_task: "task", p_controller: "epoch", p_seconds: 160 },
    { p_task: "task", p_controller: "epoch", p_seconds: 160, p_held: 7 },
  ]);
  assert.ok(
    recorded.some((r) => r.name === "jarvis_queue_actions"),
    "the corrected answer was admitted",
  );
  assert.deepEqual(recorded.at(-1), {
    name: "jarvis_planner_turn_end",
    args: { p_task: "task", p_turn: 7, p_answered: true },
  });

  // The next request for work is a new holder with a new number: never the settled keys again.
  const next = taskAdmin(8);
  await advance(next.admin, "task");
  assert.equal(keys.at(-1), "jarvis-plan:task:8:1");
  assert.equal(new Set(keys).size, keys.length, "no attempt reuses a settled permit's key");
});

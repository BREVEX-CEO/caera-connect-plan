/** A permission revoked after planning cannot strand a running task or dispatch its verifier. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { advance, JarvisRefusal, type Admin } from "../../src/lib/jarvis/authority.server.ts";
import { plannerAccess } from "../../src/lib/jarvis/planner.server.ts";

test("verifier queue rechecks permissions and waits after a stale planner snapshot", async (t) => {
  const checks = [
    {
      id: "web",
      description: "Authorized public page",
      kind: "web_text_contains",
      params: { url: "https://allowed.example.test/result", text: "Expected" },
    },
    {
      id: "window",
      description: "Authorized application",
      kind: "window_exists",
      params: { exe: "editor.exe" },
    },
  ];
  let providerCalls = 0;
  const server = createServer(async (req, res) => {
    for await (const chunk of req) void chunk;
    providerCalls += 1;
    const call = { id: "verify", name: "finish", arguments: {} };
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(
      [
        { type: "tool_call", call },
        {
          type: "final",
          response: { backend: "online", stopReason: "tool_use", toolCalls: [call] },
        },
      ]
        .map((frame) => `data: ${JSON.stringify(frame)}\r\n\r\n`)
        .join(""),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const saved = { ...plannerAccess };
  const { port } = server.address() as { port: number };
  plannerAccess.serviceUrl = () => `http://127.0.0.1:${port}`;
  plannerAccess.serviceKey = () => "synthetic-verifier-scope-key";
  plannerAccess.acquirePermit = async (_user, key) => ({
    permit: {
      id: "p",
      generationId: key,
      idempotencyKey: key,
      surface: "jarvis",
      source: "server",
    },
    release: async () => {},
  });
  try {
    for (const [label, queueError, waitError] of [
      ["authorized queue remains usable", null, null],
      ["permission revoked before admission", "permission_required", null],
      ["STOP wins after permission refusal", "permission_required", "stale_controller"],
      ["other wait failures remain errors", "permission_required", "task_not_found"],
      ["STOP wins before admission", "stale_controller", null],
    ] as const) {
      await t.test(label, async () => {
        const calls: { name: string; args: Record<string, unknown> }[] = [];
        const admin = {
          rpc: async (name: string, args: Record<string, unknown>) => {
            calls.push({ name, args });
            return {
              data:
                name === "jarvis_task_state"
                  ? {
                      id: "task",
                      userId: "synthetic-user",
                      status: "running",
                      controller: "epoch",
                      title: "Check the allowed page and application",
                      outcome: checks,
                      grants: [
                        "files",
                        "browser",
                        "site:allowed.example.test",
                        "apps",
                        "app:editor.exe",
                      ],
                      engines: ["browser", "desktop"],
                      mcp: [],
                      steps: [],
                    }
                  : name === "jarvis_planner_turn"
                    ? 1
                    : null,
              error:
                name === "jarvis_queue_actions" && queueError
                  ? { message: queueError }
                  : name === "jarvis_task_wait" && waitError
                    ? { message: waitError }
                    : null,
            };
          },
        } as unknown as Admin;
        const before = providerCalls;
        const advancing = () => advance(admin, "task", new Date("2026-11-02T00:00:00Z"));
        if (waitError && waitError !== "stale_controller") {
          await assert.rejects(
            advancing,
            (error: unknown) => error instanceof JarvisRefusal && error.code === waitError,
          );
        } else {
          await advancing();
        }
        assert.equal(providerCalls, before + 1);
        const queued = calls.find((call) => call.name === "jarvis_queue_actions");
        assert.ok(queued, JSON.stringify(calls));
        const actions = queued.args.p_actions as {
          action: { operation: string; arguments: { checks: unknown } };
        }[];
        assert.equal(actions.length, 1);
        assert.equal(actions[0].action.operation, "verify.checks");
        assert.deepEqual(actions[0].action.arguments.checks, checks);
        const waits = calls.filter((call) => call.name === "jarvis_task_wait");
        assert.equal(
          waits.length,
          queueError === "permission_required" ? 1 : 0,
          JSON.stringify(calls),
        );
        if (queueError === "permission_required") {
          assert.equal(waits[0].args.p_task, "task");
          assert.equal(waits[0].args.p_controller, "epoch");
          assert.match(String(waits[0].args.p_reason), /access|permission|app|website/i);
        }
        assert.ok(!calls.some((call) => call.name === "jarvis_settle_task"));
      });
    }
  } finally {
    Object.assign(plannerAccess, saved);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

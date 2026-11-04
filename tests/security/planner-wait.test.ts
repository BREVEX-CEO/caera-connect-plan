/**
 * How a task waits when the planner cannot answer (D10): only a busy planner retries by itself;
 * a turn that another advance of the same step already owns (a resent receipt) changes nothing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { advance, type Admin } from "../../src/lib/jarvis/authority.server.ts";
import { PlannerUnavailable, plannerAccess } from "../../src/lib/jarvis/planner.server.ts";

function taskAdmin() {
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
            : null,
        error: null,
      };
    },
  } as unknown as Admin;
  return { admin, recorded };
}

test("a busy planner waits with a retry time; a turn already being answered changes nothing", async () => {
  const saved = { ...plannerAccess };
  plannerAccess.serviceUrl = () => "http://127.0.0.1:9";
  plannerAccess.serviceKey = () => "test-only";
  try {
    for (const [code, expected] of [
      ["rate_limited", "jarvis_task_wait_until"],
      ["permit_refused", null],
      ["planner_http_500", "jarvis_task_wait"],
    ] as const) {
      plannerAccess.acquirePermit = async () => {
        throw new PlannerUnavailable(code, 45_000);
      };
      const { admin, recorded } = taskAdmin();
      await advance(admin, "task");
      const waits = recorded.filter((r) => r.name.startsWith("jarvis_task_wait"));
      assert.deepEqual(
        waits.map((r) => r.name),
        expected ? [expected] : [],
        code,
      );
      if (expected === "jarvis_task_wait_until") {
        const at = Date.parse(String(waits[0].args.p_retry_at));
        assert.ok(
          at - Date.now() > 40_000 && at - Date.now() < 50_000,
          "the provider's own retry time",
        );
      }
    }
  } finally {
    Object.assign(plannerAccess, saved);
  }
});

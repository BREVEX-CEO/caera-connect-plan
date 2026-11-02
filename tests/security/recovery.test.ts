/** No mutation batching or automatic repetition of an uncertain earlier effect. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { intent } from "../../src/lib/jarvis/contracts.ts";
import { planStep, plannerAccess } from "../../src/lib/jarvis/planner.server.ts";
import { advance, type Admin } from "../../src/lib/jarvis/authority.server.ts";
import type { Step } from "../../src/lib/jarvis/supervisor.ts";

const now = new Date("2026-11-02T00:00:00Z");
const deadline = new Date(now.getTime() + 60_000);
const output = `OCADE output/${crypto.randomUUID()}.txt`;
const checks = [
  {
    id: "result",
    description: "The requested output exists",
    kind: "file_exists" as const,
    params: { path: output },
  },
];
const read = { name: "fs_read_text", arguments: { path: `${crypto.randomUUID()}.txt` } };
const list = { name: "fs_list", arguments: {} };
const write = { name: "fs_write_text", arguments: { path: output, text: "synthetic output" } };
type Proposal = { name: string; arguments: Record<string, unknown> };

test("mutations require fresh planning; unknown effects fence resumption", async (t) => {
  let proposals: Proposal[] = [list];
  let calls = 0;
  const server = createServer(async (req, res) => {
    for await (const chunk of req) void chunk;
    calls += 1;
    const toolCalls = proposals.map((call, n) => ({ ...call, id: `proposal-${n}` }));
    const frames = [
      ...toolCalls.map((call) => ({ type: "tool_call", call })),
      {
        type: "final",
        response: { backend: "online", stopReason: "tool_use", toolCalls },
      },
    ];
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(frames.map((frame) => `data: ${JSON.stringify(frame)}\r\n\r\n`).join(""));
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
    release: async () => {},
  });
  const base = {
    userId: "u",
    objective: "Create the requested output",
    checks,
    grants: ["files"],
    engines: [],
    turnKey: "recovery",
    now,
  };
  try {
    for (const [name, sequence, expectedMore] of [
      ["read followed by a write", [read, write], 0],
      ["write followed by another action", [write, list], 0],
      ["two writes", [write, write], 0],
      ["independent reads remain batched", [read, list], 1],
    ] as const) {
      await t.test(name, async () => {
        proposals = [...sequence];
        const decision = await planStep({ ...base, steps: [] });
        assert.equal(decision.kind, "queue");
        if (decision.kind === "queue") assert.equal(decision.more?.length ?? 0, expectedMore);
      });
    }
    const uncertain: Step = {
      intent: intent("fs.write_text", "prior", write.arguments, deadline),
      status: "blocked",
      receipt: {
        status: "unknown",
        maybeChanged: true,
        observedAtUtc: now.toISOString(),
        evidence: {},
      },
    };
    proposals = [write];
    await t.test("unknown mutation is not proposed again after resume", async () => {
      const before = calls;
      assert.equal((await planStep({ ...base, steps: [uncertain] })).kind, "block");
      assert.equal(calls, before, "no provider call may spend quota or authorize a retry");
    });
    await t.test("a failed read remains recoverable", async () => {
      const step: Step = {
        ...uncertain,
        intent: intent("fs.read_text", "read", read.arguments, deadline),
        status: "failed",
        // A pure read can fail to observe a result without admitting a change.
        receipt: { ...uncertain.receipt!, maybeChanged: false },
      };
      proposals = [list];
      assert.equal((await planStep({ ...base, steps: [step] })).kind, "queue");
    });
    await t.test("a valid observed write remains recoverable", async () => {
      const step: Step = {
        ...uncertain,
        status: "done",
        receipt: { ...uncertain.receipt!, status: "observed" },
      };
      proposals = [list];
      assert.equal((await planStep({ ...base, steps: [step] })).kind, "queue");
    });
    await t.test(
      "server preserves minimal durable unknown markers instead of discarding them",
      async () => {
        const recorded: string[] = [];
        const admin = {
          rpc: async (name: string) => {
            recorded.push(name);
            return {
              data:
                name === "jarvis_task_state"
                  ? {
                      id: "task",
                      userId: "u",
                      status: "running",
                      controller: "epoch",
                      title: base.objective,
                      outcome: checks,
                      grants: ["files"],
                      engines: [],
                      mcp: [],
                      steps: [
                        {
                          intent: uncertain.intent,
                          status: "cancelled",
                          receipt: { status: "unknown" },
                        },
                      ],
                    }
                  : null,
              error: null,
            };
          },
        } as unknown as Admin;
        const before = calls;
        await advance(admin, "task", now);
        assert.ok(recorded.includes("jarvis_task_wait"), JSON.stringify(recorded));
        assert.ok(!recorded.includes("jarvis_queue_actions"), JSON.stringify(recorded));
        assert.ok(!recorded.includes("jarvis_settle_task"), JSON.stringify(recorded));
        assert.equal(calls, before);
      },
    );
    await t.test(
      "a not-applied mutation admitting a possible effect cannot be repeated",
      async () => {
        proposals = [write];
        const before = calls;
        const step: Step = {
          ...uncertain,
          status: "failed",
          receipt: { ...uncertain.receipt!, status: "not_applied" },
        };
        assert.equal((await planStep({ ...base, steps: [step] })).kind, "block");
        assert.equal(calls, before);
      },
    );
    await t.test(
      "a declared read that admits a possible unobserved effect also stops",
      async () => {
        proposals = [list];
        const before = calls;
        const step: Step = {
          ...uncertain,
          intent: intent("fs.read_text", "contradictory-read", read.arguments, deadline),
        };
        assert.equal((await planStep({ ...base, steps: [step] })).kind, "block");
        assert.equal(calls, before);
      },
    );
    for (const raw of [
      { status: "not_applied", maybeChanged: true },
      { status: "observed", maybeChanged: true },
    ]) {
      await t.test("incomplete durable effect information survives " + raw.status, async () => {
        const recorded: string[] = [];
        const admin = {
          rpc: async (name: string) => {
            recorded.push(name);
            return {
              data:
                name === "jarvis_task_state"
                  ? {
                      id: "task",
                      userId: "u",
                      status: "running",
                      controller: "epoch",
                      title: base.objective,
                      outcome: checks,
                      grants: ["files"],
                      engines: [],
                      mcp: [],
                      steps: [{ intent: uncertain.intent, status: "failed", receipt: raw }],
                    }
                  : null,
              error: null,
            };
          },
        } as unknown as Admin;
        const before = calls;
        await advance(admin, "task", now);
        assert.ok(recorded.includes("jarvis_task_wait"), JSON.stringify(recorded));
        assert.ok(!recorded.includes("jarvis_queue_actions"), JSON.stringify(recorded));
        assert.ok(!recorded.includes("jarvis_settle_task"), JSON.stringify(recorded));
        assert.equal(calls, before);
      });
    }
    for (const opaque of [
      intent("web.open", "interrupted-open", { url: "https://example.com/" }, deadline),
      intent(
        "web.close",
        "interrupted-close",
        { page: { id: "interrupted", site: "example.com" } },
        deadline,
      ),
    ]) {
      await t.test("planner fences status-only interrupted " + opaque.operation, async () => {
        proposals = [list];
        const before = calls;
        const step: Step = {
          intent: opaque,
          status: "cancelled",
          receipt: null,
          unparsedReceipt: { status: "unknown" },
        };
        assert.equal((await planStep({ ...base, steps: [step] })).kind, "block");
        assert.equal(calls, before);
      });
      await t.test("server fences status-only interrupted " + opaque.operation, async () => {
        proposals = [list];
        const recorded: string[] = [];
        const admin = {
          rpc: async (name: string) => {
            recorded.push(name);
            return {
              data:
                name === "jarvis_task_state"
                  ? {
                      id: "task",
                      userId: "u",
                      status: "running",
                      controller: "epoch",
                      title: base.objective,
                      outcome: checks,
                      grants: ["files"],
                      engines: [],
                      mcp: [],
                      steps: [
                        {
                          intent: opaque,
                          status: "cancelled",
                          receipt: { status: "unknown" },
                        },
                      ],
                    }
                  : null,
              error: null,
            };
          },
        } as unknown as Admin;
        const before = calls;
        await advance(admin, "task", now);
        assert.ok(recorded.includes("jarvis_task_wait"), JSON.stringify(recorded));
        assert.ok(!recorded.includes("jarvis_queue_actions"), JSON.stringify(recorded));
        assert.ok(!recorded.includes("jarvis_settle_task"), JSON.stringify(recorded));
        assert.equal(calls, before);
      });
    }
    for (const [description, step] of [
      [
        "a pure read without a valid observation",
        {
          intent: intent("fs.read_text", "read", read.arguments, deadline),
          status: "failed",
          receipt: { status: "unknown", maybeChanged: false },
        },
      ],
      [
        "a valid observed write",
        {
          intent: uncertain.intent,
          status: "done",
          receipt: { ...uncertain.receipt!, status: "observed" },
        },
      ],
    ] as const) {
      await t.test("server can recover " + description, async () => {
        proposals = [list];
        const recorded: string[] = [];
        const admin = {
          rpc: async (name: string) => {
            recorded.push(name);
            return {
              data:
                name === "jarvis_task_state"
                  ? {
                      id: "task",
                      userId: "u",
                      status: "running",
                      controller: "epoch",
                      title: base.objective,
                      outcome: checks,
                      grants: ["files"],
                      engines: [],
                      mcp: [],
                      steps: [step],
                    }
                  : null,
              error: null,
            };
          },
        } as unknown as Admin;
        const before = calls;
        await advance(admin, "task", now);
        assert.ok(!recorded.includes("jarvis_task_wait"), JSON.stringify(recorded));
        assert.ok(recorded.includes("jarvis_queue_actions"), JSON.stringify(recorded));
        assert.equal(calls, before + 1);
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

test("only the person's answer lifts an unknown-effect fence; the step is never re-run", async () => {
  const { unresolvedEffect } = await import("../../src/lib/jarvis/supervisor.ts");
  const written = intent("fs.write_text", "write", { path: output, text: "x" }, deadline);
  const unknown: Step = {
    intent: written,
    status: "blocked",
    receipt: {
      status: "unknown",
      maybeChanged: true,
      observedAtUtc: now.toISOString(),
      evidence: {},
      errorCode: "worker_lost",
    },
  };
  assert.ok(unresolvedEffect([unknown]), "an unobserved write fences the task");
  for (const resolution of ["applied", "not_applied"] as const) {
    assert.equal(unresolvedEffect([{ ...unknown, resolution }]), null, resolution);
  }
  const observed: Step = {
    ...unknown,
    status: "done",
    receipt: {
      status: "observed",
      maybeChanged: true,
      observedAtUtc: now.toISOString(),
      evidence: {},
    },
  };
  assert.equal(unresolvedEffect([observed]), null, "an observed effect needs no answer");
});

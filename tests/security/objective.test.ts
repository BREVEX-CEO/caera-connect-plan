/** Request text is execution authority: never silently shorten or flatten it. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { startTask, type Admin } from "../../src/lib/jarvis/authority.server.ts";
import { compileGoal, plannerAccess } from "../../src/lib/jarvis/planner.server.ts";

test("task startup preserves complete accepted requests and rejects invalid ones before work", async (t) => {
  let providerCalls = 0;
  let providerRequest: string | null = null;
  const output = `OCADE output/${crypto.randomUUID()}.txt`;
  const server = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    providerCalls += 1;
    const body = JSON.parse(raw);
    providerRequest = JSON.parse(
      body.messages.find((message: { role: string }) => message.role === "user").content,
    ).request;
    const proposal = {
      id: "goal",
      name: "set_goal",
      arguments: {
        checks: [
          {
            id: "output",
            description: "The requested output exists",
            kind: "file_exists",
            params: { path: output },
          },
        ],
      },
    };
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
      [
        { type: "tool_call", call: proposal },
        {
          type: "final",
          response: { backend: "online", stopReason: "tool_use", toolCalls: [proposal] },
        },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`)
        .join(""),
    );
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
  const calls: string[] = [];
  let savedRequest: unknown;
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "jarvis_grants") return { data: ["files"], error: null };
      if (name === "jarvis_online_consented") return { data: true, error: null };
      assert.equal(name, "jarvis_open_task", "a reused task needs no extra planning or dispatch");
      savedRequest = args.p_title;
      return { data: [{ task_id: "existing", status: "waiting", reused: true }], error: null };
    },
  } as unknown as Admin;
  const base = { conversationId: "conversation", deviceId: "device" };
  try {
    const nonce = crypto.randomUUID();
    for (const [name, objective] of [
      [
        "request longer than 200 characters",
        `Read ${nonce}.txt. ${"Keep the original file unchanged. ".repeat(10)}Create a summary.`,
      ],
      [
        "code and filename whitespace",
        `Repair ${nonce}  draft.py while preserving this block:\nif ready:\n    print("a  b")\nDo not flatten indentation.`,
      ],
      ["complete 8000-character composer boundary", "x".repeat(8000 - nonce.length) + nonce],
    ]) {
      await t.test(name, async () => {
        providerRequest = null;
        savedRequest = null;
        const before = providerCalls;
        await startTask(admin, "user", { ...base, objective });
        assert.equal(savedRequest, objective, "the journal must retain the same request");
        assert.equal(providerCalls, before, "no model is asked before the first look");
        // The checks are compiled later from the saved request, which reaches the model whole.
        await compileGoal("user", savedRequest as string, ["files"]);
        assert.equal(providerRequest, objective, "the planner must receive the complete request");
      });
    }
    for (const [name, objective] of [
      ["empty request", ""],
      ["whitespace-only request", " \n\t "],
      ["over-limit request", "x".repeat(8001)],
    ]) {
      await t.test(name, async () => {
        const beforeProvider = providerCalls;
        const beforeDatabase = calls.length;
        await assert.rejects(startTask(admin, "user", { ...base, objective }));
        assert.equal(providerCalls, beforeProvider);
        assert.equal(
          calls.length,
          beforeDatabase,
          "reject before requesting permissions or opening a task",
        );
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

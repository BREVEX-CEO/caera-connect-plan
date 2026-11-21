/**
 * An adaptive team (plan 14D.3, 14F.3): while one agent's step still runs, a free agent is given
 * independent work; work that touches what the running agent holds is refused before anything is
 * queued; nothing finishes, asks or verifies until every agent is done; a confirmation, the
 * verifier or single-agent mode means everyone waits, with no model call. Synthetic loopback
 * model only: this proves the planner's rules, not a model's choices.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { intent, type OutcomeCheck } from "../../src/lib/jarvis/contracts.ts";
import { planStep, plannerAccess } from "../../src/lib/jarvis/planner.server.ts";
import type { Step } from "../../src/lib/jarvis/supervisor.ts";
import { assignLanes } from "../../src/lib/jarvis/lanes.ts";

const deadline = new Date("2030-01-01T00:00:00Z");
const check: OutcomeCheck = {
  id: "both",
  description: "Both reports exist",
  kind: "file_exists",
  params: { path: "OCADE output/b.txt" },
};
const running = (status = "claimed", operation = "fs.write_text"): Step => ({
  intent: intent(
    operation as never,
    "s1",
    (operation === "fs.write_text"
      ? { path: "OCADE output/a.txt", text: "A" }
      : { checks: [check] }) as never,
    deadline,
  ),
  status,
  receipt: null,
  lane: 1,
});

async function withModel(
  answers: { name: string; arguments: Record<string, unknown> }[],
  run: (seen: { prompt: string; tools: string[] }[]) => Promise<void>,
) {
  const seen: { prompt: string; tools: string[] }[] = [];
  const server = createServer(async (req, res) => {
    const body: Buffer[] = [];
    for await (const chunk of req) body.push(chunk as Buffer);
    const request = JSON.parse(Buffer.concat(body).toString());
    seen.push({
      prompt: request.messages[1].content,
      tools: request.tools.map((t: { name: string }) => t.name),
    });
    const call = {
      id: `c${seen.length}`,
      ...answers[Math.min(seen.length - 1, answers.length - 1)]!,
    };
    const frames = [
      { type: "tool_call", call },
      {
        type: "final",
        response: {
          backend: "online",
          stopReason: "tool_use",
          text: "",
          toolCalls: [call],
          toolResults: [],
        },
      },
    ];
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(frames.map((frame) => `data: ${JSON.stringify(frame)}\r\n\r\n`).join(""));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const saved = { ...plannerAccess };
  const address = server.address() as { port: number };
  plannerAccess.serviceUrl = () => `http://127.0.0.1:${address.port}`;
  plannerAccess.serviceKey = () => "synthetic-loopback-key";
  plannerAccess.acquirePermit = async (_user, key) => ({
    permit: {
      id: "permit",
      generationId: key,
      idempotencyKey: key,
      surface: "jarvis",
      source: "server",
    },
    release: async () => {},
  });
  try {
    await run(seen);
  } finally {
    Object.assign(plannerAccess, saved);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

let calls = 0;
const plan = (steps: Step[]) =>
  planStep({
    userId: "synthetic-user",
    objective: "Write report A and report B",
    checks: [check],
    steps,
    grants: ["files"],
    engines: [],
    permitKey: async () => `team-${++calls}`,
    now: new Date(),
  });

test("a free agent gets independent work while another agent's step runs", async () => {
  await withModel(
    [{ name: "fs_write_text", arguments: { path: "OCADE output/b.txt", text: "B" } }],
    async (seen) => {
      const decision = await plan([running()]);
      assert.equal(decision.kind, "queue");
      assert.equal(
        (decision as { intent: { arguments: { path: string } } }).intent.arguments.path,
        "OCADE output/b.txt",
      );
      assert.match(seen[0]!.prompt, /Other agents are still running.*Agent 2:/);
      assert.ok(
        seen[0]!.tools.includes("wait") && !seen[0]!.tools.includes("finish"),
        "no finish while others run",
      );
    },
  );
});

test("work on what a running agent holds is refused, and waiting is an answer", async () => {
  await withModel(
    [
      { name: "fs_write_text", arguments: { path: "OCADE output/a.txt", text: "again" } },
      { name: "wait", arguments: {} },
    ],
    async (seen) => {
      const decision = await plan([running()]);
      assert.equal(decision.kind, "wait");
      assert.match(seen[1]!.prompt, /touches what another agent is still working on/);
    },
  );
});

test("nobody plans alongside a confirmation, the verifier, or in single-agent mode", async () => {
  await withModel([{ name: "fs_list", arguments: {} }], async (seen) => {
    assert.equal((await plan([running("needs_confirmation")])).kind, "wait");
    assert.equal((await plan([running("claimed", "verify.checks")])).kind, "wait");
    process.env.OCADE_JARVIS_SPECIALISTS = "0";
    try {
      assert.equal((await plan([running()])).kind, "wait");
    } finally {
      delete process.env.OCADE_JARVIS_SPECIALISTS;
    }
    assert.equal(seen.length, 0, "no model call for any of them");
  });
});

test("new work goes to a free agent first", () => {
  const write = (path: string) =>
    intent("fs.write_text", "k", { path, text: "x" } as never, deadline);
  assert.deepEqual(
    assignLanes([write("OCADE output/b.txt"), write("OCADE output/c.txt")], new Set([0, 1])).map(
      (l) => l.lane,
    ),
    [2, 3],
  );
  assert.deepEqual(
    assignLanes([write("OCADE output/b.txt")]).map((l) => l.lane),
    [0],
  );
});

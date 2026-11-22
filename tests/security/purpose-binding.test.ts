/**
 * R12-03 field-level purpose binding: a card number or IBAN the task read reaches the model only as
 * a placeholder; the planner may fill the real value into a form field or a document, but a step
 * that would put it into an address, a command or another tool is refused, and the step's summary
 * (timeline, notifications, history) keeps the placeholder. Synthetic loopback model only.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { intent, type OutcomeCheck } from "../../src/lib/jarvis/contracts.ts";
import { compileGoal, planStep, plannerAccess } from "../../src/lib/jarvis/planner.server.ts";
import type { Step } from "../../src/lib/jarvis/supervisor.ts";

const deadline = new Date("2030-01-01T00:00:00Z");
const card = "4111 1111 1111 1111";
const read: Step = {
  intent: intent("fs.read_text", "s1", { path: "card.txt" } as never, deadline),
  status: "done",
  receipt: {
    status: "observed",
    maybeChanged: false,
    observedAtUtc: "2026-11-21T00:00:00Z",
    evidence: { text: `Company card ${card}`, sha256: "a".repeat(64) },
  },
};
const check: OutcomeCheck = {
  id: "out",
  description: "The form copy exists",
  kind: "file_exists",
  params: { path: "OCADE output/form.txt" },
};

test("a protected value fills a document, never an address; its summary keeps the placeholder", async () => {
  const prompts: { goal: boolean; text: string }[] = [];
  const server = createServer(async (req, res) => {
    const body: Buffer[] = [];
    for await (const chunk of req) body.push(chunk as Buffer);
    const request = JSON.parse(Buffer.concat(body).toString());
    const prompt: string = request.messages[1].content;
    const goal = request.tools[0]?.name === "set_goal";
    prompts.push({ goal, text: prompt });
    const token = /⟦card·[0-9a-f]{8}⟧/.exec(prompt)?.[0] ?? "none";
    const call = goal
      ? {
          id: "goal",
          name: "set_goal",
          arguments: {
            checks: [{ ...check, kind: "file_contains", params: { ...check.params, text: token } }],
          },
        }
      : prompts.filter((entry) => !entry.goal).length === 1
        ? {
            id: "c1",
            name: "fs_write_text",
            arguments: { path: "OCADE output/" + token + ".txt", text: "draft" },
          }
        : {
            id: "c2",
            name: "fs_write_text",
            arguments: { path: "OCADE output/form.txt", text: "Card: " + token },
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
  plannerAccess.serviceUrl = () =>
    `http://127.0.0.1:${(server.address() as { port: number }).port}`;
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
    const objective = "Copy the company card " + card + " into the form";
    const goal = await compileGoal("synthetic-user", objective, ["files"]);
    assert.equal(goal[0]?.params?.text, card, "the independent local check gets the exact value");
    const decision = await planStep({
      userId: "synthetic-user",
      objective,
      checks: goal,
      steps: [read],
      grants: ["files", "computer_control"],
      engines: ["shell"],
      permitKey: async () => `bind-${prompts.length}`,
      now: new Date(),
    });
    assert.ok(
      prompts.every(({ text }) => !text.includes("4111")),
      "the model never saw the number",
    );
    assert.equal(prompts.filter(({ goal }) => !goal).length, 2, "the path proposal was refused");
    assert.equal(decision.kind, "queue");
    const queued = decision as {
      summary: string;
      intent: { operation: string; arguments: { text: string } };
    };
    assert.equal(queued.intent.operation, "fs.write_text");
    assert.equal(
      queued.intent.arguments.text,
      `Card: ${card}`,
      "the document gets the exact value",
    );
    assert.ok(!queued.summary.includes("4111"), "the summary keeps the placeholder");
  } finally {
    Object.assign(plannerAccess, saved);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  }
});

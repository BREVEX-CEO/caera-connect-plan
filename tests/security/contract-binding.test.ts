/** Checks are bound to the request and to what was seen; a check's input is never bent to pass. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import type { OutcomeCheck } from "../../src/lib/jarvis/contracts.ts";
import {
  compileGoal,
  planStep,
  plannerAccess,
  PlannerUnavailable,
} from "../../src/lib/jarvis/planner.server.ts";

type Proposal = { name: string; arguments: Record<string, unknown> };

async function provider(t: { after: (fn: () => Promise<void>) => void }) {
  const state = { next: [] as Proposal[], prompts: [] as string[] };
  const server = createServer(async (request, response) => {
    let raw = "";
    for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw);
    state.prompts.push(
      body.messages.find((message: { role: string }) => message.role === "user").content,
    );
    const proposal = { id: "p", ...state.next.shift()! };
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
  t.after(async () => {
    Object.assign(plannerAccess, saved);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return state;
}

const input = `notes-${crypto.randomUUID().slice(0, 8)}.txt`;
const readsInput: OutcomeCheck = {
  id: "summary_source",
  description: "The notes mention the budget",
  kind: "file_contains",
  params: { path: input, text: "budget" },
};

test("a check reads only a new output, a requested file or something the first look saw", async (t) => {
  const state = provider(t);
  const goal = (checks: OutcomeCheck[]) => ({ name: "set_goal", arguments: { checks } });
  const unnamed = "Summarise my notes into a short text file";
  (await state).next.push(goal([readsInput]));
  await assert.rejects(compileGoal("u", unnamed, ["files"]), PlannerUnavailable);
  (await state).next.push(goal([readsInput]));
  const seen = { entries: [{ name: input, kind: "file" }] };
  assert.deepEqual(await compileGoal("u", unnamed, ["files"], undefined, seen), [readsInput]);
  assert.match((await state).prompts.at(-1)!, new RegExp(input), "the model is shown the folder");
  (await state).next.push(goal([readsInput]));
  assert.deepEqual(await compileGoal("u", `Summarise ${input}`, ["files"]), [readsInput]);
  const output: OutcomeCheck = { ...readsInput, params: { path: "OCADE output/s.txt", text: "x" } };
  (await state).next.push(goal([output]));
  assert.deepEqual(await compileGoal("u", unnamed, ["files"]), [output]);
});

test("changing the file a check reads to make it pass is refused", async (t) => {
  const state = await provider(t);
  const now = new Date("2026-11-02T00:00:00Z");
  // An in-place edit of the input (confirmed by the person later, if it were allowed at all).
  const bend: Proposal = {
    name: "fs_replace_text",
    arguments: { path: input, text: "The budget is fine.", expectSha256: "0".repeat(64) },
  };
  const base = {
    userId: "u",
    checks: [readsInput],
    grants: ["files"],
    steps: [],
    now,
    turnKey: "binding",
  };
  state.next.push(bend, bend);
  const refused = await planStep({
    ...base,
    objective: "Summarise my notes into a text file under OCADE output",
  });
  assert.notEqual(refused.kind, "queue", JSON.stringify(refused));
  assert.match(state.prompts.at(-1)!, /what check summary_source reads/);

  // Naming the file only as a source does not authorise changing it (the D6 residual).
  state.next.push(bend, bend);
  const source = await planStep({ ...base, objective: `Summarise ${input} into a text file` });
  assert.notEqual(source.kind, "queue", JSON.stringify(source));
  assert.match(state.prompts.at(-1)!, /what check summary_source reads/);

  // The person asked for that very file to change: the same write is allowed.
  state.next.push(bend);
  const allowed = await planStep({
    ...base,
    objective: `Rewrite ${input} so it covers the budget`,
  });
  assert.equal(allowed.kind, "queue", JSON.stringify(allowed));
});

test("one rejected goal is answered with the reason and asked once more", async (t) => {
  const state = await provider(t);
  const goal = (checks: unknown) => ({ name: "set_goal", arguments: { checks } });
  const output: OutcomeCheck = { ...readsInput, params: { path: "OCADE output/s.txt", text: "x" } };
  state.next.push(goal([{ ...output, params: { path: "OCADE output/s.txt" } }]), goal([output]));
  assert.deepEqual(await compileGoal("u", "Write a short note", ["files"]), [output]);
  const second = JSON.parse(state.prompts.at(-1)!);
  assert.match(second.previousAnswerRejected, /text/, "the model is told what was wrong");
  state.next.push(goal([readsInput]), goal([readsInput]));
  await assert.rejects(compileGoal("u", "Write a short note", ["files"]), (error: Error) =>
    /invalid_goal_scope/.test(error.message),
  );
  assert.match(JSON.parse(state.prompts.at(-1)!).previousAnswerRejected, /summary_source/);
});

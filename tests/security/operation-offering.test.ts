/**
 * What a planning turn costs to offer (D47, benchmark round 4: 37 quota refusals against a
 * 16,000 input-tokens-per-minute free limit). Every granted operation stays offered by name
 * and summary; an operation whose argument schema is large is sent with that schema only once
 * the task needs it. Loopback fake provider; no model.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { intent, OPERATIONS } from "../../src/lib/jarvis/contracts.ts";
import { planStep, plannerAccess } from "../../src/lib/jarvis/planner.server.ts";
import type { Step } from "../../src/lib/jarvis/supervisor.ts";

type Tool = { name: string; description: string; inputSchema: { properties?: object } };

test("a large argument schema is sent once the task needs it; every operation stays offered", async (t) => {
  const asked: Tool[][] = [];
  let script: { name: string; arguments: Record<string, unknown> }[] = [];
  const service = createServer(async (request, response) => {
    const body: Buffer[] = [];
    for await (const chunk of request) body.push(chunk as Buffer);
    asked.push(JSON.parse(Buffer.concat(body).toString()).tools);
    const call = { id: `c${asked.length}`, ...script.shift()! };
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(
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
  await new Promise<void>((resolve) => service.listen(0, "127.0.0.1", resolve));
  const saved = { ...plannerAccess };
  t.after(async () => {
    Object.assign(plannerAccess, saved);
    await new Promise<void>((resolve) => service.close(() => resolve()));
  });
  const { port } = service.address() as { port: number };
  plannerAccess.serviceUrl = () => `http://127.0.0.1:${port}`;
  plannerAccess.serviceKey = () => "synthetic-loopback-key";
  plannerAccess.acquirePermit = async (_user, key) => ({
    permit: {
      id: key,
      generationId: key,
      idempotencyKey: key,
      surface: "jarvis",
      source: "server",
    },
    release: async () => {},
  });

  let key = 0;
  const base = {
    userId: "u",
    objective: "Make photo.png brighter",
    checks: [
      {
        id: "out",
        description: "Edited picture",
        kind: "file_exists" as const,
        params: { path: "OCADE output/bright.png" },
      },
    ],
    grants: ["files"],
    engines: ["ffmpeg", "office", "browser"],
    permitKey: async () => `k${(key += 1)}`,
    now: new Date(),
  };
  const edit = {
    source: "photo.png",
    output: "OCADE output/bright.png",
    steps: [{ op: "brightness", factor: 1.2 }],
  };
  const schemaSize = (tools: Tool[], name: string) =>
    JSON.stringify(tools.find((tool) => tool.name === name)!.inputSchema).length;
  const granted = Object.entries(OPERATIONS)
    .filter(([name, spec]) => spec.capability === "files" && !name.startsWith("verify."))
    .map(([name]) => name.replace(".", "_"));

  // The model reaches for the large operation, then gets one wrong, then gets it right:
  // the schema hand-over does not use up the turn's one correction.
  script = [
    { name: "image_edit", arguments: {} },
    { name: "image_edit", arguments: { ...edit, output: "elsewhere.png" } },
    { name: "image_edit", arguments: edit },
  ];
  const decision = await planStep({ ...base, steps: [] });
  assert.equal(decision.kind, "queue", JSON.stringify(decision));
  assert.equal((decision as { intent: { operation: string } }).intent.operation, "image.edit");
  assert.equal(asked.length, 3);

  const [first, second] = asked;
  assert.deepEqual(
    first.map((tool) => tool.name),
    [...granted, "finish", "ask"],
    "nothing is hidden: every granted operation is offered by name",
  );
  for (const name of ["image_edit", "scene_render", "media_render_timeline"]) {
    assert.deepEqual(first.find((tool) => tool.name === name)!.inputSchema.properties, {}, name);
    assert.match(first.find((tool) => tool.name === name)!.description, /argument schema/);
  }
  assert.ok(schemaSize(first, "fs_write_text") > 100, "ordinary operations keep their schema");
  // Before: 23.9k characters (about 6k tokens) of offered operations on every turn.
  assert.ok(JSON.stringify(first).length < 11_000, `offered ${JSON.stringify(first).length}`);
  assert.ok(schemaSize(second, "image_edit") > 1_500, "the schema arrives when it is called for");
  assert.deepEqual(
    second.find((tool) => tool.name === "scene_render")!.inputSchema.properties,
    {},
    "only the operation the model reached for",
  );

  // Once the task has used the operation, its schema is there from the start of every turn.
  asked.length = 0;
  script = [{ name: "image_edit", arguments: { ...edit, output: "OCADE output/again.png" } }];
  const used: Step = {
    intent: intent("image.edit", "s1", edit, new Date(Date.now() + 60_000)),
    status: "done",
    receipt: {
      status: "observed",
      maybeChanged: true,
      observedAtUtc: new Date().toISOString(),
      evidence: { sha256: "0".repeat(64) },
    },
  };
  assert.equal((await planStep({ ...base, steps: [used] })).kind, "queue");
  assert.equal(asked.length, 1);
  assert.ok(schemaSize(asked[0], "image_edit") > 1_500);
});

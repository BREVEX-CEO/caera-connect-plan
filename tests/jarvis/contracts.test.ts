/**
 * Contract and planner tests (plan.md P01/P13/P16). Pure: no network, no database.
 * Run: node --experimental-strip-types --test tests/jarvis/
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionIntent,
  actionReceipt,
  deviceRequest,
  intent,
  type ActionIntent,
} from "../../src/lib/jarvis/contracts.ts";
import { evidenceOf, open, settleChecks, type Step } from "../../src/lib/jarvis/supervisor.ts";

const now = new Date("2026-10-30T12:00:00Z");
const deadline = new Date(now.getTime() + 60_000);

test("an intent must match the registry's capability, risk and arguments", () => {
  const ok = intent("office.inspect_workbook", "inspect", { path: "a.xlsx" }, deadline);
  assert.equal(ok.risk, "read");
  for (const forged of [
    { ...ok, risk: "reversible_write" },
    { ...ok, capability: "terminal" },
    { ...ok, operation: "sys.run_shell" },
    { ...ok, arguments: { path: "a.xlsx", command: "del" } },
    { ...ok, arguments: {} },
    { ...ok, key: "Bad Key!" },
    { ...ok, extra: true },
  ]) {
    assert.equal(actionIntent.safeParse(forged).success, false, JSON.stringify(forged));
  }
});

test("a receipt cannot claim success outside the three observed states", () => {
  const base = { maybeChanged: false, observedAtUtc: now.toISOString(), evidence: {} };
  assert.ok(actionReceipt.safeParse({ ...base, status: "observed" }).success);
  assert.equal(actionReceipt.safeParse({ ...base, status: "success" }).success, false);
  assert.equal(
    actionReceipt.safeParse({ ...base, status: "observed", evidence: { blob: "x".repeat(20_000) } })
      .success,
    false,
  );
});

test("a device request is one of three strict shapes", () => {
  assert.ok(deviceRequest.safeParse({ op: "claim" }).success);
  assert.equal(deviceRequest.safeParse({ op: "claim", userId: "someone" }).success, false);
  assert.equal(deviceRequest.safeParse({ op: "settle" }).success, false);
});

test("the shared supervisor has no task-specific dispatch or application whitelist", () => {
  const step: Step = {
    intent: intent("fs.read_text", "read", { path: "sample.txt" }, deadline),
    status: "done",
    receipt: {
      status: "observed",
      maybeChanged: false,
      observedAtUtc: now.toISOString(),
      evidence: { text: "proof" },
    },
  };
  assert.deepEqual(evidenceOf([step], "fs.read_text"), { text: "proof" });
  assert.equal(open({ ...step, status: "claimed" }), true);
  assert.equal(open(step), false);
  const checks = [
    { id: "evidence_a", description: "First output exists" },
    { id: "evidence_b", description: "Second output valid" },
    { id: "evidence_c", description: "Third output still unverified" },
  ];
  const outcome = settleChecks(checks, {
    predicates: { evidence_a: true, evidence_b: false },
    verifierVersion: "test",
  });
  assert.deepEqual(outcome.passed, ["evidence_a"]);
  assert.deepEqual(outcome.failed, ["evidence_b"]);
  assert.deepEqual(outcome.unverified, ["evidence_c"]);
});

test("the pilot stops on repeated steps and on too many refused steps", async () => {
  const { stalled } = await import("../../src/lib/jarvis/planner.server.ts");
  const list = intent("fs.list", "a", {}, deadline);
  const done = (i: ActionIntent): Step => ({ intent: i, status: "done", receipt: null });
  assert.equal(stalled([done(list), done(list)]), null);
  assert.match(stalled([done(list), done(list), done(list)]) ?? "", /repeating/);
  const failed = (n: number): Step => ({
    intent: intent("fs.read_text", `f${n}`, { path: `${n}.txt` }, deadline),
    status: "failed",
    receipt: null,
  });
  assert.match(stalled([1, 2, 3, 4, 5].map(failed)) ?? "", /could not be done/);
});

test("external tools reach the planner only when granted, and only a few", async () => {
  const { routeExternalTools } = await import("../../src/lib/jarvis/planner.server.ts");
  const tools = Array.from({ length: 30 }, (_, n) => ({
    name: `tool${n}`,
    risk: "read",
    description: n === 7 ? "convert currency rates" : "unrelated",
    inputSchema: { type: "object" },
  }));
  const servers = [{ id: "fx", publisher: "Example", version: "1", tools }];
  assert.deepEqual(routeExternalTools("convert currency", servers, ["mcp"]), []);
  assert.deepEqual(routeExternalTools("convert currency", servers, ["mcp:fx"]), []);
  const routed = routeExternalTools("convert currency to EUR", servers, ["mcp", "mcp:fx"]);
  assert.equal(routed.length, 12);
  assert.equal(routed[0].tool.name, "tool7");
});

test("operations needing an engine the computer lacks are never offered", async () => {
  const { offeredOperations } = await import("../../src/lib/jarvis/planner.server.ts");
  const offered = offeredOperations(["files", "browser"], ["ffmpeg"]);
  assert.ok(offered.includes("media.render_timeline") && offered.includes("fs.list"));
  assert.ok(!offered.includes("scene.render") && !offered.includes("web.open"));
  assert.ok(
    !offered.includes("office.write_workbook") && !offered.some((o) => o.startsWith("verify.")),
  );
  assert.ok(offeredOperations(["files", "browser"], null).includes("scene.render"));
  assert.ok(!offeredOperations(["files"], null).includes("web.open"));
});

test("every operation schema stays inside the provider's schema subset", async () => {
  const { providerSchema } = await import("../../src/lib/jarvis/planner.server.ts");
  const { OPERATIONS } = await import("../../src/lib/jarvis/contracts.ts");
  const { z } = await import("zod");
  for (const [name, spec] of Object.entries(OPERATIONS)) {
    const text = JSON.stringify(providerSchema(z.toJSONSchema(spec.arguments, { io: "input" })));
    assert.ok(
      !/"\$ref"|"\$defs"|"prefixItems"|"additionalProperties"|"exclusiveM(in|ax)imum"|"propertyNames"|"const"/.test(
        text,
      ),
      name,
    );
  }
});

test("capability shortlist: descriptor vectors, bounded, continuity, paraphrase-stable", async () => {
  const { shortlistOperations, offeredOperations, rankBySimilarity } =
    await import("../../src/lib/jarvis/planner.server.ts");
  const all = offeredOperations(["files", "browser", "apps", "screen", "computer_control"], null);
  assert.ok(all.length > 12);
  const pick = (objective: string, steps: never[] = []) =>
    shortlistOperations(all, { objective, checks: [], steps });
  // Different wording, file names and formats reach the same capabilities (metamorphic).
  for (const objective of [
    "Make a Word document that states the quarterly status written in note.txt.",
    "Turn the notes in status-report.md into an editable .docx file",
    "Write up what draft_7.csv says as a document with headings",
  ]) {
    const chosen = pick(objective);
    assert.ok(chosen.length <= 12, objective);
    assert.ok(
      chosen.includes("office.write_document") && chosen.includes("fs.read_text"),
      `${objective}: ${chosen}`,
    );
  }
  const render = pick("Design a red and black 3D sports car and give me a 4K image of it");
  assert.ok(render.includes("scene.render") && render.includes("media.preview"), String(render));
  const film = pick(
    "Cut a 30 second cinematic advert from car footage with music and sound effects",
  );
  assert.ok(
    ["media.render_timeline", "media.analyze", "media.preview"].every((o) => film.includes(o)),
    String(film),
  );
  // An application nobody listed still reaches the generic desktop capabilities.
  const app = pick("In the Zorblax Pro window, press the Export button");
  assert.ok(app.includes("ui.invoke") && app.includes("apps.list"), String(app));
  // Continuity: an operation already used stays offered even when it no longer ranks.
  const used = pick("Write a document", [
    { intent: { operation: "web.close" }, status: "done", receipt: null },
  ] as never);
  assert.ok(used.includes("web.close"));
  // The descriptor, not a name table, decides: change the text and the ranking follows.
  const tools = [
    { id: "a", text: "convert currency amounts between exchange rates" },
    { id: "b", text: "resize photographs" },
  ];
  assert.equal(rankBySimilarity("convert currency", tools, (t) => t.text)[0].item.id, "a");
  tools[1].text = "convert currency quickly with live rates";
  assert.equal(rankBySimilarity("convert currency live", tools, (t) => t.text)[0].item.id, "b");
});

test("a failed independent check returns to the model for bounded repair", async () => {
  const { createServer } = await import("node:http");
  const { planStep, plannerAccess } = await import("../../src/lib/jarvis/planner.server.ts");
  let calls = 0;
  const service = createServer((_req, res) => {
    calls += 1;
    res.writeHead(200, { "content-type": "text/event-stream" });
    const event = { type: "tool_call", call: { name: "finish", arguments: {} } };
    res.end(`data: ${JSON.stringify(event)}\r\n\r\n`);
  });
  await new Promise<void>((ok) => service.listen(0, "127.0.0.1", ok));
  const saved = { ...plannerAccess };
  const { port } = service.address() as { port: number };
  plannerAccess.serviceUrl = () => `http://127.0.0.1:${port}`;
  plannerAccess.serviceKey = () => "test";
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
    const checks = [
      {
        id: "out",
        description: "Report exists",
        kind: "file_exists" as const,
        params: { path: "OCADE output/r.docx" },
      },
    ];
    let n = 0;
    const verify = (passed: boolean): Step => ({
      intent: intent("verify.checks", `v${(n += 1)}`, { checks }, deadline),
      status: "done",
      receipt: {
        status: "observed",
        maybeChanged: false,
        observedAtUtc: now.toISOString(),
        evidence: { predicates: { out: passed } },
      },
    });
    const base = {
      userId: "u",
      objective: "Write a report",
      checks,
      grants: ["files"],
      turnKey: "t",
      now,
    };
    // The failure goes back to the model, which sees it in its history and can repair.
    assert.equal((await planStep({ ...base, steps: [verify(false)] })).kind, "queue");
    assert.equal(calls, 1);
    // Bounded: the third failed verification settles the task.
    assert.equal(
      (await planStep({ ...base, steps: [verify(false), verify(false), verify(false)] })).kind,
      "settle",
    );
    // A pass settles without asking the model again.
    assert.equal(
      (await planStep({ ...base, steps: [verify(false), verify(true)] })).kind,
      "settle",
    );
    assert.equal(calls, 1);
  } finally {
    Object.assign(plannerAccess, saved);
    service.close();
  }
});

test("browser targets are public https sites by name", () => {
  for (const url of [
    "https://127.0.0.1/",
    "https://localhost/",
    "https://x.localhost/",
    "http://example.com/",
    "https://example.com:8443/",
  ]) {
    assert.throws(() => intent("web.open", "o", { url }, deadline), url);
  }
  assert.equal(
    intent("web.open", "o", { url: "https://example.com/a" }, deadline).target?.site,
    "example.com",
  );
});

test("tool schemas are normalized to what the provider accepts, nothing else changes", async () => {
  const { providerSchema } = await import("../../src/lib/jarvis/planner.server.ts");
  const normalized = providerSchema({
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    properties: {
      v: { const: 1 },
      nested: {
        type: "object",
        additionalProperties: false,
        properties: { a: { type: "string", maxLength: 5 } },
      },
    },
    required: ["v"],
  });
  assert.deepEqual(normalized, {
    type: "object",
    properties: {
      v: { enum: [1] },
      nested: { type: "object", properties: { a: { type: "string", maxLength: 5 } } },
    },
    required: ["v"],
  });
});

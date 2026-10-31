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

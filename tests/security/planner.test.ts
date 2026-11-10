/**
 * Planner trust-boundary regressions. Provider responses are synthetic protocol data;
 * all network traffic stays on a disposable runner's loopback interface.
 */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { intent, OPERATIONS, type OutcomeCheck } from "../../src/lib/jarvis/contracts.ts";
import {
  compileGoal,
  planStep,
  plannerAccess,
  PlannerUnavailable,
  unseenAddress,
} from "../../src/lib/jarvis/planner.server.ts";
import type { Step } from "../../src/lib/jarvis/supervisor.ts";

const deadline = new Date("2030-01-01T00:00:00Z");
const suffix = crypto.randomUUID();
const path = `/releases/${suffix}/artifact`;
const origin = "https://source.example";
const target = `${origin}${path}?arch=arm64`;
const credentialTarget = new URL(target);
credentialTarget.username = "synthetic";
credentialTarget.password = crypto.randomUUID();
const observation = (evidence: Record<string, unknown>): Step => ({
  intent: intent("web.open", "source", { url: origin }, deadline),
  status: "done",
  receipt: {
    status: "observed",
    maybeChanged: false,
    observedAtUtc: "2026-11-01T00:00:00Z",
    evidence,
  },
});

test("observed addresses retain their exact origin, path and query", async (t) => {
  const source = observation({
    url: `${origin}/releases/`,
    controls: [{ href: `${path}?arch=arm64`, label: "Get artifact" }],
  });
  for (const [name, url, steps] of [
    ["different origin", `https://other.example${path}?arch=arm64`, [source]],
    ["unobserved SPA route", `${origin}/#/items/${suffix}`, [source]],
    [
      "different SPA route",
      `${origin}/#/items/guessed`,
      [observation({ url: origin, controls: [{ href: `/#/items/${suffix}` }] })],
    ],
    ["shorter path", `${origin}/releases/${suffix}`, [source]],
    ["different query", `${origin}${path}?arch=x64`, [source]],
    ["credentials", credentialTarget.href, [source]],
    ["failed observation", target, [{ ...source, status: "failed" }]],
    [
      "unapplied observation",
      target,
      [{ ...source, receipt: { ...source.receipt!, status: "not_applied" } }],
    ],
    [
      "URL mentioned only as a prose substring",
      target,
      [observation({ text: `Never open ${target}.bad` })],
    ],
  ] as const) {
    await t.test(name, () => assert.throws(() => unseenAddress(url, "", [...steps])));
  }
  assert.doesNotThrow(() => unseenAddress(target, "", [source]));
  assert.doesNotThrow(() => unseenAddress(`${origin}/`, "", []));
  assert.doesNotThrow(() =>
    unseenAddress(`${origin}/#/items/${suffix}`, "", [
      observation({ url: origin, controls: [{ href: `/#/items/${suffix}` }] }),
    ]),
  );
  assert.doesNotThrow(() => unseenAddress(target, `Inspect ${target}`, []));
  assert.doesNotThrow(() => unseenAddress(target, `Inspect source.example${path}?arch=arm64`, []));
  assert.doesNotThrow(() =>
    unseenAddress(`https://other.example${path}`, "", [
      observation({ url: origin, controls: [{ href: `https://other.example${path}` }] }),
    ]),
  );
});

test("only a complete, matching provider turn may define a goal", async (t) => {
  const check: OutcomeCheck = {
    id: "result",
    description: "The requested output exists",
    kind: "file_exists",
    params: { path: `OCADE output/${suffix}.txt` },
  };
  const call = { id: "proposal", name: "set_goal", arguments: { checks: [check] } };
  const event = { type: "tool_call", call };
  const terminal = {
    type: "final",
    response: {
      backend: "online",
      stopReason: "tool_use",
      text: "",
      toolCalls: [call],
      toolResults: [],
    },
  };
  let frames: unknown[] = [];
  let offered: string[] = [];
  const server = createServer(async (req, res) => {
    const body: Buffer[] = [];
    for await (const chunk of req) body.push(chunk as Buffer);
    const request = JSON.parse(Buffer.concat(body).toString());
    offered = request.tools.map((tool: { name: string }) => tool.name);
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
  const altered = { ...call, arguments: { checks: [{ ...check, id: "substituted" }] } };
  try {
    for (const [name, response] of [
      ["closed without final", [event]],
      [
        "cancelled final",
        [event, { ...terminal, response: { ...terminal.response, stopReason: "cancelled" } }],
      ],
      [
        "final changed the proposal",
        [event, { ...terminal, response: { ...terminal.response, toolCalls: [altered] } }],
      ],
      ["call after final", [event, terminal, event]],
      ["duplicate final", [event, terminal, terminal]],
      [
        "too many calls",
        [
          ...Array.from({ length: 6 }, (_, n) => ({ ...event, call: { ...call, id: `c${n}` } })),
          terminal,
        ],
      ],
    ] as const) {
      await t.test(name, async () => {
        frames = [...response];
        await assert.rejects(
          compileGoal("synthetic-user", "Create the requested output", ["files"]),
          PlannerUnavailable,
        );
      });
    }
    frames = [event, terminal];
    assert.deepEqual(
      await compileGoal("synthetic-user", "Create the requested output", ["files"]),
      [check],
    );
    const denied = {
      id: "proposal",
      name: "web_open",
      arguments: { url: "https://example.test" },
    };
    frames = [
      { type: "tool_call", call: denied },
      { ...terminal, response: { ...terminal.response, toolCalls: [denied] } },
    ];
    const grants = ["files", "media", "computer_control", "browser"];
    const decision = await planStep({
      userId: "synthetic-user",
      objective: "Create the requested output",
      checks: [check],
      steps: [],
      grants,
      engines: ["ffmpeg", "office"],
      permitKey: async () => "operation-offering",
      now: new Date(),
    });
    const expected = Object.entries(OPERATIONS)
      .filter(
        ([name, spec]) =>
          !name.startsWith("verify.") &&
          !name.startsWith("mcp.") &&
          grants.includes(spec.capability) &&
          (!("engine" in spec) || ["ffmpeg", "office"].includes(spec.engine)),
      )
      .map(([name]) => name.replace(".", "_"));
    assert.ok(expected.length > 12, "the old shortlist would omit at least one tool");
    assert.deepEqual(offered, [...expected, "finish", "ask"]);
    assert.equal(decision.kind, "block", "a fabricated, unavailable tool must not queue");
  } finally {
    Object.assign(plannerAccess, saved);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

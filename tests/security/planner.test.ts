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
  taskApps,
  precedent,
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
    assert.deepEqual(offered, [...expected, "finish", "expect", "ask"]);
    assert.equal(decision.kind, "block", "a fabricated, unavailable tool must not queue");
  } finally {
    Object.assign(plannerAccess, saved);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("the apps a task names with @ are its scope; naming grants nothing", () => {
  const grants = ["files", "apps", "app:editor.exe", "app:calc.exe", "app:microsoft excel"];
  assert.deepEqual(taskApps("Tidy the note in @editor.exe please", grants), ["editor.exe"]);
  assert.deepEqual(taskApps("Use @Editor.exe, then @calc.exe", grants), ["editor.exe", "calc.exe"]);
  assert.deepEqual(taskApps("Sum it in @Microsoft Excel now", grants), ["microsoft excel"]);
  assert.deepEqual(taskApps("Tidy the note in any app", grants), []);
  assert.deepEqual(taskApps("Mail someone@calc.exe.example later", grants), [], "a longer name");
  assert.deepEqual(taskApps("Use @paint.exe", grants), [], "not allowed: no scope");
});

test("the closest verified earlier task guides the model; an unrelated one is not shown (C9)", () => {
  const experience = [
    { title: "Rename the holiday photos by date", route: ["fs.list", "fs.manage"] },
    {
      title: "Total the March invoices in excel.exe",
      route: [
        "apps.launch excel.exe",
        "ui.inspect excel.exe",
        "ui.inspect excel.exe",
        "verify.checks",
      ],
    },
  ];
  const line = precedent("Total the April invoices in excel.exe", experience);
  assert.match(line, /"Total the March invoices in excel\.exe"/);
  assert.match(line, /apps\.launch excel\.exe -> ui\.inspect excel\.exe -> verify\.checks\./);
  assert.equal(precedent("Draw a cat in paint", experience), "", "nothing close enough");
  assert.equal(precedent("Total the April invoices", []), "", "no history");
});

test("model spending ceilings: an account's day and everyone's month, only when set", async () => {
  const { modelBudgetReached } = await import("../../src/lib/jarvis/planner.server.ts");
  const now = new Date("2026-11-20T12:00:00Z");
  const asked: [string | null, string][] = [];
  // 1M input + 100k output tokens = $0.30 + $0.25 = $0.55 at the conservative paid prices.
  const spend = async (user: string | null, since: Date) => {
    asked.push([user, since.toISOString()]);
    return user ? { input: 1_000_000, output: 100_000 } : { input: 10_000_000, output: 1_000_000 };
  };
  assert.equal(await modelBudgetReached(spend, "u", now, {}), false);
  assert.deepEqual(asked, [], "nothing is counted when no ceiling is set");
  assert.equal(await modelBudgetReached(spend, "u", now, { accountDaily: 0.56 }), false);
  assert.equal(await modelBudgetReached(spend, "u", now, { accountDaily: 0.55 }), true);
  assert.deepEqual(asked.at(-1), ["u", "2026-11-19T12:00:00.000Z"], "the last 24 hours");
  assert.equal(await modelBudgetReached(spend, "u", now, { monthly: 5.5 }), true);
  assert.deepEqual(asked.at(-1), [null, "2026-11-01T00:00:00.000Z"], "every account this month");
  assert.equal(await modelBudgetReached(spend, "u", now, { monthly: 5.51 }), false);
  // Another model's own prices (any compatible model): ten times dearer, ten times sooner.
  const dearer = { input: 3, output: 25 };
  assert.equal(await modelBudgetReached(spend, "u", now, { accountDaily: 5.5 }, dearer), true);
});

test("the coordinator's specialists answer in parallel from complete results, and only answer", async () => {
  const check: OutcomeCheck = {
    id: "result",
    description: "The requested output exists",
    kind: "file_exists",
    params: { path: `OCADE output/${suffix}.txt` },
  };
  // A long earlier result: the history clips it, the specialist reads it whole.
  const needle = `INVOICE-${suffix}`;
  const long = observation({
    url: origin,
    text: `${"filler ".repeat(3_000)}${needle} total 42.50`,
  });
  const seen: { system: string; prompt: string; tools: string[] }[] = [];
  let analysts = 0;
  let inFlight = 0;
  let overlapped = false;
  const reply = (name: string, args: Record<string, unknown>, id = "c1") => {
    const call = { id, name, arguments: args };
    return [
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
  };
  const server = createServer(async (req, res) => {
    const body: Buffer[] = [];
    for await (const chunk of req) body.push(chunk as Buffer);
    const request = JSON.parse(Buffer.concat(body).toString());
    const [system, user] = request.messages.map((m: { content: string }) => m.content);
    seen.push({ system, prompt: user, tools: request.tools.map((t: { name: string }) => t.name) });
    let frames: unknown[];
    if (system.startsWith("You are a specialist analyst")) {
      analysts += 1;
      inFlight += 1;
      if (inFlight > 1) overlapped = true;
      await new Promise((resolve) => setTimeout(resolve, 50));
      inFlight -= 1;
      frames = reply("answer", {
        text: user.includes(needle) ? `${needle}, total 42.50` : "not in the results",
      });
    } else if (!user.includes("Specialist answers")) {
      frames = reply("delegate", {
        tasks: [
          { question: "Which invoice number and total?", steps: [1] },
          { question: "Is there a due date?", steps: [1] },
        ],
      });
    } else frames = reply("finish", {});
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
  let calls = 0;
  const plan = () =>
    planStep({
      userId: "synthetic-user",
      objective: "Write the invoice total to a file",
      checks: [check],
      steps: [long],
      grants: ["files", "browser"],
      engines: [],
      permitKey: async () => `delegation-${++calls}`,
      now: new Date(),
    });
  try {
    const decision = await plan();
    assert.equal(decision.kind, "queue");
    assert.equal((decision as { intent: { operation: string } }).intent.operation, "verify.checks");
    assert.equal(analysts, 2, "one specialist a question");
    assert.ok(overlapped, "the specialists worked at the same time");
    const [coordinator, ...rest] = seen;
    assert.ok(coordinator!.tools.includes("delegate"));
    assert.ok(!coordinator!.prompt.includes(needle), "the coordinator's history was clipped");
    const specialists = rest.filter((r) => r.system.startsWith("You are a specialist"));
    assert.deepEqual(
      specialists.map((r) => r.tools),
      [["answer"], ["answer"]],
      "they cannot act",
    );
    const second = rest.find((r) => !r.system.startsWith("You are a specialist"))!;
    assert.match(second.prompt, new RegExp(`${needle}, total 42.50`));
    assert.ok(!second.tools.includes("delegate"), "once a turn");
    // The single-agent comparison: no specialist is offered.
    seen.length = 0;
    process.env.OCADE_JARVIS_SPECIALISTS = "0";
    await plan();
    assert.ok(!seen[0]!.tools.includes("delegate"));
  } finally {
    delete process.env.OCADE_JARVIS_SPECIALISTS;
    Object.assign(plannerAccess, saved);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("a step is described in the person's words, never by a tool identifier", async () => {
  const { stepSummary } = await import("../../src/lib/jarvis/planner.server.ts");
  assert.equal(
    stepSummary("fs.write_text", { path: "OCADE output/total.txt", text: "x" }),
    "Write a new plain-text file: OCADE output/total.txt",
  );
  assert.equal(
    stepSummary("web.read", { page: { id: "p1", site: "example.com" } }),
    "Read the visible text, links and form fields of an open web page: example.com",
  );
  for (const name of Object.keys(OPERATIONS))
    assert.doesNotMatch(stepSummary(name as never, {}), /[a-z]+[._][a-z_]+\b|\.py|\.ts/, name);
});

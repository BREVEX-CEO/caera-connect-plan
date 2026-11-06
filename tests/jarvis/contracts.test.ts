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
  // A computer without a desktop bridge (macOS/Linux today) is never offered window control.
  const noDesktop = offeredOperations(["apps", "computer_control"], ["ffmpeg"]);
  assert.ok(!noDesktop.some((o) => o.startsWith("ui.") || o.startsWith("apps.")));
  assert.ok(noDesktop.includes("shell.run") && noDesktop.includes("system.inspect"));
  assert.ok(offeredOperations(["apps"], ["desktop"]).includes("ui.inspect"));
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
  // Organising files reaches the typed file operations, not a shell command.
  const organise = pick("Sort the photos in this folder into one folder per year");
  assert.ok(organise.includes("fs.manage"), String(organise));
  // An application nobody listed still reaches the generic desktop capabilities.
  const app = pick("In the Zorblax Pro window, press the Export button");
  assert.ok(app.includes("ui.invoke") && app.includes("apps.list"), String(app));
  // Continuity: an operation already used stays offered with its whole role, even when
  // neither ranks (a page opened on a website is then clicked).
  const used = pick("Write a document", [
    { intent: { operation: "web.close" }, status: "done", receipt: null },
  ] as never);
  assert.ok(used.includes("web.close") && used.includes("web.click"), String(used));
  // The descriptor, not a name table, decides: change the text and the ranking follows.
  const tools = [
    { id: "a", text: "convert currency amounts between exchange rates" },
    { id: "b", text: "resize photographs" },
  ];
  assert.equal(rankBySimilarity("convert currency", tools, (t) => t.text)[0].item.id, "a");
  tools[1].text = "convert currency quickly with live rates";
  assert.equal(rankBySimilarity("convert currency live", tools, (t) => t.text)[0].item.id, "b");
});

test("mechanism fallback: a failed route is followed by a fresh look, then the next route", async () => {
  const { fallbackRoute, observedSinceFailure, shortlistOperations, offeredOperations } =
    await import("../../src/lib/jarvis/planner.server.ts");
  const window = { exe: "fixture.exe", pid: 5, hwnd: 7, started: 11 };
  const step = (operation: string, status: string, receipt: unknown = null) =>
    ({ intent: { operation, risk: "read", arguments: { window } }, status, receipt }) as never;
  const failed = [
    step("ui.inspect", "done"),
    step("ui.invoke", "failed", {
      status: "not_applied",
      errorCode: "element_not_found",
      evidence: {},
    }),
  ];
  assert.deepEqual(fallbackRoute(failed), {
    observe: "ui.inspect",
    next: ["ui.send_keys", "ui.click_point"],
  });
  assert.throws(
    () => observedSinceFailure(failed, "ui.send_keys", { window }),
    /look again with ui.inspect/,
  );
  const fresh = step("ui.inspect", "done", {
    status: "observed",
    evidence: {},
    preview: "dGVzdA==",
  });
  assert.doesNotThrow(() =>
    observedSinceFailure([...failed, fresh], "ui.click_point", { window }),
  );
  // Another mechanism is not held back by a failure on a window.
  assert.doesNotThrow(() => observedSinceFailure(failed, "fs.write_text"));
  const all = offeredOperations(["files", "browser", "apps", "screen", "computer_control"], null);
  const offered = shortlistOperations(all, {
    objective: "Write a report",
    checks: [],
    steps: failed,
  });
  assert.ok(offered.includes("ui.inspect") && offered.includes("ui.click_point"), String(offered));
  // A command that ran out of time is offered again as a tracked job.
  const slow = [step("shell.run", "done", { status: "observed", evidence: { timedOut: true } })];
  assert.deepEqual(fallbackRoute(slow)?.next, ["job.start"]);
  assert.equal(
    fallbackRoute([step("fs.list", "done", { status: "observed", evidence: {} })]),
    null,
  );
});

test("a repaired program is re-run only with a command the person already confirmed", async () => {
  const { commandsNotYetRun } = await import("../../src/lib/jarvis/planner.server.ts");
  const checks = [
    {
      id: "runs",
      description: "Runs",
      kind: "command_succeeds",
      params: { command: "./backup.sh" },
    },
    { id: "out", description: "Out", kind: "file_exists", params: { path: "OCADE output/a.txt" } },
  ] as never;
  const ran = (command: string, status: string) =>
    ({
      intent: { operation: "shell.run", arguments: { command } },
      status,
      receipt: null,
    }) as never;
  assert.deepEqual(commandsNotYetRun(checks, []), ["./backup.sh"]);
  assert.deepEqual(commandsNotYetRun(checks, [ran("./backup.sh", "needs_confirmation")]), [
    "./backup.sh",
  ]);
  assert.deepEqual(commandsNotYetRun(checks, [ran("./backup.sh --force", "done")]), [
    "./backup.sh",
  ]);
  assert.deepEqual(commandsNotYetRun(checks, [ran("./backup.sh", "done")]), []);
});

test("a failed independent check returns to the model for bounded repair", async () => {
  const { createServer } = await import("node:http");
  const { planStep, plannerAccess } = await import("../../src/lib/jarvis/planner.server.ts");
  let calls = 0;
  let reply: { name: string; arguments: Record<string, unknown> }[] = [
    { name: "finish", arguments: {} },
  ];
  const replies: (typeof reply)[] = [];
  let lastPrompt = "";
  const service = createServer(async (req, res) => {
    calls += 1;
    let body = "";
    for await (const chunk of req) body += chunk;
    lastPrompt = JSON.parse(body).messages.at(-1).content;
    res.writeHead(200, { "content-type": "text/event-stream" });
    const proposals = (replies.shift() ?? reply).map((call, i) => ({ ...call, id: `call-${i}` }));
    res.end(
      [
        ...proposals.map((call) => ({ type: "tool_call", call })),
        {
          type: "final",
          response: { backend: "online", stopReason: "tool_use", toolCalls: proposals },
        },
      ]
        .map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`)
        .join(""),
    );
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

    // A name that was not offered this turn is refused, even if the operation exists.
    reply = [
      { name: "office_write_workbook", arguments: { path: "OCADE output/x.xlsx", sheets: [] } },
    ];
    const offeredOnly = await planStep({ ...base, engines: [], steps: [] });
    assert.equal(offeredOnly.kind, "block");
    // A mutation ends read batching and must be reconsidered after the observed result.
    reply = [
      { name: "fs_read_text", arguments: { path: "a.txt" } },
      {
        name: "office_write_document",
        arguments: { docx: "OCADE output/a.docx", title: "A", sections: [{ heading: "H" }] },
      },
      {
        name: "web_click",
        arguments: { page: { id: "p1", site: "example.com" }, selector: "#send" },
      },
      { name: "fs_list", arguments: {} },
    ];
    const batch = await planStep({ ...base, grants: ["files", "browser"], steps: [] });
    // A refused proposal goes back once with the validator's reason; the corrected one is queued.
    const sections = [{ heading: "H" }];
    replies.push(
      [{ name: "office_write_document", arguments: { docx: "report.docx", title: "A", sections } }],
      [
        {
          name: "office_write_document",
          arguments: { docx: "OCADE output/report.docx", title: "A", sections },
        },
      ],
    );
    const before = calls;
    const corrected = await planStep({ ...base, steps: [] });
    assert.equal(corrected.kind, "queue");
    assert.equal(calls - before, 2);
    assert.match(lastPrompt, /refused your last proposal.*OCADE output/s);
    // One huge observation never pushes the earlier steps out of the model's history.
    reply = [{ name: "fs_list", arguments: {} }];
    const read = (key: string, text: string): Step => ({
      intent: intent("fs.read_text", key, { path: `${key}.txt` }, deadline),
      status: "done",
      receipt: {
        status: "observed",
        maybeChanged: false,
        observedAtUtc: now.toISOString(),
        evidence: { text },
      },
    });
    await planStep({ ...base, steps: [read("first", "a"), read("huge", "x".repeat(60_000))] });
    assert.match(lastPrompt, /first\.txt/);
    assert.match(lastPrompt, /huge\.txt.*\(clipped\)/s);
    assert.equal(batch.kind, "queue");
    if (batch.kind === "queue") {
      assert.equal(batch.intent.operation, "fs.read_text");
      assert.deepEqual(
        batch.more?.map((m) => [m.intent.operation, m.intent.key]),
        [],
      );
    }
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

test("the person confirms the exact command, not a model-written summary", async () => {
  const { exactEffect } = await import("../../src/lib/jarvis/authority.server.ts");
  const command = "Get-Service Spooler | Restart-Service -Force";
  const shown = exactEffect(intent("shell.run", "fix", { command }, deadline));
  assert.match(shown, /^shell\.run /);
  assert.ok(shown.includes(JSON.stringify(command)), shown);
  assert.match(exactEffect({ operation: "shell.run" }), /do not allow it/);
});

test("every result of a batch is seen in full; a repeated pair of steps is a stall", async () => {
  const { history, stalled } = await import("../../src/lib/jarvis/planner.server.ts");
  const read = (path: string, text: string): Step => ({
    intent: intent("fs.read_text", path, { path }, deadline),
    status: "done",
    receipt: {
      status: "observed",
      maybeChanged: false,
      observedAtUtc: now.toISOString(),
      evidence: { text },
    },
  });
  const script = `import json\n${"x = 1\n".repeat(400)}from tabulate import tabulate\n`;
  const shown = history([read("restock.py", script), read("stock.json", "[]")]);
  assert.ok(
    shown.includes("from tabulate import tabulate"),
    "the earlier file of the batch was clipped",
  );
  assert.ok(
    history([read("big.txt", "y".repeat(20_000)), read("a.txt", "z")]).includes("(clipped)"),
  );
  const pair = [read("a.py", "a"), read("b.json", "b")];
  assert.equal(stalled([...pair, ...pair]), null);
  assert.match(stalled([...pair, ...pair, ...pair]) ?? "", /repeating/);
});

test("a deep address typed from memory is refused; home pages and seen links are not", async () => {
  const { unseenAddress } = await import("../../src/lib/jarvis/planner.server.ts");
  const page: Step = {
    intent: intent("web.open", "o", { url: "https://www.python.org/downloads/" }, deadline),
    status: "done",
    receipt: {
      status: "observed",
      maybeChanged: false,
      observedAtUtc: now.toISOString(),
      evidence: { controls: [{ label: "Python 3.15.2", href: "/downloads/release/python-3152/" }] },
    },
  };
  assert.doesNotThrow(() => unseenAddress("https://www.python.org/", "", []));
  assert.doesNotThrow(() =>
    unseenAddress("https://www.python.org/downloads/release/python-3152/", "", [page]),
  );
  assert.doesNotThrow(() =>
    unseenAddress(
      "https://docs.example.com/guide/install",
      "see docs.example.com/guide/install",
      [],
    ),
  );
  assert.throws(
    () => unseenAddress("https://www.python.org/downloads/release/python-3131/", "", [page]),
    /was not seen in this task/,
  );
});

test("after Take Over nothing that changes state runs until the planner looked again", async () => {
  const { observedSinceTakeOver } = await import("../../src/lib/jarvis/planner.server.ts");
  const step = (operation: "fs.list" | "fs.write_text", status: string): Step => ({
    intent: intent(
      operation,
      `${operation}-${status}`,
      operation === "fs.list" ? {} : { path: "OCADE output/a.txt", text: "x" },
      deadline,
    ),
    status,
    receipt: null,
  });
  assert.doesNotThrow(() => observedSinceTakeOver([step("fs.write_text", "done")]));
  assert.throws(
    () => observedSinceTakeOver([step("fs.list", "done"), step("fs.write_text", "cancelled")]),
    /observe the current state again/,
  );
  assert.doesNotThrow(() =>
    observedSinceTakeOver([step("fs.write_text", "cancelled"), step("fs.list", "done")]),
  );
});

test("a new account's JARVIS request is refused with the exact message the page answers by asking", async () => {
  const { plannerMessage } = await import("../../src/lib/jarvis/planner.server.ts");
  const { JARVIS_CONSENT_NEEDED } = await import("../../src/lib/jarvis/consent-needed.ts");
  assert.ok(JARVIS_CONSENT_NEEDED.startsWith(plannerMessage("online_not_consented")));
  assert.doesNotMatch(plannerMessage("online_not_consented"), /Settings/); // Settings has no "turn on" for it
});

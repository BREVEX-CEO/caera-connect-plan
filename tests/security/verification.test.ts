/** Fixed acceptance rules and the actual dispatched verifier request must agree. */
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { intent, outcomeCheck, type OutcomeCheck } from "../../src/lib/jarvis/contracts.ts";
import {
  compileGoal,
  planStep,
  plannerAccess,
  PlannerUnavailable,
} from "../../src/lib/jarvis/planner.server.ts";
import { milestonesFor, milestoneProgress, type Step } from "../../src/lib/jarvis/supervisor.ts";

const now = new Date("2026-11-01T00:00:00Z");
const deadline = new Date(now.getTime() + 60_000);
const path = `OCADE output/${crypto.randomUUID()}.txt`;
const check: OutcomeCheck = {
  id: "requested",
  description: "The requested output contains the requested content",
  kind: "file_contains",
  params: { path, text: "independently required content" },
};
const verified = (checks: OutcomeCheck[]): Step => ({
  intent: intent("verify.checks", "verify", { checks }, deadline),
  status: "done",
  receipt: {
    status: "observed",
    maybeChanged: false,
    observedAtUtc: now.toISOString(),
    evidence: { predicates: { requested: true } },
  },
});
const base = {
  userId: "synthetic-user",
  objective: "Produce the requested output",
  checks: [check],
  grants: ["files"],
  now,
  turnKey: "synthetic-verification",
};

test("completion requires proof of the exact, well-formed saved acceptance rules", async (t) => {
  const proof = verified([check]);
  for (const [name, checks, step] of [
    ["empty task checks", [], proof],
    [
      "duplicate identifiers",
      [check, { ...check, params: { path: "absent.txt", text: "missing" } }],
      proof,
    ],
    ["missing predicate arguments", [{ ...check, params: { path } }], proof],
    [
      "verifier checked another file",
      [check],
      verified([{ ...check, params: { path: "other.txt", text: check.params!.text } }]),
    ],
    [
      "verifier used a weaker predicate",
      [check],
      verified([{ ...check, kind: "file_exists", params: { path } }]),
    ],
    ["unknown receipt", [check], { ...proof, receipt: { ...proof.receipt!, status: "unknown" } }],
  ] as const) {
    await t.test(name, async () => {
      const decision = await planStep({ ...base, checks: [...checks], steps: [step] });
      assert.equal(decision.kind, "block", JSON.stringify(decision));
    });
  }
  assert.equal((await planStep({ ...base, steps: [proof] })).kind, "settle");
});

test("goal compilation refuses duplicate, incomplete or conflicting acceptance proposals", async (t) => {
  let checks: OutcomeCheck[] = [check];
  let milestones: unknown;
  let duplicateProposal = false;
  const server = createServer(async (req, res) => {
    for await (const chunk of req) void chunk;
    const call = { id: "goal", name: "set_goal", arguments: { checks, ...(milestones ? { milestones } : {}) } };
    const calls = duplicateProposal ? [call, { ...call, id: "other-goal" }] : [call];
    const frames = [
      ...calls.map((call) => ({ type: "tool_call", call })),
      { type: "final", response: { backend: "online", stopReason: "tool_use", toolCalls: calls } },
    ];
    res.writeHead(200, { "content-type": "text/event-stream" });
    res.end(frames.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join(""));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const saved = { ...plannerAccess };
  const { port } = server.address() as { port: number };
  plannerAccess.serviceUrl = () => `http://127.0.0.1:${port}`;
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
    for (const [name, proposed] of [
      [
        "duplicate identifiers",
        [check, { ...check, params: { path: "different.txt", text: "different" } }],
      ],
      ["missing required content", [{ ...check, params: { path } }]],
      [
        "missing workbook coordinates",
        [{ ...check, kind: "workbook_cell_equals", params: { path } }],
      ],
      [
        "invalid duration type",
        [{ ...check, kind: "media_duration", params: { path, value: "thirty" } }],
      ],
      [
        "website check without browser and site grants",
        [
          {
            ...check,
            kind: "web_text_contains",
            params: { url: "https://scope.example/", text: "required" },
          },
        ],
      ],
      [
        "window check without application grants",
        [{ ...check, kind: "window_exists", params: { exe: "unfamiliar.exe" } }],
      ],
    ] as const) {
      await t.test(name, async () => {
        checks = [...proposed];
        await assert.rejects(
          compileGoal(base.userId, base.objective, base.grants),
          PlannerUnavailable,
        );
      });
    }
    checks = [check];
    duplicateProposal = true;
    await assert.rejects(compileGoal(base.userId, base.objective, base.grants), PlannerUnavailable);
    duplicateProposal = false;
    assert.deepEqual(await compileGoal(base.userId, base.objective, base.grants), [check]);
    checks = [
      {
        ...check,
        kind: "web_text_contains",
        params: { url: "https://scope.example/", text: "required" },
      },
    ];
    const allowed = ["files", "browser", "site:scope.example"];
    assert.deepEqual(await compileGoal(base.userId, base.objective, allowed), checks);
    assert.equal(
      (await planStep({ ...base, checks, grants: allowed, steps: [verified(checks)] })).kind,
      "settle",
    );
    assert.equal((await planStep({ ...base, checks, steps: [verified(checks)] })).kind, "block");
    const credentialUrl = new URL("https://scope.example/");
    credentialUrl.username = "synthetic";
    credentialUrl.password = crypto.randomUUID();
    checks = [{ ...checks[0], params: { url: credentialUrl.href, text: "required" } }];
    await assert.rejects(compileGoal(base.userId, base.objective, allowed), PlannerUnavailable);
    checks = [check];
    milestones = [{ description: "Requested result", checks: [check.id], stepBudget: 4 }];
    let persisted: unknown;
    assert.deepEqual(await compileGoal(base.userId, base.objective, base.grants, undefined, null,
      (plan) => (persisted = plan)), [check]);
    assert.deepEqual(persisted, milestones, "validated model milestones must reach durable authority state");
    for (const invalid of [
      [{ description: "Wrong check", checks: ["unrelated"], stepBudget: 4 }],
      [{ description: "Unbounded", checks: [check.id], stepBudget: 31 }],
    ]) {
      milestones = invalid;
      await assert.rejects(compileGoal(base.userId, base.objective, base.grants), PlannerUnavailable);
    }
  } finally {
    Object.assign(plannerAccess, saved);
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("invalid verifier URLs return schema errors without throwing", () => {
  const credentialUrl = new URL("https://scope.example/");
  credentialUrl.username = "synthetic";
  credentialUrl.password = crypto.randomUUID();
  for (const url of ["invalid address", "https://", credentialUrl.href]) {
    const result = outcomeCheck.safeParse({
      ...check,
      kind: "web_text_contains",
      params: { url, text: "required" },
    });
    assert.equal(result.success, false);
  }
});

test("milestones validate coverage and reject corrupt durable cursors", () => {
  const second = { ...check, id: "second" };
  const plan = [
    { description: "First result", checks: [check.id], stepBudget: 2 },
    { description: "Second result", checks: [second.id], stepBudget: 3 },
  ];
  assert.deepEqual(milestonesFor([check, second], plan), plan);
  for (const invalid of [
    [{ ...plan[0], checks: ["missing"] }, plan[1]],
    [{ ...plan[0], checks: [check.id, check.id] }, plan[1]],
    [plan[0]],
    [{ ...plan[0], stepBudget: 31 }, plan[1]],
    { unexpected: true },
  ]) {
    assert.throws(() => milestonesFor([check, second], invalid));
  }
  assert.throws(() => milestoneProgress([check, second], plan, {
    milestones: { index: 3, startStep: 0 },
  }, 2));
  assert.throws(() => milestoneProgress([check, second], plan, {
    milestones: { index: 1, startStep: 3 },
  }, 2));
  assert.equal(milestoneProgress([check], ["Legacy description"], null, 0).final, true);
});

test("each milestone requires its own proof and final completion rechecks all outcomes", async () => {
  const second: OutcomeCheck = {
    ...check, id: "second", params: { path: "OCADE output/second.txt", text: "second result" },
  };
  const plan = [
    { description: "First result", checks: [check.id], stepBudget: 2 },
    { description: "Second result", checks: [second.id], stepBudget: 2 },
  ];
  const proof = (wanted: OutcomeCheck[], key: string): Step => ({
    ...verified(wanted),
    intent: intent("verify.checks", key, { checks: wanted }, deadline),
    controller: "current",
    receipt: {
      ...verified(wanted).receipt!,
      evidence: { predicates: Object.fromEntries(wanted.map((item) => [item.id, true])) },
    },
  });
  const first = proof([check], "first");
  const later = proof([second], "later");
  const input = { ...base, checks: [check, second], plan, controller: "current" };
  assert.deepEqual(await planStep({ ...input, steps: [first] }), { kind: "milestone", index: 0 });
  const checkpoint = { milestones: { index: 1, startStep: 1 } };
  assert.deepEqual(await planStep({ ...input, checkpoint, steps: [first, later] }),
    { kind: "milestone", index: 1 });
  const finalCheckpoint = { milestones: { index: 2, startStep: 2 } };
  const final = await planStep({ ...input, checkpoint: finalCheckpoint, steps: [first, later] });
  assert.equal(final.kind, "queue");
  if (final.kind === "queue") {
    assert.equal(final.intent.operation, "verify.checks");
    assert.deepEqual(final.intent.arguments.checks, [check, second]);
  }
  const settled = await planStep({
    ...input, checkpoint: finalCheckpoint, steps: [first, later, proof([check, second], "all")],
  });
  assert.equal(settled.kind, "settle");
  if (settled.kind === "settle") assert.deepEqual(settled.verification.passed, [check.id, second.id]);
  const resumed = await planStep({ ...input, controller: "new-epoch", steps: [first] });
  assert.equal(resumed.kind, "queue", "a previous controller's proof must be read again after resume");
  if (resumed.kind === "queue") assert.equal(resumed.intent.operation, "verify.checks");
});

test("milestone budgets count only their phase while uncertain earlier effects still fence work", async () => {
  const second: OutcomeCheck = { ...check, id: "second" };
  const plan = [
    { description: "First result", checks: [check.id], stepBudget: 30 },
    { description: "Second result", checks: [second.id], stepBudget: 2 },
  ];
  const reads: Step[] = Array.from({ length: 35 }, (_, index) => ({
    intent: intent("fs.read_text", "read-" + index, { path: "input-" + index }, deadline),
    status: "done",
    receipt: {
      status: "observed", maybeChanged: false, observedAtUtc: now.toISOString(), evidence: {},
    },
  }));
  const checkpoint = { milestones: { index: 1, startStep: reads.length } };
  const proof: Step = {
    ...verified([second]),
    receipt: { ...verified([second]).receipt!, evidence: { predicates: { second: true } } },
  };
  const input = { ...base, checks: [check, second], plan, checkpoint };
  assert.deepEqual(await planStep({ ...input, steps: [...reads, proof] }),
    { kind: "milestone", index: 1 }, "more than 30 total steps can still finish a later bounded phase");
  const exhausted = await planStep({ ...input, steps: [...reads, reads[0], reads[1]] });
  assert.equal(exhausted.kind, "block");
  if (exhausted.kind === "block") assert.match(exhausted.reason, /2 steps/);
  const uncertain: Step = {
    intent: intent("fs.write_text", "uncertain", { path, text: "x" }, deadline),
    status: "blocked",
    receipt: { status: "unknown", maybeChanged: true, observedAtUtc: now.toISOString(), evidence: {} },
  };
  assert.equal((await planStep({
    ...input, steps: [uncertain, ...reads.slice(1), proof],
  })).kind, "block", "phase advancement must not hide an unresolved effect");
});

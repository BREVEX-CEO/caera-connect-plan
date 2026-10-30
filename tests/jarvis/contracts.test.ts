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
import {
  JOURNEY_1_CHECKS,
  decide,
  pickSides,
  settle,
  supportedOutcome,
  type Step,
} from "../../src/lib/jarvis/supervisor.ts";

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

test("only the supported outcome is accepted", () => {
  assert.ok(supportedOutcome("Reconcile Q3 ledger.xlsx and write a report"));
  assert.equal(supportedOutcome("Book me a flight to Paris"), false);
});

function observed(i: ActionIntent, evidence: Record<string, unknown>): Step {
  return {
    intent: i,
    status: "done",
    receipt: {
      status: "observed",
      maybeChanged: false,
      observedAtUtc: now.toISOString(),
      evidence,
    },
  };
}

const sheets = [
  { name: "Ledger", headers: ["Invoice ID", "Amount"], rows: 4 },
  { name: "Bank", headers: ["Reference", "Amount"], rows: 4 },
];

test("the pilot walks Journey 1 one bounded step at a time", () => {
  const base = { taskId: "12345678-0000-0000-0000-000000000000", checks: JOURNEY_1_CHECKS, now };
  let d = decide({ ...base, objective: "Reconcile my workbook", steps: [] });
  assert.equal(d.kind === "queue" && d.intent.operation, "fs.list");

  const list = observed((d as { intent: ActionIntent }).intent, {
    entries: [
      { name: "Q3.xlsx", kind: "file" },
      { name: "notes.txt", kind: "file" },
    ],
  });
  d = decide({ ...base, objective: "Reconcile my workbook", steps: [list] });
  assert.equal(d.kind === "queue" && d.intent.arguments.path, "Q3.xlsx");

  const inspect = observed((d as { intent: ActionIntent }).intent, {
    sha256: "a".repeat(64),
    sheets,
  });
  d = decide({ ...base, objective: "Reconcile my workbook", steps: [list, inspect] });
  assert.equal(d.kind === "queue" && d.intent.operation, "office.reconcile_workbook");
  assert.match(
    String((d as { intent: ActionIntent }).intent.arguments.output),
    /^OCADE output\/12345678\//,
  );

  // While a step is in flight, nothing else is queued.
  const pending: Step = {
    ...observed((d as { intent: ActionIntent }).intent, {}),
    status: "claimed",
    receipt: null,
  };
  assert.equal(decide({ ...base, objective: "x", steps: [list, inspect, pending] }).kind, "wait");

  // A refused step blocks; nothing after it is attempted.
  const refused: Step = {
    ...pending,
    status: "failed",
    receipt: { ...inspect.receipt!, status: "not_applied", errorCode: "output_exists" },
  };
  const blocked = decide({ ...base, objective: "x", steps: [list, inspect, refused] });
  assert.equal(blocked.kind, "block");
});

test("a workbook named in the request is chosen only if it exists in the folder", () => {
  const base = { taskId: "t", checks: JOURNEY_1_CHECKS, now };
  const list = observed(intent("fs.list", "list", {}, deadline), {
    entries: [
      { name: "Q3 ledger.xlsx", kind: "file" },
      { name: "Q2 ledger.xlsx", kind: "file" },
    ],
  });
  const named = decide({ ...base, objective: "Reconcile q3 LEDGER.xlsx please", steps: [list] });
  assert.equal(named.kind === "queue" && named.intent.arguments.path, "Q3 ledger.xlsx");
  const absent = decide({ ...base, objective: "Reconcile ..\\secret.xlsx", steps: [list] });
  assert.equal(absent.kind, "block");
});

test("ambiguity is a question, never a guess", () => {
  const base = { taskId: "t", checks: JOURNEY_1_CHECKS, now, objective: "Reconcile my workbook" };
  const list = observed(intent("fs.list", "list", {}, deadline), {
    entries: [
      { name: "A.xlsx", kind: "file" },
      { name: "B.xlsx", kind: "file" },
    ],
  });
  assert.equal(decide({ ...base, steps: [list] }).kind, "block");
  assert.ok(
    "question" in pickSides([...sheets, { name: "Card", headers: ["ID", "Total"], rows: 2 }]),
  );
  assert.ok("question" in pickSides([sheets[0]]));
});

test("settlement binds the verifier's proof to the files the actor wrote", () => {
  const predicates = Object.fromEntries(
    JOURNEY_1_CHECKS.filter((c) => c.id !== "artifacts_bound").map((c) => [c.id, true]),
  );
  const ev = {
    inspected: { sha256: "s" },
    reconciled: { sha256: "w" },
    reported: { sha256: { docx: "d", pdf: "p" } },
    verified: { predicates, sha256: { source: "s", workbook: "w", docx: "d", pdf: "p" } },
  };
  const good = settle(JOURNEY_1_CHECKS, ev);
  assert.deepEqual(good.failed, []);
  assert.deepEqual(good.unverified, []);

  const swapped = settle(JOURNEY_1_CHECKS, {
    ...ev,
    verified: { predicates, sha256: { ...ev.verified.sha256, pdf: "other" } },
  });
  assert.deepEqual(swapped.failed, ["artifacts_bound"]);

  const unobserved = settle(JOURNEY_1_CHECKS, {
    ...ev,
    verified: {
      predicates: { ...predicates, report_pdf_renders: null },
      sha256: ev.verified.sha256,
    },
  });
  assert.deepEqual(unobserved.unverified, ["report_pdf_renders"]);
});

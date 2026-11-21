/**
 * SkillForge (plan 28.2.1, X01): a demonstration becomes an editable workflow whose typed values
 * are parameters; a protected field is never a value; the workflow rides in the skill's own text;
 * named in a request with new values, its steps run without a model call on the app's open window,
 * and a control that is no longer there hands the task to the planner instead of guessing.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { intent, type OutcomeCheck } from "../../src/lib/jarvis/contracts.ts";
import { planStep } from "../../src/lib/jarvis/planner.server.ts";
import {
  leaseFor,
  parameterValues,
  proposeWorkflow,
  workflowBody,
  workflowOf,
  workflowReplay,
} from "../../src/lib/jarvis/skillforge.ts";

const recording = [
  {
    kind: "set_value",
    element: { automationId: "customer" },
    value: "Acme Ltd",
    label: "Customer",
  },
  { kind: "set_value", element: { automationId: "amount" }, value: "120.00", label: "Amount" },
  { kind: "invoke", element: { name: "Save", controlType: "Button" }, label: "Save" },
  { kind: "secret", label: "Protected text field" },
  { kind: "invoke", element: { automationId: "send" }, label: "Send" },
];

test("a recording becomes a workflow whose typed values are named parameters", () => {
  const workflow = proposeWorkflow("ledger.exe", recording)!;
  assert.deepEqual(workflow.parameters, [
    { name: "customer", default: "Acme Ltd" },
    { name: "amount", default: "120.00" },
  ]);
  assert.deepEqual(
    workflow.steps.map((step) => step.operation),
    ["ui.set_value", "ui.set_value", "ui.invoke", "secret", "ui.invoke"],
  );
  assert.equal((workflow.steps[0] as { value: string }).value, "{{customer}}");
  assert.ok(!JSON.stringify(workflow.steps[3]).includes("value"), "no protected value");
  assert.equal(proposeWorkflow("ledger.exe", []), null);
  assert.equal(
    proposeWorkflow("ledger.exe", [{ kind: "invoke" }]),
    null,
    "untrusted shapes refused",
  );
});

test("the workflow rides in the skill's own text and survives a round trip", () => {
  const workflow = proposeWorkflow("ledger.exe", recording)!;
  const body = workflowBody("Enter an invoice", workflow);
  assert.match(body, /1\. Set "Customer" to \{\{customer\}\}/);
  assert.match(body, /protected field themselves/);
  assert.deepEqual(workflowOf(body), workflow);
  assert.equal(
    workflowOf(body.replace('"ui.invoke"', '"shell.run"')),
    null,
    "an edited block that no longer fits is none",
  );
  assert.equal(workflowOf("Just my written steps."), null);
});

test("a request's values fill the parameters; the replay stops before a protected field", () => {
  assert.deepEqual(parameterValues('/enter-invoice customer="Beta GmbH" note="x"'), {
    customer: "Beta GmbH",
    note: "x",
  });
  const steps = workflowReplay(
    proposeWorkflow("ledger.exe", recording)!,
    '/enter-invoice customer="Beta GmbH"',
  );
  assert.deepEqual(
    steps.map((step) => [step.operation, step.arguments.value]),
    [
      ["ui.set_value", "Beta GmbH"],
      ["ui.set_value", "120.00"],
      ["ui.invoke", undefined],
    ],
    "the new value, the recorded default, then the press; nothing past the protected field",
  );
  assert.deepEqual(steps[0]!.arguments.window, { app: "ledger.exe" });
});

const now = new Date("2026-11-21T00:00:00Z");
const later = new Date(now.getTime() + 600_000);
const lease = { exe: "ledger.exe", pid: 41, hwnd: 7001, started: 1700000000 };
const observed = (evidence: Record<string, unknown>) => ({
  status: "observed" as const,
  maybeChanged: false,
  observedAtUtc: now.toISOString(),
  evidence,
});

test("the newest open window of the app is the lease", () => {
  const steps = [
    {
      intent: { operation: "apps.list" },
      receipt: observed({
        windows: [
          { ...lease, pid: 2 },
          { exe: "other.exe", pid: 3, hwnd: 4, started: 5 },
        ],
      }),
    },
    { intent: { operation: "apps.launch" }, receipt: observed({ window: lease }) },
  ];
  assert.deepEqual(leaseFor("LEDGER.EXE", steps), lease);
  assert.equal(leaseFor("missing.exe", steps), null);
});

const checks: OutcomeCheck[] = [
  {
    id: "saved",
    description: "the invoice is saved",
    kind: "file_exists",
    params: { path: "OCADE output/i.txt" },
  },
];
const skill = {
  name: "enter-invoice",
  title: "Enter an invoice",
  body: workflowBody("Enter an invoice", proposeWorkflow("ledger.exe", recording)!),
  version: 1,
};
const noModel = async () => {
  throw new Error("the model was asked during a learned replay");
};
const base = {
  userId: "u",
  objective: '/enter-invoice customer="Beta GmbH"',
  checks,
  grants: ["files", "apps", "app:ledger.exe"],
  engines: ["desktop"],
  now,
  skills: async () => [skill],
  permitKey: noModel,
};
const step = (key: string, operation: string, args: Record<string, unknown>, receipt: unknown) => ({
  intent: intent(operation as never, key, args as never, later),
  status: (receipt as { status: string }).status === "observed" ? "done" : "failed",
  controller: null,
  completedAt: now.toISOString(),
  receipt,
  resolution: null,
});

test("named with new values, the learned steps run on the open window without the model", async () => {
  const first = await planStep({ ...base, steps: [] } as never);
  assert.equal((first as { intent: { operation: string } }).intent.operation, "apps.list");
  const found = step("skill-apps", "apps.list", {}, observed({ windows: [lease] }));
  const second = await planStep({ ...base, steps: [found] } as never);
  const queued = (second as { intent: { operation: string; arguments: Record<string, unknown> } })
    .intent;
  assert.equal(queued.operation, "ui.set_value");
  assert.deepEqual(queued.arguments, {
    window: lease,
    element: { automationId: "customer" },
    value: "Beta GmbH",
  });
});

test("a control that is no longer there hands the task to the planner (fail closed)", async () => {
  const found = step("skill-apps", "apps.list", {}, observed({ windows: [lease] }));
  const refused = step(
    "replay-1",
    "ui.set_value",
    { window: lease, element: { automationId: "customer" }, value: "Beta GmbH" },
    {
      status: "not_applied",
      maybeChanged: false,
      observedAtUtc: now.toISOString(),
      evidence: {},
      errorCode: "element_not_found",
    },
  );
  await assert.rejects(
    planStep({ ...base, steps: [found, refused] } as never),
    /the model was asked/,
  );
});

test("with the app not open, the planner (not the replay) opens it", async () => {
  const none = step("skill-apps", "apps.list", {}, observed({ windows: [] }));
  await assert.rejects(planStep({ ...base, steps: [none] } as never), /the model was asked/);
});

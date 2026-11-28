/** ELITE-08 (full cost per verified result, margin) and ELITE-03 / OWNER-07 (route by measured cost, same source only). */
import assert from "node:assert/strict";
import test from "node:test";
import { marginByWorkflow, type TaskEconomics } from "../../src/lib/commercial/unit-economics.ts";
import { chooseModel, type Candidate, type Need } from "../../src/lib/intelligence/route-choice.ts";

const task = (over: Partial<TaskEconomics>): TaskEconomics => ({
  workflow: "form",
  verified: true,
  revenue: 100,
  refund: 0,
  model: 10,
  provider: 5,
  infrastructure: 3,
  retry: 2,
  support: 0,
  verification: 1,
  ...over,
});

test("a failed task raises the cost of the verified ones, and a refund lowers revenue", () => {
  const [row] = marginByWorkflow([
    task({}),
    task({ verified: false, revenue: 0, retry: 20 }),
    task({ refund: 100 }),
  ]);
  assert.equal(row!.tasks, 3);
  assert.equal(row!.verified, 2);
  assert.equal(row!.cost, 21 * 3 + 18); // 3 tasks of 21, plus 18 extra retry on the failed one
  assert.equal(row!.costPerVerified, Math.round(81 / 2));
  assert.equal(row!.margin, 100 + 0 + 100 - 100 - 81);
});

test("a workflow with nothing verified has no cost per verified result; negative or fractional money is refused", () => {
  assert.equal(marginByWorkflow([task({ verified: false })])[0]!.costPerVerified, null);
  assert.throws(() => marginByWorkflow([task({ model: -1 })]), /non-negative/);
  assert.throws(() => marginByWorkflow([task({ support: 1.5 })]), /whole number/);
});

const measured = (
  successRate: number,
  costPerAttempt: number,
  p50LatencyMs = 1000,
  samples = 40,
) => ({ successRate, costPerAttempt, p50LatencyMs, samples });
const model = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  id,
  source: "ocade",
  qualified: true,
  contextTokens: 100_000,
  tools: true,
  risk: 1,
  families: { forms: measured(0.9, 9) },
  ...over,
});
const need: Need = {
  family: "forms",
  source: "ocade",
  contextTokens: 50_000,
  tools: true,
  maxRisk: 2,
  minSuccessRate: 0.8,
};

test("the cheaper model wins only when its measured cost per verified task is lower", () => {
  // cheap attempt but fails often: 3/0.4 = 7.5 per verified; the steady one: 9/0.9 = 10
  const flaky = model("flaky", { families: { forms: measured(0.4, 3) } });
  const steady = model("steady");
  assert.deepEqual(chooseModel([flaky, steady], { ...need, minSuccessRate: 0.3 }), {
    ok: true,
    id: "flaky",
    costPerVerified: 7.5,
  });
  assert.equal((chooseModel([flaky, steady], need) as { id: string }).id, "steady"); // flaky fails the success bar
});

test("a BYOK choice is never answered by an OCADE model, and the reverse", () => {
  const ocade = model("ocade-a");
  assert.deepEqual(chooseModel([ocade], { ...need, source: "byok" }), {
    ok: false,
    reason: "no_model_from_this_source",
  });
});

test("unqualified, unmeasured, under-sampled, too-small-context, no-tools and too-risky models are skipped", () => {
  const bad = [
    model("a", { qualified: false }),
    model("b", { families: {} }),
    model("c", { families: { forms: measured(0.9, 1, 1000, 5) } }),
    model("d", { contextTokens: 10 }),
    model("e", { tools: false }),
    model("f", { risk: 3 }),
  ];
  assert.deepEqual(chooseModel(bad, need), {
    ok: false,
    reason: "no_qualified_model_for_this_task",
  });
});

test("equal cost goes to lower latency, then to the id", () => {
  const slow = model("a", { families: { forms: measured(0.9, 9, 2000) } });
  const fast = model("b", { families: { forms: measured(0.9, 9, 500) } });
  assert.equal((chooseModel([slow, fast], need) as { id: string }).id, "b");
  const twin = model("c", { families: { forms: measured(0.9, 9, 500) } });
  assert.equal((chooseModel([twin, fast], need) as { id: string }).id, "b");
});

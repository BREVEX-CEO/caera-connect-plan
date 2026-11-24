/** REPO-41: dependency-aware milestones run in a valid order; a cycle is refused before any effect. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { inDependencyOrder, type Milestone } from "../../src/lib/jarvis/supervisor.ts";

const m = (description: string, after?: number[]): Milestone => ({
  description,
  checks: [description],
  stepBudget: 5,
  ...(after ? { after } : {}),
});

test("a car model, its parts spreadsheet and the video export run in dependency order", () => {
  // As proposed: export first, but it needs the model (2) and the spreadsheet (1); the
  // spreadsheet needs the model.
  const ordered = inDependencyOrder([
    m("video export", [1, 2]),
    m("parts spreadsheet", [2]),
    m("car model"),
  ]);
  assert.deepEqual(
    ordered.map((x) => x.description),
    ["car model", "parts spreadsheet", "video export"],
  );
  // Positions are renumbered to the new order and always point back.
  assert.deepEqual(
    ordered.map((x) => x.after ?? []),
    [[], [0], [1, 0]],
  );
  ordered.forEach((x, at) => (x.after ?? []).forEach((before) => assert.ok(before < at)));
});

test("independent milestones keep the order given, and ordering twice changes nothing", () => {
  const plan = [m("a"), m("b"), m("c", [0])];
  const once = inDependencyOrder(plan);
  assert.deepEqual(
    once.map((x) => x.description),
    ["a", "b", "c"],
  );
  assert.deepEqual(inDependencyOrder(once), once);
});

test("a cycle, a self-dependency or a missing milestone is refused", () => {
  assert.throws(() => inDependencyOrder([m("a", [1]), m("b", [0])]), /cycle/);
  assert.throws(() => inDependencyOrder([m("a", [0])]), /itself/);
  assert.throws(() => inDependencyOrder([m("a", [3])]), /does not exist/);
});

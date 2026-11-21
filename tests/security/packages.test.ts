/**
 * The four packages and eight products (plan 27.3): exact owner names, each starter is a valid
 * editable objective that names its product, and each product's rules reach the planner as a
 * read-only skill that narrows (never widens) what JARVIS does.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { builtInSkills, PACKAGES } from "../../src/lib/jarvis/packages.ts";
import { namedSkills } from "../../src/lib/jarvis/skills.ts";
import { taskObjective } from "../../src/lib/jarvis/objective.ts";

test("four packages, eight products, exact owner names", () => {
  assert.deepEqual(
    PACKAGES.map((p) => [p.name, p.products.map((x) => x.name)]),
    [
      ["Business Money Assistant", ["Invoice Recovery", "Cashflow Guardian"]],
      [
        "Universal Forms & Claims Assistant",
        ["Deadline Guardian", "Refund Assistant", "Job Application Assistant"],
      ],
      ["Personal & Family Assistant", ["Micro-Business Ledger", "Family Administration"]],
      ["Business Launch Assistant", ["Client Onboarding Autopilot"]],
    ],
  );
});

test("each starter is a valid objective naming its product, whose rules reach the planner", () => {
  for (const product of PACKAGES.flatMap((p) => p.products)) {
    assert.ok(taskObjective.safeParse(product.starter).success, product.id);
    assert.deepEqual(namedSkills(product.starter), [product.id]);
    const [skill] = builtInSkills([product.id]);
    assert.equal(skill!.body, product.rules);
    assert.match(product.rules, /never|Never/, `${product.id} states what it never does`);
  }
  for (const id of ["invoice-recovery", "cashflow-guardian"])
    assert.match(builtInSkills([id])[0]!.body, /Never move money/);
  assert.deepEqual(builtInSkills(["not-a-product"]), []);
});

test("Simplification Mode is a built-in skill that never hides or submits", async () => {
  const { SIMPLIFY } = await import("../../src/lib/jarvis/packages.ts");
  assert.deepEqual(namedSkills(SIMPLIFY.starter), ["simplify"]);
  assert.match(builtInSkills(["simplify"])[0]!.body, /never hide anything, never submit/);
});

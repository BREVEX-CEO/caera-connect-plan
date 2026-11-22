import assert from "node:assert/strict";
import { test } from "node:test";
import { businessDraft, businessWorkflows } from "../../src/lib/jarvis/business-workspace.ts";
import { taskObjective } from "../../src/lib/jarvis/objective.ts";
import { builtInSkills } from "../../src/lib/jarvis/packages.ts";
import { namedSkills } from "../../src/lib/jarvis/skills.ts";

test("Business-in-a-Box hands each chosen workflow to the existing JARVIS task composer", () => {
  assert.equal(businessWorkflows.length, 4);
  for (const workflow of businessWorkflows) {
    const draft = businessDraft(workflow.id, 'Blue & "Co"', "Clients/Blue Records");
    assert.ok(draft);
    assert.ok(taskObjective.safeParse(draft).success);
    assert.deepEqual(namedSkills(draft), [workflow.id]);
    assert.equal(builtInSkills(namedSkills(draft))[0]?.body, workflow.rules);
    assert.ok(draft.includes(JSON.stringify('Blue & "Co"')));
    assert.match(draft, /Do not send anything, change source records, or move money/);
  }
});

test("incomplete business details, unknown workflows and out-of-workspace sources are refused", () => {
  for (const source of [
    "",
    ".",
    "../Other",
    "Customers/../Other",
    "/records",
    "C:\\Records",
    "Work//New",
    "Work/",
  ]) {
    assert.equal(businessDraft("micro-ledger", "Blue", source), null, source);
  }
  assert.equal(businessDraft("refund-assistant", "Blue", "Records"), null);
  assert.equal(businessDraft("micro-ledger", "Blue /family-admin", "Records"), null);
  assert.equal(businessDraft("micro-ledger", "Blue", "Records \n all accounts"), null);
});

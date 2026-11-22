import assert from "node:assert/strict";
import { test } from "node:test";
import { civilDate, obligationSignal, obligationView } from "../../src/lib/jarvis/lifeos.ts";

test("LifeOS groups due dates, preserves an unknown deadline and respects snooze", () => {
  const today = civilDate(new Date(2026, 10, 22, 23));
  assert.equal(today, "2026-11-22");
  const item = { due_on: today, snoozed_until: null, completed: false };
  assert.equal(obligationView(item, today), "Today");
  assert.equal(obligationView({ ...item, due_on: "2026-11-23" }, today), "Upcoming");
  assert.equal(obligationView({ ...item, due_on: null }, today), "Waiting");
  assert.equal(obligationView({ ...item, snoozed_until: "2026-11-23" }, today), "Waiting");
  assert.equal(obligationView({ ...item, snoozed_until: today }, today), "Today");
  assert.equal(obligationView({ ...item, completed: true }, today), "Completed");
});

test("signals cite user-entered dates and do not alert on completed or snoozed cards", () => {
  const today = "2026-11-22";
  const soon = "2026-11-29";
  const item = { due_on: "2026-11-28", snoozed_until: null, completed: false, source: "contract" };
  assert.equal(obligationSignal(item, today, soon), "Due in the next seven days.");
  assert.equal(
    obligationSignal({ ...item, due_on: "2026-11-21" }, today, soon),
    "Past the date you entered.",
  );
  assert.equal(
    obligationSignal({ ...item, due_on: "2026-11-30", source: "" }, today, soon),
    "No source recorded.",
  );
  assert.equal(obligationSignal({ ...item, due_on: null }, today, soon), "No due date recorded.");
  assert.equal(obligationSignal({ ...item, completed: true }, today, soon), null);
  assert.equal(obligationSignal({ ...item, snoozed_until: "2026-11-27" }, today, soon), null);
});

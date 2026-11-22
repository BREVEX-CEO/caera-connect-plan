import assert from "node:assert/strict";
import { test } from "node:test";
import { problemRadar } from "../../src/lib/jarvis/problem-radar.ts";

const today = "2026-11-22";
const soon = "2026-11-29";
const item = (id: string, title: string, due_on: string | null, extra = {}) => ({
  id,
  title,
  source: "letter",
  due_on,
  snoozed_until: null,
  completed: false,
  ...extra,
});

test("deadlines are found from the person's own dates, most urgent first, never invented", () => {
  const found = problemRadar({
    today,
    soon,
    obligations: [
      item("a", "Renew passport", "2026-12-30"),
      item("b", "Pay council tax", "2026-11-20"),
      item("c", "Insurance papers", null),
      item("d", "Dentist form", "2026-11-25"),
      item("e", "Done thing", "2026-11-01", { completed: true }),
      item("f", "Snoozed", "2026-11-21", { snoozed_until: "2026-11-24" }),
    ],
  });
  assert.deepEqual(
    found.map((f) => [f.severity, f.title]),
    [
      ["high", "Pay council tax"],
      ["medium", "Dentist form"],
      ["low", "Insurance papers"],
    ],
  );
  assert.match(found[0]!.evidence, /2026-11-20/);
  assert.equal(found[2]!.evidence, "No due date recorded.");
});

test("one obligation with two dates is a conflict; the same date twice is not", () => {
  const conflict = problemRadar({
    today,
    soon,
    obligations: [
      item("a", "Visa  renewal", "2027-03-01"),
      item("b", "visa renewal", "2027-04-01"),
    ],
  }).filter((f) => f.fingerprint.startsWith("lifeos-conflict"));
  assert.equal(conflict.length, 1);
  assert.match(conflict[0]!.evidence, /2027-03-01, 2027-04-01/);
  const same = problemRadar({
    today,
    soon,
    obligations: [item("a", "Visa", "2027-03-01"), item("b", "Visa", "2027-03-01")],
  });
  assert.equal(same.length, 0);
});

test("a fingerprint changes only when its evidence changes", () => {
  const once = problemRadar({ today, soon, obligations: [item("a", "Tax", "2026-11-20")] });
  const again = problemRadar({ today, soon, obligations: [item("a", "Tax", "2026-11-20")] });
  const moved = problemRadar({ today, soon, obligations: [item("a", "Tax", "2026-11-21")] });
  assert.equal(once[0]!.fingerprint, again[0]!.fingerprint);
  assert.notEqual(once[0]!.fingerprint, moved[0]!.fingerprint);
});

test("schedules and watches on removed, unpermitted or offline computers, and failed runs", () => {
  const found = problemRadar({
    today,
    soon,
    devices: [
      { id: "d1", name: "Desk PC", state: "ready" },
      { id: "d2", name: "Laptop", state: "permission_required" },
      { id: "d3", name: "Old Mac", state: "removed" },
      { id: "d4", name: "Studio", state: "offline" },
    ],
    schedules: [
      {
        id: "s1",
        what: "Tidy",
        device_id: "d1",
        active: true,
        last_outcome: "Task started",
        last_run_at: "x",
      },
      {
        id: "s2",
        what: "Backup",
        device_id: "d3",
        active: true,
        last_outcome: null,
        last_run_at: null,
      },
      {
        id: "s3",
        what: "Report",
        device_id: "d2",
        active: true,
        last_outcome: null,
        last_run_at: null,
      },
      {
        id: "s4",
        what: "Invoices",
        device_id: "d1",
        active: true,
        last_outcome: "That computer has not been given permission.",
        last_run_at: "2026-11-21T09:00:00Z",
      },
      {
        id: "s5",
        what: "Paused",
        device_id: "d3",
        active: false,
        last_outcome: null,
        last_run_at: null,
      },
    ],
    watches: [
      { id: "w1", device_id: "d1", folder: "In", what: "file it", active: true },
      { id: "w2", device_id: "gone", folder: "Scans", what: "rename", active: true },
      { id: "w3", device_id: "d4", folder: "Raw", what: "convert", active: true },
      { id: "w4", device_id: "d3", folder: "Old", what: "x", active: false },
    ],
  });
  assert.deepEqual(found.map((f) => `${f.severity}:${f.fingerprint}`).sort(), [
    "high:schedule-device:s2:removed",
    "high:watch:w2:removed",
    "low:watch:w3:offline",
    "medium:schedule-device:s3:permission",
    "medium:schedule-run:s4:2026-11-21T09:00:00Z",
  ]);
});

test("nothing to report is an empty list, and a source that was not read adds nothing", () => {
  assert.deepEqual(problemRadar({ today, soon }), []);
});

/**
 * Scheduled JARVIS runs keep the person's wall-clock time in their own zone across daylight
 * saving changes, skip weekends for "weekdays", never catch up on missed runs, and refuse an
 * unknown zone.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isTimeZone,
  nextOccurrence,
  wallTime,
  zonedInstant,
} from "../../src/lib/jarvis/schedule-time.ts";

const at = (iso: string) => new Date(iso);

test("zones are validated, not guessed", () => {
  assert.equal(isTimeZone("Asia/Kolkata"), true);
  assert.equal(isTimeZone("America/New_York"), true);
  assert.equal(isTimeZone("Mars/Olympus"), false);
  assert.equal(isTimeZone(""), false);
});

test("a wall time converts to the right instant, both sides of a DST change", () => {
  // New York is UTC-5 in January and UTC-4 in July.
  assert.equal(
    zonedInstant(
      { year: 2026, month: 1, day: 15, hour: 9, minute: 0 },
      "America/New_York",
    ).toISOString(),
    "2026-01-15T14:00:00.000Z",
  );
  assert.equal(
    zonedInstant(
      { year: 2026, month: 7, day: 15, hour: 9, minute: 0 },
      "America/New_York",
    ).toISOString(),
    "2026-07-15T13:00:00.000Z",
  );
  // India has no DST.
  assert.equal(
    zonedInstant(
      { year: 2026, month: 11, day: 20, hour: 9, minute: 30 },
      "Asia/Kolkata",
    ).toISOString(),
    "2026-11-20T04:00:00.000Z",
  );
});

test("daily keeps 09:00 local across the spring-forward change", () => {
  // US DST starts 2026-03-08.
  const before = at("2026-03-07T14:00:00.000Z"); // 09:00 EST
  const next = nextOccurrence(before, "daily", "America/New_York")!;
  assert.equal(next.toISOString(), "2026-03-08T13:00:00.000Z"); // 09:00 EDT
  assert.deepEqual(
    [wallTime(next, "America/New_York").hour, wallTime(next, "America/New_York").minute],
    [9, 0],
  );
});

test("a skipped local time resolves after the change; a repeated one to the first", () => {
  // 02:30 does not exist in New York on 2026-03-08.
  const skipped = zonedInstant(
    { year: 2026, month: 3, day: 8, hour: 2, minute: 30 },
    "America/New_York",
  );
  assert.equal(wallTime(skipped, "America/New_York").hour, 3);
  // 01:30 happens twice on 2026-11-01; the first is EDT (UTC-4).
  const repeated = zonedInstant(
    { year: 2026, month: 11, day: 1, hour: 1, minute: 30 },
    "America/New_York",
  );
  assert.equal(repeated.toISOString(), "2026-11-01T05:30:00.000Z");
});

test("weekdays skips Saturday and Sunday; weekly keeps the weekday", () => {
  const friday = at("2026-11-20T03:30:00.000Z"); // Fri 09:00 in Kolkata
  const next = nextOccurrence(friday, "weekdays", "Asia/Kolkata")!;
  assert.equal(wallTime(next, "Asia/Kolkata").weekday, 1);
  assert.equal(next.toISOString(), "2026-11-23T03:30:00.000Z");
  const weekly = nextOccurrence(friday, "weekly", "Asia/Kolkata")!;
  assert.equal(weekly.toISOString(), "2026-11-27T03:30:00.000Z");
});

test("one-time schedules have no next run; missed runs are not caught up", () => {
  assert.equal(nextOccurrence(at("2026-11-20T03:30:00.000Z"), "none", "UTC"), null);
  const longAgo = at("2026-01-01T09:00:00.000Z");
  const now = at("2026-11-20T10:00:00.000Z");
  const next = nextOccurrence(longAgo, "daily", "UTC", now)!;
  assert.equal(next.toISOString(), "2026-11-21T09:00:00.000Z");
});

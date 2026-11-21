/** Time reclaimed (T12-12): only verified tasks count; no baseline means time saved is unavailable. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { csv, reclaimed, record } from "../../src/lib/jarvis/time-reclaimed.ts";

const now = new Date("2026-11-21T12:00:00Z");
const row = (status: string, passed: number, hoursAgo: number, waitMs = 0) =>
  record({
    title: `Task "${status}"`,
    status,
    created_at: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
    finished_at: null,
    user_wait_ms: waitMs,
    outcome: [{ id: "a" }, { id: "b" }],
    checkpoint: { verification: { passed: ["a", "b"].slice(0, passed) } },
  });

test("only verified completed tasks count; time saved needs the person's own baseline", () => {
  const tasks = [
    row("completed", 2, 1, 120_000),
    row("completed", 1, 2),
    row("failed", 0, 3),
    row("completed", 2, 24 * 10),
  ];
  const today = reclaimed(tasks, "today", null, now);
  assert.deepEqual(today, { total: 3, verified: 1, failed: 1, other: 1, savedMinutes: null });
  assert.equal(reclaimed(tasks, "month", 10, now).savedMinutes, 18, "2 x 10 minutes - 2 waited");
  assert.equal(reclaimed(tasks, "all", 0, now).savedMinutes, null);
  assert.match(csv(tasks), /"Task ""completed""",completed,yes/);
});

test("duplicate and unrelated checks cannot inflate outcomes or exported verification", () => {
  const base = {
    ...row("completed", 2, 1),
    title: "=1+1",
    outcome: [{ id: "a" }, { id: "b" }],
  };
  const notVerified = record({
    ...base,
    checkpoint: { verification: { passed: ["a", "a", "old"] } },
  });
  assert.equal(reclaimed([notVerified], "today", 10, now).verified, 0);
  assert.match(csv([notVerified]), /"'=1\+1",completed,no/);
});

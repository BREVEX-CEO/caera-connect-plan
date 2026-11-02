/** Every phase of a task's time is named; what is left over is reported, never hidden. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { taskTiming } from "../../src/lib/jarvis/authority.server.ts";

test("pickup delay is measured per step and the remainder is reported as unaccounted", () => {
  const at = (s: number) => new Date(Date.UTC(2026, 10, 2, 12, 0, s)).toISOString();
  const step = (queued: number, claimed: number | null, durationMs: number) => ({
    id: crypto.randomUUID(),
    summary: "step",
    intent: {},
    status: "done",
    receipt: { evidence: { durationMs } },
    createdAt: at(queued),
    completedAt: null,
    confirmedAt: null,
    claimedAt: claimed === null ? null : at(claimed),
    resolution: null,
  });
  const timing = taskTiming({
    status: "completed",
    timing: {
      acceptedAt: at(0),
      finishedAt: at(40),
      now: at(40),
      pausedMs: 0,
      modelCalls: 3,
      modelMs: 20_000,
    },
    steps: [step(1, 3, 5_000), step(12, 13, 4_000), step(25, null, 1_000)],
  });
  assert.equal(timing.pickupMs, 3_000, "2 s + 1 s; an unclaimed record adds nothing");
  assert.equal(timing.activeExecutionMs, 10_000);
  assert.equal(timing.unaccountedMs, 40_000 - 20_000 - 10_000 - 3_000);
});

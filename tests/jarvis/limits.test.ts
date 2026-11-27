/** UX-22: the limit the person is shown is the limit the planner enforces. */
import assert from "node:assert/strict";
import test from "node:test";
import { LIMIT_NOTE, MAX_FAILED_STEPS } from "../../src/lib/jarvis/limits.ts";
import { stalled } from "../../src/lib/jarvis/planner.server.ts";
import type { Step } from "../../src/lib/jarvis/supervisor.ts";

const failed = (i: number): Step =>
  ({
    intent: { operation: "fs.list", arguments: { path: `d${i}` }, idempotencyKey: `k${i}` },
    status: "failed",
    receipt: {
      status: "not_applied",
      maybeChanged: false,
      observedAtUtc: "2026-11-27T00:00:00Z",
      errorCode: "timeout",
    },
  }) as unknown as Step;

test("the note names the number the planner stops at", () => {
  assert.match(LIMIT_NOTE, new RegExp(`after ${MAX_FAILED_STEPS} steps`));
  assert.match(LIMIT_NOTE, /STOP ends the task at any time/);
});

test("the planner stops after exactly that many steps that could not be done, and not before", () => {
  const steps = Array.from({ length: MAX_FAILED_STEPS }, (_, i) => failed(i));
  assert.equal(stalled(steps.slice(0, MAX_FAILED_STEPS - 1)), null);
  assert.match(stalled(steps) ?? "", new RegExp(`${MAX_FAILED_STEPS} steps could not be done`));
});

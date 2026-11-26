import assert from "node:assert/strict";
import { test } from "node:test";
// @ts-expect-error plain .mjs script, no type declarations
import { isRunReport, percentile, summarize } from "../../scripts/run-metrics.mjs";

const report = (status: string, timing: unknown, confirmations: unknown[] = []) => ({
  objective: "x",
  taskId: crypto.randomUUID(),
  status,
  timing,
  confirmations,
});

test("percentile uses the nearest rank and ignores non-numbers", () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([5], 95), 5);
  assert.equal(percentile([1, 2, 3, 4], 50), 2);
  assert.equal(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 95), 100);
  assert.equal(percentile([3, Number.NaN, 1, undefined as unknown as number], 100), 3);
});

test("summarize counts outcomes, confirmations and percentiles from recorded values only", () => {
  const timing = (ms: number) => ({
    totalElapsedMs: ms,
    activeExecutionMs: ms / 10,
    modelMs: ms / 2,
    modelCalls: 2,
    userWaitMs: 0,
    stepDurationsMs: [ms / 100, ms / 50],
  });
  const result = summarize([
    report("completed", timing(1000)),
    report("completed", timing(2000), [{ id: 1 }, { id: 2 }]),
    report("blocked", timing(9000)),
    report("waiting", undefined),
  ]);
  assert.equal(result.runs, 4);
  assert.deepEqual(result.outcomes, { completed: 2, blocked: 1, waiting: 1 });
  assert.equal(result.unmeasured, 1, "a report without timing is counted, not dropped");
  assert.deepEqual(result.confirmations, { total: 2, runsAsked: 1, shareOfRunsAsked: 0.25 });
  assert.equal(result.totalElapsedMs.n, 3);
  assert.equal(result.totalElapsedMs.p50, 2000);
  assert.equal(result.totalElapsedMs.p95, 9000);
  assert.equal(result.stepMs.n, 6);
});

test("only task reports are recognised, not ledgers or summaries", () => {
  assert.equal(isRunReport(report("completed", {})), true);
  assert.equal(isRunReport({ seed: 1, passed: 3, total: 4 }), false);
  assert.equal(isRunReport([]), false);
  assert.equal(isRunReport(null), false);
});

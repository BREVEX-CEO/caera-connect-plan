#!/usr/bin/env node
/**
 * Aggregate product metrics over the recorded task reports (concepts 48 and 83).
 *
 * Every live or evaluation run writes a report with `status`, `timing` and `confirmations`
 * (see `evidence/*`). This reads those reports and prints, per run set, the outcome counts,
 * how often the person was asked to confirm, and p50/p95/max of total time, active execution,
 * model time, model calls, wait time and per-step time. Percentiles use the nearest-rank
 * method on the recorded values; nothing is estimated or filled in. Reports without a `timing`
 * object are counted as unmeasured, never dropped silently.
 *
 *   node scripts/run-metrics.mjs [folder ...]      (default: every evidence/* folder)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Nearest-rank percentile of finite numbers; null for an empty set. */
export function percentile(values, p) {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1];
}

function spread(values) {
  const finite = values.filter((v) => Number.isFinite(v));
  return {
    n: finite.length,
    p50: percentile(finite, 50),
    p95: percentile(finite, 95),
    max: finite.length ? Math.max(...finite) : null,
  };
}

/** A run report has an objective, a task id and a status string. */
export function isRunReport(value) {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof value.objective === "string" &&
    typeof value.taskId === "string" &&
    typeof value.status === "string",
  );
}

export function summarize(reports) {
  const outcomes = {};
  let unmeasured = 0;
  let asked = 0;
  let confirmations = 0;
  const total = [];
  const active = [];
  const model = [];
  const calls = [];
  const wait = [];
  const steps = [];
  for (const report of reports) {
    outcomes[report.status] = (outcomes[report.status] ?? 0) + 1;
    const list = Array.isArray(report.confirmations) ? report.confirmations : [];
    confirmations += list.length;
    if (list.length > 0) asked += 1;
    const t = report.timing;
    if (!t || typeof t !== "object") {
      unmeasured += 1;
      continue;
    }
    total.push(t.totalElapsedMs);
    active.push(t.activeExecutionMs);
    model.push(t.modelMs);
    calls.push(t.modelCalls);
    wait.push(t.userWaitMs);
    if (Array.isArray(t.stepDurationsMs)) steps.push(...t.stepDurationsMs);
  }
  const runs = reports.length;
  return {
    runs,
    outcomes,
    unmeasured,
    confirmations: {
      total: confirmations,
      runsAsked: asked,
      shareOfRunsAsked: runs ? asked / runs : null,
    },
    totalElapsedMs: spread(total),
    activeExecutionMs: spread(active),
    modelMs: spread(model),
    modelCalls: spread(calls),
    userWaitMs: spread(wait),
    stepMs: spread(steps),
  };
}

function* jsonFiles(folder) {
  for (const name of readdirSync(folder).sort()) {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) continue;
    if (name.endsWith(".json")) yield path;
  }
}

export function readReports(folder) {
  const reports = [];
  for (const path of jsonFiles(folder)) {
    try {
      const value = JSON.parse(readFileSync(path, "utf8"));
      if (isRunReport(value)) reports.push(value);
    } catch {
      // not a report (a ledger, a summary): skipped by shape, not by name
    }
  }
  return reports;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const given = process.argv.slice(2);
  const folders = given.length
    ? given
    : readdirSync("evidence")
        .map((name) => join("evidence", name))
        .filter((path) => statSync(path).isDirectory());
  const out = {};
  for (const folder of folders) {
    const reports = readReports(folder);
    if (reports.length) out[folder] = summarize(reports);
  }
  console.log(JSON.stringify(out, null, 2));
}

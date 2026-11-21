/**
 * TIME RECLAIMED (plan 28.1.12 T12-12): what JARVIS finished for this person, counted only from
 * verified task records. Time saved is shown only from a baseline the person states for a task
 * (their own minutes for doing it by hand), minus the time JARVIS waited on them; with no
 * baseline it is "unavailable", never invented. Failed and unknown tasks never count as done.
 */
export interface TaskRecord {
  title: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  user_wait_ms: number | null;
  /** How many outcome checks the task had, and how many passed. */
  checks: number;
  passed: number;
}

/** Count only distinct declared checks with a matching verification result. */
export function countOutcomeChecks(outcome: unknown, checkpoint: unknown) {
  const checks: unknown[] = Array.isArray(outcome) ? outcome : [];
  const reported = (checkpoint as { verification?: { passed?: unknown } } | null)?.verification
    ?.passed;
  const passed = new Set<unknown>(Array.isArray(reported) ? reported : []);
  const matched = new Set<string>();
  for (const check of checks) {
    const id = (check as { id?: unknown } | null)?.id;
    if (typeof id === "string" && id.length > 0 && passed.has(id)) matched.add(id);
  }
  return { checks: checks.length, passed: matched.size };
}

/** A stored task row reduced to what the dashboard counts (no checks' contents). */
export function record(row: {
  title: string;
  status: string;
  created_at: string;
  finished_at: string | null;
  user_wait_ms: number | null;
  outcome: unknown;
  checkpoint: unknown;
}): TaskRecord {
  return {
    title: row.title,
    status: row.status,
    created_at: row.created_at,
    finished_at: row.finished_at,
    user_wait_ms: row.user_wait_ms,
    ...countOutcomeChecks(row.outcome, row.checkpoint),
  };
}

export type Period = "today" | "week" | "month" | "all";

export function verified(task: TaskRecord): boolean {
  return task.status === "completed" && task.checks > 0 && task.passed === task.checks;
}

export function recordsInPeriod(tasks: readonly TaskRecord[], period: Period, now = new Date()) {
  const from =
    period === "all"
      ? 0
      : period === "today"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        : now.getTime() - (period === "week" ? 7 : 30) * 86_400_000;
  return tasks.filter((task) => Date.parse(task.created_at) >= from);
}

export function reclaimed(
  tasks: readonly TaskRecord[],
  period: Period,
  baselineMinutes: number | null,
  now = new Date(),
) {
  const within = recordsInPeriod(tasks, period, now);
  const done = within.filter(verified);
  const failed = within.filter((task) => ["failed", "blocked"].includes(task.status)).length;
  const unfinished = within.length - done.length - failed;
  const waitedMinutes =
    done.reduce((sum, task) => sum + Math.max(0, task.user_wait_ms ?? 0), 0) / 60_000;
  return {
    total: within.length,
    verified: done.length,
    failed,
    other: unfinished,
    savedMinutes:
      baselineMinutes !== null && Number.isFinite(baselineMinutes) && baselineMinutes > 0
        ? Math.max(0, Math.round(done.length * baselineMinutes - waitedMinutes))
        : null,
  };
}

export function csv(tasks: readonly TaskRecord[]): string {
  const cell = (value: string) => {
    // A task title is user text. Spreadsheet apps may interpret a quoted CSV field as a formula.
    const text = /^[\s\uFEFF]*[=+@-]|^[\t\r\n]/.test(value) ? `'${value}` : value;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return [
    "title,status,verified,accepted_at,finished_at,waited_on_you_seconds",
    ...tasks.map((task) =>
      [
        cell(task.title),
        task.status,
        verified(task) ? "yes" : "no",
        task.created_at,
        task.finished_at ?? "",
        Math.round((task.user_wait_ms ?? 0) / 1000),
      ].join(","),
    ),
  ].join("\n");
}

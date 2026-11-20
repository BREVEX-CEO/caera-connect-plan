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
  const passed = (row.checkpoint as { verification?: { passed?: unknown[] } } | null)?.verification
    ?.passed;
  return {
    title: row.title,
    status: row.status,
    created_at: row.created_at,
    finished_at: row.finished_at,
    user_wait_ms: row.user_wait_ms,
    checks: Array.isArray(row.outcome) ? row.outcome.length : 0,
    passed: Array.isArray(passed) ? passed.length : 0,
  };
}

export type Period = "today" | "week" | "month" | "all";

export function verified(task: TaskRecord): boolean {
  return task.status === "completed" && task.checks > 0 && task.passed >= task.checks;
}

export function reclaimed(
  tasks: readonly TaskRecord[],
  period: Period,
  baselineMinutes: number | null,
  now = new Date(),
) {
  const from =
    period === "all"
      ? 0
      : now.getTime() - (period === "today" ? 1 : period === "week" ? 7 : 30) * 86_400_000;
  const within = tasks.filter((task) => Date.parse(task.created_at) >= from);
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
      baselineMinutes && baselineMinutes > 0
        ? Math.max(0, Math.round(done.length * baselineMinutes - waitedMinutes))
        : null,
  };
}

export function csv(tasks: readonly TaskRecord[]): string {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
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

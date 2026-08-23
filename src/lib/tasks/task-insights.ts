import { taskBoardColumn } from "@/lib/tasks/task-board";
import type { UnifiedTask } from "@/lib/tasks/unified-task";

export type TaskAnalyticsRange = "7" | "30" | "all";

export function taskAnalytics(tasks: UnifiedTask[], range: TaskAnalyticsRange, now = new Date()) {
  const days = range === "all" ? null : Number(range);
  const cutoff = days ? new Date(now.getTime() - days * 86_400_000) : null;
  const current = tasks.filter((task) => !cutoff || new Date(task.createdAt) >= cutoff);
  const prior = days
    ? tasks.filter((task) => {
        const created = new Date(task.createdAt).getTime();
        return created < cutoff!.getTime() && created >= cutoff!.getTime() - days * 86_400_000;
      })
    : [];
  const byStatus = ["queued", "active", "waiting", "closed"].map((column) => ({
    column,
    count: current.filter((task) => taskBoardColumn(task) === column).length,
  }));
  const bySource = [...new Set(current.map((task) => task.source))].sort().map((source) => ({ source, count: current.filter((task) => task.source === source).length }));
  const completed = current.filter((task) => task.status === "COMPLETED").length;
  return { total: current.length, completed, completionRate: current.length ? Math.round((completed / current.length) * 100) : 0, priorTotal: prior.length, difference: current.length - prior.length, byStatus, bySource, lastUpdated: current.map((task) => task.updatedAt).sort().at(-1) ?? null };
}

export function timelineDays(anchor: Date, count = 7) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 2);
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function scheduleTask(task: UnifiedTask, day: Date, at = new Date().toISOString()): UnifiedTask {
  const date = new Date(day);
  date.setHours(9, 0, 0, 0);
  return { ...task, scheduledFor: date.toISOString(), updatedAt: at };
}

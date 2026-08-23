import {
  retryTask,
  transitionTask,
  type UnifiedTask,
  type UnifiedTaskSource,
} from "@/lib/tasks/unified-task";

export type TaskBoardColumn = "queued" | "active" | "waiting" | "closed";
export type TaskBoardGroup = "status" | "source";
export type TaskBoardSort = "updated" | "oldest" | "title";

export const TASK_BOARD_COLUMNS: ReadonlyArray<{
  id: TaskBoardColumn;
  label: string;
  description: string;
}> = [
  { id: "queued", label: "Queued", description: "Ready to plan or start" },
  { id: "active", label: "Active", description: "Executing or verifying" },
  { id: "waiting", label: "Waiting", description: "Needs permission or input" },
  { id: "closed", label: "Closed", description: "Completed, failed or cancelled" },
];

export function taskBoardColumn(task: UnifiedTask): TaskBoardColumn {
  if (task.status === "CREATED" || task.status === "PLANNING") return "queued";
  if (task.status === "EXECUTING" || task.status === "VERIFYING") return "active";
  if (task.status === "WAITING_PERMISSION" || task.status === "WAITING_USER") return "waiting";
  return "closed";
}

export function moveTaskToColumn(
  task: UnifiedTask,
  destination: TaskBoardColumn,
  at = new Date().toISOString(),
): UnifiedTask {
  const current = taskBoardColumn(task);
  if (current === destination) return task;

  if (destination === "queued") {
    if (task.status === "FAILED" || task.status === "CANCELLED") return retryTask(task, at);
    throw new Error("Only failed or cancelled tasks can return to Queued.");
  }

  if (destination === "active") {
    if (task.status === "COMPLETED") throw new Error("A completed task cannot be reopened.");
    const ready =
      task.status === "FAILED" || task.status === "CANCELLED" ? retryTask(task, at) : task;
    return transitionTask(ready, "EXECUTING", {}, at);
  }

  if (destination === "waiting") {
    if (task.status === "COMPLETED") throw new Error("A completed task cannot be reopened.");
    let ready = task;
    if (ready.status === "FAILED" || ready.status === "CANCELLED") ready = retryTask(ready, at);
    if (ready.status === "CREATED") ready = transitionTask(ready, "PLANNING", {}, at);
    if (ready.status === "VERIFYING") ready = transitionTask(ready, "EXECUTING", {}, at);
    if (ready.status === "WAITING_PERMISSION" || ready.status === "WAITING_USER") return ready;
    return transitionTask(ready, "WAITING_USER", {}, at);
  }

  if (task.status === "COMPLETED" || task.status === "FAILED" || task.status === "CANCELLED")
    return task;
  return transitionTask(task, "CANCELLED", {}, at);
}

export function filterAndSortTasks(
  tasks: UnifiedTask[],
  query: string,
  source: UnifiedTaskSource | "all",
  sort: TaskBoardSort,
): UnifiedTask[] {
  const needle = query.trim().toLowerCase();
  const filtered = tasks.filter(
    (task) =>
      (source === "all" || task.source === source) &&
      (!needle ||
        `${task.title} ${task.request ?? ""} ${task.currentStep ?? ""}`
          .toLowerCase()
          .includes(needle)),
  );
  return filtered.sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function taskSourceGroups(tasks: UnifiedTask[]) {
  const groups = new Map<UnifiedTaskSource, UnifiedTask[]>();
  for (const task of tasks) groups.set(task.source, [...(groups.get(task.source) ?? []), task]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function taskFeedAuthor(task: UnifiedTask) {
  if (task.agent?.trim()) return task.agent.trim();
  if (task.source === "automation") return "OCADE Automation";
  if (task.source === "system") return "OCADE System";
  return "You on this device";
}

export function paginateTaskFeed(tasks: UnifiedTask[], page: number, pageSize = 6) {
  const safeSize = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(tasks.length / safeSize));
  const safePage = Math.min(pages, Math.max(1, page));
  return {
    page: safePage,
    pages,
    items: tasks.slice((safePage - 1) * safeSize, safePage * safeSize),
  };
}

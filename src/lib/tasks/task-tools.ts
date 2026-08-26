/**
 * The three task actions OCADE can take on its own behalf, from either room.
 *
 * WHY THESE RUN HERE AND NOT THROUGH THE COMPANION
 * ------------------------------------------------
 * Every other tool call ends up at the extension or at the paired computer,
 * because every other tool acts on something outside OCADE. These three act on
 * OCADE's own task state, which lives in this tab. Sending them to a companion
 * would mean a user with no companion paired could not ask "what are you
 * working on" — a question that has an answer whether or not a desktop is
 * connected.
 *
 * They are still real tools: same registry, same permission layer, same
 * outcome enum. `task_stop` is `mutating` and carries real risk, because it
 * ends work in progress.
 *
 * Ported behaviour: the archive's TaskListTool / TaskStopTool / TaskCreateTool
 * shapes — list returns live runs before finished ones, stop distinguishes
 * "no such task" from "already finished", create records a task without
 * starting one.
 */

import { fail, ok, type ToolOutcome } from "@/lib/agent/outcomes";
import { StopTaskError, elapsedMs, listRuns, stopRun } from "@/lib/tasks/runs";
import { createUnifiedTask, listLocalTasks, persistTask } from "@/lib/tasks/unified-task";

/** Names this module owns. Kept here so the executor's check is one lookup. */
export const TASK_TOOL_NAMES = ["task_list", "task_stop", "task_create"] as const;

export type TaskToolName = (typeof TASK_TOOL_NAMES)[number];

export function isTaskTool(name: string): name is TaskToolName {
  return (TASK_TOOL_NAMES as readonly string[]).includes(name);
}

function minutes(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return "under a minute";
  return mins === 1 ? "1 minute" : `${mins} minutes`;
}

async function listTasks(): Promise<ToolOutcome> {
  const live = listRuns().filter((task) => task.status !== "completed");
  const board = await listLocalTasks().catch(() => []);
  const openBoard = board.filter(
    (task) => task.status !== "COMPLETED" && task.status !== "CANCELLED",
  );

  const running = live.map((task) => ({
    id: task.id,
    what: task.description,
    state: task.status,
    workingFor: minutes(elapsedMs(task)),
  }));

  if (running.length === 0 && openBoard.length === 0) {
    return ok({ running: [], waiting: [] }, "Nothing is running and nothing is waiting.");
  }

  const waiting = openBoard
    .filter((task) => !live.some((run) => run.id === task.id))
    .slice(0, 20)
    .map((task) => ({ id: task.id, what: task.title, state: task.status }));

  const parts: string[] = [];
  if (running.length > 0) {
    parts.push(running.length === 1 ? "1 task is running" : `${running.length} tasks are running`);
  }
  if (waiting.length > 0) {
    parts.push(waiting.length === 1 ? "1 is waiting" : `${waiting.length} are waiting`);
  }
  return ok({ running, waiting }, `${parts.join(", ")}.`);
}

async function stopTaskTool(args: Record<string, unknown>): Promise<ToolOutcome> {
  const id = typeof args.id === "string" ? args.id.trim() : "";
  if (!id) return fail("blocked", "Which task? OCADE needs the task's id to stop it.");
  try {
    const stopped = await stopRun(id, "Stopped from a request.");
    return ok({ id: stopped.taskId }, `Stopped “${stopped.label}”.`, { verified: true });
  } catch (cause) {
    if (cause instanceof StopTaskError) {
      /*
       * The three codes are three different sentences on purpose. "It did not
       * stop" leaves a user with nothing to do next; each of these tells them
       * what actually happened.
       */
      if (cause.code === "not_found") {
        return fail("blocked", "There is no task with that id.");
      }
      if (cause.code === "not_running") {
        return fail("state_changed", "That task had already finished.");
      }
      return fail("unsupported", "OCADE cannot stop that kind of task from here.");
    }
    return fail(
      "retryable_failure",
      cause instanceof Error ? cause.message : "The task did not stop.",
    );
  }
}

async function createTask(args: Record<string, unknown>): Promise<ToolOutcome> {
  const title = typeof args.title === "string" ? args.title.trim() : "";
  if (!title) return fail("blocked", "A task needs a short title.");
  const task = createUnifiedTask({
    source: "work",
    title: title.slice(0, 200),
    request: typeof args.detail === "string" ? args.detail.slice(0, 2_000) : undefined,
  });
  await persistTask(task);
  return ok({ id: task.id }, `Added “${task.title}” to your tasks.`, { verified: true });
}

export async function runTaskTool(
  name: TaskToolName,
  args: Record<string, unknown>,
): Promise<ToolOutcome> {
  if (name === "task_list") return listTasks();
  if (name === "task_stop") return stopTaskTool(args);
  return createTask(args);
}

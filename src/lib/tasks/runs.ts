/**
 * The live task registry: one place that knows what OCADE is doing right now,
 * and the only place that can stop it.
 *
 * WHY THIS EXISTS
 * ---------------
 * Before this, a Cowork mission was a set of React refs inside one hook. It
 * worked while that hook was mounted and vanished when it was not: reloading
 * the page mid-task lost the task, Chat could not see that Cowork was busy, the
 * task list showed only manually typed to-dos, and "Stop" was reachable from
 * exactly one button on one screen.
 *
 * The imported archive had already solved this shape. Its task layer is a
 * registry of live runs, a per-kind killer, a status machine with a real
 * terminal set, and a stop path with an error taxonomy. That logic is now in
 * `src/primary-logic/tasks`, and this file is the adapter that gives it a
 * store, a killer per kind, and somewhere durable to write.
 *
 * WHO OWNS WHAT
 * -------------
 * `primary-logic/tasks/lifecycle` owns the status machine for a RUN -- work
 * OCADE is doing. `lib/tasks/unified-task` owns the status machine for a BOARD
 * task -- something a person wrote down. They are not the same object and they
 * are not two authorities over one object: every run projects into a board task
 * so history and reload can see it, and the projection is one pure function
 * (`project`) that runs in one direction only.
 */

import { backgroundTasks, getPillLabel, pillNeedsAttention } from "@/primary-logic/tasks/pillLabel";
import {
  beginPause,
  createTaskRun,
  elapsedMs,
  endPause,
  isActiveTaskStatus,
  isTerminalTaskStatus,
  toTerminal,
  type TaskKind,
  type TaskRun,
} from "@/primary-logic/tasks/lifecycle";
import { StopTaskError, stopTask } from "@/primary-logic/tasks/stopTask";
import {
  listTasks,
  persistTask,
  transitionTask,
  type UnifiedTask,
  type UnifiedTaskSource,
  type UnifiedTaskStatus,
} from "@/lib/tasks/unified-task";

export type { TaskRun, TaskKind };
export { StopTaskError, elapsedMs, isActiveTaskStatus, isTerminalTaskStatus };

/**
 * What a kind of run needs in order to be stoppable.
 *
 * Registering a killer is not optional politeness: a run with no killer is
 * reported to the user as `unsupported_type` rather than silently pretending to
 * stop, which is the one behaviour the spec forbids outright.
 */
export type TaskKiller = (task: TaskRun) => Promise<void> | void;

const runs = new Map<string, TaskRun>();
const killers = new Map<string, TaskKiller>();
const listeners = new Set<(tasks: TaskRun[]) => void>();

function snapshot(): TaskRun[] {
  return [...runs.values()].sort((a, b) => b.startTime - a.startTime);
}

function announce() {
  const tasks = snapshot();
  for (const listener of listeners) listener(tasks);
}

export function subscribeToRuns(listener: (tasks: TaskRun[]) => void): () => void {
  listeners.add(listener);
  listener(snapshot());
  return () => listeners.delete(listener);
}

export function listRuns(): TaskRun[] {
  return snapshot();
}

export function getRun(id: string): TaskRun | undefined {
  return runs.get(id);
}

export function activeRuns(): TaskRun[] {
  return snapshot().filter((task) => isActiveTaskStatus(task.status));
}

/** The one-line "what is OCADE doing" summary, for the pill and for Buddy. */
export function describeRuns(tasks: TaskRun[] = snapshot()): {
  label: string;
  needsAttention: boolean;
} {
  const background = backgroundTasks(tasks);
  return {
    label: getPillLabel(background),
    needsAttention: pillNeedsAttention(background),
  };
}

const SOURCE_FOR_KIND: Record<TaskKind, UnifiedTaskSource> = {
  mission: "work",
  shell: "system",
  agent: "work",
  automation: "automation",
  monitor: "monitor",
};

const BOARD_STATUS: Record<TaskRun["status"], UnifiedTaskStatus> = {
  pending: "CREATED",
  running: "EXECUTING",
  // A paused run is waiting on one thing: the person who paused it.
  paused: "WAITING_USER",
  completed: "COMPLETED",
  failed: "FAILED",
  // A run the user stopped was not a failure. Cancelled says so, and is the
  // status the board already allows to be picked back up.
  killed: "CANCELLED",
};

/**
 * A run, as the task board sees it.
 *
 * Pure and one-directional. Nothing reads a board task back into a run: a
 * reloaded page rebuilds history from the board, but the live registry only
 * ever holds runs this session actually started.
 */
export function project(task: TaskRun, existing?: UnifiedTask): UnifiedTask {
  const now = new Date(task.endTime ?? Date.now()).toISOString();
  return {
    id: task.id,
    source: SOURCE_FOR_KIND[task.kind],
    sourceRef: task.toolUseId,
    title: task.description,
    request: task.command,
    /*
     * The run's own last word — a receipt when it finished, the stop reason
     * when the user ended it. It is what the task row shows under the title,
     * which is the only place a person who was not watching finds out what
     * happened without opening the transcript.
     */
    currentStep: task.detail ?? existing?.currentStep,
    status: BOARD_STATUS[task.status],
    progress: task.progress,
    retryCount: existing?.retryCount ?? 0,
    createdAt: existing?.createdAt ?? new Date(task.startTime).toISOString(),
    updatedAt: now,
    startedAt: new Date(task.startTime).toISOString(),
    finishedAt: task.endTime === undefined ? undefined : new Date(task.endTime).toISOString(),
    lastError: task.status === "failed" ? task.detail : existing?.lastError,
  };
}

const boardCache = new Map<string, UnifiedTask>();

function write(task: TaskRun) {
  runs.set(task.id, task);
  const projected = project(task, boardCache.get(task.id));
  boardCache.set(task.id, projected);
  /*
   * Persistence is fire-and-forget on purpose. A run must not stall because
   * the account is slow to reach or unreachable -- the durable copy is for
   * history and for recovering an interrupted run, and neither is worth
   * blocking live work over.
   */
  void persistTask(projected).catch(() => undefined);
  ensureHeartbeat();
  announce();
}

/**
 * Start tracking a run.
 *
 * `kill` is what STOP will actually do. For a Cowork mission that is aborting
 * the loop and telling the companion to let go of the keyboard; for a command
 * on the paired computer it is terminating the child process.
 */
export function startRun(input: {
  kind: TaskKind;
  description: string;
  command?: string;
  toolUseId?: string;
  isBackgrounded?: boolean;
  kill: TaskKiller;
}): TaskRun {
  const task = { ...createTaskRun(input), status: "running" as const };
  killers.set(task.id, input.kill);
  write(task);
  return task;
}

function mutate(id: string, change: (task: TaskRun) => TaskRun): TaskRun | undefined {
  const current = runs.get(id);
  if (!current) return undefined;
  const next = change(current);
  if (next === current) return current;
  write(next);
  return next;
}

export function updateRun(
  id: string,
  patch: Partial<Pick<TaskRun, "description" | "progress" | "detail" | "isBackgrounded">>,
): TaskRun | undefined {
  return mutate(id, (task) => (isTerminalTaskStatus(task.status) ? task : { ...task, ...patch }));
}

export function pauseRun(id: string): TaskRun | undefined {
  return mutate(id, (task) => beginPause(task));
}

export function resumeRun(id: string): TaskRun | undefined {
  return mutate(id, (task) => endPause(task));
}

/** Finish a run that ended on its own. */
export function finishRun(
  id: string,
  status: "completed" | "failed",
  detail?: string,
): TaskRun | undefined {
  const next = mutate(id, (task) =>
    isTerminalTaskStatus(task.status) ? task : toTerminal(task, status, detail),
  );
  killers.delete(id);
  return next;
}

/**
 * Stop a run, for real.
 *
 * Throws `StopTaskError` with a code the caller turns into a sentence. The
 * killer runs BEFORE the status changes: a run marked stopped whose process is
 * still alive is worse than one that is still marked running.
 */
export async function stopRun(id: string, detail?: string) {
  return stopTask(
    id,
    {
      get: (taskId) => runs.get(taskId),
      kill: async (task) => {
        const killer = killers.get(task.id);
        if (!killer) return false;
        await killer(task);
        killers.delete(task.id);
        return true;
      },
      markKilled: (taskId, killDetail) => {
        mutate(taskId, (task) => toTerminal(task, "killed", killDetail));
      },
    },
    detail,
  );
}

/** Stop everything still live. Used when the user says "stop" with no target. */
export async function stopAllRuns(detail?: string): Promise<number> {
  let stopped = 0;
  for (const task of activeRuns()) {
    try {
      await stopRun(task.id, detail);
      stopped += 1;
    } catch {
      // Already gone, or unstoppable from here. Either way the next one still
      // gets its chance -- a single stubborn run must not strand the rest.
    }
  }
  return stopped;
}

/**
 * How long a run may go untouched before a reload treats it as interrupted.
 *
 * Three heartbeats. One missed beat is a slow network or a busy tab, and
 * declaring a live mission dead over it is the failure this guards against;
 * three missed beats with nothing in this tab's registry is a page that is
 * gone.
 */
export const HEARTBEAT_MS = 20_000;
export const INTERRUPTED_AFTER_MS = HEARTBEAT_MS * 3 + 5_000;

function staleness(task: UnifiedTask, now: Date): number {
  const touched = Date.parse(task.updatedAt);
  // An unparseable timestamp must not make a live run look fresh forever.
  return Number.isNaN(touched) ? Number.POSITIVE_INFINITY : now.getTime() - touched;
}

let heartbeat: ReturnType<typeof setInterval> | null = null;

/**
 * Keep the durable copy of every live run warm.
 *
 * Only while something is actually running: an idle tab that beat forever
 * would write to the account for no reason, and a run that ended must go stale
 * so a later reload can tell that it did.
 */
function ensureHeartbeat() {
  const active = activeRuns();
  if (active.length === 0) {
    if (heartbeat !== null) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    return;
  }
  if (heartbeat !== null || typeof setInterval !== "function") return;
  heartbeat = setInterval(() => {
    const live = activeRuns();
    if (live.length === 0) {
      ensureHeartbeat();
      return;
    }
    for (const task of live) {
      void persistTask(project(task, boardCache.get(task.id))).catch(() => undefined);
    }
  }, HEARTBEAT_MS);
  // Node keeps the process alive for a pending interval; a test run must not
  // hang on one. Browsers have no `unref`, which is why this is guarded.
  (heartbeat as unknown as { unref?: () => void }).unref?.();
}

/**
 * Mark runs that a reload or crash interrupted.
 *
 * A board task left EXECUTING or WAITING_USER by a previous session cannot
 * still be running: this registry is per-tab, and nothing survived. Saying so
 * is what makes RESUME honest -- the user is picking up something OCADE has
 * admitted it stopped doing, not re-attaching to a process that is gone.
 */
export async function reconcileInterruptedRuns(now = new Date()): Promise<UnifiedTask[]> {
  const stored = await listTasks().catch(() => [] as UnifiedTask[]);
  const stale = stored.filter(
    (task) =>
      (task.status === "EXECUTING" ||
        task.status === "WAITING_USER" ||
        task.status === "WAITING_PERMISSION" ||
        task.status === "PLANNING") &&
      !runs.has(task.id) &&
      /*
       * ANOTHER TAB IS NOT A CRASH.
       *
       * This registry is per-tab, so "not in `runs`" used to be the whole test
       * -- and opening a second tab therefore declared the mission running in
       * the first one dead, in the account, while it carried on moving the
       * mouse. The board then showed a failure for work that was happening.
       * A live run heartbeats (below), so what separates the two cases is
       * whether anything has touched the row recently.
       */
      staleness(task, now) > INTERRUPTED_AFTER_MS,
  );
  const repaired: UnifiedTask[] = [];
  for (const task of stale) {
    const next = transitionTask(
      task,
      "FAILED",
      { lastError: "Interrupted before it finished. You can pick it up again." },
      now.toISOString(),
    );
    await persistTask(next).catch(() => undefined);
    repaired.push(next);
  }
  return repaired;
}

/** Test seam. Drops live state without touching what was persisted. */
export function resetRunsForTest() {
  if (heartbeat !== null) {
    clearInterval(heartbeat);
    heartbeat = null;
  }
  runs.clear();
  killers.clear();
  boardCache.clear();
  listeners.clear();
}

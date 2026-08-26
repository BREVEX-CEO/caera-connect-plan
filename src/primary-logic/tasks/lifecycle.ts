/**
 * Task lifecycle: identity, status, and the arithmetic of a run that can be
 * paused.
 *
 * Ported from the archive's `src/Task.ts`, `src/tasks/types.ts` and the
 * environment-free half of `src/utils/task/framework.ts`.
 *
 * ADAPTED, AND WHY
 * ----------------
 * - `randomBytes` from node:crypto became `crypto.getRandomValues`. The
 *   alphabet, the length and the per-kind prefix are the donor's; only the
 *   entropy source changed, because this runs in a browser tab at least as
 *   often as it runs on a desktop.
 * - The donor stamped every task with `outputFile`, a path under its temp
 *   directory, and streamed output there. A tab has no temp directory, so the
 *   output lives on the record and the field is gone.
 * - `'paused'` was added to the status union. The donor's CLI could not pause a
 *   task -- yet every donor task state already carried `totalPausedMs`, so the
 *   accounting was written before the control existed. OCADE has the control,
 *   so the status is real here and `elapsedMs` subtracts the paused time.
 * - `AppState` is not imported. The donor read one global store; here the store
 *   is whatever the caller holds, which is what lets one lifecycle serve both
 *   an in-memory registry and a durable one.
 */

/**
 * What kind of work a run is. The donor's names were tied to its terminal
 * (`local_bash`, `monitor_ocadeTools`); these say the same things in OCADE's
 * vocabulary, because these strings reach the user through task history.
 */
export type TaskKind =
  | 'mission'
  | 'shell'
  | 'agent'
  | 'automation'
  | 'monitor'

export type TaskRunStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'killed'

/**
 * True when a run is finished and will not transition again. Guards eviction,
 * message injection into dead runs, and orphan cleanup -- the donor's three
 * uses, all of which OCADE has too.
 */
export function isTerminalTaskStatus(status: TaskRunStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'killed'
}

/** True when a run still holds resources: it can be paused, resumed or killed. */
export function isActiveTaskStatus(status: TaskRunStatus): boolean {
  return status === 'pending' || status === 'running' || status === 'paused'
}

export type TaskRun = {
  id: string
  kind: TaskKind
  status: TaskRunStatus
  /** One line a person would recognise. Shown in history and in the pill. */
  description: string
  /** The command, for shell runs. Never shown as the label for a monitor. */
  command?: string
  /** The tool call that spawned this run, when one did. */
  toolUseId?: string
  startTime: number
  endTime?: number
  /** When the current pause began. Absent unless status is 'paused'. */
  pausedAt?: number
  totalPausedMs: number
  /**
   * False while the run is the thing the user is watching; true once it has
   * been sent to the background. A foreground run is not a "background task"
   * even though it is running -- the donor's distinction, kept.
   */
  isBackgrounded: boolean
  /** Set once the user has been told this run finished. */
  notified: boolean
  /** Terminal detail: an exit reason, an error, a one-line result. */
  detail?: string
  /** Progress 0-100 when the run can report it honestly. */
  progress?: number
}

// Task ID prefixes. Donor values where the kind survived the rename, so ids
// written by either side read the same way.
const TASK_ID_PREFIXES: Record<TaskKind, string> = {
  mission: 'k',
  shell: 'b',
  agent: 'a',
  automation: 'w',
  monitor: 'm',
}

// Case-insensitive-safe alphabet (digits + lowercase). 36^8 is about 2.8
// trillion, which is the donor's margin against guessing a task id.
const TASK_ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  const source =
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.getRandomValues === 'function'
      ? globalThis.crypto
      : null
  if (source) {
    source.getRandomValues(bytes)
    return bytes
  }
  // No Web Crypto: ids stay unique enough to key a map, and nothing here is a
  // security boundary -- a task id is not a capability in OCADE, because every
  // stop goes through the registry's own ownership check.
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256)
  }
  return bytes
}

export function generateTaskId(kind: TaskKind): string {
  const prefix = TASK_ID_PREFIXES[kind] ?? 'x'
  const bytes = randomBytes(8)
  let id = prefix
  for (let i = 0; i < 8; i++) {
    id += TASK_ID_ALPHABET[bytes[i]! % TASK_ID_ALPHABET.length]
  }
  return id
}

export function createTaskRun(input: {
  kind: TaskKind
  description: string
  command?: string
  toolUseId?: string
  isBackgrounded?: boolean
  id?: string
  now?: number
}): TaskRun {
  return {
    id: input.id ?? generateTaskId(input.kind),
    kind: input.kind,
    status: 'pending',
    description: input.description,
    command: input.command,
    toolUseId: input.toolUseId,
    startTime: input.now ?? Date.now(),
    totalPausedMs: 0,
    isBackgrounded: input.isBackgrounded ?? false,
    notified: false,
  }
}

/**
 * Whether a run belongs in the background-tasks indicator.
 *
 * The donor's rule, unchanged: it must still be live, and it must have been
 * backgrounded. A run the user is watching is not something to notify them
 * about.
 */
export function isBackgroundTask(task: TaskRun): boolean {
  if (task.status !== 'running' && task.status !== 'pending' && task.status !== 'paused') {
    return false
  }
  return task.isBackgrounded !== false
}

/**
 * How long the run has actually been working, in milliseconds.
 *
 * Paused time is subtracted -- including the pause still open right now, which
 * is why a paused run's elapsed time stops climbing on screen instead of
 * quietly counting the minutes the user was away.
 */
export function elapsedMs(task: TaskRun, now = Date.now()): number {
  const end = task.endTime ?? now
  const openPause = task.pausedAt === undefined ? 0 : Math.max(0, now - task.pausedAt)
  return Math.max(0, end - task.startTime - task.totalPausedMs - openPause)
}

/** Begin a pause. A run that is not running is returned untouched. */
export function beginPause(task: TaskRun, now = Date.now()): TaskRun {
  if (task.status !== 'running') return task
  return { ...task, status: 'paused', pausedAt: now }
}

/** End a pause, banking the time it took. */
export function endPause(task: TaskRun, now = Date.now()): TaskRun {
  if (task.status !== 'paused') return task
  const banked = task.pausedAt === undefined ? 0 : Math.max(0, now - task.pausedAt)
  return {
    ...task,
    status: 'running',
    pausedAt: undefined,
    totalPausedMs: task.totalPausedMs + banked,
  }
}

/**
 * Move a run to a terminal status, banking any open pause so the elapsed time
 * of a run stopped while paused is still correct.
 */
export function toTerminal(
  task: TaskRun,
  status: 'completed' | 'failed' | 'killed',
  detail?: string,
  now = Date.now(),
): TaskRun {
  const banked = task.pausedAt === undefined ? 0 : Math.max(0, now - task.pausedAt)
  return {
    ...task,
    status,
    detail: detail ?? task.detail,
    pausedAt: undefined,
    totalPausedMs: task.totalPausedMs + banked,
    endTime: task.endTime ?? now,
  }
}

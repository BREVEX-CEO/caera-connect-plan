/**
 * Stopping a run, and saying precisely why it could not be stopped.
 *
 * Ported from the archive's `src/tasks/stopTask.ts`. The donor's version read
 * one global `AppState` and dispatched through a task-type table; here the
 * store and the killer are passed in, because OCADE stops runs from three
 * places -- the Cowork panel, a tool call, and a companion disconnect -- and
 * none of them should have to know how the other two hold their state.
 *
 * The part worth keeping verbatim is the error taxonomy. "It did not stop" is
 * useless to a user; "there is no run by that name", "it had already finished"
 * and "OCADE cannot stop that kind of run" are three different sentences and
 * three different next steps.
 */

import { isActiveTaskStatus, type TaskRun } from './lifecycle.js'

export type StopTaskCode = 'not_found' | 'not_running' | 'unsupported_type'

export class StopTaskError extends Error {
  constructor(
    message: string,
    public readonly code: StopTaskCode,
  ) {
    super(message)
    this.name = 'StopTaskError'
  }
}

export type StopTaskStore = {
  get: (taskId: string) => TaskRun | undefined
  /**
   * Terminate the work behind the run. Returns false when this kind of run has
   * no killer registered, which is `unsupported_type` -- distinct from a
   * killer that ran and threw.
   */
  kill: (task: TaskRun) => Promise<boolean> | boolean
  /** Record the stop. Called only after `kill` reports success. */
  markKilled: (taskId: string, detail?: string) => void
}

export type StopTaskResult = {
  taskId: string
  kind: TaskRun['kind']
  /** The command for a shell run, otherwise the run's description. */
  label: string
}

/**
 * Look up a run, check it is still live, kill it, and mark it stopped.
 *
 * Throws {@link StopTaskError}; callers read `error.code` to choose their
 * sentence.
 */
export async function stopTask(
  taskId: string,
  store: StopTaskStore,
  detail?: string,
): Promise<StopTaskResult> {
  const task = store.get(taskId)

  if (!task) {
    throw new StopTaskError(`No task found with ID: ${taskId}`, 'not_found')
  }

  if (!isActiveTaskStatus(task.status)) {
    throw new StopTaskError(
      `Task ${taskId} is not running (status: ${task.status})`,
      'not_running',
    )
  }

  const killed = await store.kill(task)
  if (!killed) {
    throw new StopTaskError(
      `OCADE cannot stop a ${task.kind} run from here.`,
      'unsupported_type',
    )
  }

  // The donor suppressed the "exit code 137" notification for shell tasks, on
  // the grounds that a kill the user asked for is not news. Same rule, stated
  // once: the caller passes the detail it wants recorded, and a stop the user
  // requested passes nothing.
  store.markKilled(taskId, detail)

  return {
    taskId,
    kind: task.kind,
    label: task.command ?? task.description,
  }
}

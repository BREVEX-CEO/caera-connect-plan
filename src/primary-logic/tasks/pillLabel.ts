/**
 * The one sentence that describes everything currently running.
 *
 * Ported from the archive's `src/tasks/pillLabel.ts`, which existed for the
 * same reason it exists here: two surfaces show "what is OCADE doing" -- the
 * status pill and the task list -- and if they phrase it differently the user
 * reasonably concludes they are looking at two different things.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor's vocabulary was a terminal's: "1 shell", "ultraplan needs your
 * input", "2 cloud sessions", and two box-drawing diamonds carrying state. All
 * of that is internal terminology, and OCADE does not show internal terminology
 * to the person using it. The grouping logic -- count by kind, name the kind
 * only when every run shares it, fall back to a plain total -- is the donor's
 * and is what makes the label readable at a glance.
 */

import { isBackgroundTask, type TaskKind, type TaskRun } from './lifecycle.js'

const SINGULAR: Record<TaskKind, string> = {
  mission: 'task',
  shell: 'command',
  agent: 'task',
  automation: 'automation',
  monitor: 'watch',
}

const PLURAL: Record<TaskKind, string> = {
  mission: 'tasks',
  shell: 'commands',
  agent: 'tasks',
  automation: 'automations',
  monitor: 'watches',
}

/** Runs worth showing in the indicator: live, and sent to the background. */
export function backgroundTasks(tasks: readonly TaskRun[]): TaskRun[] {
  return tasks.filter(isBackgroundTask)
}

export function getPillLabel(tasks: readonly TaskRun[]): string {
  const n = tasks.length
  if (n === 0) return ''

  const first = tasks[0]!
  const allSameKind = tasks.every(t => t.kind === first.kind)
  if (allSameKind) {
    return n === 1 ? `1 ${SINGULAR[first.kind]}` : `${n} ${PLURAL[first.kind]}`
  }

  return n === 1 ? '1 task running' : `${n} tasks running`
}

/**
 * True when the label should carry the "open to see" affordance.
 *
 * The donor showed the call to action only for the two states that were
 * genuinely waiting on the user. Same rule: a run that is merely working needs
 * no prompt, and a paused one does -- it stopped, and only the user restarts it.
 */
export function pillNeedsAttention(tasks: readonly TaskRun[]): boolean {
  return tasks.some(t => t.status === 'paused')
}

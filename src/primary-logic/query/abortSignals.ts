/**
 * One signal that means "stop", however many reasons there were.
 *
 * Ported from the archive's `combinedAbortSignal.ts`.
 *
 * WHY A COMBINER RATHER THAN PASSING TWO SIGNALS AROUND
 * -----------------------------------------------------
 * Work in flight can be ended by several things at once: the person pressed
 * stop, the run was superseded, the call has taken longer than anyone should
 * wait. Threading each of those through every layer means every layer has to
 * remember all of them, and the one that forgets is the one that hangs.
 *
 * `AbortSignal.any` exists in modern browsers and would cover the first two --
 * but it does not cover the deadline, and it gives nothing back to unhook. This
 * returns a cleanup function, which is the difference between a listener that
 * is removed when the call finishes and one that accumulates for every call the
 * session ever makes.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor used its own controller factory and Bun-specific notes about timer
 * finalisation. This uses the platform's `AbortController` and plain
 * `setTimeout`/`clearTimeout`, which is what the donor's workaround amounted to
 * anyway.
 */

export type CombinedSignal = {
  signal: AbortSignal
  /** Removes the listeners and clears the deadline. Always call it. */
  cleanup: () => void
}

export function combineAbortSignals(
  signal: AbortSignal | undefined,
  options: { other?: AbortSignal; timeoutMs?: number } = {},
): CombinedSignal {
  const { other, timeoutMs } = options
  const controller = new AbortController()

  // Already stopped: report it immediately rather than arming a deadline for
  // work that is not going to start.
  if (signal?.aborted || other?.aborted) {
    controller.abort()
    return { signal: controller.signal, cleanup: () => {} }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    if (timer !== undefined) clearTimeout(timer)
    controller.abort()
  }

  if (timeoutMs !== undefined) {
    timer = setTimeout(stop, timeoutMs)
  }
  signal?.addEventListener('abort', stop)
  other?.addEventListener('abort', stop)

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer !== undefined) clearTimeout(timer)
      signal?.removeEventListener('abort', stop)
      other?.removeEventListener('abort', stop)
    },
  }
}

/**
 * Wait for `work`, but stop waiting when the signal says so.
 *
 * The work itself may carry on -- a request already sent to another process
 * cannot be recalled -- and this does not pretend otherwise. What it changes is
 * that the person who pressed stop is not made to watch a spinner until
 * somebody else's timeout expires. `onAbandoned` is what the caller reports in
 * that case, and it should say plainly that the action was left running.
 */
export async function raceAbort<T>(
  work: Promise<T>,
  signal: AbortSignal | undefined,
  onAbandoned: () => T,
): Promise<T> {
  if (!signal) return work
  if (signal.aborted) return onAbandoned()

  return new Promise<T>((resolve) => {
    let settled = false
    const finish = (value: T) => {
      if (settled) return
      settled = true
      signal.removeEventListener('abort', abandon)
      resolve(value)
    }
    const abandon = () => finish(onAbandoned())
    signal.addEventListener('abort', abandon)
    void work.then(finish, () => finish(onAbandoned()))
  })
}

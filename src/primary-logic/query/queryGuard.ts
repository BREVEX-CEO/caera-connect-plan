/**
 * One run at a time, and a way to know which.
 *
 * Ported from the archive's `QueryGuard.ts`.
 *
 * THE GAP THIS EXISTS TO CLOSE
 * ----------------------------
 * Starting a run is not instant. Between deciding to start one and the loop
 * actually running there is an await -- reading settings, classifying the
 * request, asking the limiter -- and a second request arriving inside that gap
 * sees no run in progress, because there is not one yet.
 *
 * In OCADE that gap had teeth. `run()` calls `runner.reset()`, which clears the
 * repeat-detection and stuck-reason that protect the run currently inside a
 * tool call. Two requests a second apart meant the first run losing the state
 * that stops it looping, silently, with nothing in any log.
 *
 * So the guard has three states rather than two. `dispatching` is the answer to
 * "has something claimed this?" during the gap, and it is the whole reason the
 * donor's version is shaped this way.
 *
 * ADAPTED, AND WHY
 * ----------------
 * The donor's version was built for React's `useSyncExternalStore` and imported
 * its own signal helper. This keeps the state machine exactly and uses a plain
 * listener set, so it can be used from a hook, a plain function, or a test
 * without dragging a renderer in.
 */

export type QueryGuardStatus = 'idle' | 'dispatching' | 'running'

export class QueryGuard {
  private status: QueryGuardStatus = 'idle'
  /** Incremented on every start, so a late finisher cannot end a newer run. */
  private generation = 0
  private listeners = new Set<() => void>()

  /** Claim the guard before the async work of starting begins. */
  reserve(): boolean {
    if (this.status !== 'idle') return false
    this.status = 'dispatching'
    this.notify()
    return true
  }

  /** Give a reservation back when the run never started after all. */
  cancelReservation(): void {
    if (this.status !== 'dispatching') return
    this.status = 'idle'
    this.notify()
  }

  /**
   * Begin. Returns the run's generation, or null when something else holds it.
   *
   * A reservation this call made itself is upgraded; a reservation made by
   * somebody else is not, which is what keeps two claimants from both starting.
   */
  tryStart(): number | null {
    if (this.status === 'running') return null
    this.status = 'running'
    this.generation += 1
    this.notify()
    return this.generation
  }

  /**
   * Finish, but only if this is still the run that started.
   *
   * A run that was superseded and finishes late must not release the guard the
   * newer run is holding -- that is the same re-entrancy bug arriving from the
   * other direction.
   */
  end(generation: number): boolean {
    if (this.status !== 'running' || generation !== this.generation) return false
    this.status = 'idle'
    this.notify()
    return true
  }

  /** Release whatever is held. For teardown, where correctness is "nothing left running". */
  forceEnd(): void {
    if (this.status === 'idle') return
    this.status = 'idle'
    this.notify()
  }

  /** True while a run is starting or running. The question callers actually ask. */
  isActive(): boolean {
    return this.status !== 'idle'
  }

  getStatus(): QueryGuardStatus {
    return this.status
  }

  getGeneration(): number {
    return this.generation
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) listener()
  }
}

/**
 * No-progress detection and loop limits (master plan §8.8, §19.8 "no-progress
 * loops terminate").
 *
 * The control plane already bounds RETRIES for a single action. Nothing bounded
 * the TASK: an orchestrator that keeps planning, executing and verifying without
 * ever completing a step will run until something else stops it — burning
 * budget, resources and, on a permissioned machine, repeating real actions.
 *
 * This is the governor for that. It watches a task's observable progress and
 * says continue, warn or halt. It is pure: no clock of its own, no I/O, no
 * randomness — every decision is a function of the observations handed to it, so
 * a long-run failure can be reproduced exactly in a test instead of waited for.
 *
 * FOUR WAYS A TASK FAILS TO PROGRESS, and all four are caught:
 *
 *  1. NOTHING COMPLETES — iterations pass with no new completed step, artifact
 *     or verified receipt.
 *  2. THE SAME STATE REPEATS — the task returns to a state it has already been
 *     in. That is a cycle, and running it again cannot produce a new outcome.
 *  3. TOO MANY ITERATIONS — a hard ceiling regardless of apparent progress,
 *     because "progress" that never terminates is still a runaway.
 *  4. TIME RUNS OUT — a wall-clock deadline for the whole task.
 *
 * HALT IS FINAL AND HONEST. When this halts a task the work done so far is
 * kept — §8.8 requires partial outputs to survive — and the reason is stated
 * plainly rather than reported as a completion.
 */

export interface ProgressObservation {
  /** Monotonic iteration counter, starting at 1. */
  iteration: number;
  /** Steps finished so far. Must never decrease. */
  completedSteps: number;
  /** Artifacts produced so far. Must never decrease. */
  producedArtifacts: number;
  /** Independently verified receipts so far. Must never decrease. */
  verifiedReceipts: number;
  /**
   * A stable digest of the task's meaningful state. Two identical digests mean
   * the task is where it has already been. Callers should hash the plan, the
   * step statuses and the pending queue — never a timestamp, or every state
   * looks new and cycles become undetectable.
   */
  stateDigest: string;
  /** Milliseconds since the task started, supplied by the caller. */
  elapsedMs: number;
}

export interface ProgressLimits {
  /** Iterations allowed with no observable progress before halting. */
  maxStalledIterations: number;
  /** Hard ceiling on total iterations. */
  maxIterations: number;
  /** Wall-clock ceiling for the whole task. */
  maxElapsedMs: number;
  /**
   * How many times a state digest may be seen before it counts as a cycle.
   * 2 means "seeing the same state twice is a cycle".
   */
  maxRepeatsOfState: number;
}

export const DEFAULT_PROGRESS_LIMITS: ProgressLimits = {
  maxStalledIterations: 5,
  maxIterations: 200,
  maxElapsedMs: 4 * 60 * 60 * 1000, // four hours
  maxRepeatsOfState: 2,
};

export type ProgressVerdict =
  | { readonly action: "continue"; readonly stalledIterations: number }
  | { readonly action: "warn"; readonly reason: string; readonly stalledIterations: number }
  | { readonly action: "halt"; readonly reason: string; readonly cause: HaltCause };

export type HaltCause =
  "no_progress" | "cycle_detected" | "iteration_limit" | "time_limit" | "inconsistent_observation";

export interface ProgressState {
  readonly limits: ProgressLimits;
  lastIteration: number;
  lastProgressSignal: number;
  stalledIterations: number;
  readonly seenStates: Map<string, number>;
  halted: HaltCause | null;
}

export function createProgressState(
  limits: ProgressLimits = DEFAULT_PROGRESS_LIMITS,
): ProgressState {
  return {
    limits,
    lastIteration: 0,
    lastProgressSignal: -1,
    stalledIterations: 0,
    seenStates: new Map(),
    halted: null,
  };
}

/**
 * Everything that counts as forward motion, combined into one number. It only
 * ever increases while the task is genuinely advancing, so a plateau is
 * unambiguous.
 */
function progressSignal(o: ProgressObservation): number {
  return o.completedSteps + o.producedArtifacts + o.verifiedReceipts;
}

/**
 * Judge one iteration.
 *
 * Total and deterministic: same state plus same observation always yields the
 * same verdict. Once halted it stays halted — a caller that ignores a halt and
 * asks again gets the same answer rather than a fresh licence to continue.
 */
export function checkProgress(
  state: ProgressState,
  observation: ProgressObservation,
): ProgressVerdict {
  if (state.halted) {
    return {
      action: "halt",
      cause: state.halted,
      reason: `This task was already halted (${state.halted}) and cannot resume without a new plan.`,
    };
  }

  // An observation that moves backwards means the caller is feeding us garbage
  // or replaying an old frame. Refuse rather than reason about it.
  const signal = progressSignal(observation);
  if (
    !Number.isInteger(observation.iteration) ||
    observation.iteration <= state.lastIteration ||
    observation.elapsedMs < 0 ||
    signal < state.lastProgressSignal
  ) {
    state.halted = "inconsistent_observation";
    return {
      action: "halt",
      cause: "inconsistent_observation",
      reason:
        "Progress went backwards or arrived out of order. The task is halted rather than judged on an unreliable observation.",
    };
  }

  state.lastIteration = observation.iteration;

  // 4. Wall clock first: an expired task must not be allowed one more step.
  if (observation.elapsedMs > state.limits.maxElapsedMs) {
    state.halted = "time_limit";
    return {
      action: "halt",
      cause: "time_limit",
      reason: `The task exceeded its ${Math.round(state.limits.maxElapsedMs / 60000)} minute budget. Work completed so far is kept.`,
    };
  }

  // 3. Hard iteration ceiling.
  if (observation.iteration > state.limits.maxIterations) {
    state.halted = "iteration_limit";
    return {
      action: "halt",
      cause: "iteration_limit",
      reason: `The task reached its limit of ${state.limits.maxIterations} iterations. Work completed so far is kept.`,
    };
  }

  // 2. Cycle: this exact state has been visited before.
  const repeats = (state.seenStates.get(observation.stateDigest) ?? 0) + 1;
  state.seenStates.set(observation.stateDigest, repeats);
  if (repeats > state.limits.maxRepeatsOfState) {
    state.halted = "cycle_detected";
    return {
      action: "halt",
      cause: "cycle_detected",
      reason: `The task returned to the same state ${repeats} times. Repeating it cannot produce a different outcome, so it is halted.`,
    };
  }

  // 1. Plateau: nothing completed since the last iteration.
  const advanced = signal > state.lastProgressSignal;
  state.lastProgressSignal = Math.max(signal, state.lastProgressSignal);
  if (advanced) {
    state.stalledIterations = 0;
    return { action: "continue", stalledIterations: 0 };
  }

  state.stalledIterations += 1;
  if (state.stalledIterations >= state.limits.maxStalledIterations) {
    state.halted = "no_progress";
    return {
      action: "halt",
      cause: "no_progress",
      reason: `No step completed, artifact produced or receipt verified in ${state.stalledIterations} iterations. Work completed so far is kept.`,
    };
  }

  // Warn before halting so a surface can surface the stall to the user while
  // there is still a chance it resolves.
  return {
    action: "warn",
    stalledIterations: state.stalledIterations,
    reason: `No observable progress for ${state.stalledIterations} of ${state.limits.maxStalledIterations} allowed iterations.`,
  };
}

/** Human-readable summary for a receipt or an audit line. */
export function describeHalt(cause: HaltCause): string {
  switch (cause) {
    case "no_progress":
      return "Halted: the task stopped making observable progress.";
    case "cycle_detected":
      return "Halted: the task was repeating a state it had already reached.";
    case "iteration_limit":
      return "Halted: the task hit its iteration ceiling.";
    case "time_limit":
      return "Halted: the task ran out of time.";
    case "inconsistent_observation":
      return "Halted: the task reported progress that moved backwards.";
    default:
      return "Halted.";
  }
}

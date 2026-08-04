/**
 * OCADE Universal Recovery Graph (master plan §23.6).
 *
 * "Model recovery actions before execution. Every risky step must know how to
 * cancel, undo, restore, or isolate failure."
 *
 * The failure this prevents is the one that only reveals itself after damage:
 * a step runs, goes wrong, and there is no way back because nobody worked out
 * the way back beforehand. So recovery is planned UP FRONT — before the step is
 * allowed to run — and a mutating step with no viable recovery is refused, not
 * attempted-and-hoped.
 *
 * The recovery strengths, weakest to strongest:
 *
 *  - `none`     — nothing can be done after the fact. Only acceptable for a
 *                 read: a read changes nothing, so there is nothing to recover.
 *  - `cancel`   — the step can be stopped before completion, but a partial
 *                 effect may remain. Weak; acceptable only for low-risk writes.
 *  - `isolate`  — the step runs against a copy/sandbox, so failure can't touch
 *                 the real state.
 *  - `restore`  — a checkpoint was taken; the prior state can be put back.
 *  - `undo`     — a precise inverse exists (e.g. an inverse patch). Strongest,
 *                 because it reverses exactly this change and nothing else.
 *
 * THE RULE: a mutating step must carry a recovery of at least the strength its
 * risk demands. An irreversible, unverifiable mutation with only `cancel` is
 * refused — planning it as runnable would be planning a step OCADE cannot walk
 * back.
 */

export type RecoveryKind = "none" | "cancel" | "isolate" | "restore" | "undo";

/** Strength ordering. Higher is stronger. */
const STRENGTH: Record<RecoveryKind, number> = {
  none: 0,
  cancel: 1,
  isolate: 2,
  restore: 3,
  undo: 4,
};

export type RiskTier = "read" | "low" | "high" | "irreversible";

export interface RecoveryOption {
  kind: RecoveryKind;
  /** How this recovery would actually be carried out. */
  plan: string;
  /** True once the prerequisite exists (checkpoint taken, inverse computed…). */
  ready: boolean;
}

export interface StepRecovery {
  intent: string;
  risk: RiskTier;
  /** Whether the result can be checked after the fact. Weakens recovery when false. */
  verifiable: boolean;
  options: RecoveryOption[];
}

export type RecoveryOutcome =
  { ok: true; data: RecoveryVerdict; evidence: string } | { ok: false; reason: string };

export interface RecoveryVerdict {
  intent: string;
  /** The strongest READY recovery available. */
  best: RecoveryKind;
  /** The minimum strength this step's risk requires. */
  required: RecoveryKind;
  /** True when `best` meets or beats `required`. */
  safe: boolean;
  reason: string;
}

/**
 * Minimum recovery strength a risk tier demands.
 *
 * An irreversible change needs a way to put the world back (`restore`) or to
 * never have touched it (`isolate` is not enough on its own for irreversible —
 * see below). A read needs nothing.
 */
function requiredFor(risk: RiskTier, verifiable: boolean): RecoveryKind {
  switch (risk) {
    case "read":
      return "none";
    case "low":
      // A recoverable, low-risk write can rely on cancel; but if its result
      // can't even be verified, hold it to isolate so a bad write is contained.
      return verifiable ? "cancel" : "isolate";
    case "high":
      return "restore";
    case "irreversible":
      // Nothing reverses a truly irreversible act; the only safe path is to run
      // it against a copy first (isolate) AND be able to restore — modelled as
      // requiring `restore`, with isolate checked separately below.
      return "restore";
  }
}

/**
 * Decide whether a step's recovery is sufficient for its risk.
 *
 * Only READY options count: a checkpoint that was never taken is not recovery,
 * and counting it would be exactly the after-the-fact surprise this exists to
 * prevent.
 */
export function assessRecovery(step: StepRecovery): RecoveryOutcome {
  if (!step.intent.trim())
    return { ok: false, reason: "A recovery assessment needs a step intent." };

  const ready = step.options.filter((o) => o.ready);
  const best = ready.reduce<RecoveryKind>(
    (acc, o) => (STRENGTH[o.kind] > STRENGTH[acc] ? o.kind : acc),
    "none",
  );
  const required = requiredFor(step.risk, step.verifiable);
  const safe = STRENGTH[best] >= STRENGTH[required];

  // Extra guard for the worst case: an irreversible change is only safe if it
  // was ALSO isolated (run against a copy), whatever else is available.
  if (step.risk === "irreversible") {
    const isolated = ready.some((o) => o.kind === "isolate");
    const restorable = STRENGTH[best] >= STRENGTH["restore"];
    if (!isolated || !restorable) {
      return {
        ok: true,
        data: {
          intent: step.intent,
          best,
          required,
          safe: false,
          reason:
            "This step is irreversible. OCADE will only run it against a copy first (isolate) with a restore point in place. Without both, it refuses — there is no walking back an irreversible act that went straight to the real state.",
        },
        evidence: `Irreversible step “${step.intent}” is NOT cleared: isolate=${isolated}, best=${best}.`,
      };
    }
  }

  return {
    ok: true,
    data: {
      intent: step.intent,
      best,
      required,
      safe,
      reason: safe
        ? `Recoverable by ${best}, which meets the ${required} this ${step.risk} step needs.`
        : `This ${step.risk} step needs at least ${required} recovery, but the strongest ready option is ${best}. OCADE won't run a change it can't walk back.`,
    },
    evidence: safe
      ? `“${step.intent}” cleared: ${best} ≥ ${required}.`
      : `“${step.intent}” blocked: ${best} < ${required}.`,
  };
}

/**
 * Assess a whole task's recovery before any step runs.
 *
 * The task is runnable only if EVERY step is individually recoverable. One
 * unrecoverable step poisons the plan, because reaching it means the steps
 * before it already changed the world.
 */
export interface TaskRecovery {
  steps: RecoveryVerdict[];
  runnable: boolean;
  unsafe: RecoveryVerdict[];
  headline: string;
}

export function assessTaskRecovery(
  steps: StepRecovery[],
): RecoveryOutcome & { task?: TaskRecovery } {
  if (steps.length === 0) return { ok: false, reason: "There are no steps to assess." };

  const verdicts: RecoveryVerdict[] = [];
  for (const step of steps) {
    const r = assessRecovery(step);
    if (!r.ok) return r;
    verdicts.push(r.data);
  }

  const unsafe = verdicts.filter((v) => !v.safe);
  const runnable = unsafe.length === 0;

  return {
    ok: true,
    data: verdicts[0],
    task: {
      steps: verdicts,
      runnable,
      unsafe,
      headline: runnable
        ? `All ${verdicts.length} steps have a recovery path. The task can run.`
        : `${unsafe.length} of ${verdicts.length} steps can't be walked back — first: ${unsafe[0].intent}. OCADE won't start a task it can't safely abandon partway.`,
    },
    evidence: runnable
      ? `${verdicts.length} steps, all recoverable.`
      : `${unsafe.length} unrecoverable step(s); task blocked.`,
  };
}

/**
 * OCADE Confidence Governor (master plan §23.4).
 *
 * "Low-confidence actions require re-observation, a safer execution method, or
 * user approval. Never let low confidence silently proceed."
 *
 * `assessAction` already produces a confidence score and a proceed/refuse
 * boundary for the general case. This module is the part the plan asks for
 * specifically: a gate that, when confidence is short of what an action needs,
 * chooses the CHEAPEST honest remedy rather than either blocking outright or
 * waving it through.
 *
 * The ordering of remedies is the whole design, and it runs cheapest-first:
 *
 *  1. **Re-route to a safer method.** If a more reliable method than the one
 *     planned is available, use it — no human needed, and the result is more
 *     trustworthy. (Reliability = lower `methodRank`.)
 *  2. **Re-observe.** If the plan leaned on a stale or low-signal reading,
 *     look again before deciding. Free, and often enough on its own.
 *  3. **Ask the user.** Only when the machine can't raise its own confidence.
 *
 * THE RULE THAT CANNOT BE TUNED AWAY: a **mutating** action below its threshold
 * NEVER resolves to "proceed". The remedy may be re-route or re-observe, but if
 * neither is available it escalates to approval — it does not fall through to
 * proceeding. A read may proceed at lower confidence because a wrong read is
 * recoverable; a wrong write may not be.
 */
import { methodRank, type ControlMethod } from "./skill-pack";

export type Decision =
  /** Confidence suffices; go ahead. */
  | { action: "proceed"; reason: string }
  /** A more reliable method is available; use it instead. */
  | { action: "reroute"; to: ControlMethod; reason: string }
  /** Look again before deciding; the current reading isn't strong enough. */
  | { action: "reobserve"; reason: string }
  /** The machine can't raise its own confidence; the user must approve. */
  | { action: "require_approval"; reason: string }
  /** Even approval can't help (e.g. no method at all). */
  | { action: "refuse"; reason: string };

export interface GovernInput {
  /** 0–1 confidence in the planned step. */
  confidence: number;
  /** True when the action changes user data or state. */
  mutating: boolean;
  /** How the result would be verified. "none" means it can't be checked after. */
  verifyBy: "file" | "ui" | "log" | "api" | "none";
  /** The method the plan chose. */
  plannedMethod: ControlMethod;
  /** Every method available right now, including the planned one. */
  availableMethods: ControlMethod[];
  /** Whether the reading behind the plan could be refreshed cheaply. */
  canReobserve: boolean;
}

/**
 * Confidence a decision needs before it may proceed unaided.
 *
 * A mutation needs more than a read. An UNVERIFIABLE mutation — one with no way
 * to confirm the result afterwards — needs more still, because if the guess is
 * wrong there is no signal that will ever say so.
 */
export const READ_THRESHOLD = 0.6;
export const MUTATE_THRESHOLD = 0.75;
export const UNVERIFIABLE_MUTATE_THRESHOLD = 0.9;

export function thresholdFor(mutating: boolean, verifyBy: GovernInput["verifyBy"]): number {
  if (!mutating) return READ_THRESHOLD;
  return verifyBy === "none" ? UNVERIFIABLE_MUTATE_THRESHOLD : MUTATE_THRESHOLD;
}

/** A method strictly more reliable than the planned one, if available. */
function saferMethodThan(planned: ControlMethod, available: ControlMethod[]): ControlMethod | null {
  const plannedRank = methodRank(planned);
  const better = available
    .filter((m) => methodRank(m) < plannedRank)
    .sort((a, b) => methodRank(a) - methodRank(b));
  return better[0] ?? null;
}

/**
 * Decide what to do about a step's confidence.
 *
 * See the module header for the remedy ordering and the non-negotiable rule for
 * mutations.
 */
export function governConfidence(input: GovernInput): Decision {
  if (input.availableMethods.length === 0) {
    return { action: "refuse", reason: "No way to perform this action is available right now." };
  }
  if (!Number.isFinite(input.confidence) || input.confidence < 0 || input.confidence > 1) {
    return {
      action: "refuse",
      reason: "The confidence score is out of range, so it can't be trusted.",
    };
  }

  const threshold = thresholdFor(input.mutating, input.verifyBy);
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  if (input.confidence >= threshold) {
    return {
      action: "proceed",
      reason: `Confidence ${pct(input.confidence)} meets the ${pct(threshold)} bar for ${describeKind(input)}.`,
    };
  }

  // Below threshold. Cheapest honest remedy first.
  const safer = saferMethodThan(input.plannedMethod, input.availableMethods);
  if (safer) {
    return {
      action: "reroute",
      to: safer,
      reason: `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar. A more reliable route (${safer}) is available, so OCADE will use that rather than guess.`,
    };
  }

  if (input.canReobserve) {
    return {
      action: "reobserve",
      reason: `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar. OCADE will look again before deciding, rather than act on a weak reading.`,
    };
  }

  // The machine can't raise its own confidence. A read may still proceed with a
  // caveat, because a wrong read is recoverable. A mutation may not — it must
  // be approved, never silently attempted.
  if (!input.mutating) {
    return {
      action: "proceed",
      reason: `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar, but this only reads — OCADE will proceed and flag the result as low-confidence rather than block a recoverable action.`,
    };
  }

  return {
    action: "require_approval",
    reason:
      input.verifyBy === "none"
        ? `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar, this changes state, and there's no way to verify the result afterwards. OCADE won't attempt it without your approval.`
        : `Confidence ${pct(input.confidence)} is below the ${pct(threshold)} bar for a change OCADE can't make more reliably on its own. It needs your approval before proceeding.`,
  };
}

function describeKind(input: GovernInput): string {
  if (!input.mutating) return "a read";
  return input.verifyBy === "none" ? "an unverifiable change" : "a change";
}

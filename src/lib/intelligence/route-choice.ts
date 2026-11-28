/**
 * ELITE-03 / OWNER-07: choose among models by measured cost per verified task.
 *
 * Candidates carry held-out measurements per task family. A model is eligible
 * only when it is qualified for the family, comes from the SAME source as the
 * person's choice (a BYOK key is never swapped for an OCADE model, or the other
 * way round), meets the capability and context needs and stays within the risk
 * ceiling. Among eligible models the cheapest cost per verified task wins; a
 * tie goes to lower latency, then to the id. With no eligible model the answer
 * is a refusal with a reason, never a silent fallback.
 */
export type ModelSource = "byok" | "ocade";

export interface Measurement {
  /** Fraction of held-out tasks verified, 0..1, from at least `MIN_SAMPLES` runs. */
  successRate: number;
  samples: number;
  /** Mean cost of one attempt, minor units. */
  costPerAttempt: number;
  p50LatencyMs: number;
}

export interface Candidate {
  id: string;
  source: ModelSource;
  qualified: boolean;
  contextTokens: number;
  tools: boolean;
  risk: number;
  families: Readonly<Record<string, Measurement>>;
}

export interface Need {
  family: string;
  source: ModelSource;
  contextTokens: number;
  tools: boolean;
  maxRisk: number;
  minSuccessRate: number;
}

export const MIN_SAMPLES = 30;

export type Choice =
  { ok: true; id: string; costPerVerified: number } | { ok: false; reason: string };

export function costPerVerified(m: Measurement): number {
  return m.successRate > 0 ? m.costPerAttempt / m.successRate : Number.POSITIVE_INFINITY;
}

export function chooseModel(candidates: readonly Candidate[], need: Need): Choice {
  const sameSource = candidates.filter((c) => c.source === need.source);
  if (!sameSource.length) return { ok: false, reason: "no_model_from_this_source" };
  const eligible = sameSource.flatMap((c) => {
    const m = c.families[need.family];
    if (
      !c.qualified ||
      !m ||
      m.samples < MIN_SAMPLES ||
      m.successRate < need.minSuccessRate ||
      c.contextTokens < need.contextTokens ||
      (need.tools && !c.tools) ||
      c.risk > need.maxRisk
    )
      return [];
    return [{ c, m, cost: costPerVerified(m) }];
  });
  if (!eligible.length) return { ok: false, reason: "no_qualified_model_for_this_task" };
  eligible.sort(
    (a, b) =>
      a.cost - b.cost || a.m.p50LatencyMs - b.m.p50LatencyMs || a.c.id.localeCompare(b.c.id),
  );
  const best = eligible[0]!;
  return { ok: true, id: best.c.id, costPerVerified: best.cost };
}

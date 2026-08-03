/**
 * OCADE local-model routing policy and model-choice receipts (P06).
 *
 * Selection until now was heuristic: profile match, then prefer the largest
 * (or smallest for "fast"). Size is a proxy for capability, not a measurement
 * of it — and P04 already showed where proxies lead, when "largest" returned a
 * model that could not load at all.
 *
 * This module routes on what was actually OBSERVED: recorded latency and
 * success rate per model per task, combined with explicit policy (context
 * limit, latency budget, privacy, cost). Every choice emits a RECEIPT saying
 * which model was chosen, which were rejected, and why — so a surprising route
 * can be explained after the fact instead of guessed at.
 *
 * Two deliberate refusals:
 *
 * 1. **No measurements is not the same as bad measurements.** An unmeasured
 *    model is routed on its declared profile and the receipt says the choice
 *    was unmeasured. It is never scored 0 and buried.
 * 2. **Deterministic work never routes to a model** (P06.S02). `routeTask`
 *    rejects task kinds that must be executed by a tool, so a model can never
 *    be handed work whose correctness is not a matter of opinion.
 */
import type { LocalModelInfo } from "../ocade-local";
import { modelFit } from "../ocade-local";
// Shared with the tier policy on purpose. Two copies of "which tags need a GPU"
// is precisely how the router and the tier policy came to choose different
// models for the same machine.
import { GPU_REQUIRED_TAGS, QUARANTINED_TAGS } from "./tier-policy";

export type TaskKind = "code" | "general" | "vision" | "summarise" | "embed";

/**
 * Work that must be executed deterministically, never generated. Routing one of
 * these to a language model is a category error: the answer is checkable, so
 * guessing it is strictly worse than computing it.
 */
export const DETERMINISTIC_TASKS = [
  "file_write",
  "shell",
  "http_request",
  "arithmetic",
  "checksum",
  "sql",
] as const;
export type DeterministicTask = (typeof DETERMINISTIC_TASKS)[number];

export interface PerfSample {
  modelId: string;
  task: TaskKind;
  /** Time to first token, the number a user actually feels. */
  firstTokenMs: number;
  totalMs: number;
  ok: boolean;
}

export interface PerfStats {
  samples: number;
  medianFirstTokenMs: number;
  successRate: number;
}

/**
 * Rolling per-model, per-task performance record.
 *
 * Bounded on purpose: a session that never forgets would let a model's first
 * cold-start minute outweigh an hour of warm performance.
 */
export class PerfLedger {
  private readonly byKey = new Map<string, PerfSample[]>();

  constructor(private readonly keep = 20) {}

  private static key(modelId: string, task: TaskKind) {
    return `${modelId}::${task}`;
  }

  record(sample: PerfSample): void {
    const k = PerfLedger.key(sample.modelId, sample.task);
    const list = this.byKey.get(k) ?? [];
    list.push(sample);
    if (list.length > this.keep) list.splice(0, list.length - this.keep);
    this.byKey.set(k, list);
  }

  /** Null when this model has never been measured on this task. */
  stats(modelId: string, task: TaskKind): PerfStats | null {
    const list = this.byKey.get(PerfLedger.key(modelId, task));
    if (!list || list.length === 0) return null;
    const oks = list.filter((s) => s.ok);
    const times = oks.map((s) => s.firstTokenMs).sort((a, b) => a - b);
    const median =
      times.length === 0 ? Number.POSITIVE_INFINITY : times[Math.floor(times.length / 2)];
    return {
      samples: list.length,
      medianFirstTokenMs: median,
      successRate: list.length === 0 ? 0 : oks.length / list.length,
    };
  }

  snapshot(): Record<string, PerfStats> {
    const out: Record<string, PerfStats> = {};
    for (const k of this.byKey.keys()) {
      const [modelId, task] = k.split("::") as [string, TaskKind];
      const s = this.stats(modelId, task);
      if (s) out[k] = s;
    }
    return out;
  }
}

export interface RoutePolicy {
  /** Reject a model whose measured first token exceeds this. */
  latencyBudgetMs?: number;
  /** Reject a model whose measured success rate is below this (0–1). */
  minSuccessRate?: number;
  /** Total RAM, so an unrunnable model is excluded before anything else. */
  totalRamBytes?: number;
  /** When true, cloud is not an option at all and refusal is local-only. */
  privateOnly?: boolean;
  /**
   * Whether this machine has real graphics acceleration.
   *
   * Fitting in RAM is not the same as being usable. Some tiers are measured at
   * under half the speed of a smaller model without a GPU — they do not fail,
   * they degrade silently, which is worse for a user because nothing announces
   * it. Pass `false` to exclude them; omit it only when the answer is genuinely
   * unknown, which leaves them in play.
   */
  hasDiscreteGpu?: boolean;
  /**
   * The tier the hardware policy selected for this device, when it is known.
   *
   * Without this the router and `selectTier` disagreed: on a 16 GB CPU-only
   * machine the tier policy chose the 8B tier while the router chose the 14B
   * one purely because it also fitted in memory — the user got 50-128 s
   * replies from a machine that answers in seconds. When the device-matched
   * model is installed and suitable, it wins.
   */
  deviceMatchedModelId?: string | null;
}

export interface RejectedCandidate {
  modelId: string;
  why: string;
}

export interface RouteReceipt {
  task: TaskKind;
  chosen: string | null;
  /**
   * How the winner was chosen: from real measurements, because it is the tier
   * this hardware was matched to, from declared profile only, or not at all.
   */
  basis: "measured" | "device_matched" | "unmeasured" | "none";
  rejected: RejectedCandidate[];
  /** Present when nothing could be chosen. */
  refusal?: string;
  policy: RoutePolicy;
  at: string;
}

/** Task kinds a code-profile model serves well, in preference order. */
function profilePreference(task: TaskKind): LocalModelInfo["profile"][] {
  switch (task) {
    case "code":
      return ["code", "general"];
    case "vision":
      return ["vision"];
    case "summarise":
      return ["general", "fast", "code"];
    case "embed":
      return ["fast", "general"];
    case "general":
    default:
      return ["general", "code", "fast"];
  }
}

export type RouteOutcome =
  { ok: true; model: LocalModelInfo; receipt: RouteReceipt } | { ok: false; receipt: RouteReceipt };

/**
 * Refuse deterministic work outright (P06.S02).
 *
 * Exported separately so callers can check before they even build a prompt.
 */
export function isDeterministic(task: string): task is DeterministicTask {
  return (DETERMINISTIC_TASKS as readonly string[]).includes(task);
}

/**
 * Choose a local model for a task, on measurements where they exist.
 *
 * Order: exclude what cannot run → exclude what policy forbids → prefer the
 * fastest MEASURED model that meets the budget → otherwise the best-profile
 * unmeasured model. Every exclusion is recorded with its reason.
 */
export function routeTask(
  task: TaskKind,
  models: LocalModelInfo[],
  ledger: PerfLedger,
  policy: RoutePolicy = {},
): RouteOutcome {
  const at = new Date().toISOString();
  const rejected: RejectedCandidate[] = [];
  let pool = models;

  // 1. Hardware. A model that cannot be resident is not a candidate at all.
  if (policy.totalRamBytes !== undefined) {
    const next: LocalModelInfo[] = [];
    for (const m of pool) {
      const fit = modelFit(m, policy.totalRamBytes);
      if (fit.fits) next.push(m);
      else rejected.push({ modelId: m.id, why: fit.reason ?? "does not fit in memory" });
    }
    pool = next;
  }

  /*
   * 1b. Usability on THIS machine, not merely residency.
   *
   * Shares its source of truth with `tier-policy.ts` rather than keeping a
   * second list: two copies of "which models need a GPU" is how the router and
   * the tier policy came to disagree in the first place.
   */
  {
    const next: LocalModelInfo[] = [];
    for (const m of pool) {
      const quarantine = QUARANTINED_TAGS[m.id];
      if (quarantine) {
        rejected.push({ modelId: m.id, why: quarantine });
        continue;
      }
      if (GPU_REQUIRED_TAGS.has(m.id) && policy.hasDiscreteGpu === false) {
        rejected.push({
          modelId: m.id,
          why: "needs a dedicated graphics card; without one it is measurably slower than a smaller model",
        });
        continue;
      }
      next.push(m);
    }
    pool = next;
  }

  // 2. Profile suitability.
  const prefs = profilePreference(task);
  const suitable = pool.filter((m) => prefs.includes(m.profile));
  for (const m of pool) {
    if (!suitable.includes(m)) {
      rejected.push({ modelId: m.id, why: `profile "${m.profile}" is not suitable for ${task}` });
    }
  }
  pool = suitable;

  // 3. Measured policy. Only models WITH measurements can fail these.
  const measured: Array<{ m: LocalModelInfo; s: PerfStats }> = [];
  const unmeasured: LocalModelInfo[] = [];
  for (const m of pool) {
    const s = ledger.stats(m.id, task);
    if (!s) {
      unmeasured.push(m);
      continue;
    }
    if (policy.minSuccessRate !== undefined && s.successRate < policy.minSuccessRate) {
      rejected.push({
        modelId: m.id,
        why: `measured success rate ${(s.successRate * 100).toFixed(0)}% is below the required ${(policy.minSuccessRate * 100).toFixed(0)}%`,
      });
      continue;
    }
    if (policy.latencyBudgetMs !== undefined && s.medianFirstTokenMs > policy.latencyBudgetMs) {
      rejected.push({
        modelId: m.id,
        why: `measured first token ${Math.round(s.medianFirstTokenMs)} ms exceeds the ${policy.latencyBudgetMs} ms budget`,
      });
      continue;
    }
    measured.push({ m, s });
  }

  // 4. Prefer the fastest model that has actually been measured.
  if (measured.length > 0) {
    measured.sort((a, b) => a.s.medianFirstTokenMs - b.s.medianFirstTokenMs);
    return {
      ok: true,
      model: measured[0].m,
      receipt: { task, chosen: measured[0].m.id, basis: "measured", rejected, policy, at },
    };
  }

  // 5. Nothing measured. Fall back to declared profile order, and SAY that the
  //    choice was unmeasured rather than implying it was earned.
  if (unmeasured.length > 0) {
    /*
     * The device-matched tier wins outright when it survived every filter
     * above. "Largest that fits" is the right instinct on a machine with
     * acceleration and the wrong one without it, and the hardware policy has
     * already done that reasoning against benchmarks.
     */
    const deviceMatched = policy.deviceMatchedModelId
      ? unmeasured.find((m) => m.id === policy.deviceMatchedModelId)
      : undefined;
    if (deviceMatched) {
      return {
        ok: true,
        model: deviceMatched,
        receipt: { task, chosen: deviceMatched.id, basis: "device_matched", rejected, policy, at },
      };
    }
    const byPref = [...unmeasured].sort(
      (a, b) => prefs.indexOf(a.profile) - prefs.indexOf(b.profile) || b.sizeBytes - a.sizeBytes,
    );
    return {
      ok: true,
      model: byPref[0],
      receipt: { task, chosen: byPref[0].id, basis: "unmeasured", rejected, policy, at },
    };
  }

  return {
    ok: false,
    receipt: {
      task,
      chosen: null,
      basis: "none",
      rejected,
      refusal:
        rejected.length > 0
          ? `No on-device engine can serve ${task}: ${rejected[0].why}.`
          : `No on-device engine is installed for ${task}.`,
      policy,
      at,
    },
  };
}

/**
 * Pick a replacement after the routed model fails mid-task (P06.S04 hot-swap).
 *
 * The failure is recorded first, so the same model is not immediately chosen
 * again — a swap that reselects the thing that just failed is not a swap.
 */
export function hotSwap(
  task: TaskKind,
  models: LocalModelInfo[],
  ledger: PerfLedger,
  failedModelId: string,
  policy: RoutePolicy = {},
): RouteOutcome {
  ledger.record({
    modelId: failedModelId,
    task,
    firstTokenMs: Number.MAX_SAFE_INTEGER,
    totalMs: 0,
    ok: false,
  });
  const remaining = models.filter((m) => m.id !== failedModelId);
  const outcome = routeTask(task, remaining, ledger, policy);
  outcome.receipt.rejected.unshift({
    modelId: failedModelId,
    why: "failed during this task and was swapped out",
  });
  return outcome;
}

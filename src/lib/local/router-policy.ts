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
import { detectPlatform, selectFixedModel } from "./fixed-model";
// Shared with the tier policy on purpose. Two copies of "which tags need a GPU"
// is precisely how the router and the tier policy came to choose different
// models for the same machine.

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
 * Which local model serves a task.
 *
 * WHAT THIS USED TO DO, AND WHY IT NO LONGER DOES IT
 * ---------------------------------------------------
 * It chose. It filtered candidates by total RAM, excluded tiers without a
 * discrete GPU, consulted a quarantine list, preferred a "profile" per task
 * kind, and finally ranked whatever survived by measured first-token latency.
 * Five inputs, and every one of them a proxy for a question nobody asked.
 *
 * It also disagreed with the tier policy about the same machine — the two lists
 * of "which models need a GPU" were kept in different files — and it is how a
 * Qwen3 build ended up serving Control + Work whose `/no_think` control token
 * leaked into a tool argument.
 *
 * OCADE HAS ONE MODEL. `local/fixed-model.ts` names it, and this function now
 * asks that authority instead of re-deriving an answer. It keeps its signature
 * and its receipt so every existing caller and every diagnostics screen keeps
 * working, and the receipt now tells the truth about how the decision was made:
 * `device_matched` is gone, because nothing is matched to a device any more.
 *
 * The ONE branch that remains is capability, not preference: a request carrying
 * an image needs a model that can read images, and the fixed model cannot.
 */
export function routeTask(
  task: TaskKind,
  models: LocalModelInfo[],
  _ledger: PerfLedger,
  policy: RoutePolicy = {},
): RouteOutcome {
  const at = new Date().toISOString();
  const usable = models.filter((m) => !m.isCloudPointer);

  const choice = selectFixedModel({
    platform: detectPlatform(),
    installed: usable.map((m) => ({
      id: m.id,
      vision: m.vision,
      sizeBytes: m.sizeBytes,
      isCloudPointer: m.isCloudPointer,
    })),
    visionRequired: task === "vision",
  });

  const rejected: RejectedCandidate[] = choice.notChosen.map((row) => ({
    modelId: row.modelId,
    why: row.why,
  }));

  if (!choice.ok || !choice.modelId) {
    return {
      ok: false,
      receipt: { task, chosen: null, basis: "none", rejected, refusal: choice.reason, policy, at },
    };
  }

  const model = usable.find((m) => m.id === choice.modelId);
  if (!model) {
    return {
      ok: false,
      receipt: {
        task,
        chosen: null,
        basis: "none",
        rejected,
        refusal: choice.reason ?? "OCADE's engine is not installed on this computer yet.",
        policy,
        at,
      },
    };
  }

  return {
    ok: true,
    model,
    receipt: { task, chosen: model.id, basis: "unmeasured", rejected, policy, at },
  };
}

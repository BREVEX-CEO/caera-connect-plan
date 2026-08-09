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
// The single authority on which engine answers. `modelFit`, `GPU_REQUIRED_TAGS`
// and `QUARANTINED_TAGS` are deliberately no longer imported: they existed to
// choose BETWEEN model sizes from hardware, and that decision no longer exists.
import { detectPlatform, selectFixedModel } from "./fixed-model";

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
  /**
   * How the engine was chosen.
   *
   * `measured`, `device_matched` and `unmeasured` are gone with the hardware
   * selection that produced them. What remains describes the only two things
   * that now decide: the platform's fixed engine, or a capability substitution
   * because the request carried an image.
   */
  basis: "fixed" | "vision_capability" | "none";
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
 * Choose the local model for a task.
 *
 * THIS NO LONGER INSPECTS THE MACHINE.
 *
 * It used to: memory was filtered on `totalRamBytes`, tiers needing a GPU were
 * excluded on `hasDiscreteGpu`, a quarantine list removed known-slow tags, and
 * the winner was the fastest MEASURED model in a rolling performance ledger,
 * with a "device-matched tier" as a tiebreak. Five inputs, four of them proxies
 * for a question nobody asked, and the file's own comments record them
 * disagreeing about the same computer.
 *
 * The rule now: PLATFORM DECIDES, AND NOTHING ELSE DOES. `local/fixed-model`
 * owns it — Qwen3 8B on desktop, Qwen3 1.7B on mobile — and this function is
 * the adapter that keeps the existing callers and their receipts working.
 *
 * WHAT SURVIVES, AND WHY IT IS NOT SELECTION:
 *   - `PerfLedger` still records how long a model took. Measuring is not
 *     choosing; the numbers are for diagnostics and the performance report,
 *     and nothing reads them to pick an engine.
 *   - Vision still branches, because it is a CAPABILITY requirement. An image
 *     needs an engine that can read images, and the fixed model cannot.
 *   - Deterministic work is still refused outright.
 *
 * `RoutePolicy`'s hardware fields are accepted and ignored, so the eleven call
 * sites keep compiling while they are simplified one at a time. They are marked
 * deprecated rather than deleted in one sweep, because silently changing eleven
 * behaviours at once is how a regression arrives without a name.
 */
export function routeTask(
  task: TaskKind,
  models: LocalModelInfo[],
  _ledger: PerfLedger,
  policy: RoutePolicy = {},
): RouteOutcome {
  const at = new Date().toISOString();

  if (isDeterministic(task as string)) {
    return {
      ok: false,
      receipt: {
        task,
        chosen: null,
        basis: "none",
        rejected: [],
        refusal: `${task} is deterministic work and must be executed by a tool, never generated.`,
        policy,
        at,
      },
    };
  }

  const selection = selectFixedModel({
    platform: detectPlatform(),
    installed: models.map((model) => ({
      id: model.id,
      vision: model.vision,
      sizeBytes: model.sizeBytes,
      isCloudPointer: model.isCloudPointer,
    })),
    visionRequired: task === "vision",
  });

  const rejected: RejectedCandidate[] = selection.notChosen.map((entry) => ({
    modelId: entry.modelId,
    why: entry.why,
  }));

  if (!selection.ok || !selection.modelId) {
    return {
      ok: false,
      receipt: {
        task,
        chosen: null,
        basis: "none",
        rejected,
        refusal: selection.reason ?? `No on-device engine is installed for ${task}.`,
        policy,
        at,
      },
    };
  }

  const chosen = models.find((model) => model.id === selection.modelId);
  if (!chosen) {
    return {
      ok: false,
      receipt: {
        task,
        chosen: null,
        basis: "none",
        rejected,
        refusal: selection.reason ?? `No on-device engine is installed for ${task}.`,
        policy,
        at,
      },
    };
  }

  return {
    ok: true,
    model: chosen,
    receipt: {
      task,
      chosen: chosen.id,
      // "fixed" everywhere except the one capability substitution, so a
      // receipt can never imply a measurement that no longer happens.
      basis: selection.basis === "fixed_vision_substitute" ? "vision_capability" : "fixed",
      rejected,
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

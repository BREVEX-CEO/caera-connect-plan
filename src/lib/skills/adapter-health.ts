/**
 * Adapter health, resumable jobs and resource limits.
 *
 * Speed here comes from not repeating work: a job that fails at step 7 of 10
 * resumes at step 7, and an adapter that is currently failing is skipped in
 * favour of a slower route that works rather than retried into the ground.
 *
 * The constraint that shapes it: speed must never cost verification. A resumed
 * job re-checks the state it depends on before continuing, because the world
 * may have moved while it was stopped — resuming blind is how an automation
 * writes over something a human changed in the meantime.
 */
import type { ControlMethod } from "./skill-pack";

/* -------------------------------------------------------------- health -- */

export type HealthState = "healthy" | "degraded" | "failing" | "unknown";

export interface AdapterHealth {
  method: ControlMethod;
  state: HealthState;
  /** Consecutive failures. Reset by any success. */
  consecutiveFailures: number;
  lastLatencyMs: number | null;
  lastCheckedAt: number | null;
  reason?: string;
}

/** Two consecutive failures is enough to route around an adapter. */
export const FAILING_THRESHOLD = 2;
/** Above this, an adapter still works but is slowing the task down. */
export const SLOW_LATENCY_MS = 2_000;

export function initialHealth(method: ControlMethod): AdapterHealth {
  return {
    method,
    state: "unknown",
    consecutiveFailures: 0,
    lastLatencyMs: null,
    lastCheckedAt: null,
  };
}

/**
 * Fold one observation into an adapter's health.
 *
 * A single success clears the failure count outright: adapters commonly fail
 * for transient reasons (an app still launching), and holding a grudge would
 * push OCADE onto the vision fallback long after the good route recovered.
 */
export function recordOutcome(
  health: AdapterHealth,
  outcome: { ok: boolean; latencyMs?: number; reason?: string; at?: number },
): AdapterHealth {
  const at = outcome.at ?? Date.now();
  if (outcome.ok) {
    const slow = (outcome.latencyMs ?? 0) > SLOW_LATENCY_MS;
    return {
      ...health,
      state: slow ? "degraded" : "healthy",
      consecutiveFailures: 0,
      lastLatencyMs: outcome.latencyMs ?? null,
      lastCheckedAt: at,
      reason: slow ? "Working, but slower than usual." : undefined,
    };
  }
  const failures = health.consecutiveFailures + 1;
  return {
    ...health,
    state: failures >= FAILING_THRESHOLD ? "failing" : "degraded",
    consecutiveFailures: failures,
    lastLatencyMs: outcome.latencyMs ?? null,
    lastCheckedAt: at,
    reason: outcome.reason ?? "The last attempt did not succeed.",
  };
}

/** True when OCADE should stop choosing this adapter. */
export function shouldRouteAround(health: AdapterHealth): boolean {
  return health.state === "failing";
}

/**
 * Choose among candidate methods, honouring both preference and health.
 *
 * A healthy but less-preferred method beats a failing preferred one: the point
 * is to finish the task correctly, and a route that is currently broken is not
 * "more reliable" however good it is on paper.
 */
export function chooseHealthyMethod(
  candidates: ControlMethod[],
  health: Map<ControlMethod, AdapterHealth>,
  rank: (m: ControlMethod) => number,
): { method: ControlMethod | null; routedAround: ControlMethod[] } {
  const routedAround: ControlMethod[] = [];
  const usable = candidates.filter((m) => {
    const h = health.get(m);
    if (h && shouldRouteAround(h)) {
      routedAround.push(m);
      return false;
    }
    return true;
  });
  if (usable.length === 0) return { method: null, routedAround };
  return { method: [...usable].sort((a, b) => rank(a) - rank(b))[0], routedAround };
}

export function describeHealth(health: AdapterHealth): string {
  switch (health.state) {
    case "healthy":
      return health.lastLatencyMs !== null
        ? `Working normally (${health.lastLatencyMs} ms).`
        : "Working normally.";
    case "degraded":
      return health.reason ?? "Working, but not reliably.";
    case "failing":
      return `Not working — OCADE is using another route. ${health.reason ?? ""}`.trim();
    default:
      return "Not checked yet.";
  }
}

/* ---------------------------------------------------------- resumable -- */

export type JobStepStatus = "pending" | "done" | "failed" | "skipped";

export interface JobStep {
  id: string;
  summary: string;
  status: JobStepStatus;
  /** State this step assumes, re-checked before resuming. */
  precondition?: string;
}

export interface ResumableJob {
  id: string;
  steps: JobStep[];
  startedAt: number;
  updatedAt: number;
}

/** Where a job should pick up: the first step not already finished. */
export function resumePoint(job: ResumableJob): JobStep | null {
  return job.steps.find((s) => s.status === "pending" || s.status === "failed") ?? null;
}

export function jobProgress(job: ResumableJob): { done: number; total: number; complete: boolean } {
  const done = job.steps.filter((s) => s.status === "done" || s.status === "skipped").length;
  return { done, total: job.steps.length, complete: done === job.steps.length };
}

/**
 * Steps whose assumptions must be re-checked before resuming.
 *
 * The world may have moved while the job was stopped. Resuming blind is how an
 * automation overwrites something a human changed in the meantime, so every
 * remaining step with a precondition is re-verified — not just the first.
 */
export function preconditionsToRecheck(job: ResumableJob): string[] {
  const from = resumePoint(job);
  if (!from) return [];
  const idx = job.steps.indexOf(from);
  return job.steps
    .slice(idx)
    .map((s) => s.precondition)
    .filter((p): p is string => Boolean(p));
}

export function markStep(
  job: ResumableJob,
  stepId: string,
  status: JobStepStatus,
  now = Date.now(),
): ResumableJob {
  return {
    ...job,
    steps: job.steps.map((s) => (s.id === stepId ? { ...s, status } : s)),
    updatedAt: now,
  };
}

export function describeResume(job: ResumableJob): string {
  const { done, total, complete } = jobProgress(job);
  if (complete) return "This task already finished.";
  const next = resumePoint(job);
  const checks = preconditionsToRecheck(job).length;
  const base = `Resuming at step ${done + 1} of ${total}: ${next?.summary ?? "the next step"}.`;
  return checks > 0
    ? `${base} OCADE re-checks ${checks} ${checks === 1 ? "assumption" : "assumptions"} first, in case anything changed.`
    : base;
}

/* ------------------------------------------------------ resource limits -- */

export interface ResourceBudget {
  /** Hard ceiling on concurrent adapter calls. */
  maxConcurrent: number;
  /** Give up on a single step after this long. */
  stepTimeoutMs: number;
  /** Stop the whole job after this long. */
  jobTimeoutMs: number;
}

export const DEFAULT_BUDGET: ResourceBudget = {
  maxConcurrent: 2,
  stepTimeoutMs: 30_000,
  jobTimeoutMs: 10 * 60 * 1000,
};

/**
 * Predict whether a job will exceed its budget, BEFORE starting it.
 *
 * Saying "this will take about twelve minutes, which is over the limit" up
 * front is far more useful than stopping halfway through with no explanation.
 */
export function predictBudget(
  stepCount: number,
  averageStepMs: number,
  budget: ResourceBudget = DEFAULT_BUDGET,
): { withinBudget: boolean; estimateMs: number; reason: string } {
  const estimateMs = Math.ceil((stepCount * averageStepMs) / Math.max(1, budget.maxConcurrent));
  if (averageStepMs > budget.stepTimeoutMs) {
    return {
      withinBudget: false,
      estimateMs,
      reason: `Each step is expected to take longer than the ${Math.round(budget.stepTimeoutMs / 1000)}s limit for a single step.`,
    };
  }
  if (estimateMs > budget.jobTimeoutMs) {
    return {
      withinBudget: false,
      estimateMs,
      reason: `This looks like about ${Math.round(estimateMs / 60000)} minutes of work, past the ${Math.round(budget.jobTimeoutMs / 60000)}-minute limit. OCADE can do it in smaller batches.`,
    };
  }
  return {
    withinBudget: true,
    estimateMs,
    reason: `Estimated ${Math.max(1, Math.round(estimateMs / 1000))}s.`,
  };
}

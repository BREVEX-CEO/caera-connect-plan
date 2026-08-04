import { describe, it, expect } from "vitest";
import {
  initialHealth,
  recordOutcome,
  shouldRouteAround,
  chooseHealthyMethod,
  describeHealth,
  resumePoint,
  jobProgress,
  preconditionsToRecheck,
  markStep,
  describeResume,
  predictBudget,
  DEFAULT_BUDGET,
  FAILING_THRESHOLD,
  SLOW_LATENCY_MS,
  type AdapterHealth,
  type ResumableJob,
} from "../skills/adapter-health";
import { methodRank, type ControlMethod } from "../skills/skill-pack";

describe("tracking whether an adapter works", () => {
  it("starts unknown rather than assuming healthy", () => {
    expect(initialHealth("official_api").state).toBe("unknown");
  });

  it("becomes healthy after a fast success", () => {
    const h = recordOutcome(initialHealth("dom"), { ok: true, latencyMs: 40 });
    expect(h.state).toBe("healthy");
    expect(h.consecutiveFailures).toBe(0);
  });

  it("reports a slow success as degraded, not healthy", () => {
    const h = recordOutcome(initialHealth("dom"), { ok: true, latencyMs: SLOW_LATENCY_MS + 1 });
    expect(h.state).toBe("degraded");
    expect(h.reason).toMatch(/slower than usual/i);
  });

  it("needs repeated failures before declaring an adapter failing", () => {
    let h = recordOutcome(initialHealth("dom"), { ok: false });
    expect(h.state).toBe("degraded");
    expect(shouldRouteAround(h)).toBe(false);

    h = recordOutcome(h, { ok: false });
    expect(h.consecutiveFailures).toBe(FAILING_THRESHOLD);
    expect(h.state).toBe("failing");
    expect(shouldRouteAround(h)).toBe(true);
  });

  /**
   * Adapters fail for transient reasons — an app still launching. Holding a
   * grudge would strand OCADE on the vision fallback after recovery.
   */
  it("a single success clears the failure count outright", () => {
    let h = initialHealth("dom");
    h = recordOutcome(h, { ok: false });
    h = recordOutcome(h, { ok: false });
    expect(h.state).toBe("failing");

    h = recordOutcome(h, { ok: true, latencyMs: 20 });
    expect(h.state).toBe("healthy");
    expect(h.consecutiveFailures).toBe(0);
    expect(shouldRouteAround(h)).toBe(false);
  });

  it("describes each state in plain language", () => {
    const states: AdapterHealth[] = [
      recordOutcome(initialHealth("dom"), { ok: true, latencyMs: 10 }),
      recordOutcome(initialHealth("dom"), { ok: false }),
      initialHealth("dom"),
    ];
    for (const s of states) expect(describeHealth(s).length).toBeGreaterThan(5);
  });
});

/**
 * A route that is currently broken is not "more reliable" however good it is
 * on paper. Finishing the task correctly is what matters.
 */
describe("routing around a broken adapter", () => {
  function healthMap(entries: [ControlMethod, AdapterHealth][]) {
    return new Map<ControlMethod, AdapterHealth>(entries);
  }

  it("prefers the best method when everything is healthy", () => {
    const r = chooseHealthyMethod(["vision_input", "official_api"], healthMap([]), methodRank);
    expect(r.method).toBe("official_api");
    expect(r.routedAround).toEqual([]);
  });

  it("falls back to a healthy slower method when the best one is failing", () => {
    let bad = initialHealth("official_api");
    bad = recordOutcome(bad, { ok: false });
    bad = recordOutcome(bad, { ok: false });

    const r = chooseHealthyMethod(
      ["official_api", "accessibility"],
      healthMap([["official_api", bad]]),
      methodRank,
    );
    expect(r.method).toBe("accessibility");
    expect(r.routedAround).toEqual(["official_api"]);
  });

  it("returns null rather than using a method it knows is broken", () => {
    let bad = initialHealth("dom");
    bad = recordOutcome(bad, { ok: false });
    bad = recordOutcome(bad, { ok: false });
    const r = chooseHealthyMethod(["dom"], healthMap([["dom", bad]]), methodRank);
    expect(r.method).toBeNull();
    expect(r.routedAround).toEqual(["dom"]);
  });

  it("a merely degraded adapter is still used", () => {
    const slow = recordOutcome(initialHealth("official_api"), { ok: false });
    const r = chooseHealthyMethod(
      ["official_api"],
      healthMap([["official_api", slow]]),
      methodRank,
    );
    expect(r.method).toBe("official_api");
  });
});

describe("resuming an interrupted job", () => {
  const job = (): ResumableJob => ({
    id: "j1",
    startedAt: 0,
    updatedAt: 0,
    steps: [
      { id: "s1", summary: "Open the folder", status: "done" },
      {
        id: "s2",
        summary: "Rename invoices",
        status: "failed",
        precondition: "invoices folder still exists",
      },
      {
        id: "s3",
        summary: "Move to archive",
        status: "pending",
        precondition: "archive folder is empty",
      },
    ],
  });

  it("resumes at the first unfinished step, not from the beginning", () => {
    expect(resumePoint(job())?.id).toBe("s2");
  });

  it("reports progress honestly", () => {
    const p = jobProgress(job());
    expect(p).toEqual({ done: 1, total: 3, complete: false });
  });

  it("knows when there is nothing left to do", () => {
    let j = job();
    j = markStep(j, "s2", "done");
    j = markStep(j, "s3", "done");
    expect(resumePoint(j)).toBeNull();
    expect(jobProgress(j).complete).toBe(true);
    expect(describeResume(j)).toMatch(/already finished/i);
  });

  /**
   * The world may have moved while the job was stopped. Re-checking only the
   * first step would still let a later step overwrite a human's change.
   */
  it("re-checks EVERY remaining assumption, not just the next one", () => {
    expect(preconditionsToRecheck(job())).toEqual([
      "invoices folder still exists",
      "archive folder is empty",
    ]);
  });

  it("says where it is resuming and how many assumptions it re-checks", () => {
    const text = describeResume(job());
    expect(text).toMatch(/step 2 of 3/i);
    expect(text).toMatch(/re-checks 2 assumptions/i);
  });

  it("treats a skipped step as accounted for, not outstanding", () => {
    const j = markStep(markStep(job(), "s2", "skipped"), "s3", "skipped");
    expect(jobProgress(j).complete).toBe(true);
  });
});

/**
 * Saying "this is over the limit" before starting is far more useful than
 * stopping halfway with no explanation.
 */
describe("predicting resource use before starting", () => {
  it("accepts work that fits the budget", () => {
    const p = predictBudget(10, 500);
    expect(p.withinBudget).toBe(true);
    expect(p.reason).toMatch(/estimated/i);
  });

  it("refuses when a SINGLE step would exceed the step timeout", () => {
    const p = predictBudget(2, DEFAULT_BUDGET.stepTimeoutMs + 1);
    expect(p.withinBudget).toBe(false);
    expect(p.reason).toMatch(/single step/i);
  });

  it("refuses an over-long job and offers to batch it", () => {
    const p = predictBudget(10_000, 5_000);
    expect(p.withinBudget).toBe(false);
    expect(p.reason).toMatch(/smaller batches/i);
  });

  it("accounts for concurrency in the estimate", () => {
    const serial = predictBudget(10, 1000, { ...DEFAULT_BUDGET, maxConcurrent: 1 });
    const parallel = predictBudget(10, 1000, { ...DEFAULT_BUDGET, maxConcurrent: 5 });
    expect(parallel.estimateMs).toBeLessThan(serial.estimateMs);
  });

  it("never divides by zero on a nonsensical concurrency", () => {
    expect(() => predictBudget(4, 100, { ...DEFAULT_BUDGET, maxConcurrent: 0 })).not.toThrow();
    expect(predictBudget(4, 100, { ...DEFAULT_BUDGET, maxConcurrent: 0 }).estimateMs).toBe(400);
  });
});

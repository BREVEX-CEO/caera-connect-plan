import { describe, it, expect } from "vitest";
import {
  planRun,
  initialStatus,
  nextRunAt,
  isDue,
  decideRetry,
  applyApproval,
  canCancel,
  MAX_BACKOFF_MS,
  type Automation,
} from "../ocade-automations";

const at = (iso: string) => new Date(iso);
const T0 = at("2026-07-22T10:00:00Z");

const automation = (over: Partial<Automation> = {}): Automation => ({
  id: "a1",
  name: "Tidy windows",
  enabled: true,
  trigger: { kind: "manual" },
  actions: [{ kind: "window.arrange", layout: "left" }],
  requiresApproval: false,
  dryRun: false,
  maxAttempts: 3,
  ...over,
});

describe("planRun", () => {
  it("summarises steps and computes the highest risk", () => {
    const plan = planRun(automation({ actions: [{ kind: "screen.read" }, { kind: "app.open", appId: "notepad" }] }));
    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].summary).toMatch(/Read the visible screen/);
    expect(plan.highestRisk).toBe("confirm");
    expect(plan.blocked).toBe(false);
  });

  it("requires approval whenever any step is above low risk", () => {
    const plan = planRun(automation({ actions: [{ kind: "app.open", appId: "x" }] }));
    expect(plan.requiresApproval).toBe(true);
    expect(plan.steps[0].requiresConfirmation).toBe(true);
  });

  it("does not require approval for purely read-only/low automations", () => {
    const plan = planRun(automation({ actions: [{ kind: "screen.read" }, { kind: "window.focus", target: "a" }] }));
    expect(plan.highestRisk).toBe("low");
    expect(plan.requiresApproval).toBe(false);
  });

  it("BLOCKS an automation containing a protected-credential step", () => {
    const plan = planRun(automation({ actions: [{ kind: "text.type", text: "password hunter2" }] }));
    expect(plan.blocked).toBe(true);
    expect(plan.highestRisk).toBe("prohibited");
    expect(plan.blockedReason).toMatch(/protected information/i);
  });

  it("honours an explicit requiresApproval even for safe steps", () => {
    expect(planRun(automation({ requiresApproval: true, actions: [{ kind: "screen.read" }] })).requiresApproval).toBe(true);
  });
});

describe("initialStatus", () => {
  it("blocks a prohibited plan", () => {
    const plan = planRun(automation({ actions: [{ kind: "text.type", text: "otp 123456" }] }));
    expect(initialStatus(plan, false)).toBe("blocked");
  });
  it("a dry run succeeds without executing", () => {
    const plan = planRun(automation({ actions: [{ kind: "app.open", appId: "x" }] }));
    expect(initialStatus(plan, true)).toBe("succeeded");
  });
  it("waits for approval when required, else queues", () => {
    expect(initialStatus(planRun(automation({ actions: [{ kind: "app.open", appId: "x" }] })), false)).toBe("awaiting_approval");
    expect(initialStatus(planRun(automation({ actions: [{ kind: "screen.read" }] })), false)).toBe("pending");
  });
});

describe("scheduling", () => {
  it("manual and condition triggers are not time-scheduled", () => {
    expect(nextRunAt({ kind: "manual" }, T0)).toBeNull();
    expect(nextRunAt({ kind: "condition", expression: "x" }, T0)).toBeNull();
  });

  it("interval schedules from the last run", () => {
    const next = nextRunAt({ kind: "interval", everyMinutes: 30 }, T0, at("2026-07-22T09:45:00Z"));
    expect(next?.toISOString()).toBe("2026-07-22T10:15:00.000Z");
  });

  it("interval never returns a past time (catches up)", () => {
    const next = nextRunAt({ kind: "interval", everyMinutes: 10 }, T0, at("2026-07-22T08:00:00Z"));
    expect(next!.getTime()).toBeGreaterThan(T0.getTime());
  });

  it("daily schedules the next occurrence, rolling to tomorrow when passed", () => {
    expect(nextRunAt({ kind: "daily", atHourUtc: 14 }, T0)?.toISOString()).toBe("2026-07-22T14:00:00.000Z");
    expect(nextRunAt({ kind: "daily", atHourUtc: 9 }, T0)?.toISOString()).toBe("2026-07-23T09:00:00.000Z");
  });

  it("isDue respects the enabled flag", () => {
    const a = automation({ enabled: false, trigger: { kind: "interval", everyMinutes: 1 } });
    expect(isDue(a, T0, at("2026-07-22T09:00:00Z"))).toBe(false);
  });

  it("isDue fires when the interval has elapsed", () => {
    const a = automation({ trigger: { kind: "interval", everyMinutes: 30 } });
    expect(isDue(a, T0, at("2026-07-22T09:00:00Z"))).toBe(true);
    expect(isDue(a, T0, at("2026-07-22T09:59:00Z"))).toBe(false);
  });
});

describe("retry policy", () => {
  it("never retries cancelled or blocked runs", () => {
    expect(decideRetry({ status: "cancelled", attempt: 1, maxAttempts: 3 }).retry).toBe(false);
    expect(decideRetry({ status: "blocked", attempt: 1, maxAttempts: 3 }).retry).toBe(false);
  });

  it("retries failures with exponential backoff", () => {
    const a1 = decideRetry({ status: "failed", attempt: 1, maxAttempts: 3 });
    const a2 = decideRetry({ status: "failed", attempt: 2, maxAttempts: 3 });
    expect(a1.retry).toBe(true);
    expect(a2.delayMs).toBeGreaterThan(a1.delayMs);
  });

  it("caps the backoff", () => {
    expect(decideRetry({ status: "failed", attempt: 20, maxAttempts: 99 }).delayMs).toBeLessThanOrEqual(MAX_BACKOFF_MS);
  });

  it("gives up at the attempt limit", () => {
    const d = decideRetry({ status: "failed", attempt: 3, maxAttempts: 3 });
    expect(d.retry).toBe(false);
    expect(d.reason).toMatch(/gave up/i);
  });
});

describe("approvals and cancellation", () => {
  it("approval queues the run; denial cancels it without running", () => {
    expect(applyApproval("awaiting_approval", "approved").status).toBe("pending");
    const denied = applyApproval("awaiting_approval", "denied");
    expect(denied.status).toBe("cancelled");
    expect(denied.reason).toMatch(/nothing was run/i);
  });

  it("ignores approval for a run that wasn't awaiting one", () => {
    expect(applyApproval("running", "approved").status).toBe("running");
  });

  it("allows cancellation while queued, awaiting approval or running", () => {
    expect(canCancel("pending")).toBe(true);
    expect(canCancel("awaiting_approval")).toBe(true);
    expect(canCancel("running")).toBe(true);
    expect(canCancel("succeeded")).toBe(false);
  });
});

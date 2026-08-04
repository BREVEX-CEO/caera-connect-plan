import { describe, it, expect } from "vitest";
import {
  planRun,
  initialStatus,
  nextRunAt,
  isDue,
  decideRetry,
  applyApproval,
  canCancel,
  describeRunEnqueue,
  isInFlight,
  isTerminal,
  IN_FLIGHT_STATUSES,
  MAX_BACKOFF_MS,
  type Automation,
  type RunStatus,
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
  it("blocks a real run with no steps instead of creating a permanent in-flight row", () => {
    const plan = planRun(automation({ actions: [] }));
    expect(plan.blocked).toBe(true);
    expect(plan.blockedReason).toMatch(/no steps/i);
    expect(initialStatus(plan, false)).toBe("blocked");
  });

  it("summarises steps and computes the highest risk", () => {
    const plan = planRun(
      automation({ actions: [{ kind: "screen.read" }, { kind: "app.open", appId: "notepad" }] }),
    );
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
    const plan = planRun(
      automation({ actions: [{ kind: "screen.read" }, { kind: "window.focus", target: "a" }] }),
    );
    expect(plan.highestRisk).toBe("low");
    expect(plan.requiresApproval).toBe(false);
  });

  it("BLOCKS an automation containing a protected-credential step", () => {
    const plan = planRun(
      automation({ actions: [{ kind: "text.type", text: "password hunter2" }] }),
    );
    expect(plan.blocked).toBe(true);
    expect(plan.highestRisk).toBe("prohibited");
    expect(plan.blockedReason).toMatch(/protected information/i);
  });

  it("honours an explicit requiresApproval even for safe steps", () => {
    expect(
      planRun(automation({ requiresApproval: true, actions: [{ kind: "screen.read" }] }))
        .requiresApproval,
    ).toBe(true);
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
    expect(
      initialStatus(planRun(automation({ actions: [{ kind: "app.open", appId: "x" }] })), false),
    ).toBe("awaiting_approval");
    expect(initialStatus(planRun(automation({ actions: [{ kind: "screen.read" }] })), false)).toBe(
      "pending",
    );
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
    expect(nextRunAt({ kind: "daily", atHourUtc: 14 }, T0)?.toISOString()).toBe(
      "2026-07-22T14:00:00.000Z",
    );
    expect(nextRunAt({ kind: "daily", atHourUtc: 9 }, T0)?.toISOString()).toBe(
      "2026-07-23T09:00:00.000Z",
    );
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
    expect(
      decideRetry({ status: "failed", attempt: 20, maxAttempts: 99 }).delayMs,
    ).toBeLessThanOrEqual(MAX_BACKOFF_MS);
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

describe("run enqueue notices", () => {
  it("does not describe a pending row as started or executed", () => {
    const notice = describeRunEnqueue({
      status: "pending",
      dryRun: false,
      reused: false,
      executed: false,
    });
    expect(notice.tone).toBe("info");
    expect(notice.message).toMatch(/queued/i);
    expect(notice.message).toMatch(/no action has executed/i);
    expect(notice.message).not.toMatch(/started/i);
  });

  it("explains that an in-flight row was reused", () => {
    const notice = describeRunEnqueue({
      status: "pending",
      dryRun: false,
      reused: true,
      executed: false,
    });
    expect(notice.message).toMatch(/already queued/i);
    expect(notice.message).toMatch(/no duplicate/i);
  });

  it("makes the dry-run non-execution boundary explicit", () => {
    const notice = describeRunEnqueue({
      status: "succeeded",
      dryRun: true,
      reused: false,
      executed: false,
    });
    expect(notice.tone).toBe("success");
    expect(notice.message).toMatch(/nothing was executed or changed/i);
  });

  it.each([
    ["blocked", /no action was executed/i],
    ["awaiting_approval", /before anything can be queued/i],
  ] as const)("keeps %s honest", (status, expected) => {
    const notice = describeRunEnqueue({
      status,
      dryRun: false,
      reused: false,
      executed: false,
    });
    expect(notice.message).toMatch(expected);
  });
});

/**
 * "Runs must fire and never double-start."
 *
 * A double-click, a second tab, and the 60s scheduler tick racing a manual
 * start can all try to start the same automation at once. These pin which
 * statuses still occupy an automation — the same set used by the application
 * guard in `startAutomationRun` and by the partial unique index in the
 * migration. If the three ever disagree, duplicate executions become possible.
 */
describe("in-flight accounting", () => {
  it.each(["pending", "awaiting_approval", "running", "paused"] as const)(
    "treats %s as still occupying the automation",
    (status) => {
      expect(isInFlight(status)).toBe(true);
      expect(isTerminal(status)).toBe(false);
    },
  );

  it.each(["succeeded", "failed", "cancelled", "blocked"] as const)(
    "treats %s as finished, so a new run may start",
    (status) => {
      expect(isTerminal(status)).toBe(true);
      expect(isInFlight(status)).toBe(false);
    },
  );

  it("every status is classified exactly one way", () => {
    const all: RunStatus[] = [
      "pending",
      "awaiting_approval",
      "running",
      "paused",
      "succeeded",
      "failed",
      "cancelled",
      "blocked",
    ];
    for (const s of all) expect(isInFlight(s)).toBe(!isTerminal(s));
  });

  it("the exported list matches the predicate, since SQL is written from it", () => {
    expect([...IN_FLIGHT_STATUSES].sort()).toEqual(
      ["awaiting_approval", "paused", "pending", "running"].sort(),
    );
    for (const s of IN_FLIGHT_STATUSES) expect(isInFlight(s)).toBe(true);
  });

  /**
   * A blocked run must NOT hold the automation hostage: it never executes, so
   * leaving it in flight would wedge the automation forever.
   */
  it("a blocked run does not keep the automation occupied", () => {
    expect(isInFlight("blocked")).toBe(false);
  });

  it("a cancelled run frees the automation immediately", () => {
    expect(isInFlight("cancelled")).toBe(false);
  });

  /** A dry run resolves straight to succeeded, so it never occupies anything. */
  it("a dry run is terminal on creation and cannot block a real run", () => {
    const plan = planRun(automation({ trigger: { kind: "manual" } }));
    expect(isTerminal(initialStatus(plan, true))).toBe(true);
  });
});

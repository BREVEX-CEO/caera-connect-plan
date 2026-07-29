import { describe, it, expect } from "vitest";
import {
  selectDueAutomations,
  retryReadyAt,
  describeSkip,
  DEFAULT_MAX_CONCURRENT,
  type SchedulableAutomation,
  type SchedulableRun,
} from "../ocade-scheduler";

const NOW = new Date("2026-07-23T12:00:00Z");
const PAST = "2026-07-23T11:00:00Z";
const FUTURE = "2026-07-23T13:00:00Z";

function auto(over: Partial<SchedulableAutomation> = {}): SchedulableAutomation {
  return {
    id: "a1",
    enabled: true,
    paused: false,
    maxAttempts: 3,
    nextRunAt: PAST,
    lastRunAt: null,
    ...over,
  };
}

function run(over: Partial<SchedulableRun> = {}): SchedulableRun {
  return {
    id: "r1",
    automationId: "a1",
    status: "succeeded",
    attempt: 1,
    createdAt: PAST,
    nextAttemptAt: null,
    ...over,
  };
}

describe("selectDueAutomations", () => {
  it("starts an enabled automation whose time has passed", () => {
    const d = selectDueAutomations([auto()], [], NOW);
    expect(d.due).toEqual(["a1"]);
  });

  it("never starts a disabled or paused automation", () => {
    expect(selectDueAutomations([auto({ enabled: false })], [], NOW).due).toEqual([]);
    expect(selectDueAutomations([auto({ paused: true })], [], NOW).due).toEqual([]);
    expect(selectDueAutomations([auto({ paused: true })], [], NOW).skipped[0].reason).toBe(
      "paused",
    );
  });

  it("never auto-starts a manual automation", () => {
    const d = selectDueAutomations([auto({ nextRunAt: null })], [], NOW);
    expect(d.due).toEqual([]);
    expect(d.skipped[0].reason).toBe("manual");
  });

  it("does not start something that isn't due yet", () => {
    const d = selectDueAutomations([auto({ nextRunAt: FUTURE })], [], NOW);
    expect(d.skipped[0].reason).toBe("not_due");
  });

  it("fails closed instead of treating an invalid schedule as due", () => {
    const d = selectDueAutomations([auto({ nextRunAt: "not-a-timestamp" })], [], NOW);
    expect(d.due).toEqual([]);
    expect(d.skipped[0].reason).toBe("invalid_schedule");
  });

  it("refuses an invalid scheduler clock", () => {
    expect(() => selectDueAutomations([auto()], [], new Date("invalid"))).toThrow(/valid clock/i);
  });

  it.each(["pending", "running"] as const)(
    "never starts a second run while one is %s",
    (status) => {
      const d = selectDueAutomations([auto()], [run({ status })], NOW);
      expect(d.due).toEqual([]);
      expect(d.skipped[0].reason).toBe("already_running");
    },
  );

  it("does not pile work behind a run awaiting approval", () => {
    const d = selectDueAutomations([auto()], [run({ status: "awaiting_approval" })], NOW);
    expect(d.due).toEqual([]);
    expect(d.skipped[0].reason).toBe("awaiting_approval");
  });

  it("respects backoff after a failure", () => {
    const d = selectDueAutomations(
      [auto()],
      [run({ status: "failed", attempt: 1, nextAttemptAt: FUTURE })],
      NOW,
    );
    expect(d.due).toEqual([]);
    expect(d.skipped[0].reason).toBe("backoff");
  });

  it("retries once the backoff has elapsed", () => {
    const d = selectDueAutomations(
      [auto()],
      [run({ status: "failed", attempt: 1, nextAttemptAt: PAST })],
      NOW,
    );
    expect(d.due).toEqual(["a1"]);
  });

  it("caps concurrency and explains why the rest waited", () => {
    const autos = Array.from({ length: 6 }, (_, i) => auto({ id: `a${i}` }));
    const d = selectDueAutomations(autos, [], NOW, 2);
    expect(d.due).toHaveLength(2);
    expect(d.skipped.filter((s) => s.reason === "concurrency_limit")).toHaveLength(4);
  });

  it("counts already-running work against the concurrency budget", () => {
    const autos = [auto({ id: "a1" }), auto({ id: "a2" })];
    const busy = [run({ id: "x", automationId: "other", status: "running" })];
    const d = selectDueAutomations(autos, busy, NOW, 1);
    // The budget of 1 is already spent by the in-flight run.
    expect(d.due).toEqual([]);
  });

  it("starts the most overdue automation first, not the newest", () => {
    const older = auto({ id: "old", nextRunAt: "2026-07-23T09:00:00Z" });
    const newer = auto({ id: "new", nextRunAt: "2026-07-23T11:30:00Z" });
    const d = selectDueAutomations([newer, older], [], NOW, 1);
    expect(d.due).toEqual(["old"]);
  });

  it("has a sane default concurrency", () => {
    expect(DEFAULT_MAX_CONCURRENT).toBeGreaterThan(0);
  });
});

describe("retryReadyAt", () => {
  it("schedules a retry with exponential backoff", () => {
    const r = retryReadyAt({ attempt: 1, createdAt: NOW.toISOString() }, 3);
    expect(r.retry).toBe(true);
    expect(r.readyAt!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("gives up once attempts are exhausted", () => {
    const r = retryReadyAt({ attempt: 3, createdAt: NOW.toISOString() }, 3);
    expect(r.retry).toBe(false);
    expect(r.readyAt).toBeNull();
    expect(r.reason).toMatch(/gave up/i);
  });

  it("does not invent a retry time from corrupt persisted history", () => {
    const r = retryReadyAt({ attempt: 1, createdAt: "not-a-timestamp" }, 3);
    expect(r.retry).toBe(false);
    expect(r.readyAt).toBeNull();
    expect(r.reason).toMatch(/invalid/i);
  });
});

describe("describeSkip", () => {
  it("explains every reason in plain language", () => {
    for (const reason of [
      "disabled",
      "paused",
      "manual",
      "not_due",
      "already_running",
      "awaiting_approval",
      "backoff",
      "concurrency_limit",
      "invalid_schedule",
      "invalid_run_state",
    ] as const) {
      expect(describeSkip(reason).length).toBeGreaterThan(3);
    }
  });
});

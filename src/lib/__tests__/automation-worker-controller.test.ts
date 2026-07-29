import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AutomationWorkerController,
  describeAutomationControllerState,
  type AutomationQueueSource,
  type AutomationQueueSupervisor,
} from "../automation-worker-controller";
import type { AutomationSupervisorOutcome } from "../automation-supervisor";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup(
  ids: string[] = [],
  outcome: AutomationSupervisorOutcome = { status: "not_claimed", reason: "claimed elsewhere" },
) {
  const source: AutomationQueueSource = {
    listEligibleRunIds: vi.fn(async () => ids),
  };
  const supervisor: AutomationQueueSupervisor = {
    run: vi.fn(async () => outcome),
    recoverStale: vi.fn(async () => ({
      paused: 0,
      expired: 0,
      cancelled: 0,
      failed: 0,
      requeued: 0,
    })),
  };
  const controller = new AutomationWorkerController({
    source,
    supervisor,
    now: () => new Date("2026-07-24T12:00:00.000Z"),
  });
  return { source, supervisor, controller };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("automation worker queue controller", () => {
  it("recovers stale claims before listing eligible rows", async () => {
    const order: string[] = [];
    const ctx = setup(["run-1"]);
    vi.mocked(ctx.supervisor.recoverStale).mockImplementation(async () => {
      order.push("recover");
      return { paused: 4, expired: 5, cancelled: 1, failed: 2, requeued: 3 };
    });
    vi.mocked(ctx.source.listEligibleRunIds).mockImplementation(async () => {
      order.push("list");
      return ["run-1"];
    });
    const result = await ctx.controller.tick();
    expect(order).toEqual(["recover", "list"]);
    expect(result.staleRecovery).toEqual({
      paused: 4,
      expired: 5,
      cancelled: 1,
      failed: 2,
      requeued: 3,
    });
  });

  it("does not poll, recover, or dispatch while offline", async () => {
    const ctx = setup(["run-1"]);
    const controller = new AutomationWorkerController({
      source: ctx.source,
      supervisor: ctx.supervisor,
      isOnline: () => false,
    });
    await expect(controller.tick()).resolves.toMatchObject({
      status: "offline",
      discovered: 0,
      claimed: 0,
    });
    expect(ctx.supervisor.recoverStale).not.toHaveBeenCalled();
    expect(ctx.source.listEligibleRunIds).not.toHaveBeenCalled();
    expect(ctx.supervisor.run).not.toHaveBeenCalled();
  });

  it("shares one in-progress tick instead of overlapping polls", async () => {
    const gate = deferred<string[]>();
    const ctx = setup();
    vi.mocked(ctx.source.listEligibleRunIds).mockReturnValue(gate.promise);
    const first = ctx.controller.tick();
    const second = ctx.controller.tick();
    expect(first).toBe(second);
    gate.resolve([]);
    await Promise.all([first, second]);
    expect(ctx.source.listEligibleRunIds).toHaveBeenCalledTimes(1);
  });

  it("deduplicates IDs and bounds concurrent supervisor dispatch", async () => {
    const ctx = setup(["a", "a", "b", "c", "d"]);
    let active = 0;
    let peak = 0;
    const gates = Array.from({ length: 4 }, () => deferred<AutomationSupervisorOutcome>());
    let call = 0;
    vi.mocked(ctx.supervisor.run).mockImplementation(async () => {
      const gate = gates[call++];
      active += 1;
      peak = Math.max(peak, active);
      const result = await gate.promise;
      active -= 1;
      return result;
    });
    const controller = new AutomationWorkerController({
      source: ctx.source,
      supervisor: ctx.supervisor,
      concurrency: 2,
    });
    const tick = controller.tick();
    await vi.waitFor(() => expect(ctx.supervisor.run).toHaveBeenCalledTimes(2));
    gates[0].resolve({ status: "not_claimed", reason: "other worker" });
    gates[1].resolve({ status: "not_claimed", reason: "other worker" });
    await vi.waitFor(() => expect(ctx.supervisor.run).toHaveBeenCalledTimes(4));
    gates[2].resolve({ status: "not_claimed", reason: "other worker" });
    gates[3].resolve({ status: "not_claimed", reason: "other worker" });
    await tick;
    expect(ctx.supervisor.run).toHaveBeenCalledTimes(4);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it("counts only post-claim outcomes as claimed and only verified success as succeeded", async () => {
    const outcomes: AutomationSupervisorOutcome[] = [
      { status: "idle", reason: "companion unavailable" },
      { status: "blocked", reason: "no verifier", missingVerifiers: ["window.list"] },
      { status: "not_eligible", reason: "backoff" },
      { status: "not_claimed", reason: "other worker" },
      { status: "deferred", reason: "retry", attempt: 2, nextAttemptAt: "later", receipts: [] },
      { status: "succeeded", receipts: [] },
    ];
    const ctx = setup(["a", "b", "c", "d", "e", "f"]);
    vi.mocked(ctx.supervisor.run).mockImplementation(async () => outcomes.shift()!);
    const result = await ctx.controller.tick();
    expect(result).toMatchObject({
      dispatched: 6,
      claimed: 2,
      succeeded: 1,
      deferred: 1,
      idle: 1,
      blocked: 1,
      notEligible: 1,
      notClaimed: 1,
    });
  });

  it("surfaces and redacts per-run failures without calling them claimed", async () => {
    const ctx = setup(["run-1"]);
    vi.mocked(ctx.supervisor.run).mockRejectedValue(
      new Error("token=secret-123 database unavailable"),
    );
    const result = await ctx.controller.tick();
    expect(result).toMatchObject({ status: "completed", errors: 1, claimed: 0, succeeded: 0 });
    expect(result.results[0].error).not.toContain("secret-123");
    expect(ctx.controller.getState().lastError).toMatch(/1 run dispatch/i);
  });

  it("fails closed when stale recovery or queue discovery fails", async () => {
    const ctx = setup(["run-1"]);
    vi.mocked(ctx.supervisor.recoverStale).mockRejectedValue(
      new Error("authorization=private-value"),
    );
    const result = await ctx.controller.tick();
    expect(result).toMatchObject({ status: "error", discovered: 0, claimed: 0, errors: 1 });
    expect(result.reason).not.toContain("private-value");
    expect(ctx.source.listEligibleRunIds).not.toHaveBeenCalled();
    expect(ctx.supervisor.run).not.toHaveBeenCalled();
  });

  it("passes bounded batch size and an explicit timestamp to the queue source", async () => {
    const ctx = setup([]);
    const controller = new AutomationWorkerController({
      source: ctx.source,
      supervisor: ctx.supervisor,
      maxBatch: 500,
      now: () => new Date("2026-07-24T12:34:56.000Z"),
    });
    await controller.tick();
    expect(ctx.source.listEligibleRunIds).toHaveBeenCalledWith({
      limit: 100,
      now: "2026-07-24T12:34:56.000Z",
    });
  });

  it("starts immediately and stops without scheduling another poll", async () => {
    vi.useFakeTimers();
    const ctx = setup([]);
    const controller = new AutomationWorkerController({
      source: ctx.source,
      supervisor: ctx.supervisor,
      pollIntervalMs: 1_000,
    });
    controller.start();
    await vi.runAllTicks();
    await vi.waitFor(() => expect(ctx.source.listEligibleRunIds).toHaveBeenCalledTimes(1));
    await controller.stop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(ctx.source.listEligibleRunIds).toHaveBeenCalledTimes(1);
    expect(controller.getState().lifecycle).toBe("stopped");
  });

  it("describes stopped, offline, error, polling, and idle states without success claims", () => {
    const base = { inFlight: 0, lastTickAt: null, lastError: null };
    expect(describeAutomationControllerState({ ...base, lifecycle: "stopped" })).toMatch(
      /stopped/i,
    );
    expect(describeAutomationControllerState({ ...base, lifecycle: "offline" })).toMatch(
      /remain pending/i,
    );
    expect(
      describeAutomationControllerState({
        ...base,
        lifecycle: "error",
        lastError: "database unavailable",
      }),
    ).toMatch(/database unavailable/i);
    expect(
      describeAutomationControllerState({ ...base, lifecycle: "polling", inFlight: 2 }),
    ).toMatch(/2 run/i);
    expect(describeAutomationControllerState({ ...base, lifecycle: "idle" })).toMatch(
      /waiting for eligible work/i,
    );
  });
});

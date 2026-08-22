import { describe, expect, it, vi } from "vitest";
import {
  AutomationVerifierRegistry,
  AutomationWorkerSupervisor,
  describeAutomationSupervisor,
  type AutomationSupervisorPersistence,
} from "../automation-supervisor";
import type {
  AutomationRunCompletion,
  AutomationRunRetry,
  AutomationStepReceipt,
  AutomationWorkerStore,
  ClaimedAutomationRun,
} from "../automation-worker";
import type { NativeCompanionAdapter } from "../native/companion-bridge";

const NOW = new Date("2026-07-24T12:00:00.000Z");
const steps: ClaimedAutomationRun["steps"] = [
  {
    action: { kind: "window.list" },
    risk: "read_only",
    summary: "List windows",
    requiresConfirmation: false,
  },
];

function companion(available = true): NativeCompanionAdapter {
  return {
    status: vi.fn(async () =>
      available
        ? { available: true, version: "test" }
        : { available: false, reason: "No native backend." },
    ),
    execute: vi.fn(async (_action, opts) => ({
      ok: true,
      runId: opts.runId,
      detail: "Window list returned.",
    })),
    cancel: vi.fn(async () => undefined),
    emergencyStop: vi.fn(async () => undefined),
    gestureStatus: vi.fn(async () => ({
      available: false,
      running: false,
      controlEnabled: false,
      cameraIndex: null,
      reason: "Not installed in this unit test.",
    })),
    startGestureControl: vi.fn(),
    stopGestureControl: vi.fn(),
  };
}

class Store implements AutomationWorkerStore {
  claimCalls = 0;
  receipts: AutomationStepReceipt[] = [];
  completions: AutomationRunCompletion[] = [];
  claimedSteps = steps;

  async claim(): Promise<ClaimedAutomationRun> {
    this.claimCalls++;
    return {
      id: "run-1",
      claimToken: "token-1",
      steps: this.claimedSteps,
      attempt: 1,
      maxAttempts: 1,
      nextStepIndex: 0,
      confirmed: true,
    };
  }
  watchCancellation() {
    return {
      signal: new AbortController().signal,
      reason: () => null,
      dispose: () => undefined,
    };
  }
  async heartbeat() {
    return true;
  }
  async appendReceipt(_claim: ClaimedAutomationRun, receipt: AutomationStepReceipt) {
    this.receipts.push(receipt);
    return true;
  }
  async complete(_claim: ClaimedAutomationRun, completion: AutomationRunCompletion) {
    this.completions.push(completion);
    return true;
  }
  async requeue(_claim: ClaimedAutomationRun, _retry: AutomationRunRetry) {
    return true;
  }
  async suspend() {
    return true;
  }
  async awaitApproval() {
    return true;
  }
}

function persistence(): AutomationSupervisorPersistence {
  return {
    inspectEligibleRun: vi.fn(async () => ({ id: "run-1", steps })),
    recoverStale: vi.fn(async () => ({
      paused: 0,
      expired: 0,
      cancelled: 0,
      failed: 1,
      requeued: 2,
    })),
  };
}

function registry(): AutomationVerifierRegistry {
  const result = new AutomationVerifierRegistry();
  result.register("window.list", async () => ({
    verified: true,
    evidence: "Window list independently observed.",
  }));
  return result;
}

function supervisor(
  over: {
    store?: Store;
    companion?: NativeCompanionAdapter;
    persistence?: AutomationSupervisorPersistence;
    verifiers?: AutomationVerifierRegistry;
  } = {},
) {
  const store = over.store ?? new Store();
  const native = over.companion ?? companion();
  const db = over.persistence ?? persistence();
  const verifiers = over.verifiers ?? registry();
  return {
    store,
    native,
    db,
    instance: new AutomationWorkerSupervisor({
      store,
      persistence: db,
      companion: native,
      verifiers,
      workerId: "desktop-1",
      now: () => NOW,
    }),
  };
}

describe("supervisor preflight", () => {
  it("never claims while the native companion is unavailable", async () => {
    const ctx = supervisor({ companion: companion(false) });
    const result = await ctx.instance.run("run-1");
    expect(result).toEqual({ status: "idle", reason: "No native backend." });
    expect(ctx.store.claimCalls).toBe(0);
    expect(ctx.db.inspectEligibleRun).not.toHaveBeenCalled();
  });

  it("keeps work queued when a verifier is missing", async () => {
    const ctx = supervisor({ verifiers: new AutomationVerifierRegistry() });
    const result = await ctx.instance.run("run-1");
    expect(result.status).toBe("blocked");
    expect(ctx.store.claimCalls).toBe(0);
  });

  it("does not claim an ineligible or empty run", async () => {
    const db = persistence();
    vi.mocked(db.inspectEligibleRun).mockResolvedValueOnce(null);
    const missing = supervisor({ persistence: db });
    expect((await missing.instance.run("run-1")).status).toBe("not_eligible");
    expect(missing.store.claimCalls).toBe(0);

    vi.mocked(db.inspectEligibleRun).mockResolvedValueOnce({ id: "run-1", steps: [] });
    const empty = supervisor({ persistence: db });
    expect((await empty.instance.run("run-1")).status).toBe("not_eligible");
    expect(empty.store.claimCalls).toBe(0);
  });

  it("stays idle when the status check itself fails", async () => {
    const native = companion();
    vi.mocked(native.status).mockRejectedValueOnce(new Error("IPC offline"));
    const ctx = supervisor({ companion: native });
    const result = await ctx.instance.run("run-1");
    expect(result).toEqual({
      status: "idle",
      reason: "The companion status check failed: IPC offline",
    });
    expect(ctx.store.claimCalls).toBe(0);
  });
});

describe("supervised execution", () => {
  it("executes and finalizes only with an independent verifier", async () => {
    const ctx = supervisor();
    const result = await ctx.instance.run("run-1");
    expect(result.status).toBe("succeeded");
    expect(ctx.store.claimCalls).toBe(1);
    expect(ctx.native.execute).toHaveBeenCalledTimes(1);
    expect(ctx.store.receipts[0]).toMatchObject({
      executionOk: true,
      verified: true,
      status: "succeeded",
    });
    expect(ctx.store.completions[0].status).toBe("succeeded");
  });

  it("fails rather than trusting a claim whose snapshot changed after preflight", async () => {
    const store = new Store();
    store.claimedSteps = [
      {
        action: { kind: "screen.read" },
        risk: "read_only",
        summary: "Read screen",
        requiresConfirmation: false,
      },
    ];
    const ctx = supervisor({ store });
    const result = await ctx.instance.run("run-1");
    expect(result.status).toBe("failed");
    expect(store.receipts[0]).toMatchObject({ verified: false, status: "failed" });
  });

  it("invokes stale recovery with an explicit cutoff", async () => {
    const ctx = supervisor();
    await expect(ctx.instance.recoverStale(30_000)).resolves.toEqual({
      paused: 0,
      expired: 0,
      cancelled: 0,
      failed: 1,
      requeued: 2,
    });
    expect(ctx.db.recoverStale).toHaveBeenCalledWith("2026-07-24T11:59:30.000Z");
  });
});

describe("visible worker status", () => {
  it("describes honest ready and idle states", () => {
    expect(describeAutomationSupervisor({ available: true })).toMatch(
      /successful only after every action is independently verified/i,
    );
    expect(describeAutomationSupervisor({ available: false, reason: "No native backend." })).toBe(
      "Automation worker idle: No native backend.",
    );
  });
});

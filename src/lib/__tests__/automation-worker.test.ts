import { describe, expect, it, vi } from "vitest";
import {
  decideStaleRunRecovery,
  runAutomationWorker,
  type AutomationActionExecutor,
  type AutomationActionVerifier,
  type AutomationRunCompletion,
  type AutomationRunRetry,
  type AutomationRunPause,
  type AutomationRunApprovalWait,
  type AutomationStepReceipt,
  type AutomationWorkerStore,
  type ClaimedAutomationRun,
} from "../automation-worker";

const T0 = new Date("2026-07-24T10:00:00.000Z");

function claim(over: Partial<ClaimedAutomationRun> = {}): ClaimedAutomationRun {
  return {
    id: "run-1",
    claimToken: "claim-1",
    steps: [
      {
        action: { kind: "window.list" },
        risk: "read_only",
        summary: "List open windows",
        requiresConfirmation: false,
      },
      {
        action: { kind: "window.focus", target: "Editor" },
        risk: "low",
        summary: "Focus Editor",
        requiresConfirmation: false,
      },
    ],
    attempt: 1,
    maxAttempts: 1,
    nextStepIndex: 0,
    confirmed: true,
    ...over,
  };
}

class FakeStore implements AutomationWorkerStore {
  claimed: ClaimedAutomationRun | null = claim();
  signal = new AbortController();
  cancellationReason: "requested" | "paused" | "unavailable" | null = null;
  receipts: AutomationStepReceipt[] = [];
  completions: AutomationRunCompletion[] = [];
  retries: AutomationRunRetry[] = [];
  pauses: AutomationRunPause[] = [];
  approvalWaits: AutomationRunApprovalWait[] = [];
  heartbeatOwnsClaim = true;
  appendOwnsClaim = true;
  completeOwnsClaim = true;
  disposed = false;

  async claim(): Promise<ClaimedAutomationRun | null> {
    const value = this.claimed;
    this.claimed = null;
    return value;
  }
  watchCancellation() {
    return {
      signal: this.signal.signal,
      reason: () => this.cancellationReason ?? (this.signal.signal.aborted ? "requested" : null),
      dispose: () => {
        this.disposed = true;
      },
    };
  }
  async heartbeat(): Promise<boolean> {
    return this.heartbeatOwnsClaim;
  }
  async appendReceipt(_claim: ClaimedAutomationRun, receipt: AutomationStepReceipt) {
    if (this.appendOwnsClaim) this.receipts.push(receipt);
    return this.appendOwnsClaim;
  }
  async complete(_claim: ClaimedAutomationRun, completion: AutomationRunCompletion) {
    if (this.completeOwnsClaim) this.completions.push(completion);
    return this.completeOwnsClaim;
  }
  async requeue(_claim: ClaimedAutomationRun, retry: AutomationRunRetry) {
    if (this.completeOwnsClaim) this.retries.push(retry);
    return this.completeOwnsClaim;
  }
  async suspend(_claim: ClaimedAutomationRun, pause: AutomationRunPause) {
    if (this.completeOwnsClaim) this.pauses.push(pause);
    return this.completeOwnsClaim;
  }
  async awaitApproval(_claim: ClaimedAutomationRun, wait: AutomationRunApprovalWait) {
    if (this.completeOwnsClaim) this.approvalWaits.push(wait);
    return this.completeOwnsClaim;
  }
}

function executor(): AutomationActionExecutor {
  return {
    execute: vi.fn(async (_action, opts) => ({
      ok: true,
      detail: `Executed ${opts.operationId}`,
    })),
    cancel: vi.fn(async () => undefined),
  };
}

function verifier(verified = true): AutomationActionVerifier {
  return {
    verify: vi.fn(async ({ operationId }) => ({
      verified,
      evidence: verified ? `Verified ${operationId}` : `Could not verify ${operationId}`,
    })),
  };
}

function input(store: FakeStore, exec = executor(), verify = verifier()) {
  return {
    runId: "run-1",
    workerId: "worker-1",
    store,
    executor: exec,
    verifier: verify,
    now: () => T0,
  };
}

describe("atomic ownership", () => {
  it("does nothing when another worker already owns the run", async () => {
    const store = new FakeStore();
    store.claimed = null;
    const exec = executor();
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("not_claimed");
    expect(exec.execute).not.toHaveBeenCalled();
  });

  it("stops before execution when the heartbeat loses the claim", async () => {
    const store = new FakeStore();
    store.heartbeatOwnsClaim = false;
    const exec = executor();
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("lost_claim");
    expect(exec.execute).not.toHaveBeenCalled();
    expect(store.completions).toEqual([]);
  });

  it("does not finalize after losing the claim while appending a receipt", async () => {
    const store = new FakeStore();
    store.appendOwnsClaim = false;
    const result = await runAutomationWorker(input(store));
    expect(result.status).toBe("lost_claim");
    expect(store.completions).toEqual([]);
  });
});

describe("verified execution receipts", () => {
  it("records every verified action before marking the run succeeded", async () => {
    const store = new FakeStore();
    const result = await runAutomationWorker(input(store));
    expect(result.status).toBe("succeeded");
    expect(store.receipts.map((r) => r.operationId)).toEqual(["run-1:step:0", "run-1:step:1"]);
    expect(store.receipts.every((r) => r.verified && r.status === "succeeded")).toBe(true);
    expect(store.completions).toEqual([
      { status: "succeeded", error: null, finishedAt: T0.toISOString() },
    ]);
    expect(store.disposed).toBe(true);
  });

  it("resumes after prior receipts instead of repeating confirmed effects", async () => {
    const store = new FakeStore();
    store.claimed = claim({ nextStepIndex: 1 });
    const exec = executor();
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("succeeded");
    expect(exec.execute).toHaveBeenCalledTimes(1);
    expect(store.receipts[0].stepIndex).toBe(1);
  });

  it("does not trust an executor success that verification cannot confirm", async () => {
    const store = new FakeStore();
    const result = await runAutomationWorker(input(store, executor(), verifier(false)));
    expect(result.status).toBe("failed");
    expect(store.receipts[0]).toMatchObject({
      executionOk: true,
      verified: false,
      status: "failed",
    });
    expect(store.completions[0].status).toBe("failed");
  });

  it("turns an executor exception into a failed receipt", async () => {
    const store = new FakeStore();
    const exec = executor();
    vi.mocked(exec.execute).mockRejectedValueOnce(new Error("adapter exploded"));
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("failed");
    expect(store.receipts[0].detail).toContain("adapter exploded");
  });

  it("redacts protected-looking detail before persistence", async () => {
    const store = new FakeStore();
    const exec = executor();
    vi.mocked(exec.execute).mockResolvedValueOnce({
      ok: false,
      detail: "password 123456 was rejected",
    });
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("failed");
    expect(store.receipts[0].detail).not.toContain("123456");
    expect(store.completions[0].error).not.toContain("123456");
  });

  it("rolls prepared inverses back in reverse order and verifies every rollback", async () => {
    const store = new FakeStore();
    store.claimed = claim({
      steps: [
        {
          action: { kind: "window.focus", target: "Editor" },
          risk: "low",
          summary: "Focus Editor",
          requiresConfirmation: false,
          rollbackAction: { kind: "window.focus", target: "Original" },
        },
        {
          action: { kind: "window.arrange", layout: "maximize" },
          risk: "low",
          summary: "Maximize Editor",
          requiresConfirmation: false,
          rollbackAction: { kind: "window.arrange", layout: "restore" },
        },
      ],
    });
    const operations: string[] = [];
    const exec: AutomationActionExecutor = {
      execute: vi.fn(async (_action, opts) => {
        operations.push(opts.operationId);
        return opts.operationId === "run-1:step:1"
          ? { ok: false, detail: "maximize failed" }
          : { ok: true, detail: "done" };
      }),
      cancel: vi.fn(async () => undefined),
    };
    const result = await runAutomationWorker(input(store, exec, verifier(true)));
    expect(result.status).toBe("failed");
    expect(operations).toEqual([
      "run-1:step:0",
      "run-1:step:1",
      "run-1:rollback:1",
      "run-1:rollback:0",
    ]);
    expect(store.receipts.filter((receipt) => receipt.phase === "rollback")).toHaveLength(2);
    expect(store.receipts.slice(-2).every((receipt) => receipt.verified)).toBe(true);
    expect(store.completions[0].error).toMatch(/2 prepared inverse actions/i);
  });
});

describe("retry and cancellation", () => {
  it("requeues the same run with backoff while attempts remain", async () => {
    const store = new FakeStore();
    store.claimed = claim({ attempt: 1, maxAttempts: 3 });
    const result = await runAutomationWorker(input(store, executor(), verifier(false)));
    expect(result.status).toBe("deferred");
    expect(store.retries[0]).toMatchObject({ status: "pending", attempt: 2 });
    expect(Date.parse(store.retries[0].nextAttemptAt)).toBeGreaterThan(T0.getTime());
    expect(store.completions).toEqual([]);
  });

  it("cancels before the first action when the signal is already set", async () => {
    const store = new FakeStore();
    store.signal.abort();
    const exec = executor();
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("cancelled");
    expect(exec.execute).not.toHaveBeenCalled();
    expect(exec.cancel).toHaveBeenCalledWith("run-1");
    expect(store.completions[0].status).toBe("cancelled");
  });

  it("does not mutate when cancellation arrives while the ownership heartbeat is in flight", async () => {
    const store = new FakeStore();
    store.heartbeat = vi.fn(async () => {
      store.signal.abort();
      return true;
    });
    const exec = executor();
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("cancelled");
    expect(exec.execute).not.toHaveBeenCalled();
    expect(exec.cancel).toHaveBeenCalledWith("run-1");
  });

  it("records a post-execution cancellation as ambiguous, never as no execution", async () => {
    const store = new FakeStore();
    const exec = executor();
    vi.mocked(exec.execute).mockImplementationOnce(async () => {
      store.signal.abort();
      return { ok: true, detail: "executor returned after cancellation" };
    });
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("cancelled");
    expect(store.receipts[0]).toMatchObject({
      status: "cancelled",
      executionOk: true,
      verified: false,
    });
    expect(store.receipts[0].detail).toMatch(/may have changed/i);
    expect(store.completions[0].status).toBe("cancelled");
    expect(store.completions[0].error).toMatch(/manual recovery/i);
  });

  it("does not replay an ambiguous action when cancellation monitoring disappears", async () => {
    const store = new FakeStore();
    store.claimed = claim({ attempt: 1, maxAttempts: 3 });
    const exec = executor();
    vi.mocked(exec.execute).mockImplementationOnce(async () => {
      store.cancellationReason = "unavailable";
      store.signal.abort();
      return { ok: true, detail: "the native action returned success" };
    });
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("failed");
    expect(store.retries).toEqual([]);
    expect(store.completions[0].error).toMatch(/manual recovery/i);
  });

  it("honours cancellation before trying to renew an expired approval", async () => {
    const store = new FakeStore();
    store.claimed = claim({
      approvalExpiresAt: new Date(T0.getTime() - 1).toISOString(),
      steps: [
        {
          action: { kind: "app.open", appId: "notes" },
          risk: "confirm",
          summary: "Open notes",
          requiresConfirmation: true,
        },
      ],
    });
    store.signal.abort();
    const result = await runAutomationWorker(input(store));
    expect(result.status).toBe("cancelled");
    expect(store.approvalWaits).toEqual([]);
  });

  it("fails or retries when cancellation monitoring is lost", async () => {
    const store = new FakeStore();
    store.claimed = claim({ maxAttempts: 1 });
    store.cancellationReason = "unavailable";
    store.signal.abort();
    const result = await runAutomationWorker(input(store));
    expect(result.status).toBe("failed");
    expect(store.completions[0].error).toMatch(/emergency brake/i);
  });

  it("pauses without a terminal receipt and resumes from the first unverified step", async () => {
    const store = new FakeStore();
    store.cancellationReason = "paused";
    store.signal.abort();
    const exec = executor();
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("paused");
    expect(exec.execute).not.toHaveBeenCalled();
    expect(store.receipts).toEqual([]);
    expect(store.completions).toEqual([]);
    expect(store.pauses[0].reason).toMatch(/first unverified step/i);
  });
});

describe("deadlines", () => {
  it("does not start an action after the persisted deadline", async () => {
    const store = new FakeStore();
    store.claimed = claim({ deadlineAt: new Date(T0.getTime() - 1).toISOString() });
    const exec = executor();
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("failed");
    expect(exec.execute).not.toHaveBeenCalled();
    expect(store.completions[0].error).toMatch(/deadline passed/i);
  });

  it("rechecks the deadline after the asynchronous heartbeat", async () => {
    const store = new FakeStore();
    store.claimed = claim({ deadlineAt: new Date(T0.getTime() + 30_000).toISOString() });
    let current = T0;
    store.heartbeat = vi.fn(async () => {
      current = new Date(T0.getTime() + 31_000);
      return true;
    });
    const exec = executor();
    const result = await runAutomationWorker({
      ...input(store, exec),
      now: () => current,
    });
    expect(result.status).toBe("failed");
    expect(exec.execute).not.toHaveBeenCalled();
  });

  it("refuses a step whose estimate cannot fit before the deadline", async () => {
    const store = new FakeStore();
    store.claimed = claim({
      deadlineAt: new Date(T0.getTime() + 10_000).toISOString(),
      steps: [
        {
          ...claim().steps[0],
          estimatedDurationMs: 15_000,
        },
      ],
    });
    const exec = executor();
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("failed");
    expect(exec.execute).not.toHaveBeenCalled();
    /*
     * The deadline check now runs through `skills/deadline` instead of a second
     * inline copy of the same rule. The refusal is unchanged — the step is not
     * started — and the reason is more specific than the old wording: it names
     * the estimate, the safety margin, the time left and the shortfall.
     */
    expect(store.completions[0].error).toMatch(/won't start work it can't finish in time/i);
    expect(store.completions[0].error).toMatch(/short by/i);
    expect(store.completions[0].error).toMatch(/margin/i);
  });
});

describe("approval expiry", () => {
  it("returns to awaiting approval before a confirm-tier mutation", async () => {
    const store = new FakeStore();
    store.claimed = claim({
      confirmed: true,
      approvalExpiresAt: new Date(T0.getTime() - 1).toISOString(),
      steps: [
        {
          action: { kind: "app.open", appId: "notes" },
          risk: "confirm",
          summary: "Open notes",
          requiresConfirmation: true,
        },
      ],
    });
    const exec = executor();
    const result = await runAutomationWorker(input(store, exec));
    expect(result.status).toBe("awaiting_approval");
    expect(exec.execute).not.toHaveBeenCalled();
    expect(store.completions).toEqual([]);
    expect(store.approvalWaits[0].reason).toMatch(/approval expired/i);
  });
});

describe("stale worker recovery", () => {
  it("ignores a fresh running heartbeat", () => {
    expect(
      decideStaleRunRecovery(
        {
          status: "running",
          attempt: 1,
          maxAttempts: 3,
          heartbeatAt: new Date(T0.getTime() - 5_000).toISOString(),
          cancelRequestedAt: null,
        },
        T0,
        30_000,
      ).action,
    ).toBe("ignore");
  });

  it("requeues a stale claim from the first unverified step", () => {
    const decision = decideStaleRunRecovery(
      {
        status: "running",
        attempt: 1,
        maxAttempts: 3,
        heartbeatAt: new Date(T0.getTime() - 60_000).toISOString(),
        cancelRequestedAt: null,
      },
      T0,
      30_000,
    );
    expect(decision.action).toBe("requeue");
    if (decision.action !== "requeue") throw new Error("unreachable");
    expect(decision.attempt).toBe(2);
    expect(Date.parse(decision.nextAttemptAt)).toBeGreaterThan(T0.getTime());
  });

  it("fails a stale claim after its retry budget is exhausted", () => {
    expect(
      decideStaleRunRecovery(
        {
          status: "running",
          attempt: 3,
          maxAttempts: 3,
          heartbeatAt: null,
          cancelRequestedAt: null,
        },
        T0,
        30_000,
      ).action,
    ).toBe("fail");
  });

  it("honours cancellation instead of retrying a lost worker", () => {
    expect(
      decideStaleRunRecovery(
        {
          status: "running",
          attempt: 1,
          maxAttempts: 3,
          heartbeatAt: null,
          cancelRequestedAt: T0.toISOString(),
        },
        T0,
        30_000,
      ).action,
    ).toBe("cancel");
  });
});

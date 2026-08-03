import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseAutomationQueueSource,
  SupabaseAutomationWorkerStore,
  type AutomationWorkerPersistenceClient,
} from "../automation-worker.supabase";
import type { ClaimedAutomationRun } from "../automation-worker";

function persistence(): AutomationWorkerPersistenceClient {
  const rpc: AutomationWorkerPersistenceClient["rpc"] = vi.fn(async () => ({
    data: true,
    error: null,
  }));
  const cancellationState: AutomationWorkerPersistenceClient["cancellationState"] = vi.fn(
    async () => "active" as const,
  );
  return {
    rpc,
    cancellationState,
  };
}

const claim: ClaimedAutomationRun = {
  id: "run-1",
  claimToken: "token-1",
  steps: [
    {
      action: { kind: "window.list" },
      risk: "read_only",
      summary: "List open windows",
      requiresConfirmation: false,
    },
  ],
  attempt: 1,
  maxAttempts: 3,
  nextStepIndex: 0,
  confirmed: true,
  deadlineAt: null,
  approvalExpiresAt: null,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("Supabase worker store", () => {
  it("maps an atomic claim row into the shared worker shape", async () => {
    const client = persistence();
    vi.mocked(client.rpc).mockResolvedValueOnce({
      data: [
        {
          id: "run-1",
          claim_token: "token-1",
          execution_steps: claim.steps,
          attempt: 1,
          max_attempts: 3,
          next_step_index: 0,
          confirmed: true,
          deadline_at: null,
          approval_expires_at: null,
        },
      ],
      error: null,
    });
    const store = new SupabaseAutomationWorkerStore(client);
    await expect(
      store.claim({ runId: "run-1", workerId: "desktop-1", now: "ignored" }),
    ).resolves.toEqual(claim);
    expect(client.rpc).toHaveBeenCalledWith("ocade_claim_automation_run", {
      p_run_id: "run-1",
      p_worker_id: "desktop-1",
    });
  });

  it("refuses a malformed claim instead of executing unvalidated steps", async () => {
    const client = persistence();
    vi.mocked(client.rpc).mockResolvedValueOnce({
      data: [
        {
          id: "run-1",
          claim_token: "token-1",
          execution_steps: [{ action: null }],
          attempt: 1,
          max_attempts: 3,
          next_step_index: 0,
          confirmed: true,
          deadline_at: null,
          approval_expires_at: null,
        },
      ],
      error: null,
    });
    const store = new SupabaseAutomationWorkerStore(client);
    await expect(
      store.claim({ runId: "run-1", workerId: "desktop-1", now: "ignored" }),
    ).rejects.toThrow(/invalid automation worker claim/i);
  });

  it("refuses forged risk and confirmation metadata from persisted steps", async () => {
    const client = persistence();
    vi.mocked(client.rpc).mockResolvedValueOnce({
      data: [
        {
          id: "run-1",
          claim_token: "token-1",
          execution_steps: [
            {
              action: { kind: "text.type", text: "hello" },
              risk: "low",
              summary: "Type approved text",
              requiresConfirmation: false,
            },
          ],
          attempt: 1,
          max_attempts: 3,
          next_step_index: 0,
          confirmed: true,
          deadline_at: null,
          approval_expires_at: null,
        },
      ],
      error: null,
    });
    const store = new SupabaseAutomationWorkerStore(client);
    await expect(
      store.claim({ runId: "run-1", workerId: "desktop-1", now: "ignored" }),
    ).rejects.toThrow(/invalid automation worker claim/i);
  });

  it("refuses prohibited text even when a row labels it as confirmed", async () => {
    const client = persistence();
    vi.mocked(client.rpc).mockResolvedValueOnce({
      data: [
        {
          id: "run-1",
          claim_token: "token-1",
          execution_steps: [
            {
              action: { kind: "text.type", text: "password 123456" },
              risk: "prohibited",
              summary: "Type text",
              requiresConfirmation: true,
            },
          ],
          attempt: 1,
          max_attempts: 3,
          next_step_index: 0,
          confirmed: true,
          deadline_at: null,
          approval_expires_at: null,
        },
      ],
      error: null,
    });
    const store = new SupabaseAutomationWorkerStore(client);
    await expect(
      store.claim({ runId: "run-1", workerId: "desktop-1", now: "ignored" }),
    ).rejects.toThrow(/invalid automation worker claim/i);
  });

  it("refuses coerced booleans and exhausted attempt metadata", async () => {
    const client = persistence();
    vi.mocked(client.rpc).mockResolvedValueOnce({
      data: [
        {
          id: "run-1",
          claim_token: "token-1",
          execution_steps: claim.steps,
          attempt: 4,
          max_attempts: 3,
          next_step_index: 0,
          confirmed: "false",
          deadline_at: null,
          approval_expires_at: null,
        },
      ],
      error: null,
    });
    const store = new SupabaseAutomationWorkerStore(client);
    await expect(
      store.claim({ runId: "run-1", workerId: "desktop-1", now: "ignored" }),
    ).rejects.toThrow(/invalid automation worker claim/i);
  });

  it("passes claim tokens to every compare-and-set mutation", async () => {
    const client = persistence();
    const store = new SupabaseAutomationWorkerStore(client);
    await store.heartbeat(claim, "ignored");
    await store.appendReceipt(claim, {
      runId: "run-1",
      stepIndex: 0,
      phase: "execute",
      operationId: "run-1:step:0",
      actionKind: "window.list",
      status: "succeeded",
      executionOk: true,
      verified: true,
      detail: "verified",
      startedAt: "2026-07-24T10:00:00.000Z",
      finishedAt: "2026-07-24T10:00:01.000Z",
    });
    await store.complete(claim, {
      status: "succeeded",
      error: null,
      finishedAt: "2026-07-24T10:00:01.000Z",
    });
    await store.requeue(claim, {
      status: "pending",
      attempt: 2,
      nextAttemptAt: "2026-07-24T10:01:00.000Z",
      error: "retry",
    });
    await store.suspend(claim, {
      reason: "Paused",
      pausedAt: "2026-07-24T10:00:02.000Z",
    });
    await store.awaitApproval(claim, {
      reason: "Approval expired",
      requestedAt: "2026-07-24T10:00:03.000Z",
    });
    for (const [, args] of vi.mocked(client.rpc).mock.calls) {
      expect(args).toMatchObject({
        p_run_id: "run-1",
        p_claim_token: "token-1",
      });
    }
  });

  it("surfaces RPC errors instead of treating them as a lost claim", async () => {
    const client = persistence();
    vi.mocked(client.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: "database unavailable" },
    });
    const store = new SupabaseAutomationWorkerStore(client);
    await expect(store.heartbeat(claim, "ignored")).rejects.toThrow(/database unavailable/i);
  });

  it("aborts when cancellation is requested", async () => {
    vi.useFakeTimers();
    const client = persistence();
    vi.mocked(client.cancellationState).mockResolvedValue("requested");
    const watch = new SupabaseAutomationWorkerStore(client, 10).watchCancellation(claim);
    await vi.advanceTimersByTimeAsync(1);
    expect(watch.signal.aborted).toBe(true);
    expect(watch.reason()).toBe("requested");
    watch.dispose();
  });

  it("aborts with a distinct pause reason", async () => {
    vi.useFakeTimers();
    const client = persistence();
    vi.mocked(client.cancellationState).mockResolvedValue("paused");
    const watch = new SupabaseAutomationWorkerStore(client, 10).watchCancellation(claim);
    await vi.advanceTimersByTimeAsync(1);
    expect(watch.signal.aborted).toBe(true);
    expect(watch.reason()).toBe("paused");
    watch.dispose();
  });

  it("fails closed when the cancellation channel is unavailable", async () => {
    vi.useFakeTimers();
    const client = persistence();
    vi.mocked(client.cancellationState).mockRejectedValue(new Error("offline"));
    const watch = new SupabaseAutomationWorkerStore(client, 10).watchCancellation(claim);
    await vi.advanceTimersByTimeAsync(1);
    expect(watch.signal.aborted).toBe(true);
    expect(watch.reason()).toBe("unavailable");
    watch.dispose();
  });

  it("treats claim loss during polling as unavailable, not user cancellation", async () => {
    vi.useFakeTimers();
    const client = persistence();
    vi.mocked(client.cancellationState).mockResolvedValue("lost_claim");
    const watch = new SupabaseAutomationWorkerStore(client, 10).watchCancellation(claim);
    await vi.advanceTimersByTimeAsync(1);
    expect(watch.signal.aborted).toBe(true);
    expect(watch.reason()).toBe("unavailable");
    watch.dispose();
  });
});

describe("Supabase automation queue source", () => {
  function queueClient(result: {
    data: Array<{ id?: unknown }> | null;
    error: { message: string } | null;
  }) {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      is: vi.fn(),
      or: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(async () => result),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.is.mockReturnValue(chain);
    chain.or.mockReturnValue(chain);
    chain.order.mockReturnValue(chain);
    return { from: vi.fn(() => chain), chain };
  }

  it("lists only bounded pending, uncancelled, due rows in creation order", async () => {
    const client = queueClient({ data: [{ id: "run-1" }, { id: 42 }], error: null });
    const source = createSupabaseAutomationQueueSource(client);
    await expect(
      source.listEligibleRunIds({
        limit: 500,
        now: "2026-07-24T12:00:00.000Z",
      }),
    ).resolves.toEqual(["run-1"]);
    expect(client.from).toHaveBeenCalledWith("ocade_automation_runs");
    expect(client.chain.eq).toHaveBeenCalledWith("status", "pending");
    expect(client.chain.is).toHaveBeenCalledWith("cancel_requested_at", null);
    expect(client.chain.or).toHaveBeenCalledWith(
      "next_attempt_at.is.null,next_attempt_at.lte.2026-07-24T12:00:00.000Z",
    );
    expect(client.chain.or).toHaveBeenCalledWith(
      "deadline_at.is.null,deadline_at.gt.2026-07-24T12:00:00.000Z",
    );
    expect(client.chain.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(client.chain.limit).toHaveBeenCalledWith(100);
  });

  it("refuses an invalid queue timestamp before querying", async () => {
    const client = queueClient({ data: [], error: null });
    const source = createSupabaseAutomationQueueSource(client);
    await expect(source.listEligibleRunIds({ limit: 20, now: "not-a-date" })).rejects.toThrow(
      /valid timestamp/i,
    );
    await expect(
      source.listEligibleRunIds({ limit: 20, now: "July 24, 2026 12:00:00 UTC" }),
    ).rejects.toThrow(/valid timestamp/i);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("surfaces database and malformed-response failures", async () => {
    const failed = createSupabaseAutomationQueueSource(
      queueClient({ data: null, error: { message: "database unavailable" } }),
    );
    await expect(
      failed.listEligibleRunIds({ limit: 20, now: "2026-07-24T12:00:00.000Z" }),
    ).rejects.toThrow(/database unavailable/i);

    const malformedClient = queueClient({ data: null, error: null });
    const malformed = createSupabaseAutomationQueueSource(malformedClient);
    await expect(
      malformed.listEligibleRunIds({ limit: 20, now: "2026-07-24T12:00:00.000Z" }),
    ).rejects.toThrow(/invalid automation queue response/i);
  });
});

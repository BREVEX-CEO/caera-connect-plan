import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BrowserWorkCheckpointStore,
  createWorkCheckpoint,
  runWorkMission,
  validateWorkGraph,
  type WorkCheckpoint,
  type WorkCheckpointStore,
  type WorkHost,
  type WorkHostObservation,
  type WorkMissionSpec,
  type WorkStep,
} from "../work/orchestrator";

const readA: WorkStep = {
  id: "read-a",
  intent: "Read source A",
  kind: "read",
  role: "researcher",
  dependsOn: [],
  estimatedMs: 20,
  maxAttempts: 2,
};

const readB: WorkStep = {
  id: "read-b",
  intent: "Read source B",
  kind: "read",
  role: "researcher",
  dependsOn: [],
  estimatedMs: 20,
  maxAttempts: 2,
};

const mutate: WorkStep = {
  id: "write-report",
  intent: "Write the verified report",
  kind: "mutation",
  role: "operator",
  dependsOn: ["read-a", "read-b"],
  estimatedMs: 30,
  maxAttempts: 2,
};

const verify: WorkStep = {
  id: "verify-report",
  intent: "Verify the report",
  kind: "read",
  role: "verifier",
  dependsOn: ["write-report"],
  estimatedMs: 10,
  maxAttempts: 1,
};

function spec(overrides: Partial<WorkMissionSpec> = {}): WorkMissionSpec {
  return {
    id: "mission-1",
    intent: "Prepare a verified report",
    initialState: "No report",
    finalState: "Verified report exists",
    steps: [readA, readB, mutate, verify],
    budget: {
      maxDurationMs: 500,
      maxParallelReads: 2,
      maxMutations: 1,
    },
    ...overrides,
  };
}

class MemoryStore implements WorkCheckpointStore {
  value: WorkCheckpoint | null = null;
  failNextWrite = false;
  writes = 0;

  async load(): Promise<WorkCheckpoint | null> {
    return this.value ? structuredClone(this.value) : null;
  }

  async save(checkpoint: WorkCheckpoint, expectedRevision: number | null): Promise<void> {
    this.writes += 1;
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("checkpoint disk unavailable");
    }
    if (expectedRevision === null) {
      if (this.value) throw new Error("create conflict");
    } else if (!this.value || this.value.revision !== expectedRevision) {
      throw new Error("revision conflict");
    }
    this.value = structuredClone(checkpoint);
  }
}

function observed(
  operationId: string,
  step: WorkStep,
  extra: Partial<WorkHostObservation> = {},
): WorkHostObservation {
  return {
    operationId,
    outcome: "succeeded",
    observed: true,
    verified: true,
    committed: step.kind === "mutation",
    evidence: `${step.id} observed and verified`,
    durationMs: step.estimatedMs,
    ...extra,
  };
}

function successfulHost(execute?: WorkHost["execute"], recover?: WorkHost["recover"]): WorkHost {
  return {
    execute:
      execute ??
      (async (step, operationId) => {
        return observed(operationId, step);
      }),
    recover: recover ?? (async () => ({ outcome: "not_found", evidence: "not found" })),
  };
}

describe("work graph validation", () => {
  it("accepts an acyclic graph and returns deterministic dependency waves", async () => {
    const result = await validateWorkGraph(spec());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.waves).toEqual([["read-a", "read-b"], ["write-report"], ["verify-report"]]);
  });

  it("refuses duplicates, unknown dependencies, and cycles", async () => {
    const duplicate = await validateWorkGraph(spec({ steps: [readA, readA] }));
    expect(duplicate.ok).toBe(false);

    const unknown = await validateWorkGraph(
      spec({ steps: [{ ...readA, dependsOn: ["missing"] }] }),
    );
    expect(unknown.ok).toBe(false);

    const cycle = await validateWorkGraph(
      spec({
        steps: [
          { ...readA, dependsOn: ["read-b"] },
          { ...readB, dependsOn: ["read-a"] },
        ],
      }),
    );
    expect(cycle.ok).toBe(false);
  });

  it("refuses a mission whose declared mutation count exceeds its budget", async () => {
    const result = await validateWorkGraph(
      spec({ budget: { maxDurationMs: 500, maxParallelReads: 2, maxMutations: 0 } }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/mutation budget/i);
  });
});

describe("dependency-safe execution", () => {
  it("runs independent reads in parallel and never overlaps them with a mutation", async () => {
    const store = new MemoryStore();
    let activeReads = 0;
    let maxReads = 0;
    let mutationSawReads = -1;
    const host = successfulHost(async (step, operationId) => {
      if (step.kind === "read") {
        activeReads += 1;
        maxReads = Math.max(maxReads, activeReads);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeReads -= 1;
      } else {
        mutationSawReads = activeReads;
      }
      return observed(operationId, step);
    });

    const result = await runWorkMission({ spec: spec(), host, store, recordReceipt: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.checkpoint.status).toBe("succeeded");
    expect(maxReads).toBe(2);
    expect(mutationSawReads).toBe(0);
    expect(result.data.ledger?.outcome).toBe("succeeded");
  });

  it("persists a pause and resumes from the next dependency-safe batch", async () => {
    const store = new MemoryStore();
    const calls: string[] = [];
    const host = successfulHost(async (step, operationId) => {
      calls.push(step.id);
      return observed(operationId, step);
    });

    const paused = await runWorkMission({
      spec: spec(),
      host,
      store,
      checkpointLimit: 1,
      recordReceipt: false,
    });
    expect(paused.ok).toBe(true);
    if (!paused.ok) return;
    expect(paused.data.checkpoint.status).toBe("paused");
    expect(calls.sort()).toEqual(["read-a", "read-b"]);

    const resumed = await runWorkMission({
      spec: spec(),
      host,
      store,
      supervisorCommand: {
        sequence: 1,
        source: "mobile",
        kind: "resume",
        issuedAt: "2026-07-25T00:00:00.000Z",
      },
      recordReceipt: false,
    });
    expect(resumed.ok).toBe(true);
    if (!resumed.ok) return;
    expect(resumed.data.checkpoint.status).toBe("succeeded");
    expect(calls.filter((id) => id === "read-a")).toHaveLength(1);
    expect(calls.filter((id) => id === "read-b")).toHaveLength(1);
  });

  it("bounds a safe retry after an observed non-commit", async () => {
    const store = new MemoryStore();
    const attempts = new Map<string, number>();
    const host = successfulHost(async (step, operationId) => {
      const next = (attempts.get(step.id) ?? 0) + 1;
      attempts.set(step.id, next);
      if (step.id === "read-a" && next === 1) {
        return observed(operationId, step, {
          outcome: "failed",
          verified: false,
          committed: false,
          evidence: "temporary read failure",
        });
      }
      return observed(operationId, step);
    });

    const result = await runWorkMission({ spec: spec(), host, store, recordReceipt: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.checkpoint.status).toBe("succeeded");
    expect(result.data.checkpoint.nodes["read-a"].attempts).toBe(2);
    expect(result.data.ledger?.summary.retried).toBe(1);
  });
});

describe("crash recovery and exactly-once mutation authority", () => {
  it("recovers an acknowledged-by-host mutation after lost acknowledgement without executing it twice", async () => {
    const store = new MemoryStore();
    const journal = new Map<string, WorkHostObservation>();
    let mutationCalls = 0;
    let loseAck = true;
    const host = successfulHost(
      async (step, operationId) => {
        const result = observed(operationId, step);
        journal.set(operationId, result);
        if (step.kind === "mutation") {
          mutationCalls += 1;
          if (loseAck) {
            loseAck = false;
            throw new Error("connection lost after commit");
          }
        }
        return result;
      },
      async (operationId) =>
        journal.get(operationId) ?? { outcome: "not_found", evidence: "not found" },
    );

    const interrupted = await runWorkMission({
      spec: spec(),
      host,
      store,
      recordReceipt: false,
    });
    expect(interrupted.ok).toBe(true);
    if (!interrupted.ok) return;
    expect(interrupted.data.checkpoint.status).toBe("recovery_required");
    expect(interrupted.data.checkpoint.nodes["write-report"].status).toBe("in_flight");

    const recovered = await runWorkMission({
      spec: spec(),
      host,
      store,
      supervisorCommand: {
        sequence: 1,
        source: "local",
        kind: "resume",
        issuedAt: "2026-07-25T00:00:01.000Z",
      },
      recordReceipt: false,
    });
    expect(recovered.ok).toBe(true);
    if (!recovered.ok) return;
    expect(recovered.data.checkpoint.status).toBe("succeeded");
    expect(recovered.data.checkpoint.nodes["write-report"].recovered).toBe(true);
    expect(mutationCalls).toBe(1);
    expect(recovered.data.ledger?.outcome).toBe("succeeded");
  });

  it("blocks an ambiguous mutation when the host cannot recover its operation journal", async () => {
    const store = new MemoryStore();
    const host = successfulHost(
      async (step, operationId) => {
        if (step.kind === "mutation") throw new Error("lost after dispatch");
        return observed(operationId, step);
      },
      async () => ({ outcome: "unknown", evidence: "host journal unavailable" }),
    );

    const first = await runWorkMission({ spec: spec(), host, store, recordReceipt: false });
    expect(first.ok).toBe(true);
    const second = await runWorkMission({
      spec: spec(),
      host,
      store,
      supervisorCommand: {
        sequence: 1,
        source: "mobile",
        kind: "resume",
        issuedAt: "2026-07-25T00:00:02.000Z",
      },
      recordReceipt: false,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.checkpoint.status).toBe("recovery_required");
    expect(second.data.checkpoint.reason).toMatch(/will not repeat/i);
  });

  it("does not execute a mutation unless the pre-mutation checkpoint is durable", async () => {
    const store = new MemoryStore();
    const base = await createWorkCheckpoint(spec());
    expect(base.ok).toBe(true);
    if (!base.ok) return;
    base.data.nodes["read-a"].status = "done";
    base.data.nodes["read-a"].receipt = {
      appId: "ocade.work.researcher",
      capabilityId: "read-a",
      method: "adapter",
      at: "2026-07-25T00:00:00.000Z",
      verified: true,
      evidence: "read a",
    };
    base.data.nodes["read-b"].status = "done";
    base.data.nodes["read-b"].receipt = {
      appId: "ocade.work.researcher",
      capabilityId: "read-b",
      method: "adapter",
      at: "2026-07-25T00:00:00.000Z",
      verified: true,
      evidence: "read b",
    };
    store.value = base.data;
    store.failNextWrite = true;
    const execute = vi.fn(async (step: WorkStep, operationId: string) =>
      observed(operationId, step),
    );

    const result = await runWorkMission({
      spec: spec(),
      host: successfulHost(execute),
      store,
      recordReceipt: false,
    });
    expect(result.ok).toBe(false);
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a concurrent stale checkpoint before either caller can duplicate dispatch", async () => {
    const store = new MemoryStore();
    let calls = 0;
    const host = successfulHost(async (step, operationId) => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return observed(operationId, step);
    });

    const [a, b] = await Promise.all([
      runWorkMission({ spec: spec(), host, store, checkpointLimit: 1, recordReceipt: false }),
      runWorkMission({ spec: spec(), host, store, checkpointLimit: 1, recordReceipt: false }),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(calls).toBe(2); // one dependency-ready read batch, never two batches
  });
});

describe("supervision, persistence, budgets, and receipts", () => {
  let browserItems: Map<string, string>;

  beforeEach(() => {
    browserItems = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => browserItems.get(key) ?? null,
      setItem: (key: string, value: string) => void browserItems.set(key, value),
      removeItem: (key: string) => void browserItems.delete(key),
      clear: () => browserItems.clear(),
    });
  });

  it("applies mobile commands monotonically and ignores a replayed command", async () => {
    const store = new MemoryStore();
    const host = successfulHost();
    const pause = {
      sequence: 2,
      source: "mobile" as const,
      kind: "pause" as const,
      issuedAt: "2026-07-25T00:00:00.000Z",
    };
    const paused = await runWorkMission({
      spec: spec(),
      host,
      store,
      supervisorCommand: pause,
      recordReceipt: false,
    });
    expect(paused.ok).toBe(true);

    const replay = await runWorkMission({
      spec: spec(),
      host,
      store,
      supervisorCommand: { ...pause, kind: "resume" },
      recordReceipt: false,
    });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;
    expect(replay.data.checkpoint.status).toBe("paused");
    expect(replay.data.checkpoint.lastSupervisorSequence).toBe(2);
  });

  it("blocks before work that cannot fit the remaining duration budget", async () => {
    const store = new MemoryStore();
    const execute = vi.fn(async (step: WorkStep, operationId: string) =>
      observed(operationId, step),
    );
    const result = await runWorkMission({
      spec: spec({ budget: { maxDurationMs: 10, maxParallelReads: 2, maxMutations: 1 } }),
      host: successfulHost(execute),
      store,
      recordReceipt: false,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.checkpoint.status).toBe("blocked");
    expect(result.data.checkpoint.reason).toMatch(/budget/i);
    expect(execute).not.toHaveBeenCalled();
  });

  it("stores one verified receipt and does not duplicate it on a later resume", async () => {
    const store = new MemoryStore();
    const first = await runWorkMission({
      spec: spec(),
      host: successfulHost(),
      store,
      recordReceipt: true,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.checkpoint.status).toBe("succeeded");
    expect(first.data.receiptRecording.status).toBe("saved");
    const count = JSON.parse(globalThis.localStorage.getItem("ocade.artifacts.v1") ?? "[]").length;
    expect(count).toBe(1);

    const again = await runWorkMission({
      spec: spec(),
      host: successfulHost(),
      store,
      recordReceipt: true,
    });
    expect(again.ok).toBe(true);
    expect(JSON.parse(globalThis.localStorage.getItem("ocade.artifacts.v1") ?? "[]")).toHaveLength(
      count,
    );
  });

  it("loads valid browser checkpoints and fails closed on corrupt storage", async () => {
    const browser = new BrowserWorkCheckpointStore(globalThis.localStorage);
    const checkpoint = await createWorkCheckpoint(spec());
    expect(checkpoint.ok).toBe(true);
    if (!checkpoint.ok) return;
    await browser.save(checkpoint.data, null);
    expect((await browser.load(spec().id))?.missionId).toBe(spec().id);

    globalThis.localStorage.setItem(`ocade.work.mission.v1:${spec().id}`, "{broken");
    await expect(browser.load(spec().id)).rejects.toThrow(/corrupt/i);
  });

  it("refuses a structurally tampered checkpoint before dispatching host work", async () => {
    const browser = new BrowserWorkCheckpointStore(globalThis.localStorage);
    const checkpoint = await createWorkCheckpoint(spec());
    expect(checkpoint.ok).toBe(true);
    if (!checkpoint.ok) return;
    const tampered = structuredClone(checkpoint.data);
    delete tampered.nodes["read-a"];
    globalThis.localStorage.setItem(`ocade.work.mission.v1:${spec().id}`, JSON.stringify(tampered));
    const execute = vi.fn(async (step: WorkStep, operationId: string) =>
      observed(operationId, step),
    );

    const result = await runWorkMission({
      spec: spec(),
      host: successfulHost(execute),
      store: browser,
      recordReceipt: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/corrupt|invalid/i);
    expect(execute).not.toHaveBeenCalled();
  });
});

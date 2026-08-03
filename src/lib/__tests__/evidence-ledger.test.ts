import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buildTaskLedger,
  serialiseLedger,
  saveLedgerArtifact,
  type LedgerStep,
  type TaskLedgerInput,
} from "../artifacts/evidence-ledger";
import { listArtifacts } from "../artifacts/store";
import type { EvidenceReceipt } from "../skills/skill-pack";

const receipt = (verified: boolean): EvidenceReceipt => ({
  appId: "ocade.data",
  capabilityId: "data.summarise",
  method: "file",
  at: "2026-07-24T10:00:05.000Z",
  verified,
  evidence: verified ? "mean 80.00" : "NOT CONFIRMED: no check was possible",
});

const step = (over: Partial<LedgerStep> = {}): LedgerStep => ({
  intent: "Summarise the amounts",
  receipt: receipt(true),
  status: "done",
  attempts: 1,
  ...over,
});

const input = (over: Partial<TaskLedgerInput> = {}): TaskLedgerInput => ({
  taskId: "task-1",
  intent: "Analyse the sales export",
  initialState: "CSV pasted, nothing computed",
  steps: [step()],
  finalState: "Column summarised, result shown",
  startedAt: "2026-07-24T10:00:00.000Z",
  finishedAt: "2026-07-24T10:00:10.000Z",
  ...over,
});

describe("the outcome is derived from the steps, never supplied", () => {
  it("calls a task succeeded only when every step ran and verified", () => {
    const r = buildTaskLedger(input({ steps: [step(), step({ intent: "Filter rows" })] }));
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.outcome).toBe("succeeded");
    expect(r.data.headline).toMatch(/All 2 steps completed and verified/);
  });

  /**
   * A done step whose result nothing confirmed is not a clean success. It lands
   * as "partial", and the headline says to treat the result as unconfirmed.
   */
  it("downgrades to partial when a done step is unverified", () => {
    const r = buildTaskLedger(input({ steps: [step(), step({ receipt: receipt(false) })] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.outcome).toBe("partial");
    expect(r.data.summary.unverified).toBe(1);
    expect(r.data.headline).toMatch(/treat the result as unconfirmed/i);
  });

  it("is failed when a step failed and wasn't recovered", () => {
    const r = buildTaskLedger(
      input({ steps: [step(), step({ status: "failed", receipt: null })] }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.outcome).toBe("failed");
    expect(r.data.headline).toMatch(/did not complete/i);
  });

  /**
   * A failure that was undone is still a failure of that step, but the task can
   * recover. The recovery is recorded, not smoothed away.
   */
  it("records recovery on a failed step without hiding the failure", () => {
    const r = buildTaskLedger(
      input({
        steps: [
          step(),
          step({
            status: "failed",
            receipt: null,
            recovery: { action: "undo", evidence: "reverted the partial write" },
          }),
        ],
      }),
    );
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.summary.failed).toBe(1);
    expect(r.data.summary.recovered).toBe(1);
    // One failed step, but it was recovered, so the task isn't "failed" — and
    // it isn't a clean "succeeded" either, because that step's goal was undone.
    expect(r.data.outcome).toBe("partial");
    expect(r.data.headline).toMatch(/failed and recovered/);
    expect(r.data.headline).toMatch(/Treat the result as unconfirmed/i);
  });

  it("counts retries and reports them", () => {
    const r = buildTaskLedger(input({ steps: [step({ attempts: 3 })] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.summary.retried).toBe(1);
    expect(r.data.headline).toMatch(/after a retry/);
  });

  it("is empty when nothing ran", () => {
    const r = buildTaskLedger(input({ steps: [] }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.outcome).toBe("empty");

    const allSkipped = buildTaskLedger(
      input({ steps: [step({ status: "skipped", receipt: null })] }),
    );
    if (!allSkipped.ok) throw new Error("unreachable");
    expect(allSkipped.data.outcome).toBe("empty");
  });
});

describe("it refuses to launder an unproven claim", () => {
  /**
   * A "done" step with no receipt is a contradiction: the receipt is what
   * proves it happened. Emitting a ledger from it would turn an unproven claim
   * into an official record.
   */
  it("refuses a done step that carries no receipt", () => {
    const r = buildTaskLedger(input({ steps: [step({ receipt: null })] }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/a step with no evidence isn't done/i);
  });

  it("refuses a skipped step that somehow has a receipt", () => {
    const r = buildTaskLedger(input({ steps: [step({ status: "skipped" })] }));
    expect(r.ok).toBe(false);
  });

  it("requires a final state", () => {
    const r = buildTaskLedger(input({ finalState: "  " }));
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/can't describe/i);
  });

  it("refuses impossible timing and attempt counts", () => {
    expect(buildTaskLedger(input({ finishedAt: "2026-07-24T09:00:00.000Z" })).ok).toBe(false);
    expect(buildTaskLedger(input({ startedAt: "not a date" })).ok).toBe(false);
    expect(buildTaskLedger(input({ steps: [step({ attempts: 0 })] })).ok).toBe(false);
  });

  it("measures duration from the timestamps", () => {
    const r = buildTaskLedger(input());
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.durationMs).toBe(10_000);
  });
});

describe("serialisation and storage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it("round-trips through JSON", () => {
    const r = buildTaskLedger(input());
    if (!r.ok) throw new Error("unreachable");
    const parsed = JSON.parse(serialiseLedger(r.data));
    expect(parsed.taskId).toBe("task-1");
    expect(parsed.outcome).toBe("succeeded");
    expect(parsed.steps).toHaveLength(1);
  });

  it("stores a succeeded ledger as a verified artifact", async () => {
    const r = buildTaskLedger(input());
    if (!r.ok) throw new Error("unreachable");
    const saved = await saveLedgerArtifact(r.data);
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error("unreachable");
    expect(saved.data.kind).toBe("receipt");
    expect(saved.data.provenance.verified).toBe(true);
    expect(listArtifacts()).toHaveLength(1);
  });

  /**
   * The ledger's honesty must flow into the store: a partial task is stored
   * NOT CONFIRMED, so it's labelled that way everywhere the artifact appears.
   */
  it("stores a partial ledger as NOT CONFIRMED", async () => {
    const r = buildTaskLedger(input({ steps: [step({ receipt: receipt(false) })] }));
    if (!r.ok) throw new Error("unreachable");
    const saved = await saveLedgerArtifact(r.data);
    if (!saved.ok) throw new Error("unreachable");
    expect(saved.data.provenance.verified).toBe(false);
    expect(saved.evidence).toMatch(/NOT CONFIRMED/);
  });
});

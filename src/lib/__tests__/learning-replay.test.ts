import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildReplay, serialiseReplay, saveReplayArtifact } from "../artifacts/learning-replay";
import {
  buildTaskLedger,
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

function ledger(over: Partial<TaskLedgerInput> = {}) {
  const r = buildTaskLedger({
    taskId: "task-1",
    intent: "Analyse the export",
    initialState: "CSV pasted",
    finalState: "Summary shown",
    startedAt: "2026-07-24T10:00:00.000Z",
    finishedAt: "2026-07-24T10:00:10.000Z",
    steps: [step()],
    ...over,
  });
  if (!r.ok) throw new Error(`fixture failed: ${r.reason}`);
  return r.data;
}

describe("a replay narrates what actually happened", () => {
  it("titles and introduces from the ledger", () => {
    const replay = buildReplay(ledger());
    expect(replay.title).toBe("How OCADE handled: Analyse the export");
    expect(replay.intro).toMatch(/Starting point: CSV pasted/);
  });

  it("narrates a verified step as confirmed", () => {
    const replay = buildReplay(ledger());
    expect(replay.steps[0].narration).toMatch(/Done, and confirmed: mean 80\.00/);
    expect(replay.steps[0].wasMistake).toBe(false);
  });

  it("marks an unverified done step as not independently confirmed", () => {
    const replay = buildReplay(ledger({ steps: [step({ receipt: receipt(false) })] }));
    expect(replay.steps[0].narration).toMatch(/not independently confirmed/i);
  });

  it("mentions retries", () => {
    const replay = buildReplay(ledger({ steps: [step({ attempts: 3 })] }));
    expect(replay.steps[0].narration).toMatch(/Took 3 attempts/);
  });
});

/**
 * The rule: the mistakes stay in. A tutorial that drops the failed step teaches
 * a path that never existed and hides the most useful part.
 */
describe("mistakes and recovery are kept, not hidden", () => {
  const withRecovery = () =>
    ledger({
      steps: [
        step(),
        step({
          intent: "Write the file",
          status: "failed",
          receipt: null,
          recovery: { action: "undo", evidence: "reverted the partial write" },
        }),
      ],
      finalState: "First step done, second reverted",
    });

  it("narrates the failure AND the recovery", () => {
    const replay = buildReplay(withRecovery());
    const failedStep = replay.steps[1];
    expect(failedStep.wasMistake).toBe(true);
    expect(failedStep.narration).toMatch(/Failed before it could run/i);
    expect(failedStep.narration).toMatch(/Recovered by undo: reverted the partial write/);
  });

  it("counts the mistakes and surfaces the count", () => {
    const replay = buildReplay(withRecovery());
    expect(replay.mistakes).toBe(1);
    expect(serialiseReplay(replay)).toMatch(
      /1 step went wrong along the way; they are kept above on purpose/,
    );
  });

  it("flags the mistaken step in the markdown heading", () => {
    const md = serialiseReplay(buildReplay(withRecovery()));
    expect(md).toMatch(/## Step 2: Write the file ⚠/);
  });

  it("notes a skipped step honestly rather than narrating work", () => {
    const halted = ledger({
      steps: [step({ intent: "Do X" }), step({ intent: "Do Y", status: "skipped", receipt: null })],
      finalState: "Stopped after X",
    });
    // The second step is skipped; buildTaskLedger allows skipped+null receipt.
    const replay = buildReplay(halted);
    expect(replay.steps[1].narration).toMatch(/Not reached/i);
  });
});

/**
 * The final proof must never read like success when the ledger says otherwise.
 */
describe("the closing proof matches the real outcome", () => {
  it("certifies a succeeded task", () => {
    expect(buildReplay(ledger()).proof).toMatch(/every step completed and was verified/i);
  });

  it("says plainly when a task was only partial", () => {
    const partial = ledger({ steps: [step({ receipt: receipt(false) })] });
    const replay = buildReplay(partial);
    expect(replay.proof).toMatch(/did NOT fully succeed/i);
    expect(replay.proof).toMatch(/Don't treat this replay as a recipe/i);
  });

  it("says plainly when a task failed", () => {
    const failed = ledger({
      steps: [step({ status: "failed", receipt: null })],
      finalState: "nothing changed",
    });
    expect(buildReplay(failed).proof).toMatch(/the task failed/i);
  });
});

describe("saving a replay as an artifact", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it("stores a succeeded replay as a verified text artifact", async () => {
    const saved = await saveReplayArtifact(ledger());
    expect(saved.ok).toBe(true);
    if (!saved.ok) throw new Error("unreachable");
    expect(saved.data.kind).toBe("text");
    expect(saved.data.provenance.verified).toBe(true);
    expect(listArtifacts()).toHaveLength(1);
  });

  it("stores a partial replay as NOT CONFIRMED, so it isn't a proven recipe", async () => {
    const saved = await saveReplayArtifact(ledger({ steps: [step({ receipt: receipt(false) })] }));
    if (!saved.ok) throw new Error("unreachable");
    expect(saved.data.provenance.verified).toBe(false);
  });
});

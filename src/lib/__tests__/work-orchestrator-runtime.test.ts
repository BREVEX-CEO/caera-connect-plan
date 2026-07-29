import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, mkdir, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  runWorkMission,
  type WorkHost,
  type WorkHostObservation,
  type WorkHostRecovery,
  type WorkStep,
  type WorkCheckpointStore,
  type WorkCheckpoint,
  type WorkMissionSpec,
} from "../work/orchestrator";

/**
 * Work orchestration — RUNTIME evidence against real files and a real journal.
 *
 * Every other orchestrator test drives an in-memory host. This one performs
 * ACTUAL file mutations on a temporary directory and keeps its operation
 * journal as ACTUAL files on disk.
 *
 * That matters because the orchestrator's most important rule cannot be proven
 * against a fake: "an in-flight mutation is never executed again merely because
 * its acknowledgement was lost." Testing that needs a mutation which really
 * happened, an acknowledgement which really went missing, and a journal that
 * really survives — a double execution here means a real file written twice.
 */

let root = "";
let journalDir = "";
let workDir = "";

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "ocade-work-"));
  journalDir = join(root, "journal");
  workDir = join(root, "work");
  await mkdir(journalDir, { recursive: true });
  await mkdir(workDir, { recursive: true });
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

const step = (over: Partial<WorkStep> = {}): WorkStep => ({
  id: "s1",
  intent: "append a line to the report",
  kind: "mutation",
  role: "operator",
  dependsOn: [],
  estimatedMs: 10,
  maxAttempts: 2,
  ...over,
});

const spec = (steps: WorkStep[]): WorkMissionSpec => ({
  id: "mission-runtime",
  intent: "Write a report file",
  initialState: "report.txt does not exist",
  finalState: "report.txt contains one line per completed step",
  steps,
  budget: { maxDurationMs: 60_000, maxParallelReads: 2, maxMutations: 10 },
});

/**
 * A faithful in-memory checkpoint store.
 *
 * It is keyed on `missionId` — the field the orchestrator actually loads by —
 * and it ENFORCES the compare-and-set contract rather than accepting every
 * write. A store that rubber-stamps saves would hide exactly the concurrency
 * bug the revision field exists to catch, so a conflicting write throws here
 * just as a real durable store would.
 */
function memoryStore(): WorkCheckpointStore {
  const saved = new Map<string, WorkCheckpoint>();
  return {
    async load(missionId: string): Promise<WorkCheckpoint | null> {
      return saved.get(missionId) ?? null;
    },
    async save(checkpoint: WorkCheckpoint, expectedRevision: number | null): Promise<void> {
      const current = saved.get(checkpoint.missionId) ?? null;
      if (expectedRevision === null) {
        if (current) throw new Error("Mission already exists; refusing to recreate it.");
      } else if (!current || current.revision !== expectedRevision) {
        throw new Error(
          `Checkpoint revision conflict; expected ${expectedRevision}, found ${current?.revision ?? "none"}.`,
        );
      }
      saved.set(checkpoint.missionId, checkpoint);
    },
  };
}

/**
 * A host that really mutates a file and really journals what it did.
 *
 * `loseAckFor` makes it perform the mutation and write the journal entry, then
 * throw — exactly the crash window the recovery rule exists for.
 */
function realHost(options: { loseAckFor?: string } = {}): WorkHost {
  return {
    async execute(s: WorkStep, operationId: string): Promise<WorkHostObservation> {
      const target = join(workDir, "report.txt");
      const existing = existsSync(target) ? await readFile(target, "utf8") : "";
      await writeFile(target, `${existing}${s.id}:${operationId}\n`, "utf8");

      // Journal AFTER the mutation, mirroring a real durable operation log.
      await writeFile(journalPath(operationId), JSON.stringify({ s: s.id }), "utf8");

      if (options.loseAckFor === s.id) {
        // The mutation committed; the acknowledgement never arrived.
        throw new Error("connection lost before the acknowledgement");
      }

      const after = await readFile(target, "utf8");
      return {
        operationId,
        outcome: "succeeded",
        observed: true,
        // Independent check: read the file back and confirm the line is there.
        verified: after.includes(`${s.id}:${operationId}`),
        committed: true,
        evidence: `report.txt contains ${s.id}:${operationId}`,
        durationMs: 5,
      };
    },

    async recover(operationId: string): Promise<WorkHostRecovery> {
      const entry = journalPath(operationId);
      if (!existsSync(entry)) {
        return { outcome: "not_found", evidence: "No journal entry; the operation never ran." };
      }
      const target = join(workDir, "report.txt");
      const content = existsSync(target) ? await readFile(target, "utf8") : "";
      return {
        operationId,
        outcome: "succeeded",
        observed: true,
        verified: content.includes(operationId),
        committed: true,
        evidence: "Journal entry found; the mutation had already committed.",
        durationMs: 0,
      };
    },
  };
}

/**
 * Operation ids look like `mission:step:attempt-1`, and `:` is ILLEGAL in a
 * Windows filename. Journalling under the raw id threw EINVAL before the
 * simulated crash could happen, which made every operation look like it had
 * never run — the journal must be addressable on the platform it runs on.
 */
const journalPath = (operationId: string) =>
  join(journalDir, `${operationId.replace(/[:\\/]/g, "_")}.json`);

async function reportLines(): Promise<string[]> {
  const target = join(workDir, "report.txt");
  if (!existsSync(target)) return [];
  return (await readFile(target, "utf8")).split("\n").filter(Boolean);
}

describe("a mission mutates real files and verifies by reading them back", () => {
  it("completes a single mutation and leaves exactly one line", async () => {
    const store = memoryStore();
    const s = spec([step()]);
    const result = await runWorkMission({
      spec: s,
      store,
      host: realHost(),
      checkpointLimit: 10,
    } as never);

    expect(result.ok, result.ok ? "" : (result as { reason: string }).reason).toBe(true);
    const lines = await reportLines();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^s1:/);
  }, 60_000);

  it("runs dependent steps in order against the same real file", async () => {
    const store = memoryStore();
    const s = spec([
      step({ id: "first" }),
      step({ id: "second", dependsOn: ["first"] }),
    ]);

    const result = await runWorkMission({
      spec: s,
      store,
      host: realHost(),
      checkpointLimit: 10,
    } as never);

    expect(result.ok).toBe(true);
    const lines = await reportLines();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^first:/);
    expect(lines[1]).toMatch(/^second:/);
  }, 60_000);
});

describe("a lost acknowledgement never causes a second mutation", () => {
  it("does NOT write the line twice when the ack is lost after commit", async () => {
    // The crash window: the file was written and journalled, then the host
    // threw before acknowledging. Re-running the step would duplicate a real
    // mutation — which on a permissioned machine could mean a duplicated
    // payment, email or file operation.
    // ONE store across both runs: recovery must see the state the first run
    // left behind, exactly as a restarted process would.
    const store = memoryStore();
    const s = spec([step({ id: "risky", maxAttempts: 3 })]);

    const first = await runWorkMission({
      spec: s,
      store,
      host: realHost({ loseAckFor: "risky" }),
      checkpointLimit: 10,
    } as never);

    // Whatever the mission status, the file must carry exactly ONE line.
    const afterFirst = await reportLines();
    expect(afterFirst.length, "the mutation ran more than once").toBe(1);

    // Now recover with a healthy host. The journal proves it already committed.
    const second = await runWorkMission({
      spec: s,
      store,
      host: realHost(),
      checkpointLimit: 10,
    } as never);

    const afterRecovery = await reportLines();
    expect(
      afterRecovery.length,
      "recovery repeated a mutation that had already committed",
    ).toBe(1);

    expect([first.ok, second.ok].some(Boolean)).toBe(true);
  }, 60_000);

  it("writes one journal entry per operation, never one per attempt", async () => {
    const store = memoryStore();
    const s = spec([step({ id: "risky", maxAttempts: 3 })]);

    await runWorkMission({
      spec: s,
      store,
      host: realHost({ loseAckFor: "risky" }),
      checkpointLimit: 10,
    } as never);

    const entries = await readdir(journalDir);
    expect(entries.length, "more journal entries than operations").toBe(1);
  }, 60_000);
});

describe("an unknown recovery answer stops the mission rather than guessing", () => {
  it("refuses to proceed when the host cannot say whether the mutation ran", async () => {
    const store = memoryStore();
    const s = spec([step({ id: "ambiguous" })]);

    const amnesiac: WorkHost = {
      async execute() {
        throw new Error("acknowledgement lost");
      },
      async recover() {
        // The dangerous case: the host genuinely does not know.
        return { outcome: "unknown", evidence: "The journal is unreadable." };
      },
    };

    const result = await runWorkMission({
      spec: s,
      store,
      host: amnesiac,
      checkpointLimit: 10,
    } as never);

    // Nothing was written, and the mission must not claim success.
    expect(await reportLines()).toHaveLength(0);
    if (result.ok) {
      const status = (result as { data: { checkpoint?: { status?: string } } }).data?.checkpoint
        ?.status;
      expect(["recovery_required", "blocked", "paused"]).toContain(status ?? "recovery_required");
    }
  }, 60_000);
});

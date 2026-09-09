import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFakeOutputStore } from "./support/fake-outputs";

const outputs = createFakeOutputStore();
vi.mock("@/lib/ocade-projects.functions", () => outputs.module);

const { runGovernedTask, runAndRecord } = await import("../skills/governed-run");
const { ExecutorRegistry } = await import("../skills/executor-registry");
const { createTaskScope } = await import("../skills/task-scope");
const { listArtifacts } = await import("../artifacts/store");
import type { GovernedStep, GovernedRunInput } from "../skills/governed-run";
import type { ExecutorRegistry as ExecutorRegistryType } from "../skills/executor-registry";
import type { AdapterHealth } from "../skills/adapter-health";
import type { AppIdentity, ControlMethod, SkillCapability, SkillPack } from "../skills/skill-pack";
import type { RecoveryOption } from "../skills/recovery-graph";

const NOW = new Date("2026-07-23T10:00:00Z");

const readCap: SkillCapability = {
  id: "data.read",
  label: "Read the table",
  methods: ["official_api"],
  mutating: false,
  verifyBy: "api",
  tested: true,
};

const writeCap: SkillCapability = {
  id: "data.write",
  label: "Write the summary",
  methods: ["official_api"],
  mutating: true,
  verifyBy: "file",
  tested: true,
};

const app: AppIdentity = { appId: "demo.app", displayName: "Demo", version: "1.0.0" };

const pack: SkillPack = {
  appId: "demo.app",
  displayName: "Demo",
  category: "os_utilities",
  testedVersions: ["1."],
  capabilities: [readCap, writeCap],
  requiresLicensedInstall: false,
};

const restore: RecoveryOption = { kind: "restore", plan: "checkpoint taken", ready: true };

const independentlyConfirmed = () => ({
  verified: true,
  evidence: "Independent observation matched the expected state.",
});

/** A registry whose executors and separate verifiers agree. */
function okRegistry(): ExecutorRegistryType {
  const r = new ExecutorRegistry();
  r.register(
    "demo.app",
    "data.read",
    async () => ({ ok: true, evidence: "read 3 rows", data: "3" }),
    independentlyConfirmed,
  );
  r.register(
    "demo.app",
    "data.write",
    async () => ({ ok: true, evidence: "wrote summary" }),
    independentlyConfirmed,
  );
  return r;
}

const readStep: GovernedStep = {
  action: { kind: "clipboard.read" },
  capability: readCap,
  app,
  risk: "read",
  recovery: [],
  canReobserve: false,
};
const writeStep: GovernedStep = {
  action: { kind: "clipboard.write", text: "x" },
  capability: writeCap,
  app,
  risk: "high",
  recovery: [restore],
  canReobserve: false,
};

const input = (over: Partial<GovernedRunInput> = {}): GovernedRunInput => ({
  taskId: "task-1",
  intent: "Summarise and save",
  initialState: "table loaded",
  finalState: "summary written",
  steps: [readStep, writeStep],
  packs: [pack],
  scope: createTaskScope({
    id: "task-1",
    summary: "Summarise and save",
    capabilities: ["clipboard.read", "clipboard.write"],
    now: NOW,
  }),
  health: new Map<ControlMethod, AdapterHealth>(),
  availableMethods: ["official_api"],
  recording: "video_off",
  registry: okRegistry(),
  now: NOW,
  ...over,
});

beforeEach(() => {
  outputs.reset();
});

describe("a clean governed run", () => {
  it("runs every step and produces a succeeded ledger", async () => {
    const r = await runGovernedTask(input());
    expect(r.ok).toBe(true);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.haltedAt).toBe(-1);
    expect(r.data.ledger.outcome).toBe("succeeded");
    expect(r.data.ledger.steps.every((s) => s.status === "done")).toBe(true);
    expect(r.data.receiptRecording.status).toBe("not_requested");
  });
});

/**
 * Halt-on-block is the safety property: reaching a later step means earlier
 * ones already changed the world, so a block stops the run rather than pressing
 * on into a half-done state.
 */
describe("halt-on-block", () => {
  it("stops at a step the scope never granted and skips the rest", async () => {
    const narrow = input({
      scope: createTaskScope({
        id: "task-1",
        summary: "Read only",
        capabilities: ["clipboard.read"], // write NOT granted
        now: NOW,
      }),
    });
    const r = await runGovernedTask(narrow);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.haltedAt).toBe(1);
    expect(r.data.ledger.steps[0].status).toBe("done");
    expect(r.data.ledger.steps[1].status).toBe("failed");
    expect(r.data.ledger.outcome).toBe("failed");
  });

  /**
   * A high-risk write with no ready recovery must never run. The recovery gate
   * stops it BEFORE execution.
   */
  it("refuses to run a high-risk step with no recovery in place", async () => {
    const noRecovery = input({ steps: [readStep, { ...writeStep, recovery: [] }] });
    const r = await runGovernedTask(noRecovery);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.haltedAt).toBe(1);
    expect(r.data.haltReason).toMatch(/can't walk back|recovery/i);
    // The write step's receipt is null — it never executed.
    expect(r.data.ledger.steps[1].receipt).toBeNull();
  });

  it("records the honest final state after a halt", async () => {
    const narrow = input({
      scope: createTaskScope({
        id: "task-1",
        summary: "Read only",
        capabilities: ["clipboard.read"],
        now: NOW,
      }),
    });
    const r = await runGovernedTask(narrow);
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.ledger.finalState).toMatch(/Stopped at step 2/);
    expect(r.data.ledger.finalState).toMatch(/1 step completed before the stop/);
  });

  it("halts when the executor is unavailable rather than faking a result", async () => {
    const emptyRegistry = new ExecutorRegistry();
    emptyRegistry.register(
      "demo.app",
      "data.read",
      async () => ({ ok: true, evidence: "read" }),
      independentlyConfirmed,
    );
    // data.write has NO executor registered.
    const r = await runGovernedTask(input({ registry: emptyRegistry }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.haltedAt).toBe(1);
    expect(r.data.haltReason).toMatch(/nothing wired up/i);
  });

  it("carries a failing executor through as a failed step", async () => {
    const failing = new ExecutorRegistry();
    failing.register(
      "demo.app",
      "data.read",
      async () => ({ ok: true, evidence: "read" }),
      independentlyConfirmed,
    );
    failing.register("demo.app", "data.write", async () => ({ ok: false, evidence: "disk full" }));
    const r = await runGovernedTask(input({ registry: failing }));
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.ledger.steps[1].status).toBe("failed");
    expect(r.data.ledger.outcome).toBe("failed");
  });
});

describe("runAndRecord persists the ledger as an artifact", () => {
  it("saves a succeeded run as a verified receipt artifact", async () => {
    const r = await runAndRecord(input());
    if (!r.ok) throw new Error("unreachable");
    const saved = await listArtifacts();
    expect(saved).toHaveLength(1);
    expect(saved[0]!.kind).toBe("receipt");
    expect(saved[0]!.provenance.verified).toBe(true);
    expect(r.evidence).toMatch(/Receipt saved/);
    expect(r.data.receiptRecording.status).toBe("saved");
  });

  /**
   * The honesty flows end to end: a halted run is stored NOT CONFIRMED, so the
   * receipt artifact is labelled that way wherever it appears.
   */
  it("saves a halted run as a NOT CONFIRMED receipt", async () => {
    const narrow = input({
      scope: createTaskScope({
        id: "task-1",
        summary: "Read only",
        capabilities: ["clipboard.read"],
        now: NOW,
      }),
    });
    const r = await runAndRecord(narrow);
    if (!r.ok) throw new Error("unreachable");
    expect((await listArtifacts())[0]!.provenance.verified).toBe(false);
  });

  it("reports receipt persistence failure instead of claiming it saved", async () => {
    /*
     * The run itself SUCCEEDED and the receipt did not reach the account. Both
     * halves have to be reported: a run reported as failed because its receipt
     * did not save would send somebody looking for a problem that is not there,
     * and one reported as fully recorded would leave them believing in evidence
     * that does not exist.
     */
    const failing = vi
      .spyOn(outputs.module, "createOutput")
      .mockRejectedValueOnce(new Error("Failed to fetch"));

    const r = await runAndRecord(input());
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.ledger.outcome).toBe("succeeded");
    expect(r.data.receiptRecording).toMatchObject({
      status: "failed",
      reason: expect.stringMatching(/could not reach your account/i),
    });
    expect(r.evidence).toMatch(/Receipt not saved/i);
    expect(r.evidence).not.toMatch(/Receipt saved:/i);
    failing.mockRestore();
  });

  it("refuses an empty task", async () => {
    expect((await runGovernedTask(input({ steps: [] }))).ok).toBe(false);
  });
});

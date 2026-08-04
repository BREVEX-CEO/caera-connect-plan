import { describe, it, expect, beforeEach, vi } from "vitest";
import { planStep } from "../skills/work-session";
import { createTaskScope } from "../skills/task-scope";
import { createDefaultExecutors } from "../skills/default-executors";
import { runPlannedStep } from "../skills/executor-registry";
import { PackRegistry } from "../skills/pack-registry";
import { parseCsv } from "../skills/packs/data-pack";
import type { AdapterHealth } from "../skills/adapter-health";
import type { ControlMethod } from "../skills/skill-pack";

/**
 * FULL PIPELINE TEST.
 *
 * Exercises exactly what `DataWorkbench` does at runtime — scope check, pack
 * match, confidence assessment, execution, verification, receipt — through the
 * real modules. Individually each layer is tested; this proves they connect.
 */

const CSV = "region,amount\nNorth,120\nSouth,80\nEast,40";

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

function pipeline(capabilityId: string, input: Parameters<typeof createDefaultExecutors>[0]) {
  const registry = new PackRegistry();
  const pack = registry.get("ocade.data")!;
  const capability = pack.capabilities.find((c) => c.id === capabilityId)!;

  const planned = planStep({
    action: { kind: "file.open", path: "memory/table" },
    capability,
    app: { appId: pack.appId, displayName: pack.displayName, version: "1.0" },
    packs: registry.list(),
    scope: createTaskScope({
      id: "wb",
      summary: "Analyse data you paste here",
      capabilities: ["file.open"],
      paths: ["memory"],
    }),
    health: new Map<ControlMethod, AdapterHealth>(),
    availableMethods: ["file"],
    recording: "video_off",
  });

  return {
    planned,
    run: () => {
      // Narrow properly rather than casting — a plan that was refused must not
      // be silently executed by the test harness.
      if (planned.status !== "ready") throw new Error(`plan was ${planned.status}`);
      return runPlannedStep(createDefaultExecutors(input), planned.plan);
    },
  };
}

describe("the full pipeline runs end to end", () => {
  it("plans, executes and produces a CONFIRMED receipt", async () => {
    const { planned, run } = pipeline("data.parse_csv", () => ({ text: CSV }));
    expect(planned.status).toBe("ready");

    const outcome = await run();
    expect(outcome.status).toBe("done");
    if (outcome.status !== "done") throw new Error("unreachable");
    expect(outcome.receipt.verified).toBe(true);
    expect(outcome.receipt.evidence).toMatch(/Independent recomputation matched.*3 rows/i);
    expect(outcome.receipt.method).toBe("file");
    expect(outcome.receipt.capabilityId).toBe("data.parse_csv");
  });

  it("summarises through the same pipeline with correct arithmetic", async () => {
    const parsed = parseCsv(CSV);
    if (!parsed.ok) throw new Error("fixture failed");

    const { run } = pipeline("data.summarise", () => ({ table: parsed.data, column: "amount" }));
    const outcome = await run();
    expect(outcome.status).toBe("done");
    if (outcome.status !== "done") throw new Error("unreachable");
    expect(JSON.parse(outcome.data!).mean).toBe(80);
    expect(outcome.receipt.evidence).toMatch(/mean 80\.00/);
  });

  /** A refusal deep in the data layer must survive all the way to the receipt. */
  it("carries a refusal through the pipeline as an UNCONFIRMED receipt", async () => {
    const mixed = parseCsv("v\n10\n20\nN/A");
    if (!mixed.ok) throw new Error("fixture failed");

    const { run } = pipeline("data.summarise", () => ({ table: mixed.data, column: "v" }));
    const outcome = await run();
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") throw new Error("unreachable");
    expect(outcome.reason).toMatch(/won't average part of a column/i);
    expect(outcome.receipt.verified).toBe(false);
    expect(outcome.receipt.evidence).toMatch(/^NOT CONFIRMED:/);
  });

  it("reports a malformed file honestly rather than partial data", async () => {
    const { run } = pipeline("data.parse_csv", () => ({ text: "a,b,c\n1,2" }));
    const outcome = await run();
    expect(outcome.status).toBe("failed");
    if (outcome.status !== "failed") throw new Error("unreachable");
    expect(outcome.reason).toMatch(/won't guess which column/i);
  });

  it("fails rather than inventing a result when no input is supplied", async () => {
    const { run } = pipeline("data.parse_csv", () => undefined);
    const outcome = await run();
    expect(outcome.status).toBe("failed");
  });
});

/**
 * The scope must genuinely bound this surface, not merely decorate it.
 */
describe("the workbench respects its own approval", () => {
  it("refuses a capability the scope never granted", () => {
    const registry = new PackRegistry();
    const pack = registry.get("ocade.data")!;

    const planned = planStep({
      // Not `file.open` — outside what the workbench scope grants.
      action: { kind: "clipboard.write", text: "x" },
      capability: pack.capabilities[0],
      app: { appId: pack.appId, displayName: pack.displayName, version: "1.0" },
      packs: registry.list(),
      scope: createTaskScope({
        id: "wb",
        summary: "Analyse data you paste here",
        capabilities: ["file.open"],
        paths: ["memory"],
      }),
      health: new Map<ControlMethod, AdapterHealth>(),
      availableMethods: ["file"],
      recording: "video_off",
    });

    expect(planned.status).toBe("refused");
    if (planned.status !== "refused") throw new Error("unreachable");
    expect(planned.escalate).toBe(true);
  });
});

/**
 * DEAD-SURFACE REGRESSION.
 *
 * The workbench scope expires after 30 minutes, which is correct — an approval
 * should not outlive its task. But a scope created once and never renewed left
 * the surface permanently dead: the user returns to an open tab and every
 * action refuses with "approve it again", with nothing to click.
 *
 * These pin that expiry is (a) genuinely enforced, and (b) recoverable.
 */
describe("an expired approval is recoverable, not a dead end", () => {
  const scopeAt = (now: Date) =>
    createTaskScope({
      id: "wb",
      summary: "Analyse data you paste here",
      capabilities: ["file.open"],
      paths: ["memory"],
      now,
    });

  const T0 = new Date("2026-07-23T10:00:00Z");
  const LATER = new Date(T0.getTime() + 31 * 60 * 1000);

  function planAt(scope: ReturnType<typeof createTaskScope>, now: Date) {
    const registry = new PackRegistry();
    const pack = registry.get("ocade.data")!;
    return planStep({
      action: { kind: "file.open", path: "memory/table" },
      capability: pack.capabilities[0],
      app: { appId: pack.appId, displayName: pack.displayName, version: "1.0" },
      packs: registry.list(),
      scope,
      health: new Map<ControlMethod, AdapterHealth>(),
      availableMethods: ["file"],
      recording: "video_off",
      now,
    });
  }

  it("expiry is genuinely enforced — a stale scope refuses", () => {
    const stale = planAt(scopeAt(T0), LATER);
    expect(stale.status).toBe("refused");
    if (stale.status !== "refused") throw new Error("unreachable");
    expect(stale.reason).toMatch(/expired/i);
  });

  it("a renewed scope works immediately, with no data lost", () => {
    // What the "Continue analysing" button does: mint a fresh scope.
    const renewed = planAt(scopeAt(LATER), LATER);
    expect(renewed.status).toBe("ready");
  });

  it("renewal does not weaken the bounds — out-of-scope is still refused", () => {
    const registry = new PackRegistry();
    const pack = registry.get("ocade.data")!;
    const planned = planStep({
      action: { kind: "clipboard.write", text: "x" },
      capability: pack.capabilities[0],
      app: { appId: pack.appId, displayName: pack.displayName, version: "1.0" },
      packs: registry.list(),
      scope: scopeAt(LATER),
      health: new Map<ControlMethod, AdapterHealth>(),
      availableMethods: ["file"],
      recording: "video_off",
      now: LATER,
    });
    expect(planned.status).toBe("refused");
  });
});

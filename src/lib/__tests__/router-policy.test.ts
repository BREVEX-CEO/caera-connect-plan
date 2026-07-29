import { describe, it, expect } from "vitest";
import {
  PerfLedger,
  routeTask,
  hotSwap,
  isDeterministic,
  DETERMINISTIC_TASKS,
} from "../local/router-policy";
import { classifyLocalModel, type LocalModelInfo } from "../ocade-local";

const m = (id: string, sizeBytes: number, params: string): LocalModelInfo =>
  classifyLocalModel({ name: id, size: sizeBytes, details: { parameter_size: params } });

const SMALL = m("deepseek-coder:6.7b", 3.83e9, "7B");
const MID = m("qwen2.5-coder:7b", 4.68e9, "7.6B");
const HUGE = m("qwen3-coder:30b", 18.56e9, "30.5B");
const VISION = m("llava:7b", 4.5e9, "7B");
const REAL_RAM = 16_801_841_152;

describe("deterministic work never routes to a model", () => {
  it("recognises every deterministic task kind", () => {
    for (const t of DETERMINISTIC_TASKS) expect(isDeterministic(t)).toBe(true);
  });

  it("does not treat generative tasks as deterministic", () => {
    for (const t of ["code", "general", "vision", "summarise", "embed"]) {
      expect(isDeterministic(t)).toBe(false);
    }
  });
});

describe("routeTask", () => {
  it("excludes a model this machine cannot hold, before anything else", () => {
    const r = routeTask("code", [SMALL, HUGE], new PerfLedger(), { totalRamBytes: REAL_RAM });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model.id).not.toBe("qwen3-coder:30b");
    expect(r.receipt.rejected.some((x) => x.modelId === "qwen3-coder:30b")).toBe(true);
  });

  it("prefers the FASTEST MEASURED model, not the largest", () => {
    const led = new PerfLedger();
    // MID is bigger, so size heuristics would pick it. Measurements say SMALL is faster.
    led.record({ modelId: MID.id, task: "code", firstTokenMs: 9000, totalMs: 12000, ok: true });
    led.record({ modelId: SMALL.id, task: "code", firstTokenMs: 1200, totalMs: 2000, ok: true });
    const r = routeTask("code", [SMALL, MID], led, { totalRamBytes: REAL_RAM });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.model.id).toBe(SMALL.id);
      expect(r.receipt.basis).toBe("measured");
    }
  });

  it("marks an unmeasured choice as unmeasured rather than implying it was earned", () => {
    const r = routeTask("code", [SMALL, MID], new PerfLedger(), { totalRamBytes: REAL_RAM });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.receipt.basis).toBe("unmeasured");
  });

  it("does not bury an unmeasured model beneath a measured-but-failing one", () => {
    // MID has been measured and is terrible; SMALL has never been measured.
    // Scoring an unmeasured model as 0 would pick MID. It must not.
    const led = new PerfLedger();
    led.record({ modelId: MID.id, task: "code", firstTokenMs: 60_000, totalMs: 90_000, ok: true });
    const r = routeTask("code", [SMALL, MID], led, {
      totalRamBytes: REAL_RAM,
      latencyBudgetMs: 5000,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.model.id).toBe(SMALL.id);
      expect(r.receipt.basis).toBe("unmeasured");
    }
    expect(r.receipt.rejected.some((x) => /exceeds the 5000 ms budget/.test(x.why))).toBe(true);
  });

  it("rejects a model below the required success rate, with the number in the reason", () => {
    const led = new PerfLedger();
    for (let i = 0; i < 4; i++) {
      led.record({ modelId: MID.id, task: "code", firstTokenMs: 100, totalMs: 200, ok: i === 0 });
    }
    const r = routeTask("code", [MID], led, { minSuccessRate: 0.9 });
    expect(r.ok).toBe(false);
    expect(r.receipt.rejected[0].why).toMatch(/success rate 25%/);
  });

  it("refuses honestly when nothing suits the task", () => {
    const r = routeTask("vision", [SMALL, MID], new PerfLedger());
    expect(r.ok).toBe(false);
    expect(r.receipt.chosen).toBeNull();
    expect(r.receipt.basis).toBe("none");
    expect(r.receipt.refusal).toMatch(/No on-device engine/);
  });

  it("routes vision to a vision model", () => {
    const r = routeTask("vision", [SMALL, VISION], new PerfLedger());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model.id).toBe(VISION.id);
  });

  it("emits a receipt that explains every rejection", () => {
    const r = routeTask("vision", [SMALL, MID, HUGE], new PerfLedger(), {
      totalRamBytes: REAL_RAM,
    });
    expect(r.receipt.rejected.length).toBeGreaterThan(0);
    for (const rej of r.receipt.rejected) {
      expect(rej.why.trim().length).toBeGreaterThan(0);
      expect(rej.modelId.trim().length).toBeGreaterThan(0);
    }
    expect(r.receipt.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("PerfLedger", () => {
  it("returns null for a model it has never seen, not a zero score", () => {
    expect(new PerfLedger().stats("nope:1b", "code")).toBeNull();
  });

  it("uses the median so one cold start does not condemn a model", () => {
    const led = new PerfLedger();
    led.record({ modelId: SMALL.id, task: "code", firstTokenMs: 30_000, totalMs: 1, ok: true });
    for (let i = 0; i < 4; i++) {
      led.record({ modelId: SMALL.id, task: "code", firstTokenMs: 500, totalMs: 1, ok: true });
    }
    expect(led.stats(SMALL.id, "code")!.medianFirstTokenMs).toBe(500);
  });

  it("bounds its history", () => {
    const led = new PerfLedger(3);
    for (let i = 0; i < 10; i++) {
      led.record({ modelId: SMALL.id, task: "code", firstTokenMs: i, totalMs: 1, ok: true });
    }
    expect(led.stats(SMALL.id, "code")!.samples).toBe(3);
  });

  it("keeps tasks separate", () => {
    const led = new PerfLedger();
    led.record({ modelId: SMALL.id, task: "code", firstTokenMs: 100, totalMs: 1, ok: true });
    expect(led.stats(SMALL.id, "general")).toBeNull();
  });
});

describe("hotSwap", () => {
  it("never reselects the model that just failed", () => {
    const led = new PerfLedger();
    const r = hotSwap("code", [SMALL, MID], led, SMALL.id, { totalRamBytes: REAL_RAM });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.model.id).toBe(MID.id);
    expect(r.receipt.rejected[0]).toEqual({
      modelId: SMALL.id,
      why: "failed during this task and was swapped out",
    });
  });

  it("records the failure so the model is penalised on later routes", () => {
    const led = new PerfLedger();
    hotSwap("code", [SMALL, MID], led, SMALL.id, { totalRamBytes: REAL_RAM });
    expect(led.stats(SMALL.id, "code")!.successRate).toBe(0);
  });

  it("refuses honestly when the failed model was the only option", () => {
    const r = hotSwap("code", [SMALL], new PerfLedger(), SMALL.id);
    expect(r.ok).toBe(false);
    expect(r.receipt.refusal).toBeTruthy();
  });
});

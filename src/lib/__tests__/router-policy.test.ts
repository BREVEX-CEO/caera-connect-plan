import { describe, it, expect } from "vitest";
import {
  PerfLedger,
  routeTask,
  hotSwap,
  isDeterministic,
  DETERMINISTIC_TASKS,
} from "../local/router-policy";
import { classifyLocalModel, type LocalModelInfo } from "../ocade-local";

/**
 * These tests were rewritten, not relaxed.
 *
 * The previous suite asserted hardware-based selection: exclude what will not
 * fit in `totalRamBytes`, drop GPU tiers when `hasDiscreteGpu` is false, prefer
 * the fastest MEASURED model, fall back to a device-matched tier. Every one of
 * those behaviours was deliberately removed — the product now uses one fixed
 * model per platform — so a test asserting them would be pinning a rule that no
 * longer exists.
 *
 * What replaces them is stricter in the way that matters: the old suite checked
 * that the machine was consulted CORRECTLY; this one checks that the machine is
 * not consulted AT ALL. That is a harder property to hold accidentally, and it
 * is the actual guarantee — the same computer, the same answer, every time.
 */

const m = (id: string, sizeBytes: number, params: string): LocalModelInfo =>
  classifyLocalModel({ name: id, size: sizeBytes, details: { parameter_size: params } });

/** The desktop fixed model. Everything else is present to be ignored. */
const FIXED = m("qwen3:8b", 5.23e9, "8.2B");
const SMALL = m("deepseek-coder:6.7b", 3.83e9, "7B");
const MID = m("qwen2.5-coder:7b", 4.68e9, "7.6B");
const HUGE = m("qwen3-coder:30b", 18.56e9, "30.5B");
const VISION = classifyLocalModel({
  name: "qwen2.5vl:7b",
  size: 5.97e9,
  details: { parameter_size: "8.3B" },
  capabilities: ["vision", "completion"],
});
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

  it("refuses deterministic work even when the fixed engine is installed", () => {
    const outcome = routeTask("shell" as never, [FIXED], new PerfLedger());
    expect(outcome.ok).toBe(false);
    expect(outcome.receipt.refusal).toMatch(/deterministic/i);
  });
});

describe("the platform decides, and nothing else does", () => {
  it("chooses the fixed engine when it is installed", () => {
    const outcome = routeTask("general", [SMALL, FIXED, HUGE], new PerfLedger());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.model.id).toBe("qwen3:8b");
    expect(outcome.receipt.basis).toBe("fixed");
  });

  it("ignores memory entirely — the same answer on 2 GB and on 64 GB", () => {
    const models = [SMALL, FIXED, HUGE];
    const tiny = routeTask("general", models, new PerfLedger(), { totalRamBytes: 2e9 });
    const huge = routeTask("general", models, new PerfLedger(), { totalRamBytes: 64e9 });
    expect(tiny.ok && tiny.model.id).toBe("qwen3:8b");
    expect(huge.ok && huge.model.id).toBe("qwen3:8b");
  });

  it("ignores whether the machine has a graphics card", () => {
    const models = [SMALL, FIXED, HUGE];
    const without = routeTask("general", models, new PerfLedger(), { hasDiscreteGpu: false });
    const with_ = routeTask("general", models, new PerfLedger(), { hasDiscreteGpu: true });
    expect(without.ok && without.model.id).toBe("qwen3:8b");
    expect(with_.ok && with_.model.id).toBe("qwen3:8b");
  });

  it("ignores measurements, however lopsided", () => {
    // The old rule would have chosen MID here by a wide margin.
    const ledger = new PerfLedger();
    for (let i = 0; i < 5; i += 1) {
      ledger.record({ modelId: MID.id, task: "general", firstTokenMs: 20, totalMs: 40, ok: true });
      ledger.record({
        modelId: FIXED.id,
        task: "general",
        firstTokenMs: 30_000,
        totalMs: 60_000,
        ok: true,
      });
    }
    const outcome = routeTask("general", [MID, FIXED], ledger, { totalRamBytes: REAL_RAM });
    expect(outcome.ok && outcome.model.id).toBe("qwen3:8b");
    expect(outcome.receipt.basis).toBe("fixed");
  });

  it("ignores a device-matched hint pointing somewhere else", () => {
    const outcome = routeTask("general", [MID, FIXED], new PerfLedger(), {
      deviceMatchedModelId: MID.id,
    });
    expect(outcome.ok && outcome.model.id).toBe("qwen3:8b");
  });

  it("never routes to a model the user installed for their own reasons", () => {
    const outcome = routeTask("general", [SMALL, FIXED, HUGE, MID], new PerfLedger());
    expect(outcome.ok && outcome.model.id).toBe("qwen3:8b");
    // ...but it does say why each was passed over, rather than hiding them.
    const passedOver = outcome.receipt.rejected.map((r) => r.modelId).sort();
    expect(passedOver).toEqual(["deepseek-coder:6.7b", "qwen2.5-coder:7b", "qwen3-coder:30b"]);
    for (const entry of outcome.receipt.rejected) {
      expect(entry.why).toMatch(/own configured engine/i);
    }
  });

  it("refuses honestly when its own engine is not installed", () => {
    const outcome = routeTask("general", [SMALL, HUGE], new PerfLedger());
    expect(outcome.ok).toBe(false);
    expect(outcome.receipt.basis).toBe("none");
    expect(outcome.receipt.refusal).toMatch(/not installed/i);
  });

  it("refuses when nothing at all is installed", () => {
    const outcome = routeTask("general", [], new PerfLedger());
    expect(outcome.ok).toBe(false);
  });
});

describe("vision is capability, not preference", () => {
  it("uses an installed vision engine when the request carries an image", () => {
    const outcome = routeTask("vision", [FIXED, VISION], new PerfLedger());
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.model.id).toBe("qwen2.5vl:7b");
    expect(outcome.receipt.basis).toBe("vision_capability");
  });

  it("refuses rather than handing a picture to a text-only engine", () => {
    const outcome = routeTask("vision", [FIXED], new PerfLedger());
    expect(outcome.ok).toBe(false);
    expect(outcome.receipt.refusal).toMatch(/read images/i);
  });

  it("does not use the vision engine for ordinary text", () => {
    const outcome = routeTask("general", [FIXED, VISION], new PerfLedger());
    expect(outcome.ok && outcome.model.id).toBe("qwen3:8b");
  });
});

describe("PerfLedger measures but no longer chooses", () => {
  it("returns null for a model it has never seen, not a zero score", () => {
    expect(new PerfLedger().stats("x", "general")).toBeNull();
  });

  it("uses the median so one cold start does not distort the record", () => {
    const ledger = new PerfLedger();
    for (const ms of [100, 120, 30_000]) {
      ledger.record({ modelId: "a", task: "general", firstTokenMs: ms, totalMs: ms, ok: true });
    }
    expect(ledger.stats("a", "general")?.medianFirstTokenMs).toBe(120);
  });

  it("bounds its history", () => {
    const ledger = new PerfLedger(3);
    for (let i = 0; i < 10; i += 1) {
      ledger.record({ modelId: "a", task: "general", firstTokenMs: i, totalMs: i, ok: true });
    }
    expect(ledger.stats("a", "general")?.samples).toBe(3);
  });

  it("keeps tasks separate", () => {
    const ledger = new PerfLedger();
    ledger.record({ modelId: "a", task: "general", firstTokenMs: 1, totalMs: 1, ok: true });
    expect(ledger.stats("a", "vision")).toBeNull();
  });
});

describe("hotSwap", () => {
  it("refuses instead of falling back to another model when the fixed engine fails", () => {
    /*
     * A swap used to drop to the next-best model by size or measurement. There
     * is no "next best" any more, and inventing one would reintroduce exactly
     * the ranking this change removed — quietly, at the worst moment, when
     * something has already gone wrong.
     *
     * hotSwap excludes the model that just failed, which leaves nothing this
     * platform is allowed to use, so it refuses. The caller reports that the
     * engine failed rather than silently answering from a different one.
     */
    const outcome = hotSwap("general", [FIXED, MID], new PerfLedger(), FIXED.id);
    expect(outcome.ok).toBe(false);
    expect(outcome.receipt.refusal).toMatch(/not installed|no on-device engine/i);
  });

  it("records the failure even though it no longer changes the choice", () => {
    const ledger = new PerfLedger();
    hotSwap("general", [FIXED, MID], ledger, FIXED.id);
    expect(ledger.stats(FIXED.id, "general")?.successRate).toBe(0);
  });
});

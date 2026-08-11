import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  FIXED_MODEL,
  OCADE_MODEL_ID,
  resolveFixedModel,
  selectFixedModel,
  thinkingFor,
} from "@/lib/local/fixed-model";
import { routeTask, PerfLedger, isDeterministic } from "@/lib/local/router-policy";
import type { LocalModelInfo } from "@/lib/ocade-local";

/**
 * One model, one place, and one rule about thinking.
 *
 * This suite replaces `tier-policy.test.ts` and `router-policy.test.ts`, which
 * between them asserted that OCADE picked a model from RAM, GPU presence, a
 * quarantine list, a per-task "profile" preference and a measured-latency
 * ledger. Every one of those tests passed while the product shipped a model
 * nobody chose deliberately — a Qwen3 build whose `/no_think` control token
 * leaked into a YouTube search argument.
 *
 * So the assertions are inverted: the interesting property is now that NOTHING
 * selects, on any input, however tempting the alternatives look.
 */

const model = (id: string, extra: Partial<LocalModelInfo> = {}): LocalModelInfo =>
  ({
    id,
    label: id,
    profile: "general",
    sizeBytes: 1_000,
    vision: false,
    isCloudPointer: false,
    ...extra,
  }) as LocalModelInfo;

describe("the one fixed model", () => {
  it("is qwen3:4b at Q4_K_M", () => {
    expect(OCADE_MODEL_ID).toBe("qwen3:4b");
    expect(FIXED_MODEL.id).toBe("qwen3:4b");
    expect(FIXED_MODEL.family).toBe("Qwen3");
    expect(FIXED_MODEL.parameters).toBe("4B");
    expect(FIXED_MODEL.quantisation).toBe("Q4_K_M");
  });

  it("is the same weights on a phone and a laptop", () => {
    for (const platform of ["windows", "macos", "linux", "android", "ios"] as const) {
      expect(resolveFixedModel(platform).id).toBe(OCADE_MODEL_ID);
      expect(resolveFixedModel(platform).quantisation).toBe("Q4_K_M");
    }
  });

  it("is small enough for the device that has least room", () => {
    // The reason 4B replaced 7B: a phone has to be able to host it, and a
    // single model is only single if every platform can actually run it.
    expect(FIXED_MODEL.approxBytes).toBeLessThan(3_000_000_000);
  });
});

describe("thinking is spent where it is worth spending", () => {
  it("reasons on both surfaces, because the measurement said so", () => {
    /*
     * The intuitive setting for Control + Work is `think:false` — the turn is
     * "emit one JSON action", which is not a reasoning problem. Measured
     * against qwen3:4b on the target machine, warm, same prompt:
     *
     *   think:false   24.2 s  content began "Okay, the user is asking what's
     *                         on their screen…" — the reasoning, in the field
     *                         the tool parser reads, JSON buried after it.
     *   think:true    25.7 s  content was exactly
     *                         {"tool":"screen_observe","arguments":{}}
     *
     * `think:false` does not stop Qwen3 reasoning; it stops Ollama SEPARATING
     * the reasoning. Same latency, dirtier channel. The latency win for PC
     * control comes from the fast router not calling the model at all.
     */
    expect(thinkingFor("chat")).toBe(true);
    expect(thinkingFor("control")).toBe(true);
  });

  it("is wired into every one of the three engine paths", () => {
    // Three separate call sites reach the runtime, and one of them silently had
    // no `think` flag at all — so the signed-in product reasoned while the
    // policy said it did. Pinned as source because that is where the bug was.
    const chatHook = readFileSync("src/lib/chat/use-local-chat-engine.ts", "utf8");
    expect(chatHook).toMatch(/think:\s*thinkingFor\(/);

    const reasoning = readFileSync("src/lib/reasoning/browser-deps.ts", "utf8");
    expect(reasoning).toMatch(/think:\s*thinkingFor\("chat"\)/);

    const mission = readFileSync("src/lib/work/use-mission-brain.ts", "utf8");
    expect(mission).toMatch(/surface:\s*"control"/);
  });
});

describe("nothing selects a model any more", () => {
  const ledger = new PerfLedger();

  it("ignores a far larger installed model", () => {
    const outcome = routeTask(
      "general",
      [model(OCADE_MODEL_ID), model("qwen3:14b", { sizeBytes: 9_276_198_565 })],
      ledger,
      {},
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.model.id).toBe(OCADE_MODEL_ID);
  });

  it("ignores memory, GPU presence and measured speed", () => {
    // Every one of these inputs used to change the answer.
    for (const policy of [
      {},
      { totalRamBytes: 1_000_000 },
      { totalRamBytes: 64 * 1024 ** 3 },
      { hasDiscreteGpu: false },
      { hasDiscreteGpu: true },
    ]) {
      const outcome = routeTask(
        "general",
        [model(OCADE_MODEL_ID), model("qwen3:14b")],
        ledger,
        policy,
      );
      expect(outcome.ok && outcome.model.id, JSON.stringify(policy)).toBe(OCADE_MODEL_ID);
    }
  });

  it("gives the same answer for every task kind", () => {
    for (const task of ["general", "code", "summarise", "embed"] as const) {
      const outcome = routeTask(
        task,
        [model(OCADE_MODEL_ID), model("deepseek-coder:6.7b")],
        ledger,
      );
      expect(outcome.ok && outcome.model.id, task).toBe(OCADE_MODEL_ID);
    }
  });

  it("refuses honestly when its own engine is absent", () => {
    const outcome = routeTask("general", [model("qwen3:14b")], ledger);
    expect(outcome.ok).toBe(false);
    expect(outcome.receipt.chosen).toBeNull();
    expect(outcome.receipt.refusal).toMatch(/not installed/i);
  });

  it("never routes to a cloud pointer", () => {
    const outcome = routeTask("general", [model(OCADE_MODEL_ID, { isCloudPointer: true })], ledger);
    expect(outcome.ok).toBe(false);
  });

  it("still substitutes a vision model for an image, which is capability not preference", () => {
    const outcome = routeTask(
      "vision",
      [model(OCADE_MODEL_ID), model("qwen2.5vl:7b", { vision: true })],
      ledger,
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.ok && outcome.model.id).toBe("qwen2.5vl:7b");
  });

  it("keeps refusing deterministic work outright", () => {
    // Unrelated to selection, and the reason `router-policy` still exists.
    expect(isDeterministic("arithmetic")).toBe(true);
    expect(isDeterministic("general")).toBe(false);
  });
});

describe("no old model architecture survives", () => {
  it("has no tier policy left to disagree with the router", () => {
    expect(() => readFileSync("src/lib/local/tier-policy.ts", "utf8")).toThrow();
  });

  it("names no superseded engine anywhere in src", () => {
    // A stray "qwen3:8b" in a fallback, a label or a default is exactly how the
    // product ends up running something nobody chose.
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(entry.name) && !path.includes("__tests__")) {
          const text = readFileSync(path, "utf8");
          for (const stale of ["qwen3:8b", "qwen3:1.7b", "qwen3:30b", "qwen2.5-coder:7b"]) {
            if (text.includes(stale)) offenders.push(`${path} → ${stale}`);
          }
        }
      }
    };
    walk("src");
    expect(offenders).toEqual([]);
  });
});

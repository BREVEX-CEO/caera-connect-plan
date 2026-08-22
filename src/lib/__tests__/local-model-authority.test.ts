import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FIXED_MODEL,
  NO_THINK_TOKEN,
  OCADE_MODEL_ID,
  resolveFixedModel,
  selectFixedModel,
  thinkingFor,
  thinkingSuffix,
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
  it("is qwen2.5:3b at Q4_K_M", () => {
    /*
     * It was qwen3:4b. That model cannot be stopped from reasoning — its chat
     * template opens an unguarded `<think>` on every generation — and the
     * reasoning consumed the token budget before a tool call was ever written:
     * no call at 300 tokens, none at 800, and one only at 2000 tokens and 125
     * seconds. A tool call that never arrives is not a slow success.
     *
     * Qwen2.5 has no forced thinking block, supports Ollama tool calling, and
     * is 600 MB smaller to download on first run.
     */
    expect(OCADE_MODEL_ID).toBe("qwen2.5:3b");
    expect(FIXED_MODEL.id).toBe("qwen2.5:3b");
    expect(FIXED_MODEL.family).toBe("Qwen2.5");
    expect(FIXED_MODEL.parameters).toBe("3B");
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
  it("never reasons on Control + Work, whatever the caller asks for", () => {
    /*
     * THIS TEST USED TO ASSERT THE OPPOSITE, AND THE MEASUREMENT BEHIND IT WAS
     * ASKING THE WRONG QUESTION.
     *
     * The old note recorded that `think:true` produced a clean
     * `{"tool":"screen_observe"}` in `content` while `think:false` buried it
     * under reasoning, and concluded that both surfaces should reason.
     *
     * But `ocade-local.ts` reads `message.tool_calls`. It has no content-JSON
     * fallback. A tool call written as prose in `content` is not a tool call —
     * it is a turn the loop cannot execute.
     *
     * Re-measured with `scripts/measure-thinking-modes.mjs`, counting NATIVE
     * tool calls, three warm-ups and five runs per mode:
     *
     *   think:false                     0/5 tool calls   22.4 s
     *   think:true                      0/5 tool calls   21.2 s
     *   think omitted                   0/5 tool calls   21.6 s
     *   /no_think in the system prompt   5/5 tool calls   14.4 s
     *
     * So the `think` field does not control thinking on this model at all — it
     * only moves the reasoning between `content` and `thinking`. The token is
     * what suppresses it, and suppressing it is both necessary and faster.
     *
     * `control` is therefore not a preference. A caller cannot switch it on.
     */
    expect(thinkingFor("control")).toBe(false);
    expect(thinkingFor("control", true)).toBe(false);
    expect(thinkingFor("control", false)).toBe(false);
  });

  it("lets the person using Chat decide, and reasons unless told not to", () => {
    // Chat is read by a human, the reasoning improves the answer, and there it
    // goes to its own field rather than into the reply. The cost is roughly a
    // third more time, which is the user's call to make and nobody else's.
    expect(thinkingFor("chat")).toBe(true);
    expect(thinkingFor("chat", undefined)).toBe(true);
    expect(thinkingFor("chat", true)).toBe(true);
    expect(thinkingFor("chat", false)).toBe(false);
  });

  it("keeps the suppression token out of anything the user typed", () => {
    // A search once ran for the literal string "/no_think" because the token
    // had been appended to the user's prompt. It belongs in the system
    // message, where no downstream parser can mistake it for content.
    expect(thinkingSuffix(false).trim()).toBe(NO_THINK_TOKEN);
    expect(thinkingSuffix(true)).toBe("");

    const source = readFileSync(
      fileURLToPath(new URL("../agent/model-turn.node.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain('role: "system"');
    expect(source).toContain("thinkingSuffix");
    // The token must never be concatenated onto a user turn.
    expect(source).not.toMatch(/role:\s*"user"[^}]*thinkingSuffix/);
  });

  it("is wired into every one of the three engine paths", () => {
    // Three separate call sites reach the runtime, and one of them silently had
    // no `think` flag at all — so the signed-in product reasoned while the
    // policy said it did. Pinned as source because that is where the bug was.
    const chatHook = readFileSync("src/lib/chat/use-local-chat-engine.ts", "utf8");
    // Destructured, not read off `context` — an unlisted dependency would make
    // the switch take effect only after a remount.
    expect(chatHook).toMatch(/thinkingFor\(contextSurface, contextThinking\)/);
    // And the switch has to reach the request, not just the variable: on a
    // model with no reasoning mode the flag alone would leave it decorative.
    expect(chatHook).toMatch(/deliberationClause\(deliberate\)/);

    // The third path used to call `thinkingFor("chat")` with NO argument,
    // which returns `preference ?? true` — always on. So the switch saved a
    // value nothing read. Pinning the preference is what keeps that fixed;
    // pinning the old argument-less call would pin the bug.
    //
    // It also used to live in `reasoning/browser-deps.ts`, which streamed
    // straight to Ollama and has been retired: the same job is done by the
    // `desktop_bridge` adapter inside the Brain registry, so Chat now reaches
    // every engine — WebGPU, WASM, bridge, paired — through one chain.
    const chatScreen = readFileSync("src/routes/_authenticated/ocade.index.tsx", "utf8");
    expect(chatScreen).toMatch(/thinkingFor\("chat",\s*chatPrefs\.thinking\)/);
    expect(chatScreen).toContain("brainReasonDeps(brainRoute");

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

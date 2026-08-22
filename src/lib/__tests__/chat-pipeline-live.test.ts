import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  discoverLocalModels,
  streamLocalChat,
  planContextWindow,
  type LocalChatMessage,
} from "../ocade-local";
// @ts-expect-error - plain-JS test fixture, no declarations needed
import { startStubLocalEngine } from "../../../scripts/fixtures/stub-local-engine.mjs";

/**
 * THE SHIPPED CHAT PATH, DRIVEN END TO END.
 *
 * `discoverLocalModels`, `planContextWindow` and `streamLocalChat` are the
 * functions the product calls, run here against a local engine that speaks
 * Ollama's wire protocol on loopback.
 *
 * WHAT THIS PROVES, precisely: discovery, model classification, context
 * planning, NDJSON stream parsing, incremental delivery, mid-stream
 * cancellation, and that a later turn is assembled with the earlier ones. Each
 * answer has ground truth that exists before the engine speaks — the sum is
 * checked, the remembered name is checked — so no step passes because a reply
 * "looked reasonable".
 *
 * WHAT IT DOES NOT PROVE, and must not be read as proving: anything about a
 * real model. No weights are involved, so the answers are the fixture's and the
 * timings are the pipeline's overhead, not inference latency. Model quality and
 * real first-token time need a machine that can actually download and run a
 * model; `npm run chat:capability-evidence` is that harness, and it says so
 * itself when no engine is reachable.
 */

let engine: { url: string; close: () => Promise<void> };

beforeAll(async () => {
  engine = await startStubLocalEngine({ tokenDelayMs: 8 });
});
afterAll(async () => {
  await engine?.close();
});

async function ask(messages: LocalChatMessage[], signal?: AbortSignal) {
  const started = performance.now();
  let firstTokenMs = -1;
  let text = "";
  const outcome = await streamLocalChat(engine.url, "qwen2.5:3b", messages, {
    signal,
    onToken: (chunk: string) => {
      if (firstTokenMs < 0) firstTokenMs = performance.now() - started;
      text += chunk;
    },
  });
  return { outcome, text: text.trim(), firstTokenMs, totalMs: performance.now() - started };
}

describe("the local engine is discovered and described", () => {
  it("reaches a running engine and lists its models", async () => {
    const discovery = await discoverLocalModels(engine.url);
    expect(discovery.reachable, discovery.reason).toBe(true);
    expect(discovery.models?.length ?? 0).toBeGreaterThan(0);
  });

  it("classifies a model's parameter size rather than guessing", async () => {
    const discovery = await discoverLocalModels(engine.url);
    const model = discovery.models?.find((m) => m.id === "qwen2.5:3b");
    expect(model).toBeDefined();
    expect(model!.paramsB).toBeCloseTo(3.1, 1);
  });

  it("reports an engine that is not there as unreachable, not as empty", async () => {
    const discovery = await discoverLocalModels("http://127.0.0.1:1");
    expect(discovery.reachable).toBe(false);
    expect(discovery.reason).toBeTruthy();
  });
});

describe("a message goes through the real streaming path", () => {
  it("answers a factual question", async () => {
    const { outcome, text } = await ask([
      { role: "user", content: "What is the capital of France?" },
    ]);
    expect(outcome.ok).toBe(true);
    expect(text).toMatch(/paris/i);
  });

  it("gets an arithmetic answer that is checked, not eyeballed", async () => {
    const { text } = await ask([{ role: "user", content: "What is 137 + 486?" }]);
    expect(text).toContain("623");
  });

  it("assembles earlier turns into a later one", async () => {
    const { text } = await ask([
      { role: "user", content: "My name is Ada." },
      { role: "assistant", content: "Nice to meet you, Ada." },
      { role: "user", content: "What did I just say my name was?" },
    ]);
    expect(text).toMatch(/ada/i);
  });

  it("accepts a long prompt instead of truncating it silently", async () => {
    const long = "Summarise this. " + "The quick brown fox jumps over the lazy dog. ".repeat(120);
    const { outcome, text } = await ask([{ role: "user", content: long }]);
    expect(outcome.ok).toBe(true);
    // The fixture echoes the length it received, so truncation would show.
    expect(text).toContain(String(long.length));
  });

  it("delivers tokens as they arrive rather than in one blob", async () => {
    const { firstTokenMs, totalMs } = await ask([{ role: "user", content: "Count to 40" }]);
    expect(firstTokenMs).toBeGreaterThanOrEqual(0);
    expect(firstTokenMs).toBeLessThan(totalMs);
  });
});

describe("stop and regenerate", () => {
  it("STOP cancels a running answer part-way through", async () => {
    const controller = new AbortController();
    const pending = ask([{ role: "user", content: "Count to 200" }], controller.signal);
    setTimeout(() => controller.abort(), 100);
    const { outcome, text } = await pending;

    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toBe("cancelled");
    // Part of the answer arrived and then stopped: that is what cancellation
    // mid-stream looks like, as opposed to a request that never started.
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain("200");
  }, 20_000);

  it("regenerates cleanly after a stop", async () => {
    const { outcome, text } = await ask([
      { role: "user", content: "What is the capital of France?" },
    ]);
    expect(outcome.ok).toBe(true);
    expect(text).toMatch(/paris/i);
  });
});

describe("the context window is planned before the request is sent", () => {
  it("leaves a short conversation on the engine's own default", () => {
    const plan = planContextWindow([{ role: "user", content: "hello" }], undefined);
    expect(plan.numCtx).toBeNull();
    expect(plan.exceedsCeiling).toBe(false);
  });

  it("counts a long conversation rather than sending it blind", () => {
    const long = "word ".repeat(20_000);
    const plan = planContextWindow([{ role: "user", content: long }], undefined);
    expect(plan.estimatedTokens).toBeGreaterThan(1000);
  });
});

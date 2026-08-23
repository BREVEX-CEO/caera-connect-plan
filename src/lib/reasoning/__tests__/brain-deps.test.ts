/**
 * THE TEST FOR "CAN A BROWSER-ONLY MACHINE ANSWER?"
 *
 * The answer used to be no. The signed-in Chat page streamed from
 * `http://localhost:11434` — Ollama, an application the user installs — so a
 * clean laptop with only Chrome downloaded a 340 MB WebGPU model through
 * `useBrain.warm()` and then had nothing that would generate with it, because
 * `useBrain` exposes `route` and `warm` and no `generate`.
 *
 * These tests drive `reason()` over a Brain adapter with `fetch` removed from
 * the environment entirely. Nothing can reach 11434, or anywhere else, so a
 * passing run is evidence that the answer came from the adapter.
 */
import { describe, it, expect, vi } from "vitest";
import { brainReasonDeps } from "../brain-deps";
import { reason } from "../engine";
import { assembleSystemPrompt } from "@/lib/prompt/assemble";
import type { BrainAdapter, BrainMessage, BrainStreamHandlers } from "@/lib/brain/adapter";
import type { RouteChosen } from "@/lib/brain/router";

function adapter(
  over: Partial<BrainAdapter> = {},
  capture?: { messages: BrainMessage[][]; handlers: BrainStreamHandlers[] },
): BrainAdapter {
  return {
    id: "browser_webgpu",
    displayName: "Browser WebGPU",
    probe: async () => ({
      available: true,
      label: "OCADE Local",
      locality: "on_device",
      capabilities: { text: true, vision: false, imageGeneration: false, tools: false },
      modelId: "test-model",
    }),
    stream: async (messages, handlers) => {
      capture?.messages.push(messages);
      capture?.handlers.push(handlers);
      handlers.onToken("on-device answer");
      return { ok: true, modelId: "test-model", firstTokenMs: 12 };
    },
    ...over,
  } as BrainAdapter;
}

function route(a: BrainAdapter = adapter(), vision = false): RouteChosen {
  return {
    ok: true,
    adapter: a,
    availability: {
      available: true,
      label: "OCADE Local",
      locality: "on_device",
      capabilities: { text: true, vision, imageGeneration: false, tools: false },
      modelId: "test-model",
    },
    attempts: [],
    mode: "pc_web",
  };
}

/** Remove every network primitive, so any escape attempt throws. */
function withNoNetwork<T>(body: () => Promise<T>): Promise<T> {
  vi.stubGlobal("fetch", () => {
    throw new Error("the network was used, and it must not have been");
  });
  return body().finally(() => vi.unstubAllGlobals());
}

const ask = (system: string) => ({
  messages: [
    { role: "system" as const, content: system },
    { role: "user" as const, content: "Hello." },
  ],
  task: "general" as const,
  modelId: "test-model",
});

describe("a device with only a browser can answer", () => {
  it("generates through the Brain adapter with no network at all", async () => {
    const result = await withNoNetwork(() =>
      reason(brainReasonDeps(route()), ask(assembleSystemPrompt({ surface: "chat" }))),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.text).toBe("on-device answer");
    expect(result.receipt.servedBy).toBe("local");
  });

  it("carries the constitution to the adapter as the first system message", async () => {
    const capture = { messages: [] as BrainMessage[][], handlers: [] as BrainStreamHandlers[] };
    const system = assembleSystemPrompt({ surface: "chat" });
    await withNoNetwork(() => reason(brainReasonDeps(route(adapter({}, capture))), ask(system)));
    expect(capture.messages).toHaveLength(1);
    expect(capture.messages[0][0].role).toBe("system");
    expect(capture.messages[0][0].content).toContain("developed and created by CAERA CADANE");
    expect(capture.messages[0][0].content).toContain("# ocade_behavior");
  });

  it("passes Fast and Thinking through to the adapter", async () => {
    for (const think of [true, false]) {
      const capture = { messages: [] as BrainMessage[][], handlers: [] as BrainStreamHandlers[] };
      await withNoNetwork(() =>
        reason(
          brainReasonDeps(route(adapter({}, capture)), { think }),
          ask(assembleSystemPrompt({ surface: "chat", mode: think ? "thinking" : "fast" })),
        ),
      );
      expect(capture.handlers[0].think).toBe(think);
    }
  });

  it("attaches images to the user turn rather than dropping them silently", async () => {
    const capture = { messages: [] as BrainMessage[][], handlers: [] as BrainStreamHandlers[] };
    await withNoNetwork(() =>
      reason(
        brainReasonDeps(route(adapter({}, capture), true), { images: ["AAAA"] }),
        ask("system"),
      ),
    );
    const sent = capture.messages[0];
    const userTurn = [...sent].reverse().find((m) => m.role === "user");
    expect(userTurn?.images).toEqual(["AAAA"]);
    // And never onto the system message, where a vision adapter would not look.
    expect(sent[0].images).toBeUndefined();
  });

  it("reports a stopped generation as cancelled, not as an error", async () => {
    const stopping = adapter({
      stream: async () => ({ ok: false, failure: "cancelled", reason: "user stopped" }),
    });
    const result = await withNoNetwork(() =>
      reason(brainReasonDeps(route(stopping)), ask("system")),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.failure).toBe("cancelled");
  });

  it("surfaces an adapter failure without inventing an answer", async () => {
    const broken = adapter({
      stream: async () => ({ ok: false, failure: "error", reason: "WebGPU device lost" }),
    });
    const result = await withNoNetwork(() => reason(brainReasonDeps(route(broken)), ask("system")));
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toContain("WebGPU device lost");
    expect(result.reason).toMatch(/not sent to any server/i);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createEngineIntelligenceTransport } from "../engine-transport";
import type { IntelligenceRequest } from "../contract";

function request(signal?: AbortSignal): IntelligenceRequest {
  return {
    permit: {
      id: "permit-1",
      generationId: "generation-1",
      idempotencyKey: "request-1",
      surface: "cowork",
      source: "server",
    },
    generationId: "generation-1",
    idempotencyKey: "request-1",
    surface: "cowork",
    mode: "local_only",
    messages: [{ role: "user", content: "Do the work" }],
    tools: [{ name: "observe", description: "Observe", inputSchema: { type: "object" } }],
    attachments: [],
    privacy: {
      storageMode: "browser_only",
      onlineInferenceConsented: false,
      sealed: true,
    },
    ...(signal ? { signal } : {}),
  };
}

describe("existing local engine intelligence transport", () => {
  it("normalizes tokens, tool calls and the final response", async () => {
    const engine = {
      send: vi.fn(async (options: Parameters<ReturnType<typeof engineFactory>["send"]>[0]) => {
        options.onToken("done");
        options.onToolCall?.({ name: "observe", arguments: { target: "screen" } });
        return { ok: true };
      }),
      stop: vi.fn(),
    };
    const events = [];
    for await (const event of createEngineIntelligenceTransport(engine).stream(request())) {
      events.push(event);
    }
    expect(events).toContainEqual({ type: "token", text: "done" });
    expect(events).toContainEqual({
      type: "tool_call",
      call: {
        id: "generation-1:tool:0",
        name: "observe",
        arguments: { target: "screen" },
      },
    });
    expect(events.at(-1)).toMatchObject({
      type: "final",
      response: { text: "done", stopReason: "tool_use" },
    });
    expect(engine.send.mock.calls[0]?.[0].tools).toHaveLength(1);
  });

  it("propagates request cancellation and never emits a fake final", async () => {
    const controller = new AbortController();
    const engine = engineFactory(async (options) => {
      await new Promise<void>((resolve) => {
        options.signal?.addEventListener("abort", () => resolve(), { once: true });
        controller.abort("stop");
      });
      return { ok: false, cancelled: true };
    });
    const events = [];
    for await (const event of createEngineIntelligenceTransport(engine).stream(
      request(controller.signal),
    )) {
      events.push(event);
    }
    expect(events).toContainEqual({
      type: "refusal",
      code: "cancelled",
      reason: "Stopped by the user.",
      retryable: false,
    });
    expect(events.some((event) => event.type === "final")).toBe(false);
  });

  it("uses the engine's stop authority when the router cancels", () => {
    const engine = engineFactory(async () => ({ ok: false, cancelled: true }));
    createEngineIntelligenceTransport(engine).cancel?.("generation-1");
    expect(engine.stop).toHaveBeenCalledOnce();
  });
});

function engineFactory(
  send: (options: {
    messages: { role: "system" | "user" | "assistant"; content: string }[];
    onToken(chunk: string): void;
    tools?: readonly unknown[];
    onToolCall?(call: { id?: string; name: string; arguments: Record<string, unknown> }): void;
    signal?: AbortSignal;
  }) => Promise<{ ok: boolean; reason?: string; cancelled?: boolean }>,
) {
  return { send: vi.fn(send), stop: vi.fn() };
}

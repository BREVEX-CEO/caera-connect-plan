import { describe, expect, it, vi } from "vitest";
import { streamLocalToolTurn } from "../ocade-local";

describe("native Ollama tool-call streaming", () => {
  it("sends typed tools and collects a streamed tool call without requiring a trailing newline", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('{"message":{"content":"I will "},"done":false}\n'),
          );
          controller.enqueue(
            new TextEncoder().encode(
              '{"message":{"content":"inspect.","tool_calls":[{"function":{"name":"world.observe","arguments":{}}}]},"done":true}',
            ),
          );
          controller.close();
        },
      });
      return new Response(stream, { status: 200 });
    });
    const tokens: string[] = [];
    const calls: string[] = [];
    const result = await streamLocalToolTurn(
      "http://127.0.0.1:11434/",
      "qwen3:8b",
      [{ role: "user", content: "Inspect the active screen." }],
      [
        {
          type: "function",
          function: {
            name: "world.observe",
            description: "Observe the current world.",
            parameters: { type: "object", properties: {}, additionalProperties: false },
          },
        },
      ],
      {
        onToken: (chunk) => tokens.push(chunk),
        onToolCall: (call) => calls.push(call.function.name),
      },
      fetchImpl,
    );

    expect(result).toMatchObject({ ok: true, content: "I will inspect." });
    expect(result.toolCalls).toEqual([{ function: { name: "world.observe", arguments: {} } }]);
    expect(tokens).toEqual(["I will ", "inspect."]);
    expect(calls).toEqual(["world.observe"]);
    expect(bodies[0]).toMatchObject({ model: "qwen3:8b", stream: true, think: false });
    expect(bodies[0].tools).toHaveLength(1);
  });

  it("rejects an unbounded or malformed tool catalogue before contacting Ollama", async () => {
    const fetchImpl = vi.fn();
    const result = await streamLocalToolTurn(
      "http://127.0.0.1:11434",
      "qwen3:8b",
      [{ role: "user", content: "Do something." }],
      [{ type: "function", function: { name: "raw shell", description: "no", parameters: {} } }],
      {},
      fetchImpl,
    );
    expect(result).toMatchObject({ ok: false, reason: expect.stringMatching(/malformed/i) });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";
import { streamLocalChat } from "../ocade-local";

describe("local Chat transport", () => {
  it("sends image bytes to a local vision engine instead of dropping them", async () => {
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        messages: Array<{ role: string; content: string; images?: string[] }>;
      };
      expect(body.messages.at(-1)).toEqual({
        role: "user",
        content: "What is shown?",
        images: ["aW1hZ2UtYnl0ZXM="],
      });
      return new Response('{"message":{"content":"A diagram."},"done":true}\n', {
        status: 200,
      });
    });
    let answer = "";
    const result = await streamLocalChat(
      "http://127.0.0.1:11434",
      "vision-model",
      [
        {
          role: "user",
          content: "What is shown?",
          images: ["aW1hZ2UtYnl0ZXM="],
        },
      ],
      { onToken: (chunk) => (answer += chunk) },
      fetchImpl,
    );
    expect(result.ok).toBe(true);
    expect(answer).toBe("A diagram.");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

/*
 * Hidden reasoning is off by default because it was MEASURED to be the
 * difference between a usable chat and one that looks frozen. Same model, same
 * one-word question, on the reference machine:
 *
 *     reasoning on   163,215 ms to the first visible character
 *     reasoning off   60,991 ms cold, 27,863 ms warm
 *
 * The answer was "Tokyo" every time. Those tokens are generated and then never
 * shown, so the entire cost is paid by the user for nothing they can read.
 */
describe("hidden reasoning is disabled unless the caller asks for it", () => {
  const capture = () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response('{"message":{"content":"ok"},"done":true}\n', { status: 200 });
    });
    return { bodies, fetchImpl };
  };

  it("asks the runtime not to think when nothing is specified", async () => {
    const { bodies, fetchImpl } = capture();
    await streamLocalChat(
      "http://127.0.0.1:11434",
      "qwen3:8b",
      [{ role: "user", content: "hi" }],
      { onToken: () => {} },
      fetchImpl,
    );
    expect(bodies[0].think).toBe(false);
  });

  it("honours an explicit request to think", async () => {
    const { bodies, fetchImpl } = capture();
    await streamLocalChat(
      "http://127.0.0.1:11434",
      "qwen3:8b",
      [{ role: "user", content: "hi" }],
      { onToken: () => {}, think: true },
      fetchImpl,
    );
    expect(bodies[0].think).toBe(true);
  });

  it("retries without the field when the runtime rejects it, rather than failing the chat", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      if ("think" in body) {
        return new Response('{"error":"model does not support think"}', { status: 400 });
      }
      return new Response('{"message":{"content":"answered"},"done":true}\n', { status: 200 });
    });
    let answer = "";
    const result = await streamLocalChat(
      "http://127.0.0.1:11434",
      "deepseek-coder:6.7b",
      [{ role: "user", content: "hi" }],
      { onToken: (c) => (answer += c) },
      fetchImpl,
    );
    expect(result.ok).toBe(true);
    expect(answer).toBe("answered");
    expect(bodies).toHaveLength(2);
    expect("think" in bodies[1]).toBe(false);
  });

  it("does not retry a 400 that has nothing to do with reasoning", async () => {
    const fetchImpl = vi.fn(
      async () => new Response('{"error":"model not found"}', { status: 400 }),
    );
    const result = await streamLocalChat(
      "http://127.0.0.1:11434",
      "missing:1b",
      [{ role: "user", content: "hi" }],
      { onToken: () => {} },
      fetchImpl,
    );
    expect(result.ok).toBe(false);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});

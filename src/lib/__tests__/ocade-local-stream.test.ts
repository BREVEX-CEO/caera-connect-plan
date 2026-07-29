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

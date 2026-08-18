import { describe, expect, it, vi } from "vitest";
import { pullModel } from "../model-lifecycle";

function stream(lines: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(`${line}\n`));
      controller.close();
    },
  });
}

describe("Ollama local model download retry", () => {
  it("automatically retries an interrupted pull and reports the retry", async () => {
    const retry = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("connection reset"))
      .mockResolvedValueOnce(
        new Response(
          stream([
            JSON.stringify({ status: "pulling manifest" }),
            JSON.stringify({ status: "downloading", completed: 100, total: 100 }),
            JSON.stringify({ status: "success" }),
          ]),
          { status: 200 },
        ),
      );
    const result = await pullModel("http://localhost:11434", "qwen2.5:3b", {
      fetchImpl,
      onRetry: retry,
      maxAttempts: 5,
      retryBaseDelayMs: 0,
      sleep: async () => {},
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.attempts).toBe(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(retry).toHaveBeenCalledTimes(1);
    expect(retry.mock.calls[0][0].message).toMatch(/retrying automatically \(2\/5\)/i);
    expect(retry.mock.calls[0][0].message).toMatch(/completed Ollama blobs will be reused/i);
  });

  it("stops after the bounded retry count and keeps resumable progress", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError("offline"));
    const result = await pullModel("http://localhost:11434", "qwen2.5:3b", {
      fetchImpl,
      maxAttempts: 3,
      retryBaseDelayMs: 0,
      sleep: async () => {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/retried.*3 times.*preserved resumable progress/i);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry deliberate cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    const result = await pullModel("http://localhost:11434", "qwen2.5:3b", {
      fetchImpl,
      signal: controller.signal,
      maxAttempts: 5,
      retryBaseDelayMs: 0,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.failure).toBe("cancelled");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

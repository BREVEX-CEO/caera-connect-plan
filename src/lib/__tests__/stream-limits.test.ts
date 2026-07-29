import { describe, it, expect } from "vitest";
import {
  assertStreamWithinLimit,
  StreamLimitError,
  MAX_STREAM_CHARS,
  MAX_STREAM_LINE_CHARS,
} from "../stream-limits";
import { streamLocalChat } from "../ocade-local";

/**
 * Bounds on streamed replies.
 *
 * Two readers accumulated with no cap at all — the cloud chat reader in the
 * OCADE route and the local-engine reader here. Both stopped only when the
 * server chose to stop. Cancellation existed at both, but cancellation is
 * something the USER does; nothing bounded a server that just keeps sending.
 *
 * The local case is not purely hypothetical: the bridge URL is configurable, so
 * it can address something that is neither local nor a model server.
 */

describe("the limit guard", () => {
  it("permits a stream inside its budget", () => {
    expect(() => assertStreamWithinLimit(10, 100)).not.toThrow();
    // Exactly at the limit is still allowed; only exceeding it stops.
    expect(() => assertStreamWithinLimit(100, 100)).not.toThrow();
  });

  it("throws a named error once the budget is passed", () => {
    expect(() => assertStreamWithinLimit(101, 100)).toThrow(StreamLimitError);
  });

  it("explains itself rather than failing bare", () => {
    try {
      assertStreamWithinLimit(101, 100, "reply");
      throw new Error("unreachable");
    } catch (error) {
      expect((error as Error).message).toMatch(/exceeded/i);
      expect((error as Error).message).toMatch(/does not end/i);
    }
  });

  it("keeps the budgets large enough for real replies", () => {
    // A cap low enough to truncate ordinary answers would be its own defect.
    expect(MAX_STREAM_CHARS).toBeGreaterThanOrEqual(1_000_000);
    expect(MAX_STREAM_LINE_CHARS).toBeGreaterThanOrEqual(500_000);
  });
});

/** A response whose body streams forever, never closing and never ending. */
function endlessResponse(chunk: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(encoder.encode(chunk));
    },
  });
  return new Response(body, { status: 200 });
}

describe("a local engine that never stops is stopped", () => {
  it("ends a stream that never sends a newline instead of buffering forever", async () => {
    // The NDJSON case: bytes are held until a newline arrives, so a stream
    // without one is unbounded even while the total looks small.
    const tokens: string[] = [];
    const result = await streamLocalChat(
      "http://localhost:11434",
      "model",
      [{ role: "user", content: "hi" }],
      { onToken: (t) => tokens.push(t) },
      async () => endlessResponse("x".repeat(64 * 1024)),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exceeded/i);
    // The specific reason survives; it is not flattened into "interrupted".
    expect(result.reason).not.toMatch(/interrupted/i);
  }, 60_000);

  it("ends a stream of well-formed lines that never finishes", async () => {
    const line = `${JSON.stringify({ message: { content: "tok" } })}\n`;
    const tokens: string[] = [];
    const result = await streamLocalChat(
      "http://localhost:11434",
      "model",
      [{ role: "user", content: "hi" }],
      { onToken: (t) => tokens.push(t) },
      async () => endlessResponse(line.repeat(2_000)),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/exceeded/i);
    // Tokens genuinely arrived before the budget stopped it — the guard bounds
    // the stream, it does not break ordinary streaming.
    expect(tokens.length).toBeGreaterThan(0);
  }, 60_000);

  it("still completes a normal, finite stream", async () => {
    // The guard must not turn a working path into a failing one.
    const encoder = new TextEncoder();
    const lines =
      `${JSON.stringify({ message: { content: "Hello" } })}\n` +
      `${JSON.stringify({ message: { content: " world" } })}\n`;
    const tokens: string[] = [];
    const result = await streamLocalChat(
      "http://localhost:11434",
      "model",
      [{ role: "user", content: "hi" }],
      { onToken: (t) => tokens.push(t) },
      async () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoder.encode(lines));
              controller.close();
            },
          }),
          { status: 200 },
        ),
    );

    expect(result.ok).toBe(true);
    expect(tokens.join("")).toBe("Hello world");
  }, 60_000);
});

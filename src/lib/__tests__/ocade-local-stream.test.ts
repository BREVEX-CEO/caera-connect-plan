import { describe, expect, it, vi } from "vitest";
import { streamLocalChat, preloadLocalModel, MODEL_KEEP_ALIVE } from "../ocade-local";
import { OCADE_MODEL_ID } from "../local/fixed-model";

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

  it("never sends the field to the shipped model, which rejects it outright", async () => {
    /*
     * OCADE's model answers `400 "qwen2.5:3b" does not support thinking` to
     * ANY value of `think`. The retry below recovers from that, but it paid a
     * whole failed round trip on every message to learn something the model id
     * already told us. One request, and no `think` in it.
     */
    const { bodies, fetchImpl } = capture();
    await streamLocalChat(
      "http://127.0.0.1:11434",
      OCADE_MODEL_ID,
      [{ role: "user", content: "hi" }],
      { onToken: () => {}, think: true },
      fetchImpl,
    );
    expect(bodies).toHaveLength(1);
    expect("think" in bodies[0]).toBe(false);
  });

  it("retries without the field when a model we did send it to rejects it", async () => {
    // The safety net stays, for runtimes and models this does not know about.
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
      "qwen3:8b",
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

/*
 * Cold start is the remaining lag and it is pure disk time: 26,932 ms against
 * 2,192 ms warm for the same question on the reference machine
 * (release/OCADE_TIER_BENCHMARK.json). Preloading turns the first message into
 * a warm one — provided it genuinely sends no prompt.
 */
describe("preloading warms the engine without sending anything", () => {
  it("asks the runtime to load weights with an EMPTY message list", async () => {
    let body: Record<string, unknown> | null = null;
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("{}", { status: 200 });
    });
    const ok = await preloadLocalModel("http://127.0.0.1:11434", OCADE_MODEL_ID, fetchImpl);
    expect(ok).toBe(true);
    expect(body).toEqual({ model: OCADE_MODEL_ID, messages: [], keep_alive: MODEL_KEEP_ALIVE });
  });

  it("targets the chat endpoint on the given bridge", async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (input: string) => {
      urls.push(input);
      return new Response("{}", { status: 200 });
    });
    await preloadLocalModel("http://127.0.0.1:11434/", OCADE_MODEL_ID, fetchImpl);
    expect(urls).toEqual(["http://127.0.0.1:11434/api/chat"]);
  });

  it("reports failure quietly rather than throwing at a user who has not sent anything", async () => {
    const rejecting = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(
      preloadLocalModel("http://127.0.0.1:11434", OCADE_MODEL_ID, rejecting),
    ).resolves.toBe(false);
  });

  it("reports a refusing runtime as not warmed", async () => {
    const failing = vi.fn(async () => new Response("nope", { status: 500 }));
    await expect(
      preloadLocalModel("http://127.0.0.1:11434", OCADE_MODEL_ID, failing),
    ).resolves.toBe(false);
  });

  it("warms at the window the send will use, not at the default", async () => {
    /*
     * The runtime reloads the weights when the context window changes. Warming
     * at the default and then sending a long document at a larger window pays
     * the whole multi-gigabyte load again — after the user presses send, which
     * is precisely the wait this optimisation exists to remove. Measured on the
     * reference machine: that reload plus prompt evaluation ran past five
     * minutes and the transport abandoned it; the same request against an
     * already-warm model at the same window answered in 40.6 seconds.
     */
    let body: Record<string, unknown> | null = null;
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("{}", { status: 200 });
    });
    await preloadLocalModel("http://127.0.0.1:11434", OCADE_MODEL_ID, fetchImpl, 16384);
    expect(body).toEqual({
      model: OCADE_MODEL_ID,
      messages: [],
      options: { num_ctx: 16384 },
      // Warming a model that is then evicted five minutes later has warmed
      // nothing. See MODEL_KEEP_ALIVE: cold TTFT 5750 ms, warm 222 ms.
      keep_alive: MODEL_KEEP_ALIVE,
    });
  });

  it("sends no window at all when the next message needs no more than the default", async () => {
    // A short chat must not reserve memory it will never use.
    let body: Record<string, unknown> | null = null;
    const fetchImpl = vi.fn(async (_input: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response("{}", { status: 200 });
    });
    await preloadLocalModel("http://127.0.0.1:11434", OCADE_MODEL_ID, fetchImpl, null);
    expect(body).toEqual({ model: OCADE_MODEL_ID, messages: [], keep_alive: MODEL_KEEP_ALIVE });
  });
});

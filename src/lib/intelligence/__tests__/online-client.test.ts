import { describe, expect, it, vi } from "vitest";
import type { IntelligenceRequest } from "../contract";
import { createOnlineIntelligenceTransport } from "../online-client";

function request(): IntelligenceRequest {
  return {
    permit: {
      id: "11111111-1111-4111-8111-111111111111",
      generationId: "generation-1",
      idempotencyKey: "idempotency-1",
      surface: "chat",
      source: "server",
    },
    generationId: "generation-1",
    idempotencyKey: "idempotency-1",
    surface: "chat",
    mode: "online",
    messages: [{ role: "user", content: "hello" }],
    tools: [],
    attachments: [],
    privacy: {
      onlineInferenceConsented: true,
      sealed: false,
    },
  };
}

function deps(fetchImpl: typeof fetch) {
  return {
    fetch: fetchImpl,
    getAccessToken: async () => "user-jwt",
    configuration: () => ({
      url: "https://project.supabase.co",
      publishableKey: "sb_publishable_test",
      configured: true,
      enabled: true,
    }),
    online: () => true,
  };
}

describe("online intelligence client", () => {
  it("sends the user JWT, publishable key and existing permit to the Edge boundary", async () => {
    const fetcher = vi.fn<typeof fetch>(async (_input, init) => {
      const encoder = new TextEncoder();
      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "final",
                response: {
                  text: "hello",
                  toolCalls: [],
                  toolResults: [],
                  backend: "online",
                  stopReason: "end_turn",
                },
              })}\n\n`,
            ),
          );
          controller.close();
        },
      });
      return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
    });
    const transport = createOnlineIntelligenceTransport(deps(fetcher));
    const events = [];
    for await (const event of transport.stream(request())) events.push(event);

    expect(events.at(-1)).toMatchObject({ type: "final", response: { text: "hello" } });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [, init] = fetcher.mock.calls[0];
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer user-jwt");
    expect(new Headers(init?.headers).get("apikey")).toBe("sb_publishable_test");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      permit: { id: "11111111-1111-4111-8111-111111111111" },
      generationId: "generation-1",
    });
  });

  it("normalizes rate limiting without rotating credentials", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 429 }));
    const transport = createOnlineIntelligenceTransport(deps(fetcher));
    const events = [];
    for await (const event of transport.stream(request())) events.push(event);

    expect(events).toEqual([
      expect.objectContaining({ type: "refusal", code: "provider_rate_limited", retryable: true }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed or truncated SSE instead of fabricating a reply", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response("data: {bad", { status: 200 }));
    const transport = createOnlineIntelligenceTransport(deps(fetcher));
    const consume = async () => {
      for await (const _event of transport.stream(request())) {
        // consume
      }
    };
    await expect(consume()).rejects.toThrow(/incomplete stream event/);
  });

  it("parses CRLF events even when the boundary is split across network chunks", async () => {
    const payload = JSON.stringify({ type: "token", text: "hello" });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${payload}\r\n\r`));
        controller.enqueue(encoder.encode("\n"));
        controller.close();
      },
    });
    const fetcher = vi.fn<typeof fetch>(async () => new Response(body, { status: 200 }));
    const events = [];
    for await (const event of createOnlineIntelligenceTransport(deps(fetcher)).stream(request())) {
      events.push(event);
    }
    expect(events).toEqual([{ type: "token", text: "hello" }]);
  });
});

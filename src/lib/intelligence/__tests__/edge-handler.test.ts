import { describe, expect, it, vi } from "vitest";
import { handleOnlineIntelligence, type OnlineHandlerDependencies } from "../edge-handler";

const ORIGIN = "https://ocade.example";

function body() {
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
    messages: [
      { role: "system", content: "You are OCADE." },
      { role: "user", content: "Hello" },
    ],
    tools: [],
    attachments: [],
    privacy: {
      storageMode: "private_sync",
      onlineInferenceConsented: true,
      sealed: false,
    },
  };
}

function request(value: unknown = body(), headers: Record<string, string> = {}) {
  return new Request("https://project.supabase.co/functions/v1/ocade-intelligence", {
    method: "POST",
    headers: {
      Origin: ORIGIN,
      Authorization: "Bearer user-token",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(value),
  });
}

function provider(chunks: unknown[]): Response {
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join(""), {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function dependencies(patch: Partial<OnlineHandlerDependencies> = {}): OnlineHandlerDependencies {
  return {
    allowedOrigins: new Set([ORIGIN]),
    providerReady: true,
    verifyJwt: vi.fn(async () => ({ userId: "user-1" })),
    claimPermit: vi.fn(async () => ({ ok: true as const })),
    callProvider: vi.fn(async () =>
      provider([
        { candidates: [{ content: { parts: [{ text: "Hello" }] } }] },
        {
          candidates: [{ content: { parts: [{ text: " there" }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 },
        },
      ]),
    ),
    sleep: vi.fn(async () => undefined),
    ...patch,
  };
}

describe("authenticated Online Intelligence Edge handler", () => {
  it("validates identity and atomically claims the existing permit before provider I/O", async () => {
    const order: string[] = [];
    const deps = dependencies({
      verifyJwt: vi.fn(async () => {
        order.push("identity");
        return { userId: "user-1" };
      }),
      claimPermit: vi.fn(async (input: Parameters<OnlineHandlerDependencies["claimPermit"]>[0]) => {
        order.push("permit");
        expect(input.userId).toBe("user-1");
        expect(input.permit.id).toBe("11111111-1111-4111-8111-111111111111");
        return { ok: true as const };
      }),
      callProvider: vi.fn(async ({ model, body: providerInput }) => {
        order.push("provider");
        expect(model).toBe("gemini-3.7-flash");
        expect(providerInput).toMatchObject({
          system_instruction: { parts: [{ text: "You are OCADE." }] },
          contents: [{ role: "user", parts: [{ text: "Hello" }] }],
        });
        return provider([{ candidates: [{ content: { parts: [{ text: "answer" }] } }] }]);
      }),
    });

    const response = await handleOnlineIntelligence(request(), deps);
    const stream = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(stream).toContain('"type":"token","text":"answer"');
    expect(stream).toContain('"type":"final"');
    expect(order).toEqual(["identity", "permit", "provider"]);
  });

  it("rejects bad origin, authentication and permit without contacting the provider", async () => {
    const providerCall = vi.fn(async () => provider([]));
    const deps = dependencies({ callProvider: providerCall });

    const wrongOrigin = request(body(), { Origin: "https://attacker.example" });
    expect((await handleOnlineIntelligence(wrongOrigin, deps)).status).toBe(403);
    expect(deps.verifyJwt).not.toHaveBeenCalled();

    const noAuth = request();
    noAuth.headers.delete("Authorization");
    expect((await handleOnlineIntelligence(noAuth, deps)).status).toBe(401);

    const invalid = body();
    invalid.permit.generationId = "different-generation";
    expect((await handleOnlineIntelligence(request(invalid), deps)).status).toBe(400);

    const refused = dependencies({
      callProvider: providerCall,
      claimPermit: vi.fn(async () => ({ ok: false, reason: "already claimed" })),
    });
    expect((await handleOnlineIntelligence(request(), refused)).status).toBe(409);
    expect(providerCall).not.toHaveBeenCalled();
  });

  it("does not claim usage when the provider or allowed model is not configured", async () => {
    const deps = dependencies({ providerReady: false });
    expect((await handleOnlineIntelligence(request(), deps)).status).toBe(503);
    expect(deps.claimPermit).not.toHaveBeenCalled();
    expect(deps.callProvider).not.toHaveBeenCalled();

    const unapproved = dependencies({ model: "latest" });
    expect((await handleOnlineIntelligence(request(), unapproved)).status).toBe(503);
    expect(unapproved.claimPermit).not.toHaveBeenCalled();
  });

  it("uses bounded retry for 429 and 5xx without changing credentials or model", async () => {
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockResolvedValueOnce(new Response(null, { status: 429 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
      );
    const sleep = vi.fn(async () => undefined);
    const deps = dependencies({ callProvider: call, sleep });

    const response = await handleOnlineIntelligence(request(), deps);
    expect(response.status).toBe(200);
    await response.text();
    expect(call).toHaveBeenCalledTimes(3);
    expect(call.mock.calls.map(([input]) => input.model)).toEqual([
      "gemini-3.7-flash",
      "gemini-3.7-flash",
      "gemini-3.7-flash",
    ]);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("converts a malformed provider stream to a refusal, never a fake final answer", async () => {
    const deps = dependencies({
      callProvider: vi.fn(async () => new Response("data: {broken\n\n", { status: 200 })),
    });
    const response = await handleOnlineIntelligence(request(), deps);
    const stream = await response.text();
    expect(stream).toContain('"type":"refusal"');
    expect(stream).not.toContain('"type":"final"');
  });

  it("normalizes provider CRLF event framing", async () => {
    const payload = JSON.stringify({
      candidates: [{ content: { parts: [{ text: "CRLF answer" }] }, finishReason: "STOP" }],
    });
    const providerBody = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode(`data: ${payload}\r\n\r`));
        controller.enqueue(encoder.encode("\n"));
        controller.close();
      },
    });
    const deps = dependencies({
      callProvider: vi.fn(async () => new Response(providerBody, { status: 200 })),
    });
    const stream = await (await handleOnlineIntelligence(request(), deps)).text();
    expect(stream).toContain('"type":"token","text":"CRLF answer"');
    expect(stream).toContain('"type":"final"');
  });

  it("aborts provider work when the browser cancels the returned stream", async () => {
    let providerSignal: AbortSignal | null = null;
    const providerStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "first" }] } }] })}\n\n`,
          ),
        );
      },
    });
    const deps = dependencies({
      callProvider: vi.fn(async ({ signal }) => {
        providerSignal = signal;
        return new Response(providerStream, { status: 200 });
      }),
    });
    const response = await handleOnlineIntelligence(request(), deps);
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel("browser stopped");
    expect(providerSignal).not.toBeNull();
    expect(providerSignal!.aborted).toBe(true);
  });
});

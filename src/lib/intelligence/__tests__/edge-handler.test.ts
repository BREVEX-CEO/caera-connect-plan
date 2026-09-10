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
    // All three configured, so a test that expects NO failover is proving the
    // rule rather than the absence of somewhere to fail over to.
    providerSlots: ["primary", "secondary", "tertiary"],
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
        expect(model).toBe("gemini-3.1-flash-lite");
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

  it("retries 429 and 5xx on the SAME key, and never changes the model", async () => {
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
      "gemini-3.1-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-3.1-flash-lite",
    ]);
    // Three slots were offered and none of them was reached for: a retry is not
    // a rotation, and a 429 is the one failure that must never become one.
    expect(call.mock.calls.map(([input]) => input.slot)).toEqual(["primary", "primary", "primary"]);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("moves to the next key when THIS key is refused, and stops when one works", async () => {
    /*
     * 401 and 403 are key-local: the credential is revoked, misconfigured or
     * not entitled, and nothing about the next one is implied. Retrying it is
     * only a delay, so the slot is abandoned on the first refusal.
     */
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 403 }))
      .mockResolvedValueOnce(
        provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
      );
    const sleep = vi.fn(async () => undefined);
    const deps = dependencies({ callProvider: call, sleep });

    const response = await handleOnlineIntelligence(request(), deps);
    expect(response.status).toBe(200);
    await response.text();
    expect(call.mock.calls.map(([input]) => input.slot)).toEqual([
      "primary",
      "secondary",
      "tertiary",
    ]);
    expect(sleep, "a revoked key was waited on before being abandoned").not.toHaveBeenCalled();
  });

  it("moves to the next key after a slot's health attempts are spent", async () => {
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockResolvedValue(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
      );
    const deps = dependencies({ callProvider: call, sleep: vi.fn(async () => undefined) });

    const response = await handleOnlineIntelligence(request(), deps);
    expect(response.status).toBe(200);
    await response.text();
    // Three attempts on the primary, then the secondary answers.
    expect(call.mock.calls.map(([input]) => input.slot)).toEqual([
      "primary",
      "primary",
      "primary",
      "secondary",
    ]);
  });

  it("treats a thrown transport error as this slot's failure, not the request's", async () => {
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(
        provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
      );
    const deps = dependencies({ callProvider: call, sleep: vi.fn(async () => undefined) });

    const response = await handleOnlineIntelligence(request(), deps);
    expect(response.status).toBe(200);
    await response.text();
    expect(call.mock.calls.map(([input]) => input.slot)).toEqual([
      "primary",
      "primary",
      "primary",
      "secondary",
    ]);
  });

  it("answers 429 rather than spending the other keys on the same project quota", async () => {
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockResolvedValue(new Response(null, { status: 429 }));
    const deps = dependencies({ callProvider: call, sleep: vi.fn(async () => undefined) });

    const response = await handleOnlineIntelligence(request(), deps);
    expect(response.status).toBe(429);
    /*
     * Three attempts, all on the primary. Quota belongs to the PROJECT, so
     * every key would meet the same wall and trying them anyway is the evasion
     * `docs/TRD.md` forbids in so many words.
     */
    expect(call).toHaveBeenCalledTimes(3);
    expect(new Set(call.mock.calls.map(([input]) => input.slot))).toEqual(new Set(["primary"]));
  });

  it("refuses once every configured key has failed, without inventing a fourth", async () => {
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const deps = dependencies({ callProvider: call, sleep: vi.fn(async () => undefined) });

    const response = await handleOnlineIntelligence(request(), deps);
    expect(response.status).toBe(503);
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("makes one primary attempt when the deployment holds a single key", async () => {
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockResolvedValue(new Response(null, { status: 401 }));
    const deps = dependencies({
      callProvider: call,
      providerSlots: ["primary"],
      sleep: vi.fn(async () => undefined),
    });

    expect((await handleOnlineIntelligence(request(), deps)).status).toBe(503);
    expect(call, "failover was invented for a project with one key").toHaveBeenCalledTimes(1);
  });

  it("does not reach for another key once the answer has started", async () => {
    /*
     * The structural guarantee: the loop ends the moment a response is ok, and
     * the stream is handed off after it. A provider that fails MID-STREAM is a
     * refusal on the stream, not a reason to start again somewhere else — the
     * person has already seen output, and a second attempt would either
     * duplicate it or contradict it.
     */
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockResolvedValueOnce(new Response("data: {broken\n\n", { status: 200 }));
    const deps = dependencies({ callProvider: call, sleep: vi.fn(async () => undefined) });

    const response = await handleOnlineIntelligence(request(), deps);
    const stream = await response.text();
    expect(stream).toContain('"type":"refusal"');
    expect(
      call,
      "a second key was tried after the stream had been handed off",
    ).toHaveBeenCalledTimes(1);
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

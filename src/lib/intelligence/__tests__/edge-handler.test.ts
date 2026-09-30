import { describe, expect, it, vi } from "vitest";
import {
  handleOnlineIntelligence,
  isServiceKey,
  SERVICE_USER_HEADER,
  type OnlineHandlerDependencies,
} from "../edge-handler";

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

describe("the health record this function leaves behind", () => {
  /*
   * PLAN.md Phase 16 asks for Edge Function health "without secrets or
   * unnecessary content". The record is the only thing this function writes
   * about a request, so what it may NOT contain is most of what is proven
   * here: not the prompt, not the key, not the user id, not the permit.
   */
  function observed() {
    const records: unknown[] = [];
    return { records, observe: (record: unknown) => records.push(record) };
  }

  it("emits exactly one record for a successful request, naming the slot that served", async () => {
    const seen = observed();
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ observe: seen.observe }),
    );
    expect(response.status).toBe(200);
    expect(seen.records).toHaveLength(1);
    expect(seen.records[0]).toMatchObject({
      component: "edge_function",
      operation: "generation",
      outcome: "succeeded",
      errorClass: "none",
      providerSlot: "primary",
      attempts: 1,
    });
  });

  it("carries no prompt, key, token, user id or permit", async () => {
    const seen = observed();
    await handleOnlineIntelligence(
      request(),
      dependencies({
        observe: seen.observe,
        verifyJwt: vi.fn(async () => ({ userId: "user-1" })),
      }),
    );
    const serialised = JSON.stringify(seen.records);
    for (const forbidden of [
      "Hello",
      "You are OCADE",
      "user-token",
      "user-1",
      "generation-1",
      "idempotency-1",
      "11111111-1111-4111-8111-111111111111",
    ]) {
      expect(serialised).not.toContain(forbidden);
    }
  });

  it("reports a refusal as refused, not as a failure", async () => {
    const seen = observed();
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ observe: seen.observe, verifyJwt: vi.fn(async () => null) }),
    );
    expect(response.status).toBe(401);
    expect(seen.records[0]).toMatchObject({
      outcome: "refused",
      errorClass: "auth",
      // Nothing reached a provider, so no attempt is claimed against one.
      providerSlot: "none",
    });
  });

  it("records the slot that finally answered after a failover", async () => {
    const seen = observed();
    const callProvider = vi.fn(async ({ slot }: { slot: string }) =>
      slot === "primary"
        ? new Response("no", { status: 401 })
        : provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
    );
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ observe: seen.observe, callProvider }),
    );
    expect(response.status).toBe(200);
    expect(seen.records[0]).toMatchObject({ providerSlot: "secondary", outcome: "succeeded" });
    expect((seen.records[0] as { attempts: number }).attempts).toBeGreaterThan(1);
  });

  it("reports exhausted quota as quota, which is the one an operator waits out", async () => {
    const seen = observed();
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({
        observe: seen.observe,
        callProvider: vi.fn(async () => new Response("slow down", { status: 429 })),
      }),
    );
    expect(response.status).toBe(429);
    expect(seen.records[0]).toMatchObject({ outcome: "failed", errorClass: "quota" });
  });

  it("still emits one record when no observer is configured, by not crashing", async () => {
    const response = await handleOnlineIntelligence(request(), dependencies());
    expect(response.status).toBe(200);
  });

  it("caps what one use can cost by bounding the answer the provider may generate", async () => {
    /*
     * A successful request costs the customer exactly one use however long the
     * answer is, so without a ceiling the cost of that one use to OCADE is
     * whatever the provider feels like generating.
     */
    let sent: Record<string, unknown> | null = null;
    await handleOnlineIntelligence(
      request(),
      dependencies({
        callProvider: vi.fn(async ({ body: providerInput }) => {
          sent = providerInput;
          return provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]);
        }),
      }),
    );
    expect(sent).toMatchObject({ generationConfig: { maxOutputTokens: expect.any(Number) } });
    const cap = (sent as unknown as { generationConfig: { maxOutputTokens: number } })
      .generationConfig.maxOutputTokens;
    expect(cap).toBeGreaterThan(1_000);
    expect(cap).toBeLessThanOrEqual(16_384);
  });

  it("delivers an answer that reached the length cap instead of calling it a failure", async () => {
    /*
     * The cap above makes `MAX_TOKENS` an ordinary ending. Treating it as a
     * refusal would put an error under an answer the person had just read, and
     * would have the client release a permit for output it received.
     */
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({
        callProvider: vi.fn(async () =>
          provider([
            {
              candidates: [
                { content: { parts: [{ text: "a long answer" }] }, finishReason: "MAX_TOKENS" },
              ],
            },
          ]),
        ),
      }),
    );
    const stream = await response.text();
    expect(stream).toContain('"type":"token","text":"a long answer"');
    expect(stream).toContain('"type":"final"');
    expect(stream).not.toContain('"type":"refusal"');
  });

  it("actually sends an attachment to the provider, labelled with its name", async () => {
    /*
     * The boundary used to validate `attachments` and then never read them, so a
     * file somebody attached reached here and went nowhere: the answer was
     * written as though no file existed. The name rides with the text so an
     * answer can say which file a figure came from.
     */
    let sent: Record<string, unknown> | null = null;
    const withFiles = {
      ...body(),
      attachments: [
        { name: "sales.csv", mime: "text/csv", sizeBytes: 9, text: "a,b\n1,2" },
        { name: "shot.png", mime: "image/png", sizeBytes: 4, image: "Ynl0ZQ==" },
      ],
    };
    await handleOnlineIntelligence(
      request(withFiles),
      dependencies({
        callProvider: vi.fn(async ({ body: providerInput }) => {
          sent = providerInput;
          return provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]);
        }),
      }),
    );

    const contents = (sent as unknown as { contents: { parts: unknown[] }[] }).contents;
    const parts = JSON.stringify(contents[contents.length - 1]!.parts);
    expect(parts).toContain("sales.csv");
    expect(parts).toContain("a,b");
    expect(parts).toContain("Ynl0ZQ==");
    expect(parts).toContain("image/png");
  });

  it("refuses an attachment that is neither readable text nor an image", async () => {
    // One of text or an image, never both and never neither: a request that
    // cannot say what it is carrying is a request the boundary does not take.
    for (const attachment of [
      { name: "x", mime: "text/plain", sizeBytes: 1 },
      { name: "x", mime: "text/plain", sizeBytes: 1, text: "a", image: "b" },
      { name: "x", mime: "text/plain", sizeBytes: 1, image: "b" },
      { name: "x", mime: "image/png", sizeBytes: 1, text: "a".repeat(200_001) },
    ]) {
      const response = await handleOnlineIntelligence(
        request({ ...body(), attachments: [attachment] }),
        dependencies(),
      );
      expect(response.status, JSON.stringify(attachment)).toBe(400);
    }
  });

  it("refuses more attachments than one question may carry", async () => {
    const many = Array.from({ length: 9 }, (_, at) => ({
      name: `f${at}.txt`,
      mime: "text/plain",
      sizeBytes: 1,
      text: "x",
    }));
    const response = await handleOnlineIntelligence(
      request({ ...body(), attachments: many }),
      dependencies(),
    );
    expect(response.status).toBe(400);
  });

  it("still refuses a genuine provider stop, such as a safety block", async () => {
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({
        callProvider: vi.fn(async () =>
          provider([{ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] }]),
        ),
      }),
    );
    expect(await response.text()).toContain('"type":"refusal"');
  });
});

describe("capacity failures that must not look like each other", () => {
  function events(stream: string) {
    return stream
      .split("\n\n")
      .filter((frame) => frame.startsWith("data: "))
      .map((frame) => JSON.parse(frame.slice(6)) as Record<string, unknown>);
  }

  it("refuses a blocked prompt once, not retryable, with no 'empty answer' after it", async () => {
    for (const chunk of [
      { promptFeedback: { blockReason: "SAFETY" } },
      { candidates: [{ content: { parts: [] }, finishReason: "PROHIBITED_CONTENT" }] },
    ]) {
      const finalize = vi.fn(async () => undefined);
      const response = await handleOnlineIntelligence(
        request(),
        dependencies({
          callProvider: vi.fn(async () => provider([chunk])),
          finalizePermit: finalize,
        }),
      );
      const refusals = events(await response.text()).filter((event) => event.type === "refusal");
      expect(refusals).toEqual([
        expect.objectContaining({ code: "content_blocked", retryable: false }),
      ]);
      expect(finalize).not.toHaveBeenCalled();
    }
  });

  it("moves to the next key when Google calls THIS key invalid with a 400", async () => {
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: { status: "INVALID_ARGUMENT", details: [{ reason: "API_KEY_INVALID" }] },
          }),
          { status: 400 },
        ),
      )
      .mockResolvedValueOnce(
        provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
      );
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ callProvider: call }),
    );
    expect(response.status).toBe(200);
    await response.text();
    expect(call.mock.calls.map(([input]) => input.slot)).toEqual(["primary", "secondary"]);
  });

  it("does not spend other keys on a 400 about the request itself", async () => {
    const call = vi.fn(
      async () => new Response('{"error":{"message":"bad schema"}}', { status: 400 }),
    );
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ callProvider: call }),
    );
    expect(response.status).toBe(503);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("gives a key that never starts answering its own deadline, then uses the next key", async () => {
    vi.useFakeTimers();
    try {
      const call = vi
        .fn<OnlineHandlerDependencies["callProvider"]>()
        .mockImplementationOnce(
          ({ signal }) =>
            new Promise((_, reject) =>
              signal.addEventListener("abort", () => reject(signal.reason)),
            ),
        )
        .mockResolvedValueOnce(
          provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
        );
      const pending = handleOnlineIntelligence(request(), dependencies({ callProvider: call }));
      await vi.advanceTimersByTimeAsync(25_000);
      const response = await pending;
      expect(response.status).toBe(200);
      expect(await response.text()).toContain('"text":"ok"');
      expect(call.mock.calls.map(([input]) => input.slot)).toEqual(["primary", "secondary"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("answers a readable 503, not an unhandled throw, when the person leaves during a retry wait", async () => {
    const leaving = new AbortController();
    const response = await handleOnlineIntelligence(
      new Request(request(), { signal: leaving.signal }),
      dependencies({
        callProvider: vi.fn(async () => new Response(null, { status: 503 })),
        sleep: vi.fn(
          (_ms: number, signal: AbortSignal) =>
            new Promise<void>((_, reject) => {
              signal.addEventListener("abort", () => reject(signal.reason));
              leaving.abort(new DOMException("gone", "AbortError"));
            }),
        ),
      }),
    );
    expect(response.status).toBe(503);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  it("charges the permit on the server before telling the person the answer is complete", async () => {
    const order: string[] = [];
    const finalize = vi.fn(
      async (input: { userId: string; permit: { idempotencyKey: string } }) => {
        order.push(`charged ${input.userId} ${input.permit.idempotencyKey}`);
      },
    );
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ finalizePermit: finalize }),
    );
    for (const event of events(await response.text())) order.push(String(event.type));
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(order.indexOf("charged user-1 idempotency-1")).toBeLessThan(order.indexOf("final"));
  });

  it("never charges for an answer that did not arrive", async () => {
    const finalize = vi.fn(async () => undefined);
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ callProvider: vi.fn(async () => provider([])), finalizePermit: finalize }),
    );
    await response.text();
    expect(finalize).not.toHaveBeenCalled();
  });
});

describe("the door for OCADE's own server", () => {
  const USER = "22222222-2222-4222-8222-222222222222";
  const jarvis = () => {
    const value = body();
    return { ...value, surface: "jarvis", permit: { ...value.permit, surface: "jarvis" } };
  };
  const serverRequest = (value: unknown, headers: Record<string, string>) =>
    new Request("https://project.supabase.co/functions/v1/ocade-intelligence-service", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(value),
    });
  const door = (patch: Partial<OnlineHandlerDependencies> = {}) =>
    dependencies({
      allowedOrigins: new Set(),
      verifyJwt: vi.fn(async () => null),
      verifyService: async (request) =>
        (await isServiceKey(request.headers.get("apikey"), ["server-key", "older-server-key"]))
          ? { userId: request.headers.get(SERVICE_USER_HEADER)! }
          : null,
      ...patch,
    });

  it("serves a holder of a server key, for the person it names and that person's permit", async () => {
    const deps = door();
    const response = await handleOnlineIntelligence(
      serverRequest(jarvis(), { apikey: "older-server-key", [SERVICE_USER_HEADER]: USER }),
      deps,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(await response.text()).toContain('"type":"final"');
    expect(deps.claimPermit).toHaveBeenCalledWith(expect.objectContaining({ userId: USER }));
    expect(deps.verifyJwt).not.toHaveBeenCalled();
  });

  it("refuses a wrong key, a missing key, a session token, and anything but JARVIS work", async () => {
    const attempts: Record<string, string>[] = [
      { apikey: "guess", [SERVICE_USER_HEADER]: USER },
      { [SERVICE_USER_HEADER]: USER },
      { Authorization: "Bearer user-token", [SERVICE_USER_HEADER]: USER },
    ];
    for (const headers of attempts) {
      const deps = door();
      const response = await handleOnlineIntelligence(serverRequest(jarvis(), headers), deps);
      expect(response.status).toBe(401);
      expect(deps.claimPermit).not.toHaveBeenCalled();
      expect(deps.callProvider).not.toHaveBeenCalled();
    }
    const chat = await handleOnlineIntelligence(
      serverRequest(body(), { apikey: "server-key", [SERVICE_USER_HEADER]: USER }),
      door(),
    );
    expect(chat.status).toBe(400);
    // Without naming a person it is an ordinary request, and this function allows no origin.
    const anonymous = await handleOnlineIntelligence(
      serverRequest(jarvis(), { apikey: "server-key", Origin: ORIGIN }),
      door(),
    );
    expect(anonymous.status).toBe(403);
  });

  it("does not exist on the function browsers use, whatever header is sent", async () => {
    const deps = dependencies({ verifyJwt: vi.fn(async () => null) });
    const response = await handleOnlineIntelligence(
      request(jarvis(), { apikey: "server-key", [SERVICE_USER_HEADER]: USER }),
      deps,
    );
    expect(response.status).toBe(401);
    expect(deps.callProvider).not.toHaveBeenCalled();
  });

  it("a refused permit stops it before any provider call", async () => {
    const deps = door({
      claimPermit: vi.fn(async () => ({ ok: false as const, reason: "no such permit" })),
    });
    const response = await handleOnlineIntelligence(
      serverRequest(jarvis(), { apikey: "server-key", [SERVICE_USER_HEADER]: USER }),
      deps,
    );
    expect(response.status).toBe(409);
    expect(deps.callProvider).not.toHaveBeenCalled();
  });
});

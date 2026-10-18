import { describe, expect, it, vi } from "vitest";
import {
  handleOnlineIntelligence,
  isServiceKey,
  type OnlineHandlerDependencies,
} from "../edge-handler";
import { SERVICE_USER_HEADER } from "../contract";

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

describe("STOP and retries around the provider call", () => {
  it("never calls the provider for a request stopped while its allowance was claimed", async () => {
    const leaving = new AbortController();
    const releasePermit = vi.fn(async () => undefined);
    const callProvider = vi.fn(async () => provider([]));
    const stopped = new Request(request(), { signal: leaving.signal });
    const response = await handleOnlineIntelligence(
      stopped,
      dependencies({
        claimPermit: vi.fn(async () => {
          leaving.abort(); // STOP pressed during the claim
          return { ok: true as const };
        }),
        callProvider,
        releasePermit,
      }),
    );
    expect(response.status).toBe(503);
    expect(callProvider).not.toHaveBeenCalled();
    expect(releasePermit).toHaveBeenCalledTimes(1);
  });

  it("waits the default backoff when a refusal carries no Retry-After", async () => {
    const sleep = vi.fn(async () => undefined);
    let calls = 0;
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({
        sleep,
        callProvider: vi.fn(async () =>
          ++calls === 1
            ? new Response("busy", { status: 503 })
            : provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
        ),
      }),
    );
    await response.text();
    expect(sleep).toHaveBeenCalledWith(250, expect.anything());
  });
});

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
        expect(model).toBe("gemini-3.5-flash-lite");
        expect(providerInput).toMatchObject({
          system_instruction: { parts: [{ text: "You are OCADE." }] },
          contents: [{ role: "user", parts: [{ text: "Hello" }] }],
        });
        return provider([
          { candidates: [{ content: { parts: [{ text: "answer" }] }, finishReason: "STOP" }] },
        ]);
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
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash-lite",
      "gemini-3.5-flash-lite",
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

  it("retries an overloaded provider on the same key within ONE budget of three, never multiplied across keys", async () => {
    const call = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockResolvedValue(new Response(null, { status: 503 }));
    const deps = dependencies({ callProvider: call, sleep: vi.fn(async () => undefined) });

    const response = await handleOnlineIntelligence(request(), deps);
    expect(response.status).toBe(503);
    // Every key reaches the same provider: three attempts in all, all on the primary (V06).
    expect(call.mock.calls.map(([input]) => input.slot)).toEqual(["primary", "primary", "primary"]);
  });

  it("treats a thrown transport error as this slot's failure, and spends the same budget on the next key", async () => {
    const once = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(
        provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
      );
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ callProvider: once, sleep: vi.fn(async () => undefined) }),
    );
    expect(response.status).toBe(200);
    await response.text();
    expect(once.mock.calls.map(([input]) => input.slot)).toEqual(["primary", "secondary"]);
    // Unreachable everywhere: three attempts in all, one per key, then an honest refusal.
    const never = vi
      .fn<OnlineHandlerDependencies["callProvider"]>()
      .mockRejectedValue(new TypeError("network"));
    const refused = await handleOnlineIntelligence(
      request(),
      dependencies({ callProvider: never, sleep: vi.fn(async () => undefined) }),
    );
    expect(refused.status).toBe(503);
    expect(never.mock.calls.map(([input]) => input.slot)).toEqual([
      "primary",
      "secondary",
      "tertiary",
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

  it("records the start at hand-off and the outcome when the answer ends, naming the slot", async () => {
    const seen = observed();
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ observe: seen.observe }),
    );
    expect(response.status).toBe(200);
    // Only the start is known when the stream is handed off: not yet an answer.
    expect(seen.records).toHaveLength(1);
    expect(seen.records[0]).toMatchObject({
      component: "edge_function",
      operation: "generation_start",
      outcome: "succeeded",
      providerSlot: "primary",
      attempts: 1,
    });
    await response.text();
    expect(seen.records).toHaveLength(2);
    expect(seen.records[1]).toMatchObject({
      operation: "generation",
      outcome: "succeeded",
      errorClass: "none",
      providerSlot: "primary",
    });
  });

  it("leaves no record for a browser's preflight, which is not a generation", async () => {
    // Seen in production: preflights logged as succeeded generations served by no slot.
    const seen = observed();
    const response = await handleOnlineIntelligence(
      new Request("https://project.supabase.co/functions/v1/ocade-intelligence", {
        method: "OPTIONS",
        headers: { Origin: ORIGIN },
      }),
      dependencies({ observe: seen.observe }),
    );
    expect(response.status).toBeLessThan(300);
    expect(seen.records).toHaveLength(0);
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
    // Thinking is asked for explicitly, at a level the pinned model accepts.
    expect(sent).toMatchObject({
      generationConfig: { thinkingConfig: { thinkingLevel: "medium" } },
    });
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
    // The request itself was refused: not reported as an outage a caller would ask again (V06).
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "provider_rejected_request" });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("never retries before the provider allows, and tells the caller when it may ask again (V06)", async () => {
    const date = new Date(Date.now() + 40_000).toUTCString();
    for (const [answer, seconds] of [
      [new Response(null, { status: 503, headers: { "Retry-After": "30" } }), 30],
      [new Response(null, { status: 503, headers: { "Retry-After": date } }), 40],
      [new Response('{"error":{"details":[{"retryDelay":"12.5s"}]}}', { status: 429 }), 13],
    ] as const) {
      const sleep = vi.fn(async () => undefined);
      const call = vi.fn(async () => answer.clone());
      const response = await handleOnlineIntelligence(
        request(),
        dependencies({ callProvider: call, sleep }),
      );
      expect([503, 429]).toContain(response.status);
      const said = (await response.json()) as { retryAfterSeconds: number };
      expect(Math.abs(said.retryAfterSeconds - seconds)).toBeLessThanOrEqual(1);
      expect(call).toHaveBeenCalledTimes(1);
      expect(sleep).not.toHaveBeenCalled();
    }
    // A short wait is waited out exactly, fractions kept.
    const sleep = vi.fn(async () => undefined);
    let calls = 0;
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({
        sleep,
        callProvider: vi.fn(async () =>
          ++calls === 1
            ? new Response(null, { status: 503, headers: { "Retry-After": "1.5" } })
            : provider([{ candidates: [{ content: { parts: [{ text: "ok" }] } }] }]),
        ),
      }),
    );
    await response.text();
    expect(sleep).toHaveBeenCalledWith(1500, expect.anything());
  });

  it("releases a call only from a turn that ended complete (V07)", async () => {
    const call = { functionCall: { name: "computer", args: { action: "file_write" } } };
    const run = async (body: string) =>
      (
        await handleOnlineIntelligence(
          request(),
          dependencies({ callProvider: vi.fn(async () => new Response(body, { status: 200 })) }),
        )
      ).text();
    const frame = (chunk: unknown) => `data: ${JSON.stringify(chunk)}\n\n`;
    // A call, then the provider stops the turn: the call never leaves the boundary.
    const stopped = await run(
      frame({ candidates: [{ content: { parts: [call] } }] }) +
        frame({ candidates: [{ content: { parts: [] }, finishReason: "OTHER" }] }),
    );
    expect(stopped).toContain('"type":"refusal"');
    expect(stopped).not.toContain('"type":"tool_call"');
    expect(stopped).not.toContain('"type":"final"');
    // A call, then the stream breaks mid-event.
    const cut = await run(frame({ candidates: [{ content: { parts: [call] } }] }) + "data: {trunc");
    expect(cut).not.toContain('"type":"tool_call"');
    const missingStop = await run(frame({ candidates: [{ content: { parts: [call] } }] }));
    expect(missingStop).not.toContain('"type":"tool_call"');
    expect(missingStop).not.toContain('"type":"final"');
    expect(missingStop).toContain('"code":"provider_failed"');
    const cappedCall = await run(
      frame({
        candidates: [
          {
            content: { parts: [call] },
            finishReason: "MAX_TOKENS",
          },
        ],
      }),
    );
    expect(cappedCall).not.toContain('"type":"tool_call"');
    expect(cappedCall).not.toContain('"type":"final"');
    const afterStop = await run(
      frame({ candidates: [{ content: { parts: [] }, finishReason: "STOP" }] }) +
        frame({ candidates: [{ content: { parts: [call] } }] }),
    );
    expect(afterStop).not.toContain('"type":"tool_call"');
    expect(afterStop).not.toContain('"type":"final"');
    // Complete: the call is released, before the final answer that confirms it.
    const whole = await run(
      frame({ candidates: [{ content: { parts: [call] } }] }) +
        frame({ candidates: [{ content: { parts: [] }, finishReason: "STOP" }] }),
    );
    expect(whole.indexOf('"type":"tool_call"')).toBeGreaterThan(-1);
    expect(whole.indexOf('"type":"tool_call"')).toBeLessThan(whole.indexOf('"type":"final"'));
  });

  it("releases an allowance when an incomplete turn's held calls never reached the caller", async () => {
    for (const finishReason of [undefined, "MAX_TOKENS", "SAFETY"]) {
      const finalize = vi.fn(async () => undefined);
      const release = vi.fn(async () => undefined);
      const response = await handleOnlineIntelligence(
        request(),
        dependencies({
          callProvider: vi.fn(async () =>
            provider([
              {
                candidates: [
                  {
                    content: { parts: [{ functionCall: { name: "start_task", args: {} } }] },
                    ...(finishReason ? { finishReason } : {}),
                  },
                ],
              },
            ]),
          ),
          finalizePermit: finalize,
          releasePermit: release,
        }),
      );
      const stream = await response.text();
      expect(stream).not.toContain('"type":"tool_call"');
      expect(stream).not.toContain('"type":"final"');
      expect(finalize).not.toHaveBeenCalled();
      expect(release).toHaveBeenCalledTimes(1);
    }
  });

  it("does not label partial text as a complete answer when the terminal event is lost", async () => {
    const finalize = vi.fn(async () => undefined);
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({
        callProvider: vi.fn(async () =>
          provider([
            {
              candidates: [
                {
                  content: {
                    parts: [
                      { text: "Partial answer" },
                      { functionCall: { name: "start_task", args: {} } },
                    ],
                  },
                },
              ],
            },
          ]),
        ),
        finalizePermit: finalize,
      }),
    );
    const stream = await response.text();
    expect(stream).toContain('"text":"Partial answer"');
    expect(stream).toContain('"code":"provider_failed"');
    expect(stream).not.toContain('"type":"final"');
    expect(stream).not.toContain('"type":"tool_call"');
    expect(finalize).toHaveBeenCalledWith(expect.objectContaining({ startsTask: false }));
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

  it("does not retry a day's limit, and says when capacity returns", async () => {
    const callProvider = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              status: "RESOURCE_EXHAUSTED",
              details: [
                { violations: [{ quotaId: "GenerateRequestsPerDayPerProjectPerModel-FreeTier" }] },
                { "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "14427s" },
              ],
            },
          }),
          { status: 429 },
        ),
    );
    const response = await handleOnlineIntelligence(request(), dependencies({ callProvider }));
    expect(callProvider).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "provider_unavailable",
      retryAfterSeconds: 14427,
    });
  });

  it("says once that a web search is not in the plan, instead of retrying it as busy", async () => {
    // What the free tier answers to grounding with Google Search: a 429 with no time to wait.
    const refused = () =>
      new Response(
        JSON.stringify({
          error: { status: "RESOURCE_EXHAUSTED", message: "You exceeded your current quota" },
        }),
        { status: 429 },
      );
    const callProvider = vi.fn(async () => refused());
    const response = await handleOnlineIntelligence(
      request({ ...body(), research: true }),
      dependencies({ callProvider }),
    );
    expect(callProvider).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "research_unavailable" });

    // An ordinary question meeting the same 429 is still busy, and retried.
    const ordinary = vi.fn(async () => refused());
    const busy = await handleOnlineIntelligence(
      request(),
      dependencies({ callProvider: ordinary }),
    );
    expect(busy.status).toBe(429);
    expect(ordinary.mock.calls.length).toBeGreaterThan(1);
  });

  it("sends nothing, and claims nothing, for an account that has not agreed to online use", async () => {
    const callProvider = vi.fn(async () => provider([]));
    const claimPermit = vi.fn(async () => ({ ok: true as const }));
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ callProvider, claimPermit, consented: async () => false }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "online_not_consented" });
    expect(claimPermit).not.toHaveBeenCalled();
    expect(callProvider).not.toHaveBeenCalled();
  });

  it("says when the reply starts a JARVIS task, whose one use is charged at completion", async () => {
    const settled: boolean[] = [];
    for (const parts of [
      [{ functionCall: { name: "start_task", args: { title: "Report" } } }],
      [{ text: "Paris." }],
    ]) {
      const finalize = vi.fn(async (input: { startsTask: boolean }) => {
        settled.push(input.startsTask);
      });
      const response = await handleOnlineIntelligence(
        request(),
        dependencies({
          callProvider: vi.fn(async () =>
            provider([{ candidates: [{ content: { parts }, finishReason: "STOP" }] }]),
          ),
          finalizePermit: finalize,
        }),
      );
      await response.text();
    }
    expect(settled).toEqual([true, false]);
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

  it("gives back a claimed permit itself when nothing arrived, however it ended", async () => {
    for (const callProvider of [
      vi.fn(async () => provider([])),
      vi.fn(async () => new Response(null, { status: 503 })),
    ]) {
      const finalize = vi.fn(async () => undefined);
      const release = vi.fn(async () => undefined);
      const response = await handleOnlineIntelligence(
        request(),
        dependencies({ callProvider, finalizePermit: finalize, releasePermit: release }),
      );
      await response.text();
      expect(release).toHaveBeenCalledTimes(1);
      expect(finalize).not.toHaveBeenCalled();
    }
  });

  it("charges an answer stopped part-way: once words arrived it is not given back", async () => {
    const leaving = new AbortController();
    const finalize = vi.fn(async () => undefined);
    const release = vi.fn(async () => undefined);
    const words = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: "Half an" }] } }] })}\n\n`;
    const response = await handleOnlineIntelligence(
      new Request(request(), { signal: leaving.signal }),
      dependencies({
        finalizePermit: finalize,
        releasePermit: release,
        callProvider: vi.fn(
          async ({ signal }) =>
            new Response(
              new ReadableStream({
                start(stream) {
                  stream.enqueue(new TextEncoder().encode(words));
                  signal.addEventListener("abort", () => stream.error(signal.reason));
                },
              }),
            ),
        ),
      }),
    );
    const reader = response.body!.getReader();
    let seen = "";
    while (!seen.includes("Half an")) {
      seen += new TextDecoder().decode((await reader.read()).value);
    }
    leaving.abort(new DOMException("gone", "AbortError"));
    await reader.cancel().catch(() => undefined);
    await vi.waitFor(() => expect(finalize).toHaveBeenCalledTimes(1));
    expect(release).not.toHaveBeenCalled();
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

describe("native tool continuity (PLAN Phase 04 V05)", () => {
  const sent = async (messages: unknown[]) => {
    const callProvider = vi.fn<OnlineHandlerDependencies["callProvider"]>(async () =>
      provider([{ candidates: [{ content: { parts: [{ text: "ok" }] }, finishReason: "STOP" }] }]),
    );
    const response = await handleOnlineIntelligence(
      request({ ...body(), messages }),
      dependencies({ callProvider }),
    );
    await response.text();
    return { status: response.status, provider: callProvider.mock.calls[0]?.[0].body as never };
  };

  it("keeps the provider's call ids and opaque signatures, and makes up neither", async () => {
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({
        callProvider: vi.fn(async () =>
          provider([
            {
              candidates: [
                {
                  content: {
                    parts: [
                      { text: "Reading both." },
                      {
                        functionCall: { id: "fc-a", name: "browser", args: { action: "observe" } },
                        thoughtSignature: "sig-a",
                      },
                      { functionCall: { name: "computer", args: { action: "file_list" } } },
                    ],
                  },
                  finishReason: "STOP",
                },
              ],
            },
          ]),
        ),
      }),
    );
    const final = (await response.text())
      .split("\n\n")
      .map((frame) => frame.replace(/^data: /, ""))
      .filter(Boolean)
      .map((frame) => JSON.parse(frame))
      .find((event) => event.type === "final");
    expect(final.response.toolCalls).toEqual([
      { id: "fc-a", name: "browser", arguments: { action: "observe" }, signature: "sig-a" },
      { id: "provider-tool-0", name: "computer", arguments: { action: "file_list" } },
    ]);
  });

  it("sends a turn's calls and their results back as native parts, in order (golden)", async () => {
    const { status, provider: sentBody } = await sent([
      { role: "system", content: "You are OCADE." },
      { role: "user", content: "List and look." },
      {
        role: "assistant",
        content: "Reading both.",
        toolCalls: [
          { id: "fc-a", name: "browser", arguments: { action: "observe" }, signature: "sig-a" },
          { id: "provider-tool-0", name: "computer", arguments: { action: "file_list" } },
        ],
      },
      { role: "user", content: "page", toolResult: { callId: "fc-a", name: "browser" } },
      {
        role: "user",
        content: "files",
        toolResult: { callId: "provider-tool-0", name: "computer" },
      },
      { role: "user", content: "Thanks, carry on." },
    ]);
    expect(status).toBe(200);
    expect((sentBody as { contents: unknown }).contents).toEqual([
      { role: "user", parts: [{ text: "List and look." }] },
      {
        role: "model",
        parts: [
          { text: "Reading both." },
          {
            functionCall: { id: "fc-a", name: "browser", args: { action: "observe" } },
            thoughtSignature: "sig-a",
          },
          // A local id is never passed off as the provider's.
          { functionCall: { name: "computer", args: { action: "file_list" } } },
        ],
      },
      {
        role: "user",
        parts: [
          { functionResponse: { id: "fc-a", name: "browser", response: { result: "page" } } },
          { functionResponse: { name: "computer", response: { result: "files" } } },
        ],
      },
      { role: "user", parts: [{ text: "Thanks, carry on." }] },
    ]);
  });

  it("round-trips signed text, empty text and call ordering without exposing thoughts", async () => {
    const parts = [
      { text: "Private summary", thought: true, thoughtSignature: "thought-sig" },
      { text: "Before", thoughtSignature: "text-sig" },
      {
        functionCall: { id: "fc-a", name: "browser", args: { action: "observe" } },
        thoughtSignature: "call-sig",
      },
      { text: "After" },
      { text: "", thoughtSignature: "empty-sig" },
    ];
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({
        callProvider: vi.fn(async () =>
          provider(
            parts.map((part, index) => ({
              candidates: [
                {
                  content: { parts: [part] },
                  ...(index === parts.length - 1 ? { finishReason: "STOP" } : {}),
                },
              ],
            })),
          ),
        ),
      }),
    );
    const events = (await response.text())
      .split("\n\n")
      .filter(Boolean)
      .map((frame) => JSON.parse(frame.replace(/^data: /, "")));
    const reply = events.find((event) => event.type === "final").response;
    expect(reply.text).toBe("BeforeAfter");
    expect(
      events
        .filter((event) => event.type === "token")
        .map((event) => event.text)
        .join(""),
    ).toBe("BeforeAfter");
    expect(reply.parts).toEqual([
      { text: "Private summary", thought: true, signature: "thought-sig" },
      { text: "Before", signature: "text-sig" },
      { callId: "fc-a" },
      { text: "After" },
      { text: "", signature: "empty-sig" },
    ]);
    const { status, provider: sentBody } = await sent([
      { role: "user", content: "Read it." },
      { role: "assistant", content: reply.text, toolCalls: reply.toolCalls, parts: reply.parts },
      { role: "user", content: "page", toolResult: { callId: "fc-a", name: "browser" } },
    ]);
    expect(status).toBe(200);
    expect((sentBody as { contents: { parts: unknown[] }[] }).contents[1]!.parts).toEqual(parts);
  });

  it("keeps an empty signed final part on a response without calls", async () => {
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({
        callProvider: vi.fn(async () =>
          provider([
            { candidates: [{ content: { parts: [{ text: "Ready" }] } }] },
            {
              candidates: [
                {
                  content: { parts: [{ text: "", thoughtSignature: "last" }] },
                  finishReason: "STOP",
                },
              ],
            },
          ]),
        ),
      }),
    );
    const events = (await response.text())
      .split("\n\n")
      .filter(Boolean)
      .map((frame) => JSON.parse(frame.replace(/^data: /, "")));
    const reply = events.find((event) => event.type === "final").response;
    expect(reply.parts).toEqual([{ text: "Ready" }, { text: "", signature: "last" }]);
    const { provider: sentBody } = await sent([
      { role: "assistant", content: reply.text, parts: reply.parts },
    ]);
    expect((sentBody as { contents: { parts: unknown[] }[] }).contents[0]!.parts).toEqual([
      { text: "Ready" },
      { text: "", thoughtSignature: "last" },
    ]);
  });

  it("withholds calls and continuation when provider part metadata exceeds its bounds", async () => {
    for (const invalid of [
      { text: "", thoughtSignature: "s".repeat(100_001) },
      { text: "", thought: "true" },
      { text: "x".repeat(200_001) },
    ]) {
      const response = await handleOnlineIntelligence(
        request(),
        dependencies({
          callProvider: vi.fn(async () =>
            provider([
              {
                candidates: [
                  {
                    content: {
                      parts: [
                        {
                          functionCall: { id: "c", name: "computer", args: {} },
                          thoughtSignature: "valid",
                        },
                        invalid,
                      ],
                    },
                    finishReason: "STOP",
                  },
                ],
              },
            ]),
          ),
        }),
      );
      const stream = await response.text();
      expect(stream).toContain('"code":"provider_failed"');
      expect(stream).not.toContain('"type":"tool_call"');
      expect(stream).not.toContain('"type":"final"');
    }
  });

  it("marks a rebuilt call that has no signature with the documented skip value, once per turn", async () => {
    const { provider: sentBody } = await sent([
      { role: "user", content: "Tidy it." },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "provider-tool-row-1", name: "computer", arguments: { action: "file_list" } },
          { id: "provider-tool-row-2", name: "computer", arguments: { action: "file_read" } },
        ],
      },
    ]);
    expect((sentBody as { contents: { parts: unknown[] }[] }).contents[1]!.parts).toEqual([
      {
        functionCall: { name: "computer", args: { action: "file_list" } },
        thoughtSignature: "skip_thought_signature_validator",
      },
      { functionCall: { name: "computer", args: { action: "file_read" } } },
    ]);
  });

  it("refuses native parts in the wrong place or out of bounds before any provider call", async () => {
    const good = { id: "c", name: "computer", arguments: {} };
    for (const message of [
      { role: "user", content: "", toolCalls: [good] },
      { role: "assistant", content: "", toolCalls: [] },
      { role: "assistant", content: "", toolCalls: [{ ...good, arguments: "x" }] },
      { role: "assistant", content: "", toolCalls: [{ ...good, id: "" }] },
      { role: "assistant", content: "", toolCalls: [{ ...good, signature: "s".repeat(100_001) }] },
      { role: "assistant", content: "", toolResult: { callId: "c", name: "computer" } },
      { role: "user", content: "x", toolResult: { callId: "c" } },
      { role: "user", content: "", parts: [{ text: "x", signature: "s" }] },
      { role: "assistant", content: "", parts: [] },
      { role: "assistant", content: "", parts: [{ text: "x", signature: "s".repeat(100_001) }] },
      { role: "assistant", content: "", parts: [{ text: "x", functionResponse: {} }] },
      { role: "assistant", content: "", parts: [{ text: "x", thought: "true" }] },
      { role: "assistant", content: "", parts: [{ callId: "missing" }] },
      { role: "assistant", content: "", toolCalls: [good], parts: [{ text: "lost call" }] },
      {
        role: "assistant",
        content: "",
        toolCalls: [good],
        parts: [{ callId: "c" }, { callId: "c" }],
      },
    ]) {
      const { status, provider: sentBody } = await sent([{ role: "user", content: "Hi" }, message]);
      expect(status, JSON.stringify(message).slice(0, 120)).toBe(400);
      expect(sentBody).toBeUndefined();
    }
  });
});

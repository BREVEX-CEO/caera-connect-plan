import { describe, expect, it, vi } from "vitest";
import { handleOnlineIntelligence, type OnlineHandlerDependencies } from "../edge-handler";

function request(patch: Record<string, unknown> = {}) {
  return new Request("https://edge.test/ocade-intelligence", {
    method: "POST",
    headers: {
      authorization: "Bearer fixture",
      Origin: "https://ocade.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      permit: {
        id: "p",
        generationId: "g",
        idempotencyKey: "k",
        surface: "jarvis",
        source: "server",
      },
      generationId: "g",
      idempotencyKey: "k",
      surface: "jarvis",
      messages: [{ role: "user", content: "Hello" }],
      tools: [],
      attachments: [],
      privacy: { onlineInferenceConsented: true, sealed: false },
      ...patch,
    }),
  });
}
const completed = () =>
  new Response(
    'data: {"candidates":[{"content":{"parts":[{"text":"done"}]},"finishReason":"STOP"}]}\n\n',
    { headers: { "content-type": "text/event-stream" } },
  );
const dependencies = (
  patch: Partial<OnlineHandlerDependencies> = {},
): OnlineHandlerDependencies => ({
  allowedOrigins: new Set(["https://ocade.test"]),
  providerReady: true,
  providerSlots: ["primary", "secondary", "tertiary"],
  verifyJwt: async () => ({ userId: "u" }),
  claimPermit: vi.fn(async () => ({ ok: true as const })),
  callProvider: vi.fn(async () => completed()),
  sleep: async () => {},
  ...patch,
});

describe("Standard is the default; High requires explicit opt-in", () => {
  it("uses all three configured Google slots for credential-local failures", async () => {
    const call = vi.fn<OnlineHandlerDependencies["callProvider"]>(async ({ slot }) =>
      slot === "tertiary" ? completed() : new Response(null, { status: 401 }),
    );
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ callProvider: call }),
    );
    await response.text();
    expect(call.mock.calls.map(([value]) => [value.model, value.slot])).toEqual(
      ["primary", "secondary", "tertiary"].map((slot) => ["gemini-3.5-flash-lite", slot]),
    );
  });
  it("routes acknowledged High independently of Google readiness, with no credential or model fallback", async () => {
    const call = vi.fn<OnlineHandlerDependencies["callProvider"]>(
      async () =>
        new Response(
          'data: {"choices":[{"index":0,"delta":{"content":"High answer"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
        ),
    );
    const response = await handleOnlineIntelligence(
      request({ quality: "high", highModeAcknowledged: "2026-10-19-v1" }),
      dependencies({ providerReady: false, highAvailable: async () => true, callProvider: call }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("High answer");
    expect(call.mock.calls[0]![0]).toMatchObject({
      model: "@cf/google/gemma-4-26b-a4b-it",
      body: {
        messages: [{ role: "user", content: "Hello" }],
        chat_template_kwargs: { enable_thinking: true },
      },
    });
  });
  it("never rotates Google keys or switches to Standard when High is exhausted", async () => {
    const call = vi.fn<OnlineHandlerDependencies["callProvider"]>(
      async () => new Response(null, { status: 429, headers: { "Retry-After": "60" } }),
    );
    const response = await handleOnlineIntelligence(
      request({ quality: "high", highModeAcknowledged: "2026-10-19-v1" }),
      dependencies({ highAvailable: async () => true, callProvider: call }),
    );
    expect(response.status).toBe(429);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call.mock.calls[0]![0].model).toBe("@cf/google/gemma-4-26b-a4b-it");
  });
  it("releases the permit if billing eligibility changes after admission", async () => {
    const release = vi.fn(async () => {});
    const call = vi.fn<OnlineHandlerDependencies["callProvider"]>(
      async () => new Response(null, { status: 412 }),
    );
    const response = await handleOnlineIntelligence(
      request({ quality: "high", highModeAcknowledged: "2026-10-19-v1" }),
      dependencies({ highAvailable: async () => true, callProvider: call, releasePermit: release }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "high_unavailable" });
    expect(call).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
  });
  it("defaults to Gemini with its qualified thinking setting", async () => {
    const call = vi.fn<OnlineHandlerDependencies["callProvider"]>(async () => completed());
    const response = await handleOnlineIntelligence(
      request(),
      dependencies({ callProvider: call }),
    );
    expect(response.status).toBe(200);
    await response.text();
    expect(call.mock.calls[0]![0]).toMatchObject({
      model: "gemini-3.5-flash-lite",
      body: { generationConfig: { thinkingConfig: { thinkingLevel: "medium" } } },
    });
  });
  it("never changes model when Standard is overloaded", async () => {
    const call = vi.fn<OnlineHandlerDependencies["callProvider"]>(
      async () => new Response(null, { status: 503 }),
    );
    expect(
      (await handleOnlineIntelligence(request(), dependencies({ callProvider: call }))).status,
    ).toBe(503);
    expect(call.mock.calls.map(([v]) => [v.model, v.slot])).toEqual(
      Array(3).fill(["gemini-3.5-flash-lite", "primary"]),
    );
  });
  it("refuses unavailable High before claiming a use or calling a provider", async () => {
    const deps = dependencies();
    expect(
      (
        await handleOnlineIntelligence(
          request({ quality: "high", highModeAcknowledged: "2026-10-19-v1" }),
          deps,
        )
      ).status,
    ).toBe(503);
    expect(deps.claimPermit).not.toHaveBeenCalled();
    expect(deps.callProvider).not.toHaveBeenCalled();
  });
  it.each([
    { quality: "high" },
    { quality: "high", highModeAcknowledged: "old" },
    { quality: "anything" },
  ])("requires current High acknowledgement and a valid level: %j", async (patch) => {
    const deps = dependencies();
    expect((await handleOnlineIntelligence(request(patch), deps)).status).toBe(400);
    expect(deps.callProvider).not.toHaveBeenCalled();
  });
});

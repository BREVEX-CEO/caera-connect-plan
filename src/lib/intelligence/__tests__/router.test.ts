import { describe, expect, it, vi } from "vitest";
import type { IntelligenceEvent, IntelligenceRequest, IntelligenceTransport } from "../contract";
import { createOcadeIntelligence } from "../router";

function request(mode: IntelligenceRequest["mode"] = "automatic"): IntelligenceRequest {
  return {
    permit: {
      id: "permit-1",
      generationId: "generation-1",
      idempotencyKey: "idempotency-1",
      surface: "chat",
      source: "server",
    },
    generationId: "generation-1",
    idempotencyKey: "idempotency-1",
    surface: "chat",
    mode,
    messages: [{ role: "user", content: "hello" }],
    tools: [],
    attachments: [],
    privacy: {
      onlineInferenceConsented: true,
      sealed: false,
    },
  };
}

function transport(
  backend: IntelligenceTransport["backend"],
  events: IntelligenceEvent[],
  available = true,
) {
  const probe = vi.fn(async () => ({
    available,
    state: available ? ("ready" as const) : ("unavailable" as const),
    reason: available ? undefined : "not available",
    capabilities: { text: available, tools: available, vision: available },
  }));
  const stream = vi.fn(async function* (_request: IntelligenceRequest) {
    yield* events;
  });
  return { backend, probe, stream } satisfies IntelligenceTransport;
}

function final(backend: IntelligenceTransport["backend"], text = "answer"): IntelligenceEvent {
  return {
    type: "final",
    response: { text, toolCalls: [], toolResults: [], backend, stopReason: "end_turn" },
  };
}

describe("OcadeIntelligence", () => {
  it("rejects a mismatched permit before probing either backend", async () => {
    const online = transport("gemini_online", [final("gemini_online")]);
    const local = transport("webgpu_local", [final("webgpu_local")]);
    const intelligence = createOcadeIntelligence({ online, local });
    const invalid = request();
    invalid.permit.generationId = "somebody-else";

    await expect(intelligence.generate(invalid)).rejects.toThrow(/matching commercial/);
    expect(online.probe).not.toHaveBeenCalled();
    expect(local.probe).not.toHaveBeenCalled();
  });

  it("makes Local only a zero-online-call path", async () => {
    const online = transport("gemini_online", [final("gemini_online")]);
    const local = transport("wasm_local", [
      { type: "token", text: "local" },
      final("wasm_local", "local"),
    ]);
    const result = await createOcadeIntelligence({ online, local }).generate(request("local_only"));

    expect(result).toMatchObject({ ok: true, response: { text: "local", backend: "wasm_local" } });
    expect(online.probe).not.toHaveBeenCalled();
    expect(online.stream).not.toHaveBeenCalled();
    expect(local.stream).toHaveBeenCalledTimes(1);
  });

  it("uses Online only when consent and a server permit are present", async () => {
    const online = transport("gemini_online", [final("gemini_online", "online")]);
    const local = transport("webgpu_local", [final("webgpu_local", "local")]);
    const intelligence = createOcadeIntelligence({ online, local });

    const denied = request("online");
    denied.privacy.onlineInferenceConsented = false;
    expect(await intelligence.generate(denied)).toMatchObject({
      ok: false,
      code: "online_not_consented",
    });
    expect(online.probe).not.toHaveBeenCalled();
    expect(local.probe).not.toHaveBeenCalled();

    const allowed = await intelligence.generate(request("online"));
    expect(allowed).toMatchObject({ ok: true, response: { backend: "gemini_online" } });
    expect(local.stream).not.toHaveBeenCalled();
  });

  it("falls back automatically with the same permit after a pre-output provider failure", async () => {
    const seen: IntelligenceRequest[] = [];
    const online = transport("gemini_online", [
      {
        type: "refusal",
        code: "provider_rate_limited",
        reason: "busy",
        retryable: true,
      },
    ]);
    const local = transport("webgpu_local", [final("webgpu_local", "local")]);
    online.stream.mockImplementation(async function* (input) {
      seen.push(input);
      yield {
        type: "refusal" as const,
        code: "provider_rate_limited" as const,
        reason: "busy",
        retryable: true,
      };
    });
    local.stream.mockImplementation(async function* (input) {
      seen.push(input);
      yield final("webgpu_local", "local");
    });

    const result = await createOcadeIntelligence({ online, local }).generate(request());
    expect(result).toMatchObject({ ok: true, response: { text: "local" } });
    expect(seen).toHaveLength(2);
    expect(seen[0].permit).toBe(seen[1].permit);
    expect(seen[0].generationId).toBe(seen[1].generationId);
  });

  it("never duplicates partial online output by falling back", async () => {
    const online = transport("gemini_online", [
      { type: "token", text: "part" },
      { type: "refusal", code: "provider_failed", reason: "lost", retryable: true },
    ]);
    const local = transport("webgpu_local", [final("webgpu_local", "duplicate")]);
    const result = await createOcadeIntelligence({ online, local }).generate(request());

    expect(result).toMatchObject({ ok: false, code: "provider_failed", partialText: "part" });
    expect(local.stream).not.toHaveBeenCalled();
  });

  it("does not turn an explicit Online failure into a Local request", async () => {
    const online = transport("gemini_online", [], false);
    const local = transport("webgpu_local", [final("webgpu_local")]);
    const result = await createOcadeIntelligence({ online, local }).generate(request("online"));

    expect(result).toMatchObject({ ok: false, code: "online_unavailable" });
    expect(local.probe).not.toHaveBeenCalled();
  });

  it("propagates cancellation to the active transport", async () => {
    let start!: () => void;
    const started = new Promise<void>((resolve) => {
      start = resolve;
    });
    const online = transport("gemini_online", []);
    const local = transport("webgpu_local", []);
    online.stream.mockImplementation(async function* (input) {
      start();
      await new Promise<void>((resolve) =>
        input.signal?.addEventListener("abort", () => resolve()),
      );
      yield { type: "refusal", code: "cancelled", reason: "stopped", retryable: false };
    });
    const intelligence = createOcadeIntelligence({ online, local });
    const pending = intelligence.generate(request("online"));
    await started;
    await intelligence.cancel("generation-1");

    await expect(pending).resolves.toMatchObject({ ok: false, code: "cancelled" });
    expect(local.stream).not.toHaveBeenCalled();
  });
});

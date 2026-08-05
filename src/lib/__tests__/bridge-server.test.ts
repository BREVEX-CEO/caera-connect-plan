import { describe, it, expect, vi } from "vitest";
import {
  handleBridgeRequest,
  handleChat,
  handleStatus,
  readPairingRequest,
  statusForDenial,
  type BridgeDeps,
  type BridgeRequest,
} from "../brain/bridge-server";
import { createPairingState, type PairedDevice } from "../brain/pairing";

/**
 * The desktop side of pairing.
 *
 * The assertion that matters more than any other: THE ENGINE IS NEVER TOUCHED
 * BY AN UNAUTHORISED REQUEST. Everything else here is detail; that one is the
 * difference between a paired computer and an open inference server.
 */

const DEVICE: PairedDevice = {
  id: "dev-1",
  label: "Work laptop",
  origin: "https://app.example.com",
  secret: "shared-secret",
  approvedAt: 0,
};

function deps(now = 10_000, overrides: Partial<BridgeDeps> = {}): BridgeDeps {
  return {
    state: createPairingState([DEVICE]),
    now: () => now,
    sign: (device, r) => `${device.secret}|${r.deviceId}|${r.origin}|${r.issuedAt}|${r.nonce}`,
    constantTimeEqual: (a, b) => a === b,
    describeEngine: async () => ({
      label: "Work laptop",
      modelId: "qwen3:8b",
      vision: true,
      tools: true,
    }),
    streamChat: async (_messages, handlers) => {
      handlers.onToken("To");
      handlers.onToken("kyo");
      return { ok: true, modelId: "qwen3:8b" };
    },
    ...overrides,
  };
}

function signedHeaders(now: number, over: Record<string, string> = {}) {
  const nonce = `n-${Math.random()}`;
  return {
    origin: DEVICE.origin,
    "x-ocade-device": DEVICE.id,
    "x-ocade-issued-at": String(now),
    "x-ocade-nonce": nonce,
    "x-ocade-signature": `${DEVICE.secret}|${DEVICE.id}|${DEVICE.origin}|${now}|${nonce}`,
    ...over,
  };
}

const get = (headers: Record<string, string>): BridgeRequest => ({
  path: "/status",
  method: "GET",
  headers,
});

const post = (headers: Record<string, string>, body: unknown): BridgeRequest => ({
  path: "/chat",
  method: "POST",
  headers,
  body,
});

describe("an unauthorised request never reaches the engine", () => {
  it("refuses an unsigned request without calling the engine", async () => {
    const streamChat = vi.fn();
    const describeEngine = vi.fn();
    const d = deps(10_000, { streamChat, describeEngine });
    const response = await handleStatus(get({ origin: DEVICE.origin }), d);
    expect(response.status).toBe(401);
    expect(describeEngine).not.toHaveBeenCalled();
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("refuses a chat from an unknown device without generating anything", async () => {
    const streamChat = vi.fn();
    const d = deps(10_000, { streamChat, state: createPairingState([]) });
    const result = await handleChat(
      post(signedHeaders(10_000), { messages: [{ role: "user", content: "hi" }] }),
      d,
    );
    expect(result.status).toBe(401);
    expect(result.stream).toBeUndefined();
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("refuses a chat from the wrong website without generating anything", async () => {
    const streamChat = vi.fn();
    const d = deps(10_000, { streamChat });
    const result = await handleChat(
      post(signedHeaders(10_000, { origin: "https://evil.example" }), {
        messages: [{ role: "user", content: "hi" }],
      }),
      d,
    );
    expect(result.status).toBe(403);
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("refuses a replayed request without generating anything twice", async () => {
    const streamChat = vi.fn(async () => ({ ok: true }));
    const d = deps(10_000, { streamChat });
    const headers = signedHeaders(10_000);
    const body = { messages: [{ role: "user", content: "hi" }] };
    const first = await handleChat(post(headers, body), d);
    expect(first.status).toBe(200);
    const replay = await handleChat(post(headers, body), d);
    expect(replay.status).toBe(401);
    expect(replay.stream).toBeUndefined();
  });
});

describe("status", () => {
  it("describes the engine to an authorised device", async () => {
    const response = await handleStatus(get(signedHeaders(10_000)), deps());
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ label: "Work laptop", vision: true });
  });

  it("says so plainly when this computer has no engine ready", async () => {
    const d = deps(10_000, { describeEngine: async () => null });
    const response = await handleStatus(get(signedHeaders(10_000)), d);
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: "no_engine" });
  });

  it("never leaks the secret or the device list in a refusal", async () => {
    const response = await handleStatus(get({ origin: DEVICE.origin }), deps());
    const serialised = JSON.stringify(response.body);
    expect(serialised).not.toContain(DEVICE.secret);
    expect(serialised).not.toContain(DEVICE.id);
  });
});

describe("chat", () => {
  it("streams newline-delimited tokens and the model that produced them", async () => {
    const result = await handleChat(
      post(signedHeaders(10_000), { messages: [{ role: "user", content: "capital?" }] }),
      deps(),
    );
    expect(result.status).toBe(200);
    const lines: string[] = [];
    await result.stream!((line) => lines.push(line));
    const parsed = lines.map((l) => JSON.parse(l));
    expect(
      parsed
        .filter((p) => p.token)
        .map((p) => p.token)
        .join(""),
    ).toBe("Tokyo");
    expect(parsed.some((p) => p.modelId === "qwen3:8b")).toBe(true);
  });

  it("rejects a request with no messages before touching the engine", async () => {
    const streamChat = vi.fn();
    const result = await handleChat(post(signedHeaders(10_000), {}), deps(10_000, { streamChat }));
    expect(result.status).toBe(400);
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("rejects a malformed message rather than passing it through", async () => {
    const streamChat = vi.fn();
    const result = await handleChat(
      post(signedHeaders(10_000), { messages: [{ role: "wizard", content: "hi" }] }),
      deps(10_000, { streamChat }),
    );
    expect(result.status).toBe(400);
    expect(streamChat).not.toHaveBeenCalled();
  });

  it("reports a mid-stream failure inside the stream, since the status is already sent", async () => {
    const d = deps(10_000, {
      streamChat: async (_m, handlers) => {
        handlers.onToken("par");
        return { ok: false, reason: "the engine stopped" };
      },
    });
    const result = await handleChat(
      post(signedHeaders(10_000), { messages: [{ role: "user", content: "x" }] }),
      d,
    );
    const lines: string[] = [];
    await result.stream!((line) => lines.push(line));
    const parsed = lines.map((l) => JSON.parse(l));
    expect(parsed.some((p) => p.error === "the engine stopped")).toBe(true);
  });
});

describe("routing and status codes", () => {
  it("answers an unknown endpoint with 404", async () => {
    const response = await handleBridgeRequest(
      { path: "/anything", method: "GET", headers: signedHeaders(10_000) },
      deps(),
    );
    expect(response.status).toBe(404);
  });

  it("does not treat a GET to the chat endpoint as a chat", async () => {
    const response = await handleBridgeRequest(
      { path: "/chat", method: "GET", headers: signedHeaders(10_000) },
      deps(),
    );
    expect(response.status).toBe(404);
  });

  it("distinguishes re-pair, forbidden and busy, because the advice differs", () => {
    // The browser adapter turns 401/403 into "pair again" and 429 into "busy".
    // Collapsing them would give the wrong advice for half the failures.
    expect(statusForDenial("bad_signature")).toBe(401);
    expect(statusForDenial("revoked")).toBe(403);
    expect(statusForDenial("origin_not_allowed")).toBe(403);
    expect(statusForDenial("rate_limited")).toBe(429);
  });
});

describe("reading the signed headers", () => {
  it("returns null when any of the four is missing", () => {
    const full = signedHeaders(10_000);
    for (const key of [
      "x-ocade-device",
      "x-ocade-issued-at",
      "x-ocade-nonce",
      "x-ocade-signature",
    ]) {
      const partial = { ...full, [key]: undefined };
      expect(readPairingRequest(partial, DEVICE.origin)).toBeNull();
    }
  });

  it("returns null when the timestamp is not a number", () => {
    const headers = { ...signedHeaders(10_000), "x-ocade-issued-at": "soon" };
    expect(readPairingRequest(headers, DEVICE.origin)).toBeNull();
  });
});

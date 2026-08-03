import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";

/**
 * OCADE relay — RUNTIME evidence.
 *
 * The relay process is spawned for real and driven over HTTP. Every assertion
 * below is about observed behaviour of a running server, not about its source.
 *
 * The properties that matter are the ones that keep the relay a dumb pipe: it
 * must refuse anything that is not a sealed envelope, refuse a third listener
 * to a two-party pairing, never echo to the sender, and never retain history.
 * A relay that quietly did any of those would be a place where plaintext could
 * appear or a message could be silently copied.
 */

const PORT = 8791; // distinct from the default so a local instance cannot collide
const BASE = `http://127.0.0.1:${PORT}`;

let relay: ChildProcess;

const sealed = (over: Record<string, unknown> = {}) => ({
  v: 1,
  deviceId: "phone-1",
  sequence: 1,
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  senderPublicKey: { kty: "EC", crv: "P-256", x: "abc", y: "def" },
  senderFingerprint: "fp-1",
  salt: "c2FsdA",
  iv: "aXY",
  ciphertext: "Y2lwaGVy",
  ...over,
});

async function waitForHealth(timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) throw new Error("relay did not become healthy");
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** Open an SSE stream and collect envelope frames. */
function openStream(room: string) {
  const controller = new AbortController();
  const received: Array<Record<string, unknown>> = [];
  let clientId = "";
  const ready = (async () => {
    const res = await fetch(`${BASE}/rooms/${room}/stream`, { signal: controller.signal });
    if (!res.ok) throw new Error(`stream refused: ${res.status}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let resolveReady: () => void = () => {};
    const readyPromise = new Promise<void>((r) => (resolveReady = r));
    (async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            if (frame.includes("event: ready")) {
              const data = /data: (.+)/.exec(frame)?.[1];
              if (data) clientId = JSON.parse(data).clientId;
              resolveReady();
            } else if (frame.includes("event: envelope")) {
              const data = /data: (.+)/.exec(frame)?.[1];
              if (data) received.push(JSON.parse(data));
            }
          }
        }
      } catch {
        /* aborted */
      }
    })();
    await readyPromise;
  })();
  return {
    ready,
    received,
    close: () => controller.abort(),
    get clientId() {
      return clientId;
    },
  };
}

const post = (room: string, body: unknown, clientId?: string) =>
  fetch(`${BASE}/rooms/${room}/send`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(clientId ? { "x-client-id": clientId } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const settle = () => new Promise((r) => setTimeout(r, 120));

beforeAll(async () => {
  relay = spawn(process.execPath, ["relay/server.mjs"], {
    env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1" },
    stdio: "ignore",
  });
  await waitForHealth();
}, 30_000);

afterAll(() => {
  relay?.kill("SIGTERM");
});

describe("liveness", () => {
  it("reports healthy without leaking room or client identifiers", async () => {
    const res = await fetch(`${BASE}/health`);
    const body = (await res.json()) as Record<string, unknown>;
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.service).toBe("ocade-relay");
    expect(JSON.stringify(body)).not.toMatch(/roomId|clientId/);
  });
});

describe("it forwards sealed envelopes between the two ends of a pairing", () => {
  it("delivers to the peer and does NOT echo to the sender", async () => {
    const room = "runtime-room-delivery";
    const a = openStream(room);
    await a.ready;
    const b = openStream(room);
    await b.ready;

    const res = await post(room, sealed({ sequence: 7 }), a.clientId);
    expect(res.status).toBe(200);
    expect((await res.json()).delivered).toBe(1);
    await settle();

    expect(b.received).toHaveLength(1);
    expect(b.received[0].sequence).toBe(7);
    expect(a.received, "sender must not receive its own envelope").toHaveLength(0);

    a.close();
    b.close();
    await settle();
  });

  it("preserves the ciphertext byte for byte", async () => {
    const room = "runtime-room-fidelity";
    const a = openStream(room);
    await a.ready;
    const b = openStream(room);
    await b.ready;

    const envelope = sealed({ ciphertext: "TG9uZ2VyQ2lwaGVyVGV4dA", sequence: 3 });
    await post(room, envelope, a.clientId);
    await settle();

    expect(b.received[0].ciphertext).toBe("TG9uZ2VyQ2lwaGVyVGV4dA");
    expect(b.received[0].iv).toBe(envelope.iv);
    expect(b.received[0].salt).toBe(envelope.salt);

    a.close();
    b.close();
    await settle();
  });
});

describe("it refuses to be anything but a pipe", () => {
  it("rejects a body that is not a sealed envelope", async () => {
    const res = await post("runtime-room-reject", { hello: "world" });
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe("not_a_sealed_envelope");
  });

  it("rejects an envelope carrying a PLAINTEXT field", async () => {
    // A readable payload means a client skipped sealing. Forwarding it would
    // put plaintext through the relay.
    const res = await post("runtime-room-plain", sealed({ payload: { kind: "emergency.stop" } }));
    expect(res.status).toBe(422);
  });

  it("rejects malformed JSON", async () => {
    const res = await post("runtime-room-json", "{not json");
    expect(res.status).toBe(400);
  });

  it("rejects an envelope with a non-positive sequence", async () => {
    expect((await post("runtime-room-seq", sealed({ sequence: 0 }))).status).toBe(422);
  });

  it("rejects an unsupported protocol version", async () => {
    expect((await post("runtime-room-ver", sealed({ v: 2 }))).status).toBe(422);
  });

  it("rejects an invalid room id rather than creating it", async () => {
    // A too-short id reaches the room handler and is refused there.
    expect((await post("short", sealed())).status).toBe(400);
    // A traversal attempt never even reaches it: the URL normalises to /etc/send,
    // which is not a rooms route at all. 404 is the stronger outcome.
    expect((await post("../etc", sealed())).status).toBe(404);
  });

  it("rejects an oversized body", async () => {
    const huge = sealed({ ciphertext: "A".repeat(300_000) });
    expect((await post("runtime-room-huge", huge)).status).toBe(413);
  });
});

describe("a pairing has exactly two ends", () => {
  it("refuses a THIRD listener instead of silently copying to it", async () => {
    const room = "runtime-room-capacity";
    const a = openStream(room);
    await a.ready;
    const b = openStream(room);
    await b.ready;

    const res = await fetch(`${BASE}/rooms/${room}/stream`);
    expect(res.status).toBe(409);
    // `res.json()` already consumes the body; cancelling it afterwards throws
    // ERR_INVALID_STATE on a locked stream and surfaces as an unhandled
    // rejection even though every assertion passes.
    expect((await res.json()).error).toBe("room_full");

    a.close();
    b.close();
    await settle();
  });
});

describe("it keeps no history", () => {
  it("reports honestly that nobody was connected", async () => {
    const res = await post("runtime-room-empty", sealed());
    expect(res.status).toBe(202);
    const body = (await res.json()) as { delivered: number; note: string };
    expect(body.delivered).toBe(0);
    expect(body.note).toBe("no_peer_connected");
  });

  it("does not replay an earlier envelope to a client that connects later", async () => {
    const room = "runtime-room-nohistory";
    await post(room, sealed({ sequence: 42 }));
    await settle();

    const late = openStream(room);
    await late.ready;
    await settle();

    // Recovery is the client reconnect protocol's job, not the relay's.
    expect(late.received).toHaveLength(0);
    late.close();
    await settle();
  });
});

describe("unknown routes", () => {
  it("404s an unknown path and 405s a wrong method", async () => {
    expect((await fetch(`${BASE}/nope`)).status).toBe(404);
    expect((await fetch(`${BASE}/rooms/runtime-room-x/send`)).status).toBe(405);
  });
});

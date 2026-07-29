/**
 * OCADE relay — a deliberately dumb pipe.
 *
 * Forwards SEALED envelopes between the two members of a pairing room. It has
 * no keys and never decrypts anything: payloads are AES-GCM sealed by
 * src/lib/mobile/secure-channel.ts before they arrive, and the relay only ever
 * sees `ciphertext`, `iv`, `salt` and routing metadata.
 *
 * WHAT THIS MEANS FOR TRUST
 *
 * A compromised relay can drop, delay, duplicate or reorder messages. It cannot
 * read them, and it cannot forge one: the recipient verifies the sender
 * fingerprint and rejects any sequence at or below its watermark. Those
 * defences live in the client and are already tested; this process is
 * deliberately given no ability to help or hinder them.
 *
 * So the relay REFUSES to be clever:
 *  - it rejects any body that is not a well-formed sealed envelope;
 *  - it never logs ciphertext, and never logs a full envelope;
 *  - it holds no history — a client that was not connected missed the message,
 *    and the client-side reconnect protocol is what recovers it;
 *  - it caps room membership at 2, so a third party cannot silently join a
 *    pairing and receive copies.
 *
 * Transport is SSE + POST rather than WebSocket purely so it runs on stock Node
 * with no dependencies at all: nothing to audit, nothing to keep patched.
 *
 * Run:    node relay/server.mjs
 * Docker: docker compose up --build
 */

import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? "0.0.0.0";
const MAX_ENVELOPE_BYTES = Number(process.env.MAX_ENVELOPE_BYTES ?? 256 * 1024);
const MAX_ROOM_MEMBERS = 2;
const MAX_SENDS_PER_MINUTE = Number(process.env.MAX_SENDS_PER_MINUTE ?? 600);

/** roomId -> Map<clientId, res> */
const rooms = new Map();
/** roomId -> { count, resetAt } */
const rates = new Map();

const ROOM_ID = /^[A-Za-z0-9_-]{8,128}$/;

function log(event, fields = {}) {
  // Structured, and deliberately incapable of carrying a payload: only the
  // whitelisted routing fields below are ever emitted.
  const safe = {
    at: new Date().toISOString(),
    event,
    room: fields.room ? `${String(fields.room).slice(0, 8)}…` : undefined,
    client: fields.client ? `${String(fields.client).slice(0, 8)}…` : undefined,
    sequence: fields.sequence,
    bytes: fields.bytes,
    reason: fields.reason,
    members: fields.members,
  };
  console.log(JSON.stringify(safe));
}

/** A sealed envelope, and nothing else, is acceptable. */
function isSealedEnvelope(value) {
  if (typeof value !== "object" || value === null) return false;
  const required = [
    "v",
    "deviceId",
    "sequence",
    "issuedAt",
    "expiresAt",
    "senderPublicKey",
    "senderFingerprint",
    "salt",
    "iv",
    "ciphertext",
  ];
  for (const key of required) {
    if (!(key in value)) return false;
  }
  if (value.v !== 1) return false;
  if (!Number.isSafeInteger(value.sequence) || value.sequence < 1) return false;
  for (const key of ["salt", "iv", "ciphertext", "senderFingerprint", "deviceId"]) {
    if (typeof value[key] !== "string" || value[key].length === 0) return false;
  }
  // A plaintext field would mean a client bypassed sealing. Refuse it loudly
  // rather than forwarding readable content through a relay.
  if ("payload" in value || "intent" in value || "plaintext" in value) return false;
  return true;
}

function withinRate(roomId) {
  const now = Date.now();
  const entry = rates.get(roomId);
  if (!entry || now >= entry.resetAt) {
    rates.set(roomId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_SENDS_PER_MINUTE;
}

function send(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(text);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let exceeded = false;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        if (!exceeded) {
          exceeded = true;
          // Stop BUFFERING, but do not destroy the socket. Destroying it makes
          // the client see a transport error instead of the 413 explaining what
          // went wrong — an honest refusal the caller can act on is worth more
          // than shaving a few milliseconds off a rejected upload.
          chunks.length = 0;
          reject(new Error("too_large"));
        }
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!exceeded) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, {
      status: "ok",
      service: "ocade-relay",
      rooms: rooms.size,
      // Deliberately no room ids and no client ids.
    });
  }

  // /rooms/:roomId/stream   (SSE, receive)
  // /rooms/:roomId/send     (POST, forward)
  if (parts[0] !== "rooms" || parts.length !== 3) {
    return send(res, 404, { error: "not_found" });
  }
  const roomId = parts[1];
  if (!ROOM_ID.test(roomId)) {
    return send(res, 400, { error: "invalid_room" });
  }

  if (req.method === "GET" && parts[2] === "stream") {
    const room = rooms.get(roomId) ?? new Map();
    if (room.size >= MAX_ROOM_MEMBERS) {
      // A pairing has exactly two ends. A third listener would receive copies
      // of every envelope, so it is refused rather than quietly accepted.
      log("join_refused", { room: roomId, reason: "room_full", members: room.size });
      return send(res, 409, { error: "room_full" });
    }

    const clientId = randomUUID();
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    res.write(`event: ready\ndata: ${JSON.stringify({ clientId })}\n\n`);

    room.set(clientId, res);
    rooms.set(roomId, room);
    log("join", { room: roomId, client: clientId, members: room.size });

    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), 25_000);
    const leave = () => {
      clearInterval(heartbeat);
      const current = rooms.get(roomId);
      if (!current) return;
      current.delete(clientId);
      if (current.size === 0) {
        rooms.delete(roomId);
        rates.delete(roomId);
      }
      log("leave", { room: roomId, client: clientId, members: current.size });
    };
    req.on("close", leave);
    req.on("error", leave);
    return undefined;
  }

  if (req.method === "POST" && parts[2] === "send") {
    let raw;
    try {
      raw = await readBody(req, MAX_ENVELOPE_BYTES);
    } catch {
      log("rejected", { room: roomId, reason: "too_large" });
      return send(res, 413, { error: "envelope_too_large" });
    }

    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      log("rejected", { room: roomId, reason: "malformed_json" });
      return send(res, 400, { error: "malformed_json" });
    }

    if (!isSealedEnvelope(envelope)) {
      log("rejected", { room: roomId, reason: "not_a_sealed_envelope" });
      return send(res, 422, { error: "not_a_sealed_envelope" });
    }

    if (!withinRate(roomId)) {
      log("rejected", { room: roomId, reason: "rate_limited" });
      return send(res, 429, { error: "rate_limited" });
    }

    const room = rooms.get(roomId);
    if (!room || room.size === 0) {
      // Honest: nobody heard it. The relay keeps no history, so the client's
      // reconnect protocol — not the relay — is what recovers this.
      log("undelivered", { room: roomId, sequence: envelope.sequence });
      return send(res, 202, { delivered: 0, note: "no_peer_connected" });
    }

    const senderId = req.headers["x-client-id"];
    let delivered = 0;
    const frame = `event: envelope\ndata: ${JSON.stringify(envelope)}\n\n`;
    for (const [clientId, stream] of room) {
      if (clientId === senderId) continue; // never echo to the sender
      stream.write(frame);
      delivered += 1;
    }

    log("forwarded", { room: roomId, sequence: envelope.sequence, bytes: raw.length });
    return send(res, 200, { delivered });
  }

  return send(res, 405, { error: "method_not_allowed" });
});

server.listen(PORT, HOST, () => {
  log("listening", { reason: `${HOST}:${PORT}` });
});

// Close cleanly so `docker stop` does not sever live streams abruptly.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    log("shutting_down", { reason: signal });
    for (const room of rooms.values()) {
      for (const stream of room.values()) stream.end();
    }
    server.close(() => process.exit(0));
  });
}

export { server };

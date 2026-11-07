/**
 * The signed device door (165): a malformed device id is refused before any database work,
 * and the per-device budget is the database's shared decision, so a budget spent on another
 * server instance is enforced here too. Synthetic key and fake database; no network.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { canonical, handleDeviceRequest, HEADERS } from "../../src/lib/jarvis/authority.server.ts";
import { PROTOCOL_VERSION } from "../../src/lib/jarvis/contracts.ts";

const base64url = (bytes: ArrayBuffer) => Buffer.from(bytes).toString("base64url");

async function door(admission: string | null, deviceId: string) {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const publicKey = base64url(await crypto.subtle.exportKey("spki", keys.publicKey));
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const admin = {
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn === "jarvis_device_key") return { data: publicKey, error: null };
      if (fn === "jarvis_device_admit") return { data: admission, error: null };
      return { data: null, error: { message: `unexpected ${fn}` } };
    },
  };
  const body = JSON.stringify({ op: "inventory", apps: [], mcp: [], engines: [] });
  const now = Date.now();
  const path = "/api/jarvis/device";
  const text = await canonical({ method: "POST", path, deviceId, timestamp: now, body });
  const signature = base64url(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      keys.privateKey,
      new TextEncoder().encode(text),
    ),
  );
  const request = new Request(`https://ocade.test${path}`, {
    method: "POST",
    body,
    headers: {
      [HEADERS.protocol]: String(PROTOCOL_VERSION),
      [HEADERS.timestamp]: String(now),
      [HEADERS.device]: deviceId,
      [HEADERS.signature]: signature,
    },
  });
  const reply = await handleDeviceRequest(
    admin as never,
    request,
    `test-${crypto.randomUUID()}`,
    now,
  );
  return { reply, calls };
}

test("a malformed device id is refused before the database is asked", async () => {
  for (const deviceId of [
    "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa-",
    "--------aaaa-aaaa-aaaa-aaaaaaaaaaaaa",
    "A".repeat(36),
  ]) {
    const { reply, calls } = await door("admitted", deviceId);
    assert.equal(reply.status, 401, deviceId);
    assert.deepEqual(calls, [], deviceId);
  }
});

test("the shared database budget decides, whichever server instance answers", async () => {
  const deviceId = crypto.randomUUID();
  const limited = await door("rate_limited", deviceId);
  assert.equal(limited.reply.status, 429);
  const admit = limited.calls.find((c) => c.fn === "jarvis_device_admit");
  assert.equal(admit?.args.p_limit, 30);
  assert.equal(admit?.args.p_window_ms, 10_000);
  const refused = await door("refused", crypto.randomUUID());
  assert.equal(
    refused.reply.status,
    409,
    "a fresh-check refusal with a live key reads as a replay",
  );
});

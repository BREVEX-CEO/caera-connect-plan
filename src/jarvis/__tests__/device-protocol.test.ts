import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { canonical, PROTOCOL, readSigned, verifySignature } from "../device.server";

/**
 * The shared device protocol: the website verifies exactly what the Device
 * Agent (Python) and the browser extension (WebCrypto) sign, and refuses old
 * protocol versions, stale clocks and tampered requests.
 */
const BASE = "https://ocade.test";
/** The agent's own dependency; without it the cross-language proof cannot run here. */
const pythonAgent =
  spawnSync("python3", [
    "-c",
    "import sys; sys.path.insert(0, 'jarvis-runtime'); import ocade_identity",
  ]).status === 0;
const PATH = PROTOCOL.paths.exchange;

const b64url = (bytes: ArrayBuffer) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function webcryptoDevice() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const publicKey = b64url(await crypto.subtle.exportKey("spki", pair.publicKey));
  const request = async (
    body: string,
    opts: {
      device?: string;
      ts?: number;
      protocol?: number;
      path?: string;
      signBody?: string;
    } = {},
  ) => {
    const ts = opts.ts ?? Date.now();
    const device = opts.device ?? "d1";
    const text = await canonical({
      protocol: opts.protocol ?? PROTOCOL.version,
      method: "POST",
      path: opts.path ?? PATH,
      deviceId: device,
      timestamp: ts,
      body: opts.signBody ?? body,
    });
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(text),
    );
    return new Request(`${BASE}${PATH}`, {
      method: "POST",
      body,
      headers: {
        [PROTOCOL.headers.device]: device,
        [PROTOCOL.headers.protocol]: String(opts.protocol ?? PROTOCOL.version),
        [PROTOCOL.headers.timestamp]: String(ts),
        [PROTOCOL.headers.signature]: b64url(signature),
      },
    });
  };
  return { publicKey, request };
}

async function check(request: Request, publicKey: string) {
  const signed = await readSigned(request.clone());
  if (!signed.ok) return signed.error;
  return (await verifySignature(request, signed, publicKey)) ? "ok" : "bad_signature";
}

describe("the device protocol", () => {
  it("verifies a WebCrypto signature, as the browser extension makes it", async () => {
    const device = await webcryptoDevice();
    expect(await check(await device.request('{"results":[]}'), device.publicKey)).toBe("ok");
  });

  it("refuses a changed body, a different path or another device's key", async () => {
    const device = await webcryptoDevice();
    const other = await webcryptoDevice();
    expect(
      await check(await device.request('{"results":[1]}', { signBody: "{}" }), device.publicKey),
    ).toBe("bad_signature");
    expect(
      await check(await device.request("{}", { path: PROTOCOL.paths.enroll }), device.publicKey),
    ).toBe("bad_signature");
    expect(await check(await device.request("{}"), other.publicKey)).toBe("bad_signature");
  });

  it("fails closed on an old protocol and a stale clock", async () => {
    const device = await webcryptoDevice();
    expect(await check(await device.request("{}", { protocol: 0 }), device.publicKey)).toBe(
      "update_required",
    );
    expect(
      await check(await device.request("{}", { ts: Date.now() - 10 * 60_000 }), device.publicKey),
    ).toBe("clock_skew");
  });

  it.skipIf(!pythonAgent)("verifies what the Python Device Agent signs", async () => {
    const script = `
import json, sys, time
sys.path.insert(0, "jarvis-runtime")
import ocade_identity as i
key = i.new_key()
body = b'{"results": []}'
ts = int(time.time() * 1000)
path = i.PROTOCOL["paths"]["exchange"]
print(json.dumps({"public": i.public_text(key), "ts": ts, "body": body.decode(),
  "signature": i.sign(key, i.canonical("POST", path, "d9", ts, body)),
  "fingerprint": i.fingerprint(i.public_text(key))}))`;
    const run = spawnSync("python3", ["-c", script], { encoding: "utf8" });
    expect(run.stderr).toBe("");
    const vector = JSON.parse(run.stdout) as Record<string, string | number>;
    const request = new Request(`${BASE}${PATH}`, {
      method: "POST",
      body: String(vector.body),
      headers: {
        [PROTOCOL.headers.device]: "d9",
        [PROTOCOL.headers.protocol]: String(PROTOCOL.version),
        [PROTOCOL.headers.timestamp]: String(vector.ts),
        [PROTOCOL.headers.signature]: String(vector.signature),
      },
    });
    expect(await check(request, String(vector.public))).toBe("ok");
    const { fingerprint } = await import("../device.server");
    expect(await fingerprint(String(vector.public))).toBe(vector.fingerprint);
  });
});

import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { canonical, PROTOCOL, readSigned, verifySignature } from "../device.server";

/**
 * The shared device protocol: the website verifies exactly what the Device
 * Agent (Python) and a raw-signature client (WebCrypto; Android converts to it) sign, and refuses old
 * protocol versions, stale clocks and tampered requests.
 */
const BASE = "https://ocade.test";
/** The agent's own dependency; without it the cross-language proof cannot run here. */
// `python3` on Linux and macOS, `python` on Windows.
const pythonAgent = ["python3", "python"].find(
  (python) =>
    spawnSync(python, [
      "-c",
      "import sys; sys.path.insert(0, 'jarvis-runtime'); import ocade_identity",
    ]).status === 0,
);
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
  it.each([undefined, "1"])(
    "bounds unsigned request streams with Content-Length %s",
    async (declaredLength) => {
      let pulls = 0;
      const cancel = vi.fn();
      const headers = new Headers({
        [PROTOCOL.headers.protocol]: String(PROTOCOL.version),
        [PROTOCOL.headers.timestamp]: String(Date.now()),
      });
      if (declaredLength) headers.set("Content-Length", declaredLength);
      const request = new Request(`${BASE}${PROTOCOL.paths.enroll}`, {
        method: "POST",
        headers,
        body: new ReadableStream<Uint8Array>(
          {
            pull(controller) {
              pulls += 1;
              controller.enqueue(new Uint8Array(100_000));
            },
            cancel,
          },
          { highWaterMark: 0 },
        ),
        duplex: "half",
      } as RequestInit);
      expect(await readSigned(request)).toEqual({ ok: false, status: 413, error: "too_large" });
      expect(pulls).toBe(19);
      expect(cancel).toHaveBeenCalledTimes(1);
    },
  );

  it("keeps the existing text limit for multi-byte device messages", async () => {
    const headers = {
      [PROTOCOL.headers.protocol]: String(PROTOCOL.version),
      [PROTOCOL.headers.timestamp]: String(Date.now()),
    };
    const body = "€".repeat(600_000);
    const signed = await readSigned(
      new Request(`${BASE}${PATH}`, { method: "POST", headers, body: "\uFEFF" + body }),
    );
    expect(signed.ok && signed.body).toBe(body);
    expect(
      await readSigned(
        new Request(`${BASE}${PATH}`, { method: "POST", headers, body: "a".repeat(600_001) }),
      ),
    ).toEqual({ ok: false, status: 413, error: "too_large" });
  });

  it("cancels a pending body read when the device disconnects", async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const request = new Request(`${BASE}${PATH}`, {
      method: "POST",
      headers: {
        [PROTOCOL.headers.protocol]: String(PROTOCOL.version),
        [PROTOCOL.headers.timestamp]: String(Date.now()),
      },
      signal: controller.signal,
      body: new ReadableStream<Uint8Array>({ cancel }),
      duplex: "half",
    } as RequestInit);
    const reading = readSigned(request);
    controller.abort(new DOMException("Device disconnected", "AbortError"));
    await expect(reading).rejects.toThrow("Device disconnected");
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it("verifies a raw r||s signature, as WebCrypto and the Android app send it", async () => {
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
    // Not 401: a device treats only "not enrolled" as removal, never a wrong clock.
    const skewed = await readSigned(await device.request("{}", { ts: Date.now() - 10 * 60_000 }));
    expect(skewed.ok ? 200 : skewed.status).toBe(409);
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
    const run = spawnSync(pythonAgent!, ["-c", script], { encoding: "utf8" });
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

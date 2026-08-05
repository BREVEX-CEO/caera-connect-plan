import { describe, it, expect } from "vitest";
import {
  parseDeviceFile,
  readBridgeConfig,
  signPairingRequest,
  constantTimeEqual,
  serveBridgeRequest,
} from "../brain/bridge-host.server";

/**
 * The listener side.
 *
 * Two things are worth more than the rest here. The first is that the bridge is
 * ABSENT unless the machine turned it on — a hosted deployment answering as
 * though it were the user's own computer would defeat the whole idea of a
 * paired device. The second is that the signature computed here matches the one
 * the browser adapter computes; if those two ever drift, every genuine request
 * is refused and the only visible symptom is "pair again" forever.
 */

describe("whether this machine is a bridge at all", () => {
  it("is off unless the machine explicitly turned it on", () => {
    expect(readBridgeConfig({}).enabled).toBe(false);
    expect(readBridgeConfig({ OCADE_BRIDGE_ENABLED: "true" }).enabled).toBe(false);
    expect(readBridgeConfig({ OCADE_BRIDGE_ENABLED: "1" }).enabled).toBe(true);
  });

  it("answers nothing at all when it is off, rather than refusing", async () => {
    // Null becomes a 404 at the transport. A disabled bridge must look like no
    // endpoint, not like a locked one: a locked one advertises what is behind it.
    const outcome = await serveBridgeRequest(
      { path: "/status", method: "GET", headers: {} },
      { enabled: false, deviceFile: null },
    );
    expect(outcome).toBeNull();
  });

  it("refuses everyone when it is on but nobody has been approved", async () => {
    const outcome = await serveBridgeRequest(
      { path: "/status", method: "GET", headers: {} },
      { enabled: true, deviceFile: null },
    );
    expect(outcome).not.toBeNull();
    expect(outcome!.status).toBe(401);
  });
});

describe("the approved-device file", () => {
  it("accepts both a bare array and a { devices } wrapper", () => {
    const device = { id: "d1", label: "Laptop", origin: "https://a.example", secret: "s" };
    expect(parseDeviceFile(JSON.stringify([device]))).toHaveLength(1);
    expect(parseDeviceFile(JSON.stringify({ devices: [device] }))).toHaveLength(1);
  });

  it("drops an entry missing any of the fields that make it safe", () => {
    // A device with no origin would be usable from ANY website. Defaulting a
    // missing field here would be the hole the origin check exists to close.
    const rows = [
      { id: "d1", label: "L", origin: "", secret: "s" },
      { id: "", label: "L", origin: "https://a.example", secret: "s" },
      { id: "d3", label: "L", origin: "https://a.example", secret: "" },
      { id: "d4", label: "L", origin: "https://a.example", secret: "s" },
    ];
    const parsed = parseDeviceFile(JSON.stringify(rows));
    expect(parsed.map((device) => device.id)).toEqual(["d4"]);
  });

  it("returns nothing rather than throwing on a corrupt file", () => {
    expect(parseDeviceFile("{not json")).toEqual([]);
    expect(parseDeviceFile("null")).toEqual([]);
  });

  it("keeps a revocation, so a revoked device is not silently re-admitted", () => {
    const parsed = parseDeviceFile(
      JSON.stringify([
        { id: "d1", label: "L", origin: "https://a.example", secret: "s", revokedAt: 5 },
      ]),
    );
    expect(parsed[0].revokedAt).toBe(5);
  });
});

describe("the signature", () => {
  it("matches the one the browser adapter computes, byte for byte", async () => {
    // Recomputed here with WebCrypto exactly as `paired-desktop.ts` does it. If
    // this ever fails, the two sides have drifted and no genuine request can
    // succeed.
    const secret = "shared-secret-value";
    const request = {
      deviceId: "dev-1",
      origin: "https://app.example.com",
      issuedAt: 1_700_000_000_000,
      nonce: "11111111-2222-3333-4444-555555555555",
    };
    const message = `${request.deviceId}|${request.origin}|${request.issuedAt}|${request.nonce}`;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const browserSide = [
      ...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))),
    ]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    expect(signPairingRequest(secret, request)).toBe(browserSide);
  });

  it("changes when any field of the request changes", () => {
    const base = { deviceId: "d", origin: "https://a.example", issuedAt: 1, nonce: "n" };
    const signed = signPairingRequest("s", base);
    expect(signPairingRequest("s", { ...base, deviceId: "e" })).not.toBe(signed);
    expect(signPairingRequest("s", { ...base, origin: "https://b.example" })).not.toBe(signed);
    expect(signPairingRequest("s", { ...base, issuedAt: 2 })).not.toBe(signed);
    expect(signPairingRequest("s", { ...base, nonce: "m" })).not.toBe(signed);
    expect(signPairingRequest("t", base)).not.toBe(signed);
  });

  it("compares without leaking length or content through an exception", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    // Different lengths must return false, not throw: timingSafeEqual rejects
    // mismatched buffers, and an unhandled throw here would 500 instead of 401.
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

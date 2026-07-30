import { describe, it, expect } from "vitest";
import {
  completeKeyExchange,
  confirmSas,
  deriveSas,
  SAS_DIGITS,
} from "../mobile/pairing-keys";
import { generateMobileChannelIdentity } from "../mobile/secure-channel";

/**
 * Pairing key exchange and short authentication string (P13).
 *
 * Real ECDH keys throughout — a module whose whole purpose is detecting a
 * man-in-the-middle cannot be tested against stubbed keys.
 */

const RELAY = "wss://relay.example/ws";
const ROOM = "room-abc";

async function keys() {
  const host = await generateMobileChannelIdentity();
  const device = await generateMobileChannelIdentity();
  return { host, device };
}

const offer = (hostPublicKey: JsonWebKey, over = {}) => ({
  hostPublicKey,
  relayUrl: RELAY,
  roomId: ROOM,
  ...over,
});

describe("key exchange produces what the encrypted transport needs", () => {
  it("returns the relay, room and peer key", async () => {
    const { host, device } = await keys();
    const r = await completeKeyExchange(offer(host.publicKey), {
      devicePublicKey: device.publicKey,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.channel.relayUrl).toBe(RELAY);
      expect(r.channel.roomId).toBe(ROOM);
      expect(r.channel.peerPublicKey).toEqual(device.publicKey);
      expect(r.sas).toMatch(new RegExp(`^\\d{${SAS_DIGITS}}$`));
    }
  });

  it("refuses when either side offers no key", async () => {
    const { host, device } = await keys();
    const noHost = await completeKeyExchange(
      offer(undefined as unknown as JsonWebKey),
      { devicePublicKey: device.publicKey },
    );
    expect(noHost.ok).toBe(false);
    if (!noHost.ok) expect(noHost.refusal).toBe("missing_host_key");

    const noDevice = await completeKeyExchange(offer(host.publicKey), {
      devicePublicKey: undefined as unknown as JsonWebKey,
    });
    expect(noDevice.ok).toBe(false);
    if (!noDevice.ok) expect(noDevice.refusal).toBe("missing_device_key");
  });

  it("REFUSES a reflection attack where both sides show the same key", async () => {
    // A relay that bounces the offer back instead of forwarding it would
    // produce a perfectly matching SAS that proves nothing.
    const { host } = await keys();
    const r = await completeKeyExchange(offer(host.publicKey), {
      devicePublicKey: host.publicKey,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.refusal).toBe("same_key");
      expect(r.reason).toMatch(/reflected back/);
    }
  });
});

describe("the relay address is checked", () => {
  it("accepts wss", async () => {
    const { host, device } = await keys();
    const r = await completeKeyExchange(offer(host.publicKey, { relayUrl: "wss://a.example/ws" }), {
      devicePublicKey: device.publicKey,
    });
    expect(r.ok).toBe(true);
  });

  it("REFUSES plain ws to a remote host", async () => {
    // Envelopes are encrypted, but an unencrypted transport still leaks who is
    // talking to whom and lets an active attacker drop frames invisibly.
    const { host, device } = await keys();
    const r = await completeKeyExchange(offer(host.publicKey, { relayUrl: "ws://a.example/ws" }), {
      devicePublicKey: device.publicKey,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("insecure_relay");
  });

  it("allows plain ws on loopback only", async () => {
    const { host, device } = await keys();
    for (const url of ["ws://localhost:8080/ws", "ws://127.0.0.1:8080/ws"]) {
      const r = await completeKeyExchange(offer(host.publicKey, { relayUrl: url }), {
        devicePublicKey: device.publicKey,
      });
      expect(r.ok, `${url} should be allowed`).toBe(true);
    }
  });

  it("refuses a malformed relay address and a missing room", async () => {
    const { host, device } = await keys();
    const bad = await completeKeyExchange(offer(host.publicKey, { relayUrl: "not a url" }), {
      devicePublicKey: device.publicKey,
    });
    expect(bad.ok).toBe(false);

    const noRoom = await completeKeyExchange(offer(host.publicKey, { roomId: "" }), {
      devicePublicKey: device.publicKey,
    });
    expect(noRoom.ok).toBe(false);
    if (!noRoom.ok) expect(noRoom.refusal).toBe("missing_room");
  });
});

describe("the short authentication string detects a man in the middle", () => {
  it("is identical on both devices regardless of who started pairing", async () => {
    // If the two sides disagreed with no attacker present, users would learn to
    // ignore a mismatch — destroying the only signal that matters.
    const { host, device } = await keys();
    const a = await deriveSas(host.publicKey, device.publicKey);
    const b = await deriveSas(device.publicKey, host.publicKey);
    expect(a).toBe(b);
  });

  it("DIFFERS when an attacker sits in the middle", async () => {
    const { host, device } = await keys();
    const attacker = await generateMobileChannelIdentity();

    // What each side would compute while talking to the attacker.
    const hostSide = await deriveSas(host.publicKey, attacker.publicKey);
    const deviceSide = await deriveSas(attacker.publicKey, device.publicKey);
    const honest = await deriveSas(host.publicKey, device.publicKey);

    expect(hostSide).not.toBe(deviceSide);
    expect(hostSide).not.toBe(honest);
  });

  it("is stable for the same pair of keys", async () => {
    const { host, device } = await keys();
    const a = await deriveSas(host.publicKey, device.publicKey);
    const b = await deriveSas(host.publicKey, device.publicKey);
    expect(a).toBe(b);
  });
});

describe("confirmation requires the user to actually compare", () => {
  const channel = { relayUrl: RELAY, roomId: ROOM, peerPublicKey: {} as JsonWebKey };

  it("confirms when the digits match", () => {
    const r = confirmSas("123456", "123456", channel);
    expect(r.confirmed).toBe(true);
  });

  it("tolerates spacing the user may type", () => {
    expect(confirmSas("123456", "123 456", channel).confirmed).toBe(true);
  });

  it("REFUSES a mismatch and says why it matters", () => {
    const r = confirmSas("123456", "654321", channel);
    expect(r.confirmed).toBe(false);
    if (!r.confirmed) {
      expect(r.reason).toMatch(/relaying the connection/);
      expect(r.reason).toMatch(/do not continue/i);
    }
  });

  it("refuses anything that is not six digits", () => {
    for (const bad of ["", "12345", "abcdef", "1234567"]) {
      expect(confirmSas("123456", bad, channel).confirmed, `${bad} accepted`).toBe(false);
    }
  });

  it("takes what the user SAW, not a boolean they agreed", () => {
    // A function accepting `matched: true` would let a caller skip the
    // comparison entirely, which is the only thing protecting the channel.
    const wrong = confirmSas("111111", "222222", channel);
    expect(wrong.confirmed).toBe(false);
  });
});

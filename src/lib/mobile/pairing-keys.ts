/**
 * Pairing key exchange and short authentication string (P13).
 *
 * `pairing.ts` exchanged a six-digit code and a nonce — enough to prove the two
 * devices are looking at the same screen, and nothing else. `PairedDevice`
 * carried no relay URL, no room and no peer key, so the encrypted transport
 * built in P21 could never be constructed and `UnavailableMobileTransport`
 * stayed permanently in place. This is the missing half.
 *
 * WHY A CODE IS NOT ENOUGH
 * -----------------------
 * The relay forwards sealed envelopes between two devices that have never met.
 * A relay that is compromised — or simply impersonated — can sit in the middle,
 * present its own key to each side, and read everything. The six-digit code
 * does not prevent this: both devices would happily complete pairing with the
 * attacker.
 *
 * The defence is a SHORT AUTHENTICATION STRING derived from BOTH public keys.
 * A man in the middle necessarily produces different key pairs on each side, so
 * the two devices compute DIFFERENT strings and the mismatch is visible to the
 * person holding them. It only works if the user actually compares it, which is
 * why `confirmSas` exists as a separate, explicit step rather than something
 * this module can decide for itself.
 */
import { fingerprintMobilePublicKey } from "./secure-channel";

export interface ChannelDescriptor {
  /** Relay to meet on. */
  relayUrl: string;
  /** Pairing room both devices join. */
  roomId: string;
  /** The other device's public key. */
  peerPublicKey: JsonWebKey;
}

export interface KeyExchangeOffer {
  /** Public key of the device that started pairing. */
  hostPublicKey: JsonWebKey;
  relayUrl: string;
  roomId: string;
}

export interface KeyExchangeAnswer {
  /** Public key of the device that scanned the code. */
  devicePublicKey: JsonWebKey;
}

export type KeyExchangeRefusal =
  | "missing_host_key"
  | "missing_device_key"
  | "same_key"
  | "insecure_relay"
  | "missing_room";

export type KeyExchangeResult =
  | { ok: true; channel: ChannelDescriptor; sas: string }
  | { ok: false; refusal: KeyExchangeRefusal; reason: string };

/**
 * Relay URLs that may carry sealed envelopes.
 *
 * Plain `ws://` is refused except on loopback. Envelopes are already encrypted,
 * but an unencrypted transport leaks who is talking to whom, when, and how
 * much — and it lets an active attacker drop or reorder frames invisibly.
 */
function relayIsAcceptable(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === "wss:") return true;
  if (parsed.protocol !== "ws:") return false;
  return parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
}

/** Number of SAS digits shown to the user. */
export const SAS_DIGITS = 6;

/**
 * Derive the short authentication string.
 *
 * Both fingerprints are SORTED before hashing so each device computes the same
 * value regardless of which one started pairing. Without that, the two sides
 * would disagree even with no attacker present, and users would learn to ignore
 * a mismatch — which is exactly the signal this exists to make meaningful.
 */
export async function deriveSas(a: JsonWebKey, b: JsonWebKey): Promise<string> {
  const [fa, fb] = await Promise.all([
    fingerprintMobilePublicKey(a),
    fingerprintMobilePublicKey(b),
  ]);
  const joined = [fa, fb].sort().join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(joined));
  const bytes = new Uint8Array(digest);
  let n = 0;
  for (let i = 0; i < 4; i += 1) n = (n << 8) | bytes[i];
  return String(Math.abs(n) % 10 ** SAS_DIGITS).padStart(SAS_DIGITS, "0");
}

/**
 * Complete the key exchange.
 *
 * Returns the channel the encrypted transport needs, plus the SAS the user must
 * confirm. It does NOT mark the device trusted — `confirmSas` does, and only
 * after a human has compared the two strings.
 */
export async function completeKeyExchange(
  offer: KeyExchangeOffer,
  answer: KeyExchangeAnswer,
): Promise<KeyExchangeResult> {
  if (!offer?.hostPublicKey) {
    return { ok: false, refusal: "missing_host_key", reason: "This device offered no public key." };
  }
  if (!answer?.devicePublicKey) {
    return {
      ok: false,
      refusal: "missing_device_key",
      reason: "The other device offered no public key.",
    };
  }
  if (!offer.roomId) {
    return { ok: false, refusal: "missing_room", reason: "No pairing room was supplied." };
  }
  if (!relayIsAcceptable(offer.relayUrl)) {
    return {
      ok: false,
      refusal: "insecure_relay",
      reason: `${offer.relayUrl || "The relay"} is not an encrypted address. Pairing needs wss://, or ws:// on this machine only.`,
    };
  }

  const [fh, fd] = await Promise.all([
    fingerprintMobilePublicKey(offer.hostPublicKey),
    fingerprintMobilePublicKey(answer.devicePublicKey),
  ]);
  if (fh === fd) {
    /*
     * Both sides presenting the same key means one device is talking to itself
     * — a reflection attack, where a relay bounces the offer back instead of
     * forwarding it. The SAS would match perfectly and prove nothing.
     */
    return {
      ok: false,
      refusal: "same_key",
      reason: "Both devices presented the same key, which means the pairing was reflected back.",
    };
  }

  return {
    ok: true,
    channel: {
      relayUrl: offer.relayUrl,
      roomId: offer.roomId,
      peerPublicKey: answer.devicePublicKey,
    },
    sas: await deriveSas(offer.hostPublicKey, answer.devicePublicKey),
  };
}

export type SasConfirmation =
  | { confirmed: true; channel: ChannelDescriptor }
  | { confirmed: false; reason: string };

/**
 * Record that the user compared the two strings and they matched.
 *
 * Takes what the USER says they saw on the other device, and compares it here.
 * A function that simply took a boolean "yes they matched" would let a caller
 * skip the comparison entirely.
 */
export function confirmSas(
  expected: string,
  seenOnOtherDevice: string,
  channel: ChannelDescriptor,
): SasConfirmation {
  const clean = seenOnOtherDevice.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) {
    return { confirmed: false, reason: "Enter the six digits shown on your other device." };
  }
  if (clean !== expected) {
    return {
      confirmed: false,
      reason:
        "Those numbers do not match. Something is relaying the connection between your devices — do not continue.",
    };
  }
  return { confirmed: true, channel };
}

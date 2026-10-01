/**
 * WEB PUSH, DONE WITH THE PLATFORM'S OWN CRYPTOGRAPHY AND NOTHING ELSE.
 *
 * A browser that turned on notifications gave OCADE a push service address and
 * two keys. A message for it is encrypted to those keys (RFC 8291, `aes128gcm`
 * content coding, RFC 8188) so the push service relays bytes it cannot read,
 * and signed for by OCADE's own key (VAPID, RFC 8292) so the push service knows
 * who is sending. WebCrypto does all of it, in the Worker and in Node alike.
 *
 * The private VAPID key is a server secret (`WEB_PUSH_PRIVATE_KEY`, the scalar
 * `d`, base64url); the public key is public (`VITE_WEB_PUSH_PUBLIC_KEY`, the
 * 65-byte uncompressed point, base64url) because every browser needs it to
 * subscribe.
 */

/** Bytes backed by a plain ArrayBuffer, which is what WebCrypto and fetch accept. */
type Bytes = Uint8Array<ArrayBuffer>;

export const b64url = {
  encode(bytes: Uint8Array): string {
    let text = "";
    for (const byte of bytes) text += String.fromCharCode(byte);
    return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(text: string): Bytes {
    const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  },
};

const utf8 = (text: string): Bytes => new TextEncoder().encode(text) as Bytes;

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

async function hkdf(salt: Bytes, ikm: Bytes, info: Bytes, bytes: number): Promise<Bytes> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8),
  );
}

/** A P-256 private key from its public point and scalar, for ECDH or ECDSA. */
function privateJwk(publicPoint: Uint8Array, d: string): JsonWebKey {
  return {
    kty: "EC",
    crv: "P-256",
    x: b64url.encode(publicPoint.slice(1, 33)),
    y: b64url.encode(publicPoint.slice(33, 65)),
    d,
    ext: true,
  };
}

export interface PushSubscriptionKeys {
  /** The browser's P-256 public key, uncompressed, base64url. */
  p256dh: string;
  /** The browser's 16-byte authentication secret, base64url. */
  auth: string;
}

/**
 * Encrypt one message for one browser (RFC 8291 §3, one record).
 *
 * `fixed` exists for the RFC's own test vector and nothing else: a real message
 * always gets a fresh salt and a fresh sender key, so no two are alike.
 */
export async function encryptForBrowser(
  payload: Bytes,
  keys: PushSubscriptionKeys,
  fixed?: { salt: Bytes; senderPublic: Bytes; senderPrivate: string },
): Promise<Bytes> {
  const browserPublic = b64url.decode(keys.p256dh);
  const authSecret = b64url.decode(keys.auth);
  if (browserPublic.length !== 65 || authSecret.length !== 16) {
    throw new Error("That push subscription's keys are not usable.");
  }
  const ecdh = { name: "ECDH", namedCurve: "P-256" } as const;
  let senderPrivate: CryptoKey;
  let senderPublic: Bytes;
  if (fixed) {
    senderPublic = fixed.senderPublic;
    senderPrivate = await crypto.subtle.importKey(
      "jwk",
      privateJwk(fixed.senderPublic, fixed.senderPrivate),
      ecdh,
      false,
      ["deriveBits"],
    );
  } else {
    const pair = (await crypto.subtle.generateKey(ecdh, true, ["deriveBits"])) as CryptoKeyPair;
    senderPrivate = pair.privateKey;
    senderPublic = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  }
  const browserKey = await crypto.subtle.importKey("raw", browserPublic, ecdh, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: browserKey }, senderPrivate, 256),
  );
  const ikm = await hkdf(
    authSecret,
    shared,
    concat(utf8("WebPush: info\0"), browserPublic, senderPublic),
    32,
  );
  const salt = fixed?.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, utf8("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  // One record, so the padding delimiter is 2 ("last record").
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      key,
      concat(payload, Uint8Array.of(2)),
    ),
  );
  const header = new Uint8Array(21);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = senderPublic.length;
  return concat(header, senderPublic, sealed);
}

/** The VAPID `Authorization` header for one push service (RFC 8292). */
export async function vapidAuthorization(input: {
  endpoint: string;
  publicKey: string;
  privateKey: string;
  subject: string;
  now?: number;
}): Promise<string> {
  const publicPoint = b64url.decode(input.publicKey);
  const key = await crypto.subtle.importKey(
    "jwk",
    privateJwk(publicPoint, input.privateKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const seconds = Math.floor((input.now ?? Date.now()) / 1000);
  const part = (value: object) => b64url.encode(utf8(JSON.stringify(value)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({
    aud: new URL(input.endpoint).origin,
    exp: seconds + 12 * 3600,
    sub: input.subject,
  })}`;
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(unsigned)),
  );
  return `vapid t=${unsigned}.${b64url.encode(signature)}, k=${input.publicKey}`;
}

/** What the service worker shows. Kept small: push services cap a message near 4 KB. */
export interface PushMessage {
  title: string;
  body: string;
  /** A same-origin path to open when the notification is pressed. */
  url: string;
  /** Replaces an earlier notification with the same tag instead of stacking. */
  tag: string;
}

/** "refused": a retry could pass (busy, rate-limited, unreachable). "rejected": it never will. */
export type PushOutcome = "sent" | "gone" | "refused" | "rejected";

/**
 * The browsers' own push services. A subscription is an address a browser
 * handed over, but it reaches OCADE through a request body, so OCADE posts
 * only to the services browsers actually use — never to an address somebody
 * typed in.
 */
const PUSH_SERVICES = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge on Android, Opera, Samsung
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari, iPhone and iPad home-screen apps
  /^[a-z0-9-]+\.notify\.windows\.com$/, // Edge on Windows
];

export function isPushService(endpoint: string, allowLoopback = false): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (allowLoopback && url.protocol === "http:" && url.hostname === "127.0.0.1") return true;
  return url.protocol === "https:" && PUSH_SERVICES.some((host) => host.test(url.hostname));
}

/** Send one message to one browser. "gone": the subscription no longer exists. */
export async function sendPush(input: {
  subscription: { endpoint: string } & PushSubscriptionKeys;
  message: PushMessage;
  publicKey: string;
  privateKey: string;
  subject: string;
  urgent: boolean;
  /** Local proofs only: a stand-in push service on this machine. */
  allowLoopback?: boolean;
  fetcher?: typeof fetch;
}): Promise<PushOutcome> {
  if (!isPushService(input.subscription.endpoint, input.allowLoopback)) return "gone";
  const endpoint = new URL(input.subscription.endpoint);
  const body = await encryptForBrowser(utf8(JSON.stringify(input.message)), input.subscription);
  const response = await (input.fetcher ?? fetch)(endpoint.toString(), {
    method: "POST",
    headers: {
      authorization: await vapidAuthorization({
        endpoint: endpoint.toString(),
        publicKey: input.publicKey,
        privateKey: input.privateKey,
        subject: input.subject,
      }),
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: String(24 * 3600),
      urgency: input.urgent ? "high" : "normal",
    },
    body,
    // A push service answers; it never sends OCADE somewhere else.
    redirect: "manual",
  }).catch(() => null);
  if (!response) return "refused";
  if (response.status === 404 || response.status === 410) return "gone";
  if (response.ok) return "sent";
  return response.status === 429 || response.status >= 500 ? "refused" : "rejected";
}

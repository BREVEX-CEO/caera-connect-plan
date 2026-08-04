/**
 * End-to-end encrypted mobile channel.
 *
 * Transport TLS is still required, but it is not the trust boundary: a relay,
 * push provider, proxy, or database must never see approval or handoff bodies.
 * Each paired endpoint owns an ephemeral-in-JS P-256 ECDH private key and pins
 * the peer public-key fingerprint established during the QR ceremony.
 *
 * Production native apps must persist the private key in Keychain/Keystore and
 * inject the CryptoKey-equivalent signer. This module never serialises private
 * key material or accepts a secret from web storage.
 */
import type { MobileIntent, MobileTransport, MobileTransportStatus } from "./companion-link";

const PROTOCOL_VERSION = 1;
const MAX_PLAINTEXT_BYTES = 256 * 1024;
const MAX_CIPHERTEXT_BYTES = MAX_PLAINTEXT_BYTES + 32;
const MAX_ENVELOPE_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const HKDF_INFO = new TextEncoder().encode("ocade-mobile-channel-v1");

export interface MobileChannelIdentity {
  privateKey: CryptoKey;
  publicKey: JsonWebKey;
  fingerprint: string;
}

export interface EncryptedMobileEnvelope {
  v: 1;
  deviceId: string;
  sequence: number;
  issuedAt: string;
  expiresAt: string;
  senderPublicKey: JsonWebKey;
  senderFingerprint: string;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface MobileEnvelopeLink {
  status(): Promise<MobileTransportStatus>;
  send(
    envelope: EncryptedMobileEnvelope,
    options?: { idempotencyKey: string },
  ): Promise<{ ok: boolean; detail: string }>;
  subscribe?(onMessage: (envelope: EncryptedMobileEnvelope) => void): () => void;
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error("WebCrypto is required for the encrypted mobile channel.");
  }
  return globalThis.crypto;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Malformed base64url value.");
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function canonicalPublicKey(key: JsonWebKey): string {
  if (
    key.kty !== "EC" ||
    key.crv !== "P-256" ||
    typeof key.x !== "string" ||
    typeof key.y !== "string"
  ) {
    throw new Error("The peer identity is not a valid P-256 public key.");
  }
  return JSON.stringify({ crv: key.crv, kty: key.kty, x: key.x, y: key.y });
}

export async function fingerprintMobilePublicKey(key: JsonWebKey): Promise<string> {
  const digest = await cryptoApi().subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalPublicKey(key)),
  );
  return base64Url(new Uint8Array(digest));
}

export async function generateMobileChannelIdentity(): Promise<MobileChannelIdentity> {
  const pair = (await cryptoApi().subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const publicKey = await cryptoApi().subtle.exportKey("jwk", pair.publicKey);
  return {
    privateKey: pair.privateKey,
    publicKey,
    fingerprint: await fingerprintMobilePublicKey(publicKey),
  };
}

async function deriveAesKey(
  privateKey: CryptoKey,
  peerPublicKey: JsonWebKey,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const peer = await cryptoApi().subtle.importKey(
    "jwk",
    peerPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const secret = await cryptoApi().subtle.deriveBits(
    { name: "ECDH", public: peer },
    privateKey,
    256,
  );
  const material = await cryptoApi().subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
  return cryptoApi().subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: arrayBuffer(salt),
      info: arrayBuffer(HKDF_INFO),
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function envelopeMetadata(
  envelope: Omit<EncryptedMobileEnvelope, "iv" | "ciphertext">,
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      v: envelope.v,
      deviceId: envelope.deviceId,
      sequence: envelope.sequence,
      issuedAt: envelope.issuedAt,
      expiresAt: envelope.expiresAt,
      senderFingerprint: envelope.senderFingerprint,
      senderPublicKey: JSON.parse(canonicalPublicKey(envelope.senderPublicKey)),
      salt: envelope.salt,
    }),
  );
}

export async function sealMobileMessage<T>(
  payload: T,
  input: {
    sender: MobileChannelIdentity;
    recipientPublicKey: JsonWebKey;
    deviceId: string;
    sequence: number;
    now?: Date;
    ttlMs?: number;
  },
): Promise<EncryptedMobileEnvelope> {
  if (!input.deviceId || input.deviceId.length > 128) {
    throw new Error("A bounded device id is required.");
  }
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) {
    throw new Error("The encrypted message sequence must be a positive safe integer.");
  }
  const ttlMs = input.ttlMs ?? 2 * 60 * 1000;
  if (!Number.isFinite(ttlMs) || ttlMs < 1 || ttlMs > MAX_ENVELOPE_TTL_MS) {
    throw new Error("The encrypted message expiry is outside the allowed window.");
  }
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) {
    throw new Error("The encrypted mobile message exceeds the 256 KiB limit.");
  }

  const now = input.now ?? new Date();
  const salt = cryptoApi().getRandomValues(new Uint8Array(32));
  const iv = cryptoApi().getRandomValues(new Uint8Array(12));
  const metadata = {
    v: PROTOCOL_VERSION,
    deviceId: input.deviceId,
    sequence: input.sequence,
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    senderPublicKey: input.sender.publicKey,
    senderFingerprint: input.sender.fingerprint,
    salt: base64Url(salt),
  } satisfies Omit<EncryptedMobileEnvelope, "iv" | "ciphertext">;
  const key = await deriveAesKey(input.sender.privateKey, input.recipientPublicKey, salt);
  const ciphertext = await cryptoApi().subtle.encrypt(
    {
      name: "AES-GCM",
      iv: arrayBuffer(iv),
      additionalData: arrayBuffer(envelopeMetadata(metadata)),
      tagLength: 128,
    },
    key,
    plaintext,
  );
  return {
    ...metadata,
    iv: base64Url(iv),
    ciphertext: base64Url(new Uint8Array(ciphertext)),
  };
}

export async function openMobileMessage<T>(
  envelope: EncryptedMobileEnvelope,
  input: {
    recipientPrivateKey: CryptoKey;
    expectedSenderFingerprint: string;
    lastSequence: number;
    now?: Date;
  },
): Promise<{ ok: true; value: T; sequence: number } | { ok: false; reason: string }> {
  try {
    if (!Number.isSafeInteger(input.lastSequence) || input.lastSequence < 0) {
      return { ok: false, reason: "The encrypted mobile replay state is invalid." };
    }
    const now = (input.now ?? new Date()).getTime();
    if (!Number.isFinite(now)) {
      return { ok: false, reason: "The encrypted mobile receiver clock is invalid." };
    }
    if (envelope.v !== PROTOCOL_VERSION) return { ok: false, reason: "Unsupported protocol." };
    if (!Number.isSafeInteger(envelope.sequence) || envelope.sequence <= input.lastSequence) {
      return { ok: false, reason: "This encrypted mobile message was replayed or reordered." };
    }
    const actualFingerprint = await fingerprintMobilePublicKey(envelope.senderPublicKey);
    if (
      envelope.senderFingerprint !== actualFingerprint ||
      envelope.senderFingerprint !== input.expectedSenderFingerprint
    ) {
      return { ok: false, reason: "The encrypted message came from an untrusted device key." };
    }
    const issuedAt = Date.parse(envelope.issuedAt);
    const expiresAt = Date.parse(envelope.expiresAt);
    if (
      !Number.isFinite(issuedAt) ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= issuedAt ||
      expiresAt - issuedAt > MAX_ENVELOPE_TTL_MS ||
      issuedAt > now + CLOCK_SKEW_MS ||
      expiresAt < now
    ) {
      return {
        ok: false,
        reason: "The encrypted mobile message is expired or has invalid time bounds.",
      };
    }
    const salt = fromBase64Url(envelope.salt);
    const iv = fromBase64Url(envelope.iv);
    const ciphertext = fromBase64Url(envelope.ciphertext);
    if (
      salt.byteLength !== 32 ||
      iv.byteLength !== 12 ||
      ciphertext.byteLength > MAX_CIPHERTEXT_BYTES
    ) {
      return { ok: false, reason: "The encrypted mobile envelope has invalid bounds." };
    }
    const key = await deriveAesKey(input.recipientPrivateKey, envelope.senderPublicKey, salt);
    const plaintext = await cryptoApi().subtle.decrypt(
      {
        name: "AES-GCM",
        iv: arrayBuffer(iv),
        additionalData: arrayBuffer(envelopeMetadata(envelope)),
        tagLength: 128,
      },
      key,
      arrayBuffer(ciphertext),
    );
    return {
      ok: true,
      value: JSON.parse(new TextDecoder().decode(plaintext)) as T,
      sequence: envelope.sequence,
    };
  } catch {
    return { ok: false, reason: "The encrypted mobile message failed authentication." };
  }
}

/**
 * Concrete `MobileTransport` wrapper. Relays receive only encrypted envelopes;
 * sequence numbers increase before every send so retry idempotency is supplied
 * by the existing queue key, never by reusing an AES-GCM nonce.
 */
export class EncryptedMobileTransport implements MobileTransport {
  private sequence = 0;

  /**
   * Replay watermark for the RECEIVE path: the highest sequence already
   * accepted. `openMobileMessage` rejects `sequence <= lastSequence`, so this
   * must advance on every accepted message — otherwise a captured envelope can
   * be re-delivered forever and each copy passes the check.
   */
  private receivedSequence = 0;

  /** Pinned peer fingerprint, derived once from the trusted key. */
  private peerFingerprint: Promise<string> | null = null;

  /**
   * Serialises envelope processing. Two envelopes arriving concurrently would
   * otherwise both read the same watermark before either advanced it, and a
   * duplicate would be accepted twice — the reconnect race in §8.7.
   */
  private intake: Promise<void> = Promise.resolve();

  constructor(
    private readonly deviceId: string,
    private readonly identity: MobileChannelIdentity,
    private readonly peerPublicKey: JsonWebKey,
    private readonly link: MobileEnvelopeLink,
    private readonly now: () => Date = () => new Date(),
  ) {}

  status(): Promise<MobileTransportStatus> {
    return this.link.status();
  }

  async send(
    intent: MobileIntent,
    options?: { idempotencyKey: string },
  ): Promise<{ ok: boolean; detail: string }> {
    const envelope = await sealMobileMessage(intent, {
      sender: this.identity,
      recipientPublicKey: this.peerPublicKey,
      deviceId: this.deviceId,
      sequence: ++this.sequence,
      now: this.now(),
    });
    return this.link.send(envelope, options);
  }

  private pinnedPeerFingerprint(): Promise<string> {
    this.peerFingerprint ??= fingerprintMobilePublicKey(this.peerPublicKey);
    return this.peerFingerprint;
  }

  subscribe(onMessage: (payload: any) => void): () => void {
    if (!this.link.subscribe) return () => {};
    return this.link.subscribe((envelope) => {
      // Process strictly one at a time so the replay watermark below cannot be
      // read by two concurrent arrivals before either has advanced it.
      this.intake = this.intake
        .then(async () => {
          const opened = await openMobileMessage<any>(envelope, {
            recipientPrivateKey: this.identity.privateKey,
            expectedSenderFingerprint: await this.pinnedPeerFingerprint(),
            lastSequence: this.receivedSequence,
            now: this.now(),
          });
          if (!opened.ok) return; // replayed, reordered, expired or untrusted
          // Advance BEFORE delivering: a handler that throws must not leave the
          // watermark behind, or the same message could be accepted again.
          this.receivedSequence = opened.sequence;
          onMessage(opened.value);
        })
        // One bad or throwing envelope must not tear down the subscription.
        .catch(() => {});
      return this.intake;
    });
  }
}

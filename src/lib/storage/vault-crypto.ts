/**
 * Vault cryptography — AES-GCM for record encryption, PBKDF2-SHA256 for
 * passphrase derivation, WebAuthn PRF extension for hardware-backed
 * wrapping. Unwrapped Data Encryption Keys (DEKs) never leave memory.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Copy a Uint8Array into a fresh ArrayBuffer so it satisfies SubtleCrypto's
 *  strict BufferSource<ArrayBuffer> parameter (TS lib.dom no longer accepts
 *  Uint8Array<ArrayBufferLike> after 5.6). */
function ab(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

export function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
export function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

export async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function exportRawKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.exportKey("raw", key));
}
export async function importRawKey(
  raw: Uint8Array,
  usages: KeyUsage[] = ["encrypt", "decrypt"],
): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", ab(raw), { name: "AES-GCM" }, false, usages);
}

/** PBKDF2-SHA256 passphrase → 256-bit AES-GCM key. Iteration count is
 *  stored per-user so we can raise it during rotation. */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations = 600_000,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    ab(enc.encode(passphrase)),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ab(salt), iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"],
  );
}

export async function aesGcmEncrypt(
  key: CryptoKey,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = randomBytes(12);
  const alg: AesGcmParams = { name: "AES-GCM", iv: ab(iv) };
  if (aad) alg.additionalData = ab(aad);
  const ct = await crypto.subtle.encrypt(alg, key, ab(plaintext));
  return { iv, ciphertext: new Uint8Array(ct) };
}
export async function aesGcmDecrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array,
): Promise<Uint8Array> {
  const alg: AesGcmParams = { name: "AES-GCM", iv: ab(iv) };
  if (aad) alg.additionalData = ab(aad);
  const pt = await crypto.subtle.decrypt(alg, key, ab(ciphertext));
  return new Uint8Array(pt);
}

export const jsonToBytes = (v: unknown) => enc.encode(JSON.stringify(v));
export const bytesToJson = <T>(b: Uint8Array): T => JSON.parse(dec.decode(b)) as T;

// ---------- WebAuthn PRF ----------

export function webauthnPrfSupported(): boolean {
  return (
    typeof PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials
  );
}

export async function createPrfCredential(userId: string, userLabel: string, prfSalt: Uint8Array) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: ab(randomBytes(32)),
      rp: { name: "CAERA CADANE" },
      user: { id: ab(enc.encode(userId)), name: userLabel, displayName: userLabel },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      timeout: 60_000,
      extensions: { prf: { eval: { first: ab(prfSalt) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("WebAuthn credential creation failed.");
  const ext = cred.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } };
  const first = ext.prf?.results?.first;
  if (!first) throw new Error("This authenticator does not support the PRF extension.");
  return { credentialId: new Uint8Array(cred.rawId), prfOutput: new Uint8Array(first) };
}

export async function evaluatePrf(
  credentialId: Uint8Array,
  prfSalt: Uint8Array,
): Promise<Uint8Array> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: ab(randomBytes(32)),
      allowCredentials: [{ id: ab(credentialId), type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: ab(prfSalt) } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("WebAuthn assertion failed.");
  const ext = assertion.getClientExtensionResults() as {
    prf?: { results?: { first?: ArrayBuffer } };
  };
  const first = ext.prf?.results?.first;
  if (!first) throw new Error("Authenticator did not return PRF output.");
  return new Uint8Array(first);
}

export async function keyFromMaterial(material: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey("raw", ab(material), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", salt: ab(salt), hash: "SHA-256", info: ab(enc.encode("caera-vault-kek")) },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function generateRecoveryKey(): Uint8Array {
  return randomBytes(32);
}

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const RECOVERY_KEY_BYTES = 32;
const RECOVERY_CODE_CHARS = 52;

export function formatRecoveryKit(raw: Uint8Array): string {
  if (raw.byteLength !== RECOVERY_KEY_BYTES) {
    throw new Error("A recovery kit requires exactly 256 bits of key material.");
  }
  let encoded = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of raw) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      encoded += RECOVERY_ALPHABET[(buffer >>> bits) & 31];
      buffer &= (1 << bits) - 1;
    }
  }
  if (bits > 0) encoded += RECOVERY_ALPHABET[(buffer << (5 - bits)) & 31];
  return encoded.match(/.{1,4}/g)?.join("-") ?? encoded;
}

export function parseRecoveryKit(text: string): Uint8Array | null {
  if (typeof text !== "string" || !/^[A-Za-z0-9\s-]+$/.test(text)) return null;
  const cleaned = text.replace(/[\s-]/g, "").toUpperCase();
  if (cleaned.length !== RECOVERY_CODE_CHARS) return null;

  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of cleaned) {
    const value = RECOVERY_ALPHABET.indexOf(character);
    if (value < 0) return null;
    buffer = (buffer << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >>> bits) & 0xff);
      buffer &= (1 << bits) - 1;
    }
  }
  // 256 bits occupy 52 Base32 symbols; the final four padding bits must be 0.
  if (bytes.length !== RECOVERY_KEY_BYTES || buffer !== 0) return null;
  return Uint8Array.from(bytes);
}
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", ab(data)));
}

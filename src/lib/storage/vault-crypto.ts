/**
 * Vault cryptography — AES-GCM for record encryption, PBKDF2-SHA256 for
 * passphrase derivation, WebAuthn PRF extension for hardware-backed
 * wrapping. Unwrapped Data Encryption Keys (DEKs) never leave memory.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

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
export async function importRawKey(raw: Uint8Array, usages: KeyUsage[] = ["encrypt", "decrypt"]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, usages);
}

/** PBKDF2-SHA256 passphrase → 256-bit AES-GCM key. Memory-hard alternative
 *  (Argon2) requires a wasm dep; PBKDF2 at 600k iterations is FIPS-approved
 *  and the OWASP 2023 minimum. Iteration count is stored per-user so we can
 *  raise it during rotation. */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations = 600_000,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
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
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource | undefined },
    key,
    plaintext as BufferSource,
  );
  return { iv, ciphertext: new Uint8Array(ct) };
}
export async function aesGcmDecrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array,
): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv as BufferSource, additionalData: aad as BufferSource | undefined },
    key,
    ciphertext as BufferSource,
  );
  return new Uint8Array(pt);
}

export const jsonToBytes = (v: unknown) => enc.encode(JSON.stringify(v));
export const bytesToJson = <T>(b: Uint8Array): T => JSON.parse(dec.decode(b)) as T;

// ---------- WebAuthn PRF ----------

export function webauthnPrfSupported(): boolean {
  return typeof PublicKeyCredential !== "undefined" && typeof navigator !== "undefined" && !!navigator.credentials;
}

/** Create a resident credential with the PRF extension. Returns the raw
 *  credential id and the PRF output that we treat as key material. */
export async function createPrfCredential(userId: string, userLabel: string, prfSalt: Uint8Array) {
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: "CAERA CADANE" },
      user: { id: enc.encode(userId), name: userLabel, displayName: userLabel },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
      timeout: 60_000,
      extensions: { prf: { eval: { first: prfSalt as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("WebAuthn credential creation failed.");
  const ext = cred.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } };
  const first = ext.prf?.results?.first;
  if (!first) throw new Error("This authenticator does not support the PRF extension.");
  return { credentialId: new Uint8Array(cred.rawId), prfOutput: new Uint8Array(first) };
}

export async function evaluatePrf(credentialId: Uint8Array, prfSalt: Uint8Array): Promise<Uint8Array> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ id: credentialId as BufferSource, type: "public-key" }],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: prfSalt as BufferSource } } } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!assertion) throw new Error("WebAuthn assertion failed.");
  const ext = assertion.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } };
  const first = ext.prf?.results?.first;
  if (!first) throw new Error("Authenticator did not return PRF output.");
  return new Uint8Array(first);
}

/** Turn raw key material (PRF output or a recovery key) into an AES key. */
export async function keyFromMaterial(material: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey("raw", material as BufferSource, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "HKDF", salt: salt as BufferSource, hash: "SHA-256", info: enc.encode("caera-vault-kek") },
    km,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export function generateRecoveryKey(): Uint8Array {
  return randomBytes(32);
}
/** Groups of 5 chars, 12 groups → 60 chars base32-ish. */
export function formatRecoveryKit(raw: Uint8Array): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (const b of raw) s += alphabet[b % alphabet.length];
  return s.match(/.{1,5}/g)?.join("-") ?? s;
}
export function parseRecoveryKit(text: string): Uint8Array | null {
  const cleaned = text.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (cleaned.length !== 32) return null;
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    const idx = alphabet.indexOf(cleaned[i]);
    if (idx < 0) return null;
    out[i] = idx;
  }
  return out;
}
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data as BufferSource));
}

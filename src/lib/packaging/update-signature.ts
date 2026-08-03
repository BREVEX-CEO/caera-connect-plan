/**
 * Update signature verification (spec §19.9 packaging; §2.1 evidence).
 *
 * `update-plan.ts` refuses an update whose `signature` field is missing or
 * blank. That is a provenance check, not a verification: ANY non-empty string
 * satisfied it. An attacker who could serve a manifest could therefore put the
 * word "signed" in that field and pass.
 *
 * This module does the actual cryptography. Ed25519 over the artifact's SHA-256
 * digest, using WebCrypto — the same primitive the Tauri updater uses, so a
 * signature produced for the native updater verifies here too.
 *
 * WHY THIS CAN BE PROVEN WITHOUT A CODE-SIGNING CERTIFICATE
 *
 * A release certificate identifies the PUBLISHER. It is a separate concern from
 * whether the signing and verification pipeline works at all, which is provable
 * today with a generated key pair. Doing that now means the day a real key
 * exists, the only new variable is the key itself.
 *
 * FAILS CLOSED, ALWAYS:
 *  - a malformed key, malformed signature, or wrong-length input is a refusal,
 *    never a pass;
 *  - a signature made with a different key is a refusal;
 *  - a digest that does not match the artifact is a refusal, so a valid
 *    signature over DIFFERENT bytes cannot be replayed onto this download;
 *  - any thrown error inside WebCrypto is a refusal, never an exception that a
 *    caller might catch and treat as success.
 */

export interface SignatureCheckInput {
  /** Raw Ed25519 public key, 32 bytes, base64. Ships with the application. */
  readonly publicKeyBase64: string;
  /** Detached Ed25519 signature, 64 bytes, base64. */
  readonly signatureBase64: string;
  /** Lower-case hex SHA-256 of the downloaded artifact, computed by the host. */
  readonly artifactSha256: string;
}

export type SignatureVerdict =
  | { readonly ok: true; readonly evidence: string }
  | { readonly ok: false; readonly reason: string };

const HEX64 = /^[0-9a-f]{64}$/;
const ED25519_PUBLIC_KEY_BYTES = 32;
const ED25519_SIGNATURE_BYTES = 64;

function fromBase64(value: string): Uint8Array | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    const binary = atob(value.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Verify a detached Ed25519 signature over an artifact digest.
 *
 * The signed message is the digest, not the artifact, so a caller never has to
 * hold a whole installer in memory to check it. The digest MUST be the one
 * computed from the bytes actually on disk — signing a digest supplied by the
 * same party as the signature would prove nothing.
 */
export async function verifyUpdateSignature(input: SignatureCheckInput): Promise<SignatureVerdict> {
  const digest = input.artifactSha256?.trim().toLowerCase();
  if (!digest || !HEX64.test(digest)) {
    return { ok: false, reason: "The artifact digest is not a valid SHA-256 hex string." };
  }

  const publicKeyBytes = fromBase64(input.publicKeyBase64);
  if (!publicKeyBytes || publicKeyBytes.byteLength !== ED25519_PUBLIC_KEY_BYTES) {
    return {
      ok: false,
      reason: `The signing public key is not a ${ED25519_PUBLIC_KEY_BYTES}-byte Ed25519 key. Refusing to verify against an unusable key.`,
    };
  }

  const signatureBytes = fromBase64(input.signatureBase64);
  if (!signatureBytes || signatureBytes.byteLength !== ED25519_SIGNATURE_BYTES) {
    return {
      ok: false,
      reason: `The signature is not a ${ED25519_SIGNATURE_BYTES}-byte Ed25519 signature.`,
    };
  }

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      publicKeyBytes as unknown as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const message = new TextEncoder().encode(digest);
    const valid = await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      signatureBytes as unknown as BufferSource,
      message as unknown as BufferSource,
    );
    if (!valid) {
      return {
        ok: false,
        reason:
          "The signature does not match this artifact under the shipped public key. The download was modified, or it was signed by someone else.",
      };
    }
    return {
      ok: true,
      evidence: `Ed25519 signature verified over SHA-256 ${digest.slice(0, 12)}… using the shipped public key.`,
    };
  } catch (error) {
    // A verification that throws is a verification that did not succeed.
    return {
      ok: false,
      reason: `Signature verification could not complete: ${error instanceof Error ? error.message : "unknown error"}.`,
    };
  }
}

/**
 * The message that gets signed, exposed so a release pipeline signs EXACTLY
 * what verification will check. A signer and a verifier that disagree about the
 * message produce signatures that never validate — or, worse, validate the
 * wrong thing.
 */
export function signingMessageFor(artifactSha256: string): Uint8Array {
  return new TextEncoder().encode(artifactSha256.trim().toLowerCase());
}

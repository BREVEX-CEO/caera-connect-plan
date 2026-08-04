/**
 * Signed update-manifest trust policy (P26).
 *
 * The artifact verifier proves that a signature covers a SHA-256 digest. It
 * does not, by itself, bind the version, URL, upgrade floor, key identity or
 * signing time that caused the host to fetch those bytes. This module signs a
 * canonical representation of that metadata and evaluates it through an
 * explicit, rotatable, revocable keyring.
 */
import type { UpdateManifest } from "./update-plan";
import { signingMessageFor, verifyUpdateSignature } from "./update-signature";

const HEX64 = /^[0-9a-f]{64}$/;
const KEY_ID = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const MAX_TEXT = 4_096;
const DEFAULT_CLOCK_SKEW_MS = 5 * 60 * 1_000;

export interface TrustedUpdateKey {
  readonly id: string;
  readonly publicKeyBase64: string;
  /** Monotonically increasing generation. A policy floor retires older keys. */
  readonly epoch: number;
  readonly validFrom: number;
  readonly validUntil?: number | null;
  /** Once reached, revocation overrides a cryptographically valid signature. */
  readonly revokedAt?: number | null;
}

export interface UpdateTrustPolicy {
  readonly keys: readonly TrustedUpdateKey[];
  readonly minimumKeyEpoch: number;
  readonly evaluationTime: number;
  readonly allowedClockSkewMs?: number;
  readonly maximumSignatureAgeMs?: number | null;
}

export type UpdateTrustVerdict =
  | {
      readonly ok: true;
      readonly keyId: string;
      readonly keyEpoch: number;
      readonly manifestSha256: string;
      readonly evidence: string;
    }
  | { readonly ok: false; readonly reason: string };

type CanonicalManifest = {
  readonly schemaVersion: 1;
  readonly signingKeyId: string;
  readonly signedAt: number;
  readonly version: string;
  readonly sha256: string;
  readonly url: string | null;
  readonly minimumClientVersion: string | null;
  readonly notes: string | null;
};

function boundedText(value: unknown, allowEmpty = false): value is string {
  return (
    typeof value === "string" && value.length <= MAX_TEXT && (allowEmpty || value.trim().length > 0)
  );
}

function canonicalManifest(manifest: UpdateManifest): CanonicalManifest | null {
  const keyId = manifest.signingKeyId?.trim();
  const digest = manifest.sha256?.trim().toLowerCase();
  if (!keyId || !KEY_ID.test(keyId)) return null;
  if (!Number.isSafeInteger(manifest.signedAt) || (manifest.signedAt as number) <= 0) return null;
  if (!boundedText(manifest.version) || !digest || !HEX64.test(digest)) return null;
  if (manifest.url !== undefined && !boundedText(manifest.url)) return null;
  if (manifest.minimumClientVersion !== undefined && !boundedText(manifest.minimumClientVersion)) {
    return null;
  }
  if (manifest.notes !== undefined && !boundedText(manifest.notes, true)) return null;

  if (manifest.url !== undefined) {
    try {
      const url = new URL(manifest.url);
      if (
        url.protocol !== "https:" ||
        url.username.length > 0 ||
        url.password.length > 0 ||
        url.hash.length > 0
      ) {
        return null;
      }
    } catch {
      return null;
    }
  }

  return {
    schemaVersion: 1,
    signingKeyId: keyId,
    signedAt: manifest.signedAt as number,
    version: manifest.version,
    sha256: digest,
    url: manifest.url ?? null,
    minimumClientVersion: manifest.minimumClientVersion ?? null,
    notes: manifest.notes ?? null,
  };
}

/**
 * Stable bytes for the release signer. Object property order is fixed here;
 * callers do not sign arbitrary JSON serialization.
 */
export function manifestSigningMessageFor(manifest: UpdateManifest): Uint8Array | null {
  const canonical = canonicalManifest(manifest);
  return canonical === null ? null : new TextEncoder().encode(JSON.stringify(canonical));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function selectTrustedKey(
  manifest: UpdateManifest,
  policy: UpdateTrustPolicy,
): TrustedUpdateKey | UpdateTrustVerdict {
  const keyId = manifest.signingKeyId?.trim();
  if (!keyId || !KEY_ID.test(keyId)) {
    return { ok: false, reason: "The signed manifest has no valid signing-key identity." };
  }
  if (!Number.isSafeInteger(policy.minimumKeyEpoch) || policy.minimumKeyEpoch < 0) {
    return { ok: false, reason: "The update trust policy has an invalid key-epoch floor." };
  }
  if (!Number.isSafeInteger(policy.evaluationTime) || policy.evaluationTime <= 0) {
    return { ok: false, reason: "The update trust policy has no valid evaluation time." };
  }

  const matches = policy.keys.filter((key) => key.id === keyId);
  if (matches.length !== 1) {
    return {
      ok: false,
      reason:
        matches.length === 0
          ? `Signing key "${keyId}" is not trusted by this build.`
          : `Signing key "${keyId}" is duplicated in the trust policy.`,
    };
  }

  const key = matches[0];
  if (
    !KEY_ID.test(key.id) ||
    !Number.isSafeInteger(key.epoch) ||
    key.epoch < 0 ||
    !Number.isSafeInteger(key.validFrom) ||
    key.validFrom <= 0
  ) {
    return { ok: false, reason: `Signing key "${keyId}" has invalid trust metadata.` };
  }
  if (key.publicKeyBase64.includes("REPLACE_WITH")) {
    return {
      ok: false,
      reason: "No legitimate update signing key is configured. Production updates remain disabled.",
    };
  }
  if (key.epoch < policy.minimumKeyEpoch) {
    return {
      ok: false,
      reason: `Signing key "${keyId}" is from retired epoch ${key.epoch}; epoch ${policy.minimumKeyEpoch} or newer is required.`,
    };
  }
  if (key.revokedAt != null && key.revokedAt <= policy.evaluationTime) {
    return { ok: false, reason: `Signing key "${keyId}" is revoked.` };
  }
  return key;
}

/** Verify canonical metadata, rotation, revocation, validity and signature. */
export async function verifyUpdateTrust(
  manifest: UpdateManifest,
  policy: UpdateTrustPolicy,
): Promise<UpdateTrustVerdict> {
  const canonical = canonicalManifest(manifest);
  if (canonical === null) {
    return { ok: false, reason: "The signed update manifest is malformed or non-canonical." };
  }
  const selected = selectTrustedKey(manifest, policy);
  if ("ok" in selected) return selected;

  const skew = policy.allowedClockSkewMs ?? DEFAULT_CLOCK_SKEW_MS;
  if (!Number.isSafeInteger(skew) || skew < 0) {
    return { ok: false, reason: "The update trust policy has an invalid clock-skew allowance." };
  }
  if (canonical.signedAt > policy.evaluationTime + skew) {
    return { ok: false, reason: "The update manifest is signed in the future." };
  }
  if (canonical.signedAt < selected.validFrom) {
    return { ok: false, reason: `The update predates signing key "${selected.id}".` };
  }
  if (selected.validUntil != null) {
    if (!Number.isSafeInteger(selected.validUntil) || selected.validUntil <= selected.validFrom) {
      return { ok: false, reason: `Signing key "${selected.id}" has an invalid expiry.` };
    }
    if (
      canonical.signedAt > selected.validUntil ||
      policy.evaluationTime > selected.validUntil + skew
    ) {
      return { ok: false, reason: `Signing key "${selected.id}" is expired.` };
    }
  }
  const maximumAge = policy.maximumSignatureAgeMs;
  if (maximumAge != null) {
    if (!Number.isSafeInteger(maximumAge) || maximumAge <= 0) {
      return { ok: false, reason: "The update trust policy has an invalid signature age." };
    }
    if (policy.evaluationTime - canonical.signedAt > maximumAge) {
      return { ok: false, reason: "The update manifest signature is stale." };
    }
  }

  const message = manifestSigningMessageFor(manifest);
  if (message === null) {
    return { ok: false, reason: "The signed update manifest cannot be canonicalised." };
  }
  const manifestSha256 = await sha256Hex(message);
  const signature = manifest.signature?.trim();
  if (!signature) return { ok: false, reason: "The update manifest is unsigned." };

  const signatureVerdict = await verifyUpdateSignature({
    publicKeyBase64: selected.publicKeyBase64,
    signatureBase64: signature,
    artifactSha256: manifestSha256,
  });
  if (!signatureVerdict.ok) {
    return { ok: false, reason: `Manifest signature rejected: ${signatureVerdict.reason}` };
  }

  return {
    ok: true,
    keyId: selected.id,
    keyEpoch: selected.epoch,
    manifestSha256,
    evidence: `Canonical update manifest verified with key ${selected.id} at epoch ${selected.epoch}; ${signatureVerdict.evidence}`,
  };
}

/**
 * Signers sign the SHA-256 hex of these canonical bytes, using the existing
 * `signingMessageFor` contract.
 */
export async function manifestSigningDigestFor(
  manifest: UpdateManifest,
): Promise<Uint8Array | null> {
  const message = manifestSigningMessageFor(manifest);
  if (message === null) return null;
  return signingMessageFor(await sha256Hex(message));
}

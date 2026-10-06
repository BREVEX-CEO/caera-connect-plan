import {
  OFFLINE_LEASE_ALGORITHM,
  offlineEventSigningBytes,
  offlineClosureSigningBytes,
  offlineLeaseSigningBytes,
  ownedArrayBuffer,
  sha256Base64,
  type OfflineLeaseVerificationKey,
  type OfflineUsageLeasePayload,
  type SignedOfflineUsageEvent,
  type SignedOfflineUsageLease,
} from "./offline-lease";

function decodeBase64(value: string): Uint8Array {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new Error("The offline-usage signing key is not valid base64.");
  }
}

function encodeBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function importOfflineLeasePrivateKey(pkcs8Base64: string): Promise<CryptoKey> {
  const bytes = decodeBase64(pkcs8Base64);
  return crypto.subtle.importKey(
    "pkcs8",
    ownedArrayBuffer(bytes),
    { name: OFFLINE_LEASE_ALGORITHM },
    false,
    ["sign"],
  );
}

export async function signOfflineUsageLease(
  payload: OfflineUsageLeasePayload,
  privateKey: CryptoKey,
): Promise<SignedOfflineUsageLease> {
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: OFFLINE_LEASE_ALGORITHM },
      privateKey,
      ownedArrayBuffer(offlineLeaseSigningBytes(payload)),
    ),
  );
  return { payload, signature: encodeBase64(signature) };
}

export interface OfflineLeaseSigningAuthority {
  key: OfflineLeaseVerificationKey;
  verificationKeys: OfflineLeaseVerificationKey[];
  privateKey: CryptoKey;
}

/**
 * Production signing material is mandatory and server-only. There is no
 * generated fallback key: a deployment without an explicit authority refuses
 * lease issuance instead of handing out unverifiable offline capacity.
 */
export async function loadOfflineLeaseSigningAuthority(
  environment: Record<string, string | undefined> = process.env,
): Promise<OfflineLeaseSigningAuthority> {
  const keyId = environment.OCADE_LEASE_SIGNING_KEY_ID?.trim();
  const privateKey = environment.OCADE_LEASE_SIGNING_PRIVATE_KEY?.trim();
  const publicKey = environment.OCADE_LEASE_SIGNING_PUBLIC_KEY?.trim();
  const notBefore = environment.OCADE_LEASE_SIGNING_NOT_BEFORE?.trim();
  const expiresAt = environment.OCADE_LEASE_SIGNING_EXPIRES_AT?.trim();
  if (
    !keyId ||
    !privateKey ||
    !publicKey ||
    !notBefore ||
    !Number.isFinite(Date.parse(notBefore))
  ) {
    throw new Error(
      "Offline usage is unavailable because the lease-signing authority is not configured.",
    );
  }
  if (expiresAt && !Number.isFinite(Date.parse(expiresAt))) {
    throw new Error("The offline-usage signing-key expiry is not a valid timestamp.");
  }
  let previous: OfflineLeaseVerificationKey[] = [];
  const previousJson = environment.OCADE_LEASE_PREVIOUS_VERIFICATION_KEYS?.trim();
  if (previousJson) {
    try {
      const parsed = JSON.parse(previousJson) as OfflineLeaseVerificationKey[];
      if (!Array.isArray(parsed)) throw new Error("not an array");
      previous = parsed.filter(
        (candidate) =>
          candidate &&
          typeof candidate.keyId === "string" &&
          typeof candidate.publicKeyBase64 === "string" &&
          Number.isFinite(Date.parse(candidate.notBefore)) &&
          (!candidate.expiresAt || Number.isFinite(Date.parse(candidate.expiresAt))),
      );
      if (previous.length !== parsed.length) throw new Error("contains an invalid key");
    } catch {
      throw new Error("The previous offline-usage verification-key set is not valid JSON.");
    }
  }
  const key = {
    keyId,
    publicKeyBase64: publicKey,
    notBefore: new Date(notBefore).toISOString(),
    expiresAt: expiresAt || undefined,
  } satisfies OfflineLeaseVerificationKey;
  const importedPrivateKey = await importOfflineLeasePrivateKey(privateKey);
  const importedPublicKey = await importDeviceEventPublicKey(publicKey);
  const probe = new TextEncoder().encode(`ocade-offline-lease-key:${keyId}`);
  const probeSignature = await crypto.subtle.sign(
    { name: OFFLINE_LEASE_ALGORITHM },
    importedPrivateKey,
    ownedArrayBuffer(probe),
  );
  if (
    !(await crypto.subtle.verify(
      { name: OFFLINE_LEASE_ALGORITHM },
      importedPublicKey,
      probeSignature,
      ownedArrayBuffer(probe),
    ))
  ) {
    throw new Error("The offline-usage signing key does not match its public verification key.");
  }
  return {
    key,
    verificationKeys: [key, ...previous.filter((candidate) => candidate.keyId !== keyId)],
    privateKey: importedPrivateKey,
  };
}

export async function importDeviceEventPublicKey(rawBase64: string): Promise<CryptoKey> {
  const bytes = decodeBase64(rawBase64);
  if (bytes.byteLength !== 32)
    throw new Error("The device event key is not an Ed25519 public key.");
  return crypto.subtle.importKey(
    "raw",
    ownedArrayBuffer(bytes),
    { name: OFFLINE_LEASE_ALGORITHM },
    false,
    ["verify"],
  );
}

/** Did the device holding this public key sign its own closure? */
export async function verifyOfflineClosure(input: {
  publicKeyBase64: string;
  accountId: string;
  deviceId: string;
  signature: string;
}): Promise<boolean> {
  try {
    return await crypto.subtle.verify(
      { name: OFFLINE_LEASE_ALGORITHM },
      await importDeviceEventPublicKey(input.publicKeyBase64),
      ownedArrayBuffer(decodeBase64(input.signature)),
      ownedArrayBuffer(offlineClosureSigningBytes(input.accountId, input.deviceId)),
    );
  } catch {
    return false;
  }
}

export async function verifyOfflineEventChain(input: {
  events: readonly SignedOfflineUsageEvent[];
  publicKey: CryptoKey;
  lease: OfflineUsageLeasePayload;
  afterSequence: number;
  previousHash: string;
}): Promise<{ consumedHundredths: number; lastSequence: number; lastHash: string }> {
  let sequence = input.afterSequence;
  let previousHash = input.previousHash;
  let consumed = 0;
  const reservations = new Map<string, number>();
  const settlements = new Set<string>();

  for (const event of input.events) {
    const payload = event.payload;
    if (
      payload.leaseId !== input.lease.leaseId ||
      payload.accountId !== input.lease.accountId ||
      payload.deviceId !== input.lease.deviceId ||
      payload.sequence !== sequence + 1 ||
      payload.sequence < input.lease.sequenceStart ||
      payload.sequence > input.lease.sequenceEnd ||
      payload.previousHash !== previousHash ||
      !Number.isSafeInteger(payload.costHundredths) ||
      payload.costHundredths < 0
    ) {
      throw new Error(
        "The offline event chain is not continuous or does not belong to this lease.",
      );
    }
    const bytes = offlineEventSigningBytes(payload);
    const expectedHash = await sha256Base64(bytes);
    if (event.eventHash !== expectedHash) throw new Error("The offline event hash is invalid.");
    const signature = decodeBase64(event.deviceSignature);
    const signatureValid = await crypto.subtle.verify(
      { name: OFFLINE_LEASE_ALGORITHM },
      input.publicKey,
      ownedArrayBuffer(signature),
      ownedArrayBuffer(bytes),
    );
    if (!signatureValid) throw new Error("The offline event signature is invalid.");

    if (payload.status === "reserved") {
      if (reservations.has(payload.idempotencyKey) || settlements.has(payload.idempotencyKey)) {
        throw new Error("The offline event chain contains a duplicate reservation.");
      }
      reservations.set(payload.idempotencyKey, payload.costHundredths);
    } else {
      const held = reservations.get(payload.idempotencyKey);
      if (held === undefined) throw new Error("An offline settlement has no reservation.");
      if (payload.costHundredths > held) {
        throw new Error("An offline settlement exceeds its signed reservation.");
      }
      reservations.delete(payload.idempotencyKey);
      settlements.add(payload.idempotencyKey);
      if (payload.status === "succeeded") consumed += payload.costHundredths;
    }
    if (consumed > input.lease.allocatedHundredths) {
      throw new Error("The offline event chain exceeds its signed allocation.");
    }
    sequence = payload.sequence;
    previousHash = event.eventHash;
  }

  return { consumedHundredths: consumed, lastSequence: sequence, lastHash: previousHash };
}

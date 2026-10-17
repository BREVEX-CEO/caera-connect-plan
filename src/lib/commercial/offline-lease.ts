import type { GenerationSurface } from "./generation-gate";
import { observeNow } from "@/lib/time/trusted-clock";
import type { PlanTier } from "@/lib/payments/pricing";

const OFFLINE_LEASE_VERSION = 1 as const;
export const OFFLINE_LEASE_ALGORITHM = "Ed25519" as const;
export const OFFLINE_BLOCK_INCREMENT: Record<PlanTier, number> = {
  free: 7,
  pro: 35,
  max: 70,
};

export interface OfflineUsageLeasePayload {
  version: typeof OFFLINE_LEASE_VERSION;
  keyId: string;
  leaseId: string;
  accountId: string;
  deviceId: string;
  tier: PlanTier;
  allocatedHundredths: number;
  sequenceStart: number;
  sequenceEnd: number;
  sessionWindowStart: string;
  sessionResetAt: string;
  weekWindowStart: string;
  weekResetAt: string;
  issuedAt: string;
  notBefore: string;
  expiresAt: string;
  preissued: boolean;
}

export interface SignedOfflineUsageLease {
  payload: OfflineUsageLeasePayload;
  signature: string;
}

export interface OfflineLeaseVerificationKey {
  keyId: string;
  publicKeyBase64: string;
  notBefore: string;
  expiresAt?: string;
}

export type OfflineLeaseRefusal =
  | "unsupported_version"
  | "unknown_key"
  | "invalid_signature"
  | "wrong_account"
  | "wrong_device"
  | "not_yet_valid"
  | "expired"
  | "clock_rollback"
  | "invalid_allocation"
  | "sequence_exhausted";

export type OfflineLeaseDecision =
  | { ok: true; lease: SignedOfflineUsageLease; trustedNow: number }
  | { ok: false; reason: OfflineLeaseRefusal; trustedNow: number };

export interface TrustedOfflineTimeInput {
  wallNow: number;
  monotonicNow: number;
  serverTimeAtSync: number;
  monotonicAtSync: number;
  durableHighWater: number;
  /** Small clock corrections are normal. Larger backwards moves fail closed. */
  rollbackToleranceMs?: number;
}

export interface TrustedOfflineTime {
  now: number;
  rollbackDetected: boolean;
}

/**
 * Combines signed server time, elapsed monotonic time and durable wall-clock
 * history. The result only moves forward. A backwards wall-clock change does
 * not merely get clamped: it is reported so offline generation can lock until
 * a trusted server time is observed again.
 */
export function resolveTrustedOfflineTime(input: TrustedOfflineTimeInput): TrustedOfflineTime {
  const tolerance = Math.max(0, input.rollbackToleranceMs ?? 60_000);
  const monotonicElapsed =
    input.monotonicNow >= input.monotonicAtSync ? input.monotonicNow - input.monotonicAtSync : 0;
  const monotonicEstimate = input.serverTimeAtSync + monotonicElapsed;
  const floor = Math.max(input.serverTimeAtSync, monotonicEstimate, input.durableHighWater);
  return {
    now: Math.max(input.wallNow, floor),
    rollbackDetected: input.wallNow + tolerance < floor,
  };
}

/**
 * The trusted time as this device can best establish it, right now.
 *
 * Lived privately in `use-generation-permit.ts` while a second caller needed
 * exactly the same combination of wall clock, monotonic clock and durable high
 * water mark. Two copies of this is two devices' worth of disagreement about
 * whether a lease has expired, so there is one.
 */
export function trustedOfflineTimeNow(issuedAt: string): TrustedOfflineTime {
  const wallNow = Date.now();
  /*
   * READ AND RECORDED IN ONE STEP. Only the mark was read here, and nothing
   * wrote it, so it was always 0: a clock set back inside an expired lease's
   * window brought the lease back.
   */
  const durableHighWater = observeNow(wallNow);
  const monotonicNow =
    typeof performance === "undefined" ? wallNow : performance.timeOrigin + performance.now();
  return resolveTrustedOfflineTime({
    wallNow,
    monotonicNow,
    serverTimeAtSync: Date.parse(issuedAt),
    monotonicAtSync: monotonicNow,
    durableHighWater,
  });
}

/** Fixed-order bytes used by both the signer and every verifier. */
export function offlineLeaseSigningBytes(payload: OfflineUsageLeasePayload): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      version: payload.version,
      keyId: payload.keyId,
      leaseId: payload.leaseId,
      accountId: payload.accountId,
      deviceId: payload.deviceId,
      tier: payload.tier,
      allocatedHundredths: payload.allocatedHundredths,
      sequenceStart: payload.sequenceStart,
      sequenceEnd: payload.sequenceEnd,
      sessionWindowStart: payload.sessionWindowStart,
      sessionResetAt: payload.sessionResetAt,
      weekWindowStart: payload.weekWindowStart,
      weekResetAt: payload.weekResetAt,
      issuedAt: payload.issuedAt,
      notBefore: payload.notBefore,
      expiresAt: payload.expiresAt,
      preissued: payload.preissued,
    }),
  );
}

export function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

export function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function validTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function verifyOfflineUsageLease(input: {
  lease: SignedOfflineUsageLease;
  keys: readonly OfflineLeaseVerificationKey[];
  accountId: string;
  deviceId: string;
  time: TrustedOfflineTime;
}): Promise<OfflineLeaseDecision> {
  const { payload } = input.lease;
  if (payload.version !== OFFLINE_LEASE_VERSION) {
    return { ok: false, reason: "unsupported_version", trustedNow: input.time.now };
  }
  if (payload.accountId !== input.accountId) {
    return { ok: false, reason: "wrong_account", trustedNow: input.time.now };
  }
  if (payload.deviceId !== input.deviceId) {
    return { ok: false, reason: "wrong_device", trustedNow: input.time.now };
  }
  if (
    !Number.isSafeInteger(payload.allocatedHundredths) ||
    payload.allocatedHundredths <= 0 ||
    !Number.isSafeInteger(payload.sequenceStart) ||
    !Number.isSafeInteger(payload.sequenceEnd) ||
    payload.sequenceStart < 1 ||
    payload.sequenceEnd < payload.sequenceStart
  ) {
    return { ok: false, reason: "invalid_allocation", trustedNow: input.time.now };
  }
  const notBefore = validTimestamp(payload.notBefore);
  const expiresAt = validTimestamp(payload.expiresAt);
  const issuedAt = validTimestamp(payload.issuedAt);
  if (notBefore === null || expiresAt === null || issuedAt === null || expiresAt <= notBefore) {
    return { ok: false, reason: "invalid_allocation", trustedNow: input.time.now };
  }
  const timeRefusal: OfflineLeaseRefusal | null = input.time.rollbackDetected
    ? "clock_rollback"
    : input.time.now < notBefore
      ? "not_yet_valid"
      : input.time.now >= expiresAt
        ? "expired"
        : null;

  const configuredKey = input.keys.find((candidate) => candidate.keyId === payload.keyId);
  if (!configuredKey) {
    return { ok: false, reason: "unknown_key", trustedNow: input.time.now };
  }
  const keyNotBefore = validTimestamp(configuredKey.notBefore);
  const keyExpiresAt = configuredKey.expiresAt ? validTimestamp(configuredKey.expiresAt) : null;
  if (
    keyNotBefore === null ||
    issuedAt < keyNotBefore ||
    (configuredKey.expiresAt && (keyExpiresAt === null || issuedAt >= keyExpiresAt))
  ) {
    return { ok: false, reason: "unknown_key", trustedNow: input.time.now };
  }

  const rawKey = decodeBase64(configuredKey.publicKeyBase64);
  const signature = decodeBase64(input.lease.signature);
  if (!rawKey || rawKey.byteLength !== 32 || !signature || signature.byteLength !== 64) {
    return { ok: false, reason: "invalid_signature", trustedNow: input.time.now };
  }
  try {
    const publicKey = await crypto.subtle.importKey(
      "raw",
      ownedArrayBuffer(rawKey),
      { name: OFFLINE_LEASE_ALGORITHM },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      { name: OFFLINE_LEASE_ALGORITHM },
      publicKey,
      ownedArrayBuffer(signature),
      ownedArrayBuffer(offlineLeaseSigningBytes(payload)),
    );
    if (!valid) return { ok: false, reason: "invalid_signature", trustedNow: input.time.now };
    return timeRefusal
      ? { ok: false, reason: timeRefusal, trustedNow: input.time.now }
      : { ok: true, lease: input.lease, trustedNow: input.time.now };
  } catch {
    return { ok: false, reason: "invalid_signature", trustedNow: input.time.now };
  }
}

export interface OfflineUsageEventPayload {
  version: 1;
  eventId: string;
  leaseId: string;
  accountId: string;
  deviceId: string;
  sequence: number;
  generationId: string;
  idempotencyKey: string;
  surface: GenerationSurface;
  status: "reserved" | "succeeded" | "released";
  costHundredths: number;
  occurredAt: string;
  previousHash: string;
}

export interface SignedOfflineUsageEvent {
  payload: OfflineUsageEventPayload;
  eventHash: string;
  deviceSignature: string;
}

export function offlineEventSigningBytes(payload: OfflineUsageEventPayload): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      version: payload.version,
      eventId: payload.eventId,
      leaseId: payload.leaseId,
      accountId: payload.accountId,
      deviceId: payload.deviceId,
      sequence: payload.sequence,
      generationId: payload.generationId,
      idempotencyKey: payload.idempotencyKey,
      surface: payload.surface,
      status: payload.status,
      costHundredths: payload.costHundredths,
      occurredAt: payload.occurredAt,
      previousHash: payload.previousHash,
    }),
  );
}

/**
 * What a removed device signs to give its unspent capacity back. Only the browser
 * holding the device's private key can produce it, so another browser cannot
 * refund a block that device may still spend offline (F-067).
 */
export function offlineClosureSigningBytes(accountId: string, deviceId: string): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({ purpose: "ocade-offline-closure", version: 1, accountId, deviceId }),
  );
}

export function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function sha256Base64(bytes: Uint8Array): Promise<string> {
  return encodeBase64(
    new Uint8Array(await crypto.subtle.digest("SHA-256", ownedArrayBuffer(bytes))),
  );
}

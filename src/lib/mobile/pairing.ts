/**
 * OCADE mobile companion — pairing, approvals and emergency stop (Plan §27,
 * decisions #10, #34).
 *
 * Protocol logic only: pure, deterministic and unit-tested. The Capacitor apps
 * and the transport implement this contract; nothing here opens a socket.
 *
 * Security posture:
 *  - Pairing is short-lived and single-use; a code cannot be replayed.
 *  - Mobile can MONITOR, APPROVE, DENY, CANCEL and EMERGENCY-STOP — it can NOT
 *    initiate arbitrary PC control.
 *  - Every sensitive desktop action initiated from mobile requires a trusted
 *    paired device, an explicit decision, an expiry, and an audit entry.
 */

export type DevicePlatform = "windows" | "macos" | "android" | "ios";
export type DeviceKind = "desktop" | "mobile";

export interface PairingChallenge {
  /** Shown on the desktop / encoded in the QR payload. */
  code: string;
  /** Single-use nonce binding the response to this challenge. */
  nonce: string;
  createdAt: Date;
  expiresAt: Date;
}

export const PAIRING_TTL_MS = 5 * 60 * 1000;
export const APPROVAL_TTL_MS = 2 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;

function secureRandomUnit(): number {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) {
    throw new Error("A cryptographically secure random source is required for mobile pairing.");
  }
  const value = new Uint32Array(1);
  source.getRandomValues(value);
  return value[0] / 0x1_0000_0000;
}

function checkedRandom(random: () => number): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Pairing randomness must be a finite number between 0 (inclusive) and 1.");
  }
  return value;
}

/** 6-digit code + nonce. `random` is injectable so tests are deterministic. */
export function createPairingChallenge(
  now: Date = new Date(),
  random: () => number = secureRandomUnit,
): PairingChallenge {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("A pairing challenge requires a valid creation time.");
  }
  const code = String(Math.floor(checkedRandom(random) * 1_000_000)).padStart(6, "0");
  const nonce = Array.from({ length: 4 }, () =>
    Math.floor(checkedRandom(random) * 0x10000)
      .toString(16)
      .padStart(4, "0"),
  ).join("");
  return {
    code,
    nonce,
    createdAt: now,
    expiresAt: new Date(now.getTime() + PAIRING_TTL_MS),
  };
}

export type PairingResult =
  | { ok: true }
  | {
      ok: false;
      code: "expired" | "code_mismatch" | "nonce_mismatch" | "invalid_challenge";
      reason: string;
    };

export function verifyPairing(
  challenge: PairingChallenge,
  attempt: { code: string; nonce: string },
  now: Date = new Date(),
): PairingResult {
  const createdAt =
    challenge.createdAt instanceof Date ? challenge.createdAt.getTime() : Number.NaN;
  const expiresAt =
    challenge.expiresAt instanceof Date ? challenge.expiresAt.getTime() : Number.NaN;
  const current = now.getTime();
  if (
    !/^\d{6}$/.test(challenge.code) ||
    !/^[a-f0-9]{16}$/.test(challenge.nonce) ||
    !Number.isFinite(createdAt) ||
    !Number.isFinite(expiresAt) ||
    !Number.isFinite(current) ||
    expiresAt <= createdAt ||
    expiresAt - createdAt > PAIRING_TTL_MS
  ) {
    return {
      ok: false,
      code: "invalid_challenge",
      reason: "This pairing challenge is invalid. Generate a new one.",
    };
  }
  if (current >= expiresAt) {
    return {
      ok: false,
      code: "expired",
      reason: "This pairing code has expired. Generate a new one.",
    };
  }
  if (attempt.nonce !== challenge.nonce) {
    return {
      ok: false,
      code: "nonce_mismatch",
      reason: "This pairing request doesn't match. Try again.",
    };
  }
  if (attempt.code !== challenge.code) {
    return { ok: false, code: "code_mismatch", reason: "That code is incorrect." };
  }
  return { ok: true };
}

/** QR payload — carries no secret beyond the single-use challenge. */
export function pairingPayload(challenge: PairingChallenge, accountRef: string): string {
  return JSON.stringify({ v: 1, ref: accountRef, code: challenge.code, nonce: challenge.nonce });
}

export interface PairedDevice {
  id: string;
  label: string;
  kind: DeviceKind;
  platform: DevicePlatform;
  pairedAt: Date;
  lastSeenAt: Date;
  revoked: boolean;
}

/** A device is trusted only while paired, unrevoked and recently seen. */
export const TRUST_STALE_MS = 30 * 24 * 60 * 60 * 1000;

export function isTrusted(device: PairedDevice, now: Date = new Date()): boolean {
  if (device.revoked) return false;
  const current = now.getTime();
  const pairedAt = device.pairedAt instanceof Date ? device.pairedAt.getTime() : Number.NaN;
  const lastSeenAt = device.lastSeenAt instanceof Date ? device.lastSeenAt.getTime() : Number.NaN;
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(pairedAt) ||
    !Number.isFinite(lastSeenAt) ||
    pairedAt > lastSeenAt ||
    lastSeenAt > current + CLOCK_SKEW_MS
  ) {
    return false;
  }
  return current - lastSeenAt <= TRUST_STALE_MS;
}

/* ----------------------------------------------------------- approvals -- */

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "cancelled";

export interface ApprovalRequest {
  id: string;
  /** Redacted, human-readable summary of what will happen. */
  summary: string;
  risk: "read_only" | "low" | "confirm" | "high" | "prohibited";
  requestedAt: Date;
  expiresAt: Date;
  status: ApprovalStatus;
  /** Device that made the decision, for the audit trail. */
  decidedByDeviceId?: string;
  decidedAt?: Date;
}

export function createApprovalRequest(input: {
  id: string;
  summary: string;
  risk: ApprovalRequest["risk"];
  now?: Date;
}): ApprovalRequest {
  const now = input.now ?? new Date();
  return {
    id: input.id,
    summary: input.summary,
    risk: input.risk,
    requestedAt: now,
    expiresAt: new Date(now.getTime() + APPROVAL_TTL_MS),
    status: "pending",
  };
}

export type DecisionResult =
  | { ok: true; request: ApprovalRequest }
  | {
      ok: false;
      code: "expired" | "already_decided" | "untrusted_device" | "prohibited";
      reason: string;
    };

/**
 * Apply a mobile decision. Refuses prohibited actions outright, decisions from
 * untrusted devices, expired requests and double-decisions.
 */
export function decideApproval(
  request: ApprovalRequest,
  decision: "approved" | "denied" | "cancelled",
  device: PairedDevice,
  now: Date = new Date(),
): DecisionResult {
  if (request.risk === "prohibited") {
    return {
      ok: false,
      code: "prohibited",
      reason: "This action involves protected information and can never be approved remotely.",
    };
  }
  if (request.status !== "pending") {
    return {
      ok: false,
      code: "already_decided",
      reason: `This request was already ${request.status}.`,
    };
  }
  if (now.getTime() > request.expiresAt.getTime()) {
    return {
      ok: false,
      code: "expired",
      reason: "This approval request expired. Ask again from your desktop.",
    };
  }
  if (!isTrusted(device, now)) {
    return {
      ok: false,
      code: "untrusted_device",
      reason: "This device isn't trusted. Pair it again.",
    };
  }
  return {
    ok: true,
    request: { ...request, status: decision, decidedByDeviceId: device.id, decidedAt: now },
  };
}

export function expireIfDue(request: ApprovalRequest, now: Date = new Date()): ApprovalRequest {
  if (request.status === "pending" && now.getTime() > request.expiresAt.getTime()) {
    return { ...request, status: "expired" };
  }
  return request;
}

/* ------------------------------------------------------ emergency stop -- */

export interface EmergencyStop {
  requestedByDeviceId: string;
  requestedAt: Date;
  reason: string;
}

/**
 * Emergency stop is always permitted from ANY paired device — including a
 * device that has gone stale — because halting is never the dangerous
 * direction. Only revoked devices are refused.
 */
export function canEmergencyStop(device: PairedDevice): { allowed: boolean; reason?: string } {
  if (device.revoked) {
    return { allowed: false, reason: "This device has been revoked." };
  }
  return { allowed: true };
}

/** Which in-flight requests an emergency stop cancels. */
export function applyEmergencyStop(
  requests: ApprovalRequest[],
  stop: EmergencyStop,
): ApprovalRequest[] {
  return requests.map((r) =>
    r.status === "pending"
      ? {
          ...r,
          status: "cancelled" as const,
          decidedByDeviceId: stop.requestedByDeviceId,
          decidedAt: stop.requestedAt,
        }
      : r,
  );
}

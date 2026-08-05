/**
 * Pairing policy: who may ask a desktop OCADE to think, and for how long.
 *
 * THE THREAT THIS EXISTS TO STOP. A local inference server is an
 * unauthenticated prompt endpoint and a file-reading surface. If any web page
 * could reach it, visiting the wrong site would let a stranger run prompts on
 * your machine, read whatever the model can see, and burn your battery doing
 * it. So a website NEVER talks to the engine directly — it talks to OCADE's
 * bridge, and the bridge applies every rule below before a single token is
 * generated.
 *
 * PURE ON PURPOSE. There is no transport, no crypto library and no clock here
 * beyond what a caller injects. Authorisation logic that can only be exercised
 * by standing up two machines is authorisation logic nobody has tested, and
 * this is the layer where a mistake is worst.
 *
 * WHAT IS NOT HERE, and must not be assumed: the actual HTTP listener, the
 * approval UI, and the transport-level TLS. This decides; it does not carry.
 */

export interface PairedDevice {
  /** Stable id for this pairing, safe to show in a device list. */
  id: string;
  /** What the user called it, e.g. "Work laptop". */
  label: string;
  /** Exact origin allowed to use this pairing, e.g. "https://app.example.com". */
  origin: string;
  /** Secret shared at approval time. Never leaves the two devices. */
  secret: string;
  /** When the human approved it. */
  approvedAt: number;
  /** Set when revoked; a revoked pairing is kept so it can be shown as revoked. */
  revokedAt?: number;
}

export interface PairingRequest {
  deviceId: string;
  origin: string;
  /** Unix millis the token was minted. */
  issuedAt: number;
  /** Single-use value; a repeat is a replay. */
  nonce: string;
  /** HMAC over the request, computed by the caller with the shared secret. */
  signature: string;
}

export type DenialCode =
  | "unknown_device"
  | "revoked"
  | "origin_not_allowed"
  | "expired"
  | "clock_skew"
  | "replayed"
  | "rate_limited"
  | "bad_signature";

export type PairingDecision =
  { allowed: true; device: PairedDevice } | { allowed: false; code: DenialCode; reason: string };

/**
 * How long a minted token stays usable.
 *
 * Short because a token is a licence to run prompts on someone's computer.
 * Two minutes is long enough for a slow network and short enough that a copied
 * token is worthless before it can be used deliberately.
 */
export const TOKEN_LIFETIME_MS = 120_000;

/**
 * Tolerance for a device whose clock is wrong.
 *
 * Without it, a laptop thirty seconds fast rejects every request from a phone
 * and the user sees "expired" forever with nothing to fix. A token from the
 * FUTURE beyond this is refused as skew rather than accepted, because
 * accepting it would extend its life past the limit above.
 */
export const CLOCK_SKEW_TOLERANCE_MS = 30_000;

/** Requests one paired device may make per window. */
export const RATE_LIMIT = { windowMs: 60_000, maxRequests: 60 } as const;

export interface PairingState {
  devices: Map<string, PairedDevice>;
  /** Nonces already spent, with the time they were seen. */
  seenNonces: Map<string, number>;
  /** Request timestamps per device, for the rate limit. */
  recentRequests: Map<string, number[]>;
}

export function createPairingState(devices: PairedDevice[] = []): PairingState {
  return {
    devices: new Map(devices.map((d) => [d.id, d])),
    seenNonces: new Map(),
    recentRequests: new Map(),
  };
}

export interface AuthoriseDeps {
  now: () => number;
  /**
   * Recompute the expected signature. Injected so this module carries no
   * crypto and stays synchronous and testable.
   */
  sign: (device: PairedDevice, request: Omit<PairingRequest, "signature">) => string;
  /**
   * Constant-time string comparison. Injected for the same reason, and named
   * so it is obvious that `===` is the wrong tool here — comparing secrets
   * with early-exit equality leaks their contents through timing.
   */
  constantTimeEqual: (a: string, b: string) => boolean;
}

/**
 * Decide whether one request may be served.
 *
 * ORDER MATTERS, and it is deliberate: cheap, non-secret checks first, so an
 * attacker probing with garbage never reaches the signature comparison, and
 * the rate limit is charged before the expensive work rather than after.
 */
export function authorisePairedRequest(
  state: PairingState,
  request: PairingRequest,
  deps: AuthoriseDeps,
): PairingDecision {
  const now = deps.now();

  const device = state.devices.get(request.deviceId);
  if (!device) {
    return {
      allowed: false,
      code: "unknown_device",
      reason: "This device is not paired with that computer.",
    };
  }
  if (device.revokedAt !== undefined) {
    return {
      allowed: false,
      code: "revoked",
      reason: "That pairing was revoked on the computer it belonged to.",
    };
  }

  /*
   * An EXACT origin match, never a suffix one. `endsWith("example.com")` also
   * matches `evil-example.com`, which is how origin allowlists are usually
   * defeated.
   */
  if (request.origin !== device.origin) {
    return {
      allowed: false,
      code: "origin_not_allowed",
      reason: "This website is not the one that pairing was approved for.",
    };
  }

  if (request.issuedAt > now + CLOCK_SKEW_TOLERANCE_MS) {
    return {
      allowed: false,
      code: "clock_skew",
      reason: "That request is dated in the future. Check the clock on the sending device.",
    };
  }
  if (now - request.issuedAt > TOKEN_LIFETIME_MS) {
    return {
      allowed: false,
      code: "expired",
      reason: "That request took too long to arrive and is no longer valid.",
    };
  }

  // Rate limit BEFORE the signature check: verifying signatures for an
  // attacker is work they get to choose the amount of.
  const window = state.recentRequests.get(device.id) ?? [];
  const fresh = window.filter((at) => now - at < RATE_LIMIT.windowMs);
  if (fresh.length >= RATE_LIMIT.maxRequests) {
    state.recentRequests.set(device.id, fresh);
    return {
      allowed: false,
      code: "rate_limited",
      reason: "That device is making too many requests. It will be allowed again shortly.",
    };
  }

  const nonceKey = `${device.id}:${request.nonce}`;
  if (state.seenNonces.has(nonceKey)) {
    return {
      allowed: false,
      code: "replayed",
      reason: "That request was already used once and cannot be repeated.",
    };
  }

  const expected = deps.sign(device, {
    deviceId: request.deviceId,
    origin: request.origin,
    issuedAt: request.issuedAt,
    nonce: request.nonce,
  });
  if (!deps.constantTimeEqual(expected, request.signature)) {
    // Not recorded as a spent nonce: a wrong signature must not let an
    // attacker burn a nonce the real device is about to use.
    return {
      allowed: false,
      code: "bad_signature",
      reason: "That request was not signed by the paired device.",
    };
  }

  state.seenNonces.set(nonceKey, now);
  state.recentRequests.set(device.id, [...fresh, now]);
  return { allowed: true, device };
}

/**
 * Drop nonces that can no longer be replayed.
 *
 * A nonce only needs remembering for as long as a token could still be valid.
 * Without this the set grows without bound and becomes its own denial of
 * service against the machine it protects.
 */
export function pruneNonces(state: PairingState, now: number): number {
  const cutoff = now - (TOKEN_LIFETIME_MS + CLOCK_SKEW_TOLERANCE_MS);
  let removed = 0;
  for (const [key, at] of state.seenNonces) {
    if (at < cutoff) {
      state.seenNonces.delete(key);
      removed += 1;
    }
  }
  return removed;
}

/** Revoke a pairing. Kept in the list so it can be shown as revoked. */
export function revokeDevice(state: PairingState, deviceId: string, now: number): boolean {
  const device = state.devices.get(deviceId);
  if (!device || device.revokedAt !== undefined) return false;
  state.devices.set(deviceId, { ...device, revokedAt: now });
  // Its in-flight nonces go too, so nothing already minted still works.
  for (const key of state.seenNonces.keys()) {
    if (key.startsWith(`${deviceId}:`)) state.seenNonces.delete(key);
  }
  return true;
}

/** One sentence per denial, for a device list or a diagnostics page. */
export function describeDenial(code: DenialCode): string {
  switch (code) {
    case "unknown_device":
      return "Not paired";
    case "revoked":
      return "Pairing revoked";
    case "origin_not_allowed":
      return "Different website";
    case "expired":
      return "Request expired";
    case "clock_skew":
      return "Clock out of sync";
    case "replayed":
      return "Already used";
    case "rate_limited":
      return "Too many requests";
    case "bad_signature":
      return "Not signed correctly";
  }
}

import { describe, it, expect } from "vitest";
import {
  authorisePairedRequest,
  createPairingState,
  pruneNonces,
  revokeDevice,
  describeDenial,
  CLOCK_SKEW_TOLERANCE_MS,
  RATE_LIMIT,
  TOKEN_LIFETIME_MS,
  type AuthoriseDeps,
  type PairedDevice,
  type PairingRequest,
} from "../brain/pairing";
import { parsePairingCode } from "@/lib/brain/pairing-code";

/**
 * Authorisation for a paired desktop.
 *
 * This is the layer where a mistake is worst: a local inference server is an
 * unauthenticated prompt endpoint, so anything that wrongly returns `allowed`
 * hands a stranger someone else's computer. Every denial path is therefore
 * exercised deliberately, including the ones that look paranoid.
 */

const DEVICE: PairedDevice = {
  id: "dev-1",
  label: "Work laptop",
  origin: "https://app.example.com",
  secret: "shared-secret",
  approvedAt: 1_000,
};

/** A stand-in signature: deterministic, and dependent on every field. */
const deps = (now: number): AuthoriseDeps => ({
  now: () => now,
  sign: (device, r) => `${device.secret}|${r.deviceId}|${r.origin}|${r.issuedAt}|${r.nonce}`,
  constantTimeEqual: (a, b) => a === b,
});

function request(now: number, over: Partial<PairingRequest> = {}): PairingRequest {
  const base = {
    deviceId: DEVICE.id,
    origin: DEVICE.origin,
    issuedAt: now,
    nonce: `n-${Math.random()}`,
  };
  const merged = { ...base, ...over };
  return {
    ...merged,
    signature:
      over.signature ??
      `${DEVICE.secret}|${merged.deviceId}|${merged.origin}|${merged.issuedAt}|${merged.nonce}`,
  };
}

describe("a correctly signed, fresh request is allowed", () => {
  it("allows it and identifies the device", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    const decision = authorisePairedRequest(state, request(now), deps(now));
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.device.id).toBe("dev-1");
  });

  it("tolerates a modestly fast clock on the sending device", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    const decision = authorisePairedRequest(
      state,
      request(now, { issuedAt: now + CLOCK_SKEW_TOLERANCE_MS - 1 }),
      deps(now),
    );
    expect(decision.allowed).toBe(true);
  });
});

describe("identity and permission", () => {
  it("refuses a device that was never paired", () => {
    const now = 10_000;
    const state = createPairingState([]);
    const decision = authorisePairedRequest(state, request(now), deps(now));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("unknown_device");
  });

  it("refuses a revoked pairing", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    expect(revokeDevice(state, DEVICE.id, now)).toBe(true);
    const decision = authorisePairedRequest(state, request(now), deps(now));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("revoked");
  });

  it("refuses a second revocation rather than reporting success twice", () => {
    const state = createPairingState([DEVICE]);
    expect(revokeDevice(state, DEVICE.id, 1)).toBe(true);
    expect(revokeDevice(state, DEVICE.id, 2)).toBe(false);
  });

  it("refuses a different origin", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    const decision = authorisePairedRequest(
      state,
      request(now, { origin: "https://other.example.com" }),
      deps(now),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("origin_not_allowed");
  });

  it("refuses a look-alike origin that merely ends with the allowed one", () => {
    /*
     * The classic allowlist defeat: `endsWith("example.com")` also matches
     * `evil-example.com`. Matching must be exact.
     */
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    const decision = authorisePairedRequest(
      state,
      request(now, { origin: "https://evil-app.example.com.attacker.test" }),
      deps(now),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("origin_not_allowed");
  });

  it("refuses a request signed with the wrong secret", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    const decision = authorisePairedRequest(
      state,
      request(now, { signature: "not-the-right-signature" }),
      deps(now),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("bad_signature");
  });

  it("refuses a signature lifted from a different request", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    const other = request(now);
    const decision = authorisePairedRequest(
      state,
      request(now, { signature: other.signature }),
      deps(now),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("bad_signature");
  });
});

describe("freshness", () => {
  it("refuses a token older than its lifetime", () => {
    const now = 1_000_000;
    const state = createPairingState([DEVICE]);
    const decision = authorisePairedRequest(
      state,
      request(now, { issuedAt: now - TOKEN_LIFETIME_MS - 1 }),
      deps(now),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("expired");
  });

  it("refuses a token dated far in the future rather than accepting it", () => {
    // Accepting it would extend its usable life past the lifetime limit.
    const now = 1_000_000;
    const state = createPairingState([DEVICE]);
    const decision = authorisePairedRequest(
      state,
      request(now, { issuedAt: now + CLOCK_SKEW_TOLERANCE_MS + 1 }),
      deps(now),
    );
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe("clock_skew");
  });
});

describe("replay protection", () => {
  it("refuses the same nonce twice", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    const one = request(now);
    expect(authorisePairedRequest(state, one, deps(now)).allowed).toBe(true);
    const again = authorisePairedRequest(state, one, deps(now));
    expect(again.allowed).toBe(false);
    if (!again.allowed) expect(again.code).toBe("replayed");
  });

  it("does NOT let a bad signature burn a nonce the real device will use", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    const genuine = request(now);
    // An attacker guesses the nonce but cannot sign it.
    const forged = { ...genuine, signature: "wrong" };
    expect(authorisePairedRequest(state, forged, deps(now)).allowed).toBe(false);
    // The real request must still work.
    expect(authorisePairedRequest(state, genuine, deps(now)).allowed).toBe(true);
  });

  it("forgets nonces once they can no longer be replayed", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    authorisePairedRequest(state, request(now), deps(now));
    expect(state.seenNonces.size).toBe(1);
    // Not yet: still inside the replay window.
    expect(pruneNonces(state, now + TOKEN_LIFETIME_MS)).toBe(0);
    // Now: a token this old would be rejected as expired anyway.
    expect(pruneNonces(state, now + TOKEN_LIFETIME_MS + CLOCK_SKEW_TOLERANCE_MS + 1)).toBe(1);
    expect(state.seenNonces.size).toBe(0);
  });

  it("drops a revoked device's nonces so nothing already minted still works", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    authorisePairedRequest(state, request(now), deps(now));
    expect(state.seenNonces.size).toBe(1);
    revokeDevice(state, DEVICE.id, now);
    expect(state.seenNonces.size).toBe(0);
  });
});

describe("rate limiting", () => {
  it("stops a device that exceeds the window", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    for (let i = 0; i < RATE_LIMIT.maxRequests; i++) {
      expect(authorisePairedRequest(state, request(now), deps(now)).allowed).toBe(true);
    }
    const overLimit = authorisePairedRequest(state, request(now), deps(now));
    expect(overLimit.allowed).toBe(false);
    if (!overLimit.allowed) expect(overLimit.code).toBe("rate_limited");
  });

  it("charges the limit BEFORE verifying a signature", () => {
    /*
     * Otherwise an attacker chooses how much signature verification the
     * machine performs, which is the denial of service the limit exists for.
     */
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    for (let i = 0; i < RATE_LIMIT.maxRequests; i++) {
      authorisePairedRequest(state, request(now), deps(now));
    }
    const forged = authorisePairedRequest(state, request(now, { signature: "wrong" }), deps(now));
    expect(forged.allowed).toBe(false);
    if (!forged.allowed) expect(forged.code).toBe("rate_limited");
  });

  it("lets the device through again once the window has passed", () => {
    const now = 10_000;
    const state = createPairingState([DEVICE]);
    for (let i = 0; i < RATE_LIMIT.maxRequests; i++) {
      authorisePairedRequest(state, request(now), deps(now));
    }
    const later = now + RATE_LIMIT.windowMs + 1;
    expect(authorisePairedRequest(state, request(later), deps(later)).allowed).toBe(true);
  });
});

describe("denials read as sentences, not codes", () => {
  it("has wording for every denial", () => {
    const codes = [
      "unknown_device",
      "revoked",
      "origin_not_allowed",
      "expired",
      "clock_skew",
      "replayed",
      "rate_limited",
      "bad_signature",
    ] as const;
    for (const code of codes) {
      expect(describeDenial(code).length).toBeGreaterThan(3);
      expect(describeDenial(code)).not.toContain("_");
    }
  });
});

/*
 * The pairing code a user pastes.
 *
 * Parsed strictly because a partly-applied pairing fails later in a way nobody
 * can diagnose — and because the address inside it decides whether the
 * conversation travels encrypted.
 */
describe("the pairing code a user pastes", () => {
  const encode = (deviceId: string, bridgeUrl: string, secret: string) =>
    btoa(`${deviceId}|${bridgeUrl}|${secret}`);

  it("accepts a well-formed code over https", () => {
    const parsed = parsePairingCode(encode("dev-1", "https://laptop.local:7443", "s3cret"));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.deviceId).toBe("dev-1");
      expect(parsed.bridgeUrl).toBe("https://laptop.local:7443");
      expect(parsed.secret).toBe("s3cret");
    }
  });

  it("tolerates whitespace introduced by copying and pasting", () => {
    const code = encode("dev-1", "https://laptop.local:7443", "s3cret");
    const wrapped = `${code.slice(0, 8)}\n  ${code.slice(8)}`;
    expect(parsePairingCode(wrapped).ok).toBe(true);
  });

  it("accepts loopback over plain http, for a desktop talking to itself", () => {
    expect(parsePairingCode(encode("dev-1", "http://127.0.0.1:7443", "s")).ok).toBe(true);
  });

  it("REFUSES plain http to another machine", () => {
    // Otherwise the signed request and the conversation cross whatever network
    // the two devices share in clear text.
    const parsed = parsePairingCode(encode("dev-1", "http://laptop.local:7443", "s"));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/unencrypted/i);
  });

  it("refuses a truncated code rather than applying half of it", () => {
    const parsed = parsePairingCode(btoa("dev-1|https://laptop.local"));
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.reason).toMatch(/incomplete/i);
  });

  it("refuses a code with an empty field", () => {
    expect(parsePairingCode(encode("dev-1", "https://laptop.local", "")).ok).toBe(false);
  });

  it("refuses something that is not a code at all", () => {
    expect(parsePairingCode("hello there").ok).toBe(false);
    expect(parsePairingCode("").ok).toBe(false);
  });

  it("refuses a code carrying an unusable address", () => {
    expect(parsePairingCode(encode("dev-1", "not a url", "s")).ok).toBe(false);
  });
});

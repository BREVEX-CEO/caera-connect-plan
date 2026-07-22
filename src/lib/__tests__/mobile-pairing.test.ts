import { describe, it, expect } from "vitest";
import {
  createPairingChallenge,
  verifyPairing,
  pairingPayload,
  isTrusted,
  createApprovalRequest,
  decideApproval,
  expireIfDue,
  canEmergencyStop,
  applyEmergencyStop,
  PAIRING_TTL_MS,
  APPROVAL_TTL_MS,
  type PairedDevice,
} from "../mobile/pairing";

const at = (iso: string) => new Date(iso);
const T0 = at("2026-07-22T10:00:00Z");
const seq = () => {
  let i = 0;
  const vals = [0.123456, 0.2, 0.3, 0.4, 0.5];
  return () => vals[i++ % vals.length];
};

const device = (over: Partial<PairedDevice> = {}): PairedDevice => ({
  id: "dev-1",
  label: "Pixel",
  kind: "mobile",
  platform: "android",
  pairedAt: T0,
  lastSeenAt: T0,
  revoked: false,
  ...over,
});

describe("pairing challenge", () => {
  it("creates a 6-digit code with a bounded lifetime", () => {
    const c = createPairingChallenge(T0, seq());
    expect(c.code).toMatch(/^\d{6}$/);
    expect(c.nonce.length).toBeGreaterThan(0);
    expect(c.expiresAt.getTime() - c.createdAt.getTime()).toBe(PAIRING_TTL_MS);
  });

  it("accepts a correct, unexpired attempt", () => {
    const c = createPairingChallenge(T0, seq());
    expect(verifyPairing(c, { code: c.code, nonce: c.nonce }, T0)).toEqual({ ok: true });
  });

  it("rejects an expired code", () => {
    const c = createPairingChallenge(T0, seq());
    const r = verifyPairing(c, { code: c.code, nonce: c.nonce }, at("2026-07-22T10:06:00Z"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("expired");
  });

  it("rejects a wrong code and a replayed/mismatched nonce", () => {
    const c = createPairingChallenge(T0, seq());
    const wrongCode = verifyPairing(c, { code: "000000", nonce: c.nonce }, T0);
    expect(wrongCode.ok).toBe(false);
    if (!wrongCode.ok) expect(wrongCode.code).toBe("code_mismatch");

    const wrongNonce = verifyPairing(c, { code: c.code, nonce: "deadbeef" }, T0);
    expect(wrongNonce.ok).toBe(false);
    if (!wrongNonce.ok) expect(wrongNonce.code).toBe("nonce_mismatch");
  });

  it("QR payload carries only the single-use challenge", () => {
    const c = createPairingChallenge(T0, seq());
    const parsed = JSON.parse(pairingPayload(c, "acct-1")) as Record<string, unknown>;
    expect(parsed).toMatchObject({ v: 1, ref: "acct-1", code: c.code, nonce: c.nonce });
    expect(Object.keys(parsed)).toHaveLength(4);
  });
});

describe("device trust", () => {
  it("trusts a recently seen, unrevoked device", () => {
    expect(isTrusted(device(), T0)).toBe(true);
  });
  it("never trusts a revoked device", () => {
    expect(isTrusted(device({ revoked: true }), T0)).toBe(false);
  });
  it("stops trusting a long-unseen device", () => {
    expect(isTrusted(device({ lastSeenAt: at("2026-01-01T00:00:00Z") }), T0)).toBe(false);
  });
});

describe("approval decisions", () => {
  const req = () => createApprovalRequest({ id: "a1", summary: "Open approved app", risk: "confirm", now: T0 });

  it("has a bounded lifetime", () => {
    const r = req();
    expect(r.expiresAt.getTime() - r.requestedAt.getTime()).toBe(APPROVAL_TTL_MS);
    expect(r.status).toBe("pending");
  });

  it("records approval with the deciding device for audit", () => {
    const d = decideApproval(req(), "approved", device(), T0);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.request.status).toBe("approved");
      expect(d.request.decidedByDeviceId).toBe("dev-1");
      expect(d.request.decidedAt).toEqual(T0);
    }
  });

  it("supports deny and cancel", () => {
    for (const decision of ["denied", "cancelled"] as const) {
      const d = decideApproval(req(), decision, device(), T0);
      expect(d.ok).toBe(true);
      if (d.ok) expect(d.request.status).toBe(decision);
    }
  });

  it("NEVER allows remote approval of protected-information actions", () => {
    const prohibited = createApprovalRequest({ id: "p", summary: "Type password", risk: "prohibited", now: T0 });
    const d = decideApproval(prohibited, "approved", device(), T0);
    expect(d.ok).toBe(false);
    if (!d.ok) {
      expect(d.code).toBe("prohibited");
      expect(d.reason).toMatch(/never be approved remotely/i);
    }
  });

  it("rejects decisions from untrusted devices", () => {
    const d = decideApproval(req(), "approved", device({ revoked: true }), T0);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.code).toBe("untrusted_device");
  });

  it("rejects expired and double decisions", () => {
    const late = decideApproval(req(), "approved", device(), at("2026-07-22T10:05:00Z"));
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.code).toBe("expired");

    const first = decideApproval(req(), "approved", device(), T0);
    if (first.ok) {
      const second = decideApproval(first.request, "denied", device(), T0);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.code).toBe("already_decided");
    }
  });

  it("expires pending requests when due", () => {
    expect(expireIfDue(req(), at("2026-07-22T10:05:00Z")).status).toBe("expired");
    expect(expireIfDue(req(), T0).status).toBe("pending");
  });
});

describe("emergency stop", () => {
  it("is allowed from any paired device, even a stale one", () => {
    expect(canEmergencyStop(device({ lastSeenAt: at("2026-01-01T00:00:00Z") })).allowed).toBe(true);
  });

  it("is refused from a revoked device", () => {
    const r = canEmergencyStop(device({ revoked: true }));
    expect(r.allowed).toBe(false);
    expect(r.reason).toMatch(/revoked/i);
  });

  it("cancels every in-flight request and records who stopped it", () => {
    const pending = createApprovalRequest({ id: "x", summary: "s", risk: "confirm", now: T0 });
    const done = { ...createApprovalRequest({ id: "y", summary: "s", risk: "low", now: T0 }), status: "approved" as const };
    const out = applyEmergencyStop([pending, done], {
      requestedByDeviceId: "dev-1",
      requestedAt: T0,
      reason: "user pressed stop",
    });
    expect(out[0].status).toBe("cancelled");
    expect(out[0].decidedByDeviceId).toBe("dev-1");
    // Already-decided requests are untouched.
    expect(out[1].status).toBe("approved");
  });
});

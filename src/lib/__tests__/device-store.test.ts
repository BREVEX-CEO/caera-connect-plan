import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listDevices,
  activeDevices,
  saveDevice,
  revokeDevice,
  forgetDevice,
  touchDevice,
  clearDevices,
} from "../mobile/device-store";
import { isTrusted, TRUST_STALE_MS, type PairedDevice } from "../mobile/pairing";

const NOW = new Date("2026-07-23T10:00:00Z");

function phone(over: Partial<PairedDevice> = {}): PairedDevice {
  return {
    id: "d1",
    label: "Pixel",
    kind: "mobile",
    platform: "android",
    pairedAt: NOW,
    lastSeenAt: NOW,
    revoked: false,
    ...over,
  };
}

beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

/**
 * Devices lived in component state, which made pairing cosmetic — and made
 * REVOCATION cosmetic too. A revocation that vanishes on reload is worse than
 * none, because the user believes a lost phone has been cut off.
 */
describe("pairing survives a reload", () => {
  it("a paired device is still there afterwards", () => {
    saveDevice(phone());
    // A fresh read is the "after reload" case; nothing is held in memory.
    expect(listDevices()).toHaveLength(1);
    expect(listDevices()[0].label).toBe("Pixel");
  });

  it("round-trips dates rather than leaving strings behind", () => {
    saveDevice(phone());
    const [d] = listDevices();
    expect(d.pairedAt).toBeInstanceOf(Date);
    expect(d.lastSeenAt).toBeInstanceOf(Date);
  });

  it("updating an existing device does not duplicate it", () => {
    saveDevice(phone());
    saveDevice(phone({ label: "Pixel 9" }));
    expect(listDevices()).toHaveLength(1);
    expect(listDevices()[0].label).toBe("Pixel 9");
  });
});

describe("revocation survives a reload", () => {
  it("stays revoked after a fresh read", () => {
    saveDevice(phone());
    revokeDevice("d1", NOW);
    const [d] = listDevices();
    expect(d.revoked).toBe(true);
  });

  it("a revoked device is excluded from the active list", () => {
    saveDevice(phone());
    saveDevice(phone({ id: "d2", label: "iPhone", platform: "ios" }));
    revokeDevice("d1", NOW);

    expect(activeDevices().map((d) => d.id)).toEqual(["d2"]);
    // The tombstone is still listed, so the refusal is visible and auditable.
    expect(listDevices()).toHaveLength(2);
  });

  /**
   * A lost phone must not be able to restore its own trust by pairing again
   * under the same identity.
   */
  it("REFUSES to re-pair a revoked device id", () => {
    saveDevice(phone());
    revokeDevice("d1", NOW);

    const retry = saveDevice(phone());
    expect(retry.ok).toBe(false);
    if (retry.ok) throw new Error("unreachable");
    expect(retry.reason).toMatch(/revoked/i);
    expect(activeDevices()).toHaveLength(0);
  });

  it("forgetting is a deliberate act that allows re-pairing", () => {
    saveDevice(phone());
    revokeDevice("d1", NOW);
    forgetDevice("d1");

    expect(listDevices()).toHaveLength(0);
    expect(saveDevice(phone()).ok).toBe(true);
    expect(activeDevices()).toHaveLength(1);
  });

  it("revoking an unknown id returns null instead of inventing a row", () => {
    expect(revokeDevice("nope")).toBeNull();
    expect(listDevices()).toHaveLength(0);
  });
});

describe("trust staleness", () => {
  it("a freshly seen device is trusted", () => {
    saveDevice(phone());
    expect(isTrusted(listDevices()[0], NOW)).toBe(true);
  });

  it("touch refreshes last-seen so an active device stays trusted", () => {
    saveDevice(phone({ lastSeenAt: new Date(NOW.getTime() - TRUST_STALE_MS - 1000) }));
    expect(isTrusted(listDevices()[0], NOW)).toBe(false);

    touchDevice("d1", NOW);
    expect(isTrusted(listDevices()[0], NOW)).toBe(true);
  });

  it("touch NEVER resurrects a revoked device", () => {
    saveDevice(phone());
    revokeDevice("d1", NOW);
    touchDevice("d1", NOW);
    expect(listDevices()[0].revoked).toBe(true);
    expect(activeDevices()).toHaveLength(0);
  });
});

describe("resilience", () => {
  it("survives corrupt storage rather than throwing", () => {
    localStorage.setItem("caera:devices:v1", "{not json");
    expect(() => listDevices()).not.toThrow();
    expect(listDevices()).toEqual([]);
  });

  it("discards malformed rows instead of crashing on them", () => {
    localStorage.setItem("caera:devices:v1", JSON.stringify([{ nope: true }, 42, null]));
    expect(listDevices()).toEqual([]);
  });

  it("clears everything on request", () => {
    saveDevice(phone());
    clearDevices();
    expect(listDevices()).toHaveLength(0);
  });

  it("does not report pairing or revocation success when durable storage rejects the write", () => {
    const d = phone();
    vi.stubGlobal("localStorage", {
      getItem: () => "[]",
      setItem: () => {
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      },
    });

    expect(saveDevice(d)).toMatchObject({ ok: false });
    expect(revokeDevice(d.id)).toBeNull();
  });
});

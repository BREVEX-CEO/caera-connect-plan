import { describe, it, expect, beforeEach, vi } from "vitest";
import { isTrusted, TRUST_STALE_MS, type PairedDevice } from "../mobile/pairing";

/**
 * PAIRING AND REVOCATION, IN THE ACCOUNT.
 *
 * These lived in `localStorage`, and the tests below used to prove they
 * survived a reload. That was the wrong bar, and the gap it left is the reason
 * for this file: a revocation kept in one browser is not a revocation.
 * Somebody who loses a phone and revokes it from a laptop would find it still
 * trusted on every other device they own, and the refusal gone entirely once
 * that laptop's storage was cleared.
 *
 * So what is proved here is the same set of rules against the account: a
 * revoked id cannot re-pair, a tombstone stays visible, trust is never
 * refreshed for a revoked device, and an unreachable account is never reported
 * as a success.
 */

/*
 * Hoisted, because `vi.mock` is lifted above every import in the file. The fake
 * has to exist before the module under test resolves its client, or the tests
 * would exercise the real one and pass by doing nothing.
 */
const devices = vi.hoisted(async () => {
  const { createFakeDeviceStore } = await import("./support/fake-devices");
  return createFakeDeviceStore();
});

vi.mock("@/integrations/supabase/on-demand", () => ({
  loadSupabaseClient: async () => (await devices).client,
}));

const store = await devices;
const {
  listDevices,
  activeDevices,
  saveDevice,
  revokeDevice,
  forgetDevice,
  touchDevice,
  clearDevices,
} = await import("../mobile/device-store");

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
  store.reset();
});

describe("pairing is recorded in the account", () => {
  it("a paired device is listed afterwards", async () => {
    await saveDevice(phone());
    expect(await listDevices()).toHaveLength(1);
    expect((await listDevices())[0]!.label).toBe("Pixel");
  });

  it("returns dates rather than leaving strings behind", async () => {
    await saveDevice(phone());
    const [device] = await listDevices();
    expect(device!.pairedAt).toBeInstanceOf(Date);
    expect(device!.lastSeenAt).toBeInstanceOf(Date);
  });

  it("updating an existing device does not duplicate it", async () => {
    await saveDevice(phone());
    await saveDevice(phone({ label: "Pixel 9" }));
    expect(await listDevices()).toHaveLength(1);
    expect((await listDevices())[0]!.label).toBe("Pixel 9");
  });

  it("records the platform, so it is not guessed from a user agent later", async () => {
    await saveDevice(phone({ platform: "ios" }));
    expect(store.rows[0]!.platform).toBe("ios");
    expect((await listDevices())[0]!.platform).toBe("ios");
  });

  it("refuses to pair when nobody is signed in", async () => {
    store.signedInAs(null);
    const result = await saveDevice(phone());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/sign in/i);
    expect(store.rows).toHaveLength(0);
  });
});

describe("revocation is recorded in the account", () => {
  it("stays revoked on a fresh read", async () => {
    await saveDevice(phone());
    await revokeDevice("d1", NOW);
    const [device] = await listDevices();
    expect(device!.revoked).toBe(true);
  });

  it("a revoked device is excluded from the active list", async () => {
    await saveDevice(phone());
    await saveDevice(phone({ id: "d2", label: "iPhone", platform: "ios" }));
    await revokeDevice("d1", NOW);

    expect((await activeDevices()).map((device) => device.id)).toEqual(["d2"]);
    // The tombstone is still listed, so the refusal is visible and auditable.
    expect(await listDevices()).toHaveLength(2);
  });

  /**
   * A lost phone must not be able to restore its own trust by pairing again
   * under the same identity — and the check reads the account, so it holds on a
   * device that has never seen the revocation.
   */
  it("REFUSES to re-pair a revoked device id", async () => {
    await saveDevice(phone());
    await revokeDevice("d1", NOW);

    const retry = await saveDevice(phone());
    expect(retry.ok).toBe(false);
    if (retry.ok) throw new Error("unreachable");
    expect(retry.reason).toMatch(/revoked/i);
    expect(await activeDevices()).toHaveLength(0);
  });

  it("forgetting is a deliberate act that allows re-pairing", async () => {
    await saveDevice(phone());
    await revokeDevice("d1", NOW);
    await forgetDevice("d1");

    expect(await listDevices()).toHaveLength(0);
    expect((await saveDevice(phone())).ok).toBe(true);
    expect(await activeDevices()).toHaveLength(1);
  });

  it("revoking an unknown id returns null instead of inventing a row", async () => {
    expect(await revokeDevice("nope")).toBeNull();
    expect(await listDevices()).toHaveLength(0);
  });
});

describe("trust staleness", () => {
  it("a freshly seen device is trusted", async () => {
    await saveDevice(phone());
    expect(isTrusted((await listDevices())[0]!, NOW)).toBe(true);
  });

  it("touch refreshes last-seen so an active device stays trusted", async () => {
    await saveDevice(phone({ lastSeenAt: new Date(NOW.getTime() - TRUST_STALE_MS - 1000) }));
    expect(isTrusted((await listDevices())[0]!, NOW)).toBe(false);

    await touchDevice("d1", NOW);
    expect(isTrusted((await listDevices())[0]!, NOW)).toBe(true);
  });

  it("touch NEVER resurrects a revoked device", async () => {
    /*
     * The filter is `revoked_at IS NULL` on the update itself, not a read
     * followed by a decision: a revoked phone that keeps sending heartbeats
     * must not be able to refresh its own trust between the two.
     */
    await saveDevice(phone({ lastSeenAt: new Date(NOW.getTime() - TRUST_STALE_MS - 1000) }));
    await revokeDevice("d1", NOW);
    await touchDevice("d1", NOW);
    const [device] = await listDevices();
    expect(device!.revoked).toBe(true);
    expect(device!.lastSeenAt.getTime()).toBe(NOW.getTime() - TRUST_STALE_MS - 1000);
    expect(await activeDevices()).toHaveLength(0);
  });
});

describe("an unreachable account is never reported as success", () => {
  it("lists NOTHING rather than a remembered set", async () => {
    /*
     * Failing closed is the only safe answer: the list decides what may act,
     * and a stale copy is exactly how a revoked phone keeps working.
     */
    await saveDevice(phone());
    store.failNext();
    expect(await listDevices()).toEqual([]);
  });

  it("does not claim a device was paired", async () => {
    store.failNext();
    const result = await saveDevice(phone());
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toMatch(/could not be paired/i);
    expect(result.reason).toMatch(/Nothing was changed/i);
  });

  it("does not claim a device was revoked", async () => {
    await saveDevice(phone());
    store.failNext();
    expect(await revokeDevice("d1", NOW)).toBeNull();
    // And the device is genuinely still able to act, which is what the null says.
    expect(await activeDevices()).toHaveLength(1);
  });
});

describe("clearing", () => {
  it("removes every device for the signed-in account on request", async () => {
    await saveDevice(phone());
    await saveDevice(phone({ id: "d2", label: "iPhone", platform: "ios" }));
    await clearDevices();
    expect(await listDevices()).toHaveLength(0);
  });

  it("does nothing when nobody is signed in", async () => {
    // Signing out must never unpair somebody's phones, so this has to be a
    // no-op rather than an unscoped delete.
    await saveDevice(phone());
    store.signedInAs(null);
    await clearDevices();
    store.signedInAs("user-1");
    expect(await listDevices()).toHaveLength(1);
  });
});

describe("signing out leaves the account's devices alone", () => {
  it("the root layout clears held state, not the registry", async () => {
    /*
     * `clearDevices()` was called on SIGNED_OUT while devices lived in this
     * browser. Once they live in the account that call unpairs every phone the
     * person owns — so the sign-out path is pinned here rather than left to be
     * rediscovered.
     */
    const { readFileSync } = await import("node:fs");
    const root = readFileSync("src/routes/__root.tsx", "utf8");
    const signedOut = root.slice(root.indexOf('if (event === "SIGNED_OUT")'));
    const block = signedOut.slice(0, signedOut.indexOf("router.invalidate()"));
    expect(block, "signing out deletes the account's paired devices").not.toContain(
      "module.clearDevices()",
    );
    expect(block).toContain("forgetAllQueues");
    expect(block).toContain("forgetAllUnsyncedTurns");
  });
});

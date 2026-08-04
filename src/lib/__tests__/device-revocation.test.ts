import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * DEVICE REVOCATION MUST SURVIVE A RECONNECT (spec §8.1 device revocation,
 * §9.3 revocation, §8.3 device management, §19.7 "revoked devices cannot
 * mutate").
 *
 * `registerDeviceForCurrentSession` previously wrote `revoked_at: null` on
 * every reconnect of a known device. Revoking a lost or stolen device was
 * therefore undone the moment that device loaded the app again — the user
 * revokes it, whoever holds it reloads, and it silently comes back.
 *
 * These tests assert on the WRITES the module issues, so they fail if the
 * un-revoking update is ever reintroduced.
 */

interface Write {
  table: string;
  op: "update" | "insert";
  values: Record<string, unknown>;
}

const writes: Write[] = [];
/** The row `.maybeSingle()` resolves to; null means "no existing device". */
let existingRow: { id: string; revoked_at: string | null } | null = null;

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.eq = self;
    chain.order = self;
    chain.maybeSingle = () => Promise.resolve({ data: existingRow });
    chain.update = (values: Record<string, unknown>) => {
      writes.push({ table, op: "update", values });
      return chain;
    };
    chain.insert = (values: Record<string, unknown>) => {
      writes.push({ table, op: "insert", values });
      return Promise.resolve({ error: null });
    };
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }) },
    },
  };
});

vi.mock("../browser-install-id", () => ({
  getBrowserInstallId: () => "install-abcdef123456",
  guessDeviceKind: () => "desktop" as const,
  browserLabel: () => "Test Browser",
}));

const { registerDeviceForCurrentSession, revokeDevice } = await import("../devices");

beforeEach(() => {
  writes.length = 0;
  existingRow = null;
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { userAgent: "test-agent" });
});

describe("device registration and revocation", () => {
  it("registers a brand-new device", async () => {
    existingRow = null;
    await registerDeviceForCurrentSession();

    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("insert");
    // A newly inserted device is not revoked; it must not carry a revocation field.
    expect(writes[0].values).not.toHaveProperty("revoked_at");
  });

  it("refreshes activity for a known, NOT-revoked device", async () => {
    existingRow = { id: "device-1", revoked_at: null };
    await registerDeviceForCurrentSession();

    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("update");
    expect(writes[0].values).toHaveProperty("last_active_at");
    // Even here it must not touch revocation state.
    expect(writes[0].values).not.toHaveProperty("revoked_at");
  });

  it("does NOT un-revoke a revoked device that reconnects", async () => {
    existingRow = { id: "device-1", revoked_at: "2026-07-20T10:00:00.000Z" };
    await registerDeviceForCurrentSession();

    // The critical assertion: nothing is written at all, so the revocation
    // timestamp the user created survives untouched.
    expect(writes).toHaveLength(0);
  });

  it("does not un-revoke across repeated reconnect attempts", async () => {
    existingRow = { id: "device-1", revoked_at: "2026-07-20T10:00:00.000Z" };
    await registerDeviceForCurrentSession();
    await registerDeviceForCurrentSession();
    await registerDeviceForCurrentSession();

    expect(writes).toHaveLength(0);
    expect(writes.some((w) => "revoked_at" in w.values && w.values.revoked_at === null)).toBe(
      false,
    );
  });

  it("revokeDevice writes a revocation timestamp", async () => {
    await revokeDevice("device-1");

    expect(writes).toHaveLength(1);
    expect(writes[0].op).toBe("update");
    expect(typeof writes[0].values.revoked_at).toBe("string");
  });

  it("revoking then reconnecting leaves the device revoked (end to end)", async () => {
    await revokeDevice("device-1");
    const revokedAt = writes[0].values.revoked_at as string;
    writes.length = 0;

    // The revoked device comes back and tries to register again.
    existingRow = { id: "device-1", revoked_at: revokedAt };
    await registerDeviceForCurrentSession();

    expect(writes).toHaveLength(0);
  });
});

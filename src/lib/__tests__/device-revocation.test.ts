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
 * Identity now lives in `browser_grants.browser_install_id` rather than the
 * mutable device name, and revocation is a single atomic RPC. These tests
 * assert on the WRITES and the RPC the module issues, so they fail if the
 * un-revoking update — or a non-atomic two-table revoke — is reintroduced.
 */

interface Write {
  table: string;
  op: "update" | "insert" | "delete";
  values: Record<string, unknown>;
}

const writes: Write[] = [];
const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];

/** Rows the fake client resolves for each read. */
let grantRows: Array<{
  id: string;
  device_id: string;
  revoked_at: string | null;
  created_at: string;
}> = [];
let deviceRow: { id: string; revoked_at: string | null } | null = null;
let legacyDeviceRow: { id: string; revoked_at: string | null } | null = null;
/** revoke_device_for_current_user's return value. */
let rpcResult: boolean | null = true;

vi.mock("@/integrations/supabase/client", () => {
  const builder = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = self;
    chain.eq = self;
    chain.order = self;
    chain.limit = self;
    // devices is read twice: by grant device_id, and on the legacy name path.
    chain.maybeSingle = () =>
      Promise.resolve({ data: grantRows.length > 0 ? deviceRow : legacyDeviceRow, error: null });
    chain.single = () => Promise.resolve({ data: { id: "device-new" }, error: null });
    chain.update = (values: Record<string, unknown>) => {
      writes.push({ table, op: "update", values });
      return chain;
    };
    chain.insert = (values: Record<string, unknown>) => {
      writes.push({ table, op: "insert", values });
      return chain;
    };
    chain.delete = () => {
      writes.push({ table, op: "delete", values: {} });
      return chain;
    };
    // A read that ends without maybeSingle()/single() resolves to the rows.
    chain.then = (resolve: (value: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: table === "browser_grants" ? grantRows : [], error: null }));
    return chain;
  };
  return {
    supabase: {
      from: (table: string) => builder(table),
      rpc: (fn: string, args: Record<string, unknown>) => {
        rpcCalls.push({ fn, args });
        return Promise.resolve({ data: rpcResult, error: null });
      },
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1" } }, error: null }) },
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
  rpcCalls.length = 0;
  grantRows = [];
  deviceRow = null;
  legacyDeviceRow = null;
  rpcResult = true;
  vi.stubGlobal("window", { location: { origin: "https://example.test" } });
  vi.stubGlobal("navigator", { userAgent: "test-agent" });
});

const grant = (revokedAt: string | null) => [
  { id: "grant-1", device_id: "device-1", revoked_at: revokedAt, created_at: "2026-07-01" },
];

describe("device registration and revocation", () => {
  it("registers a brand-new device", async () => {
    await registerDeviceForCurrentSession();

    const deviceInsert = writes.find((w) => w.table === "devices" && w.op === "insert");
    expect(deviceInsert).toBeDefined();
    // A newly inserted device is not revoked; it must not carry a revocation field.
    expect(deviceInsert!.values).not.toHaveProperty("revoked_at");
    // Its stable browser identity is recorded in the same registration.
    expect(writes.some((w) => w.table === "browser_grants" && w.op === "insert")).toBe(true);
  });

  it("refreshes activity for a known, NOT-revoked device", async () => {
    grantRows = grant(null);
    deviceRow = { id: "device-1", revoked_at: null };
    await registerDeviceForCurrentSession();

    const deviceUpdate = writes.find((w) => w.table === "devices" && w.op === "update");
    expect(deviceUpdate).toBeDefined();
    expect(deviceUpdate!.values).toHaveProperty("last_active_at");
    // Even here it must not touch revocation state.
    expect(deviceUpdate!.values).not.toHaveProperty("revoked_at");
  });

  it("does NOT un-revoke a revoked device that reconnects", async () => {
    grantRows = grant("2026-07-20T10:00:00.000Z");
    deviceRow = { id: "device-1", revoked_at: "2026-07-20T10:00:00.000Z" };
    await registerDeviceForCurrentSession();

    // The critical assertion: nothing is written at all, so the revocation
    // timestamp the user created survives untouched.
    expect(writes).toHaveLength(0);
  });

  it("does NOT un-revoke when only the device row carries the revocation", async () => {
    // A partial earlier write may have left the grant unstamped; the device row
    // is authoritative.
    grantRows = grant(null);
    deviceRow = { id: "device-1", revoked_at: "2026-07-20T10:00:00.000Z" };
    await registerDeviceForCurrentSession();

    expect(writes).toHaveLength(0);
  });

  it("does not un-revoke across repeated reconnect attempts", async () => {
    grantRows = grant("2026-07-20T10:00:00.000Z");
    deviceRow = { id: "device-1", revoked_at: "2026-07-20T10:00:00.000Z" };
    await registerDeviceForCurrentSession();
    await registerDeviceForCurrentSession();
    await registerDeviceForCurrentSession();

    expect(writes).toHaveLength(0);
    expect(writes.some((w) => "revoked_at" in w.values && w.values.revoked_at === null)).toBe(
      false,
    );
  });

  it("revokeDevice revokes device and grants in one atomic call", async () => {
    const result = await revokeDevice("device-1");

    expect(result.error).toBeUndefined();
    expect(rpcCalls).toEqual([
      { fn: "revoke_device_for_current_user", args: { _device_id: "device-1" } },
    ]);
    // Atomicity matters: no client-side sequential writes may remain.
    expect(writes).toHaveLength(0);
  });

  it("reports a failure when the RPC revoked nothing", async () => {
    rpcResult = false;
    const result = await revokeDevice("device-not-mine");

    expect(result.error).toBeTruthy();
  });

  it("revoking then reconnecting leaves the device revoked (end to end)", async () => {
    await revokeDevice("device-1");
    writes.length = 0;

    // The revoked device comes back and tries to register again.
    grantRows = grant("2026-07-20T10:00:00.000Z");
    deviceRow = { id: "device-1", revoked_at: "2026-07-20T10:00:00.000Z" };
    await registerDeviceForCurrentSession();

    expect(writes).toHaveLength(0);
  });
});

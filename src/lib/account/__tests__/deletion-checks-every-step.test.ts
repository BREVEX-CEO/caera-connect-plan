import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * F26: account deletion discarded every step's `error` and still returned a
 * receipt. F31: Library deletion never acknowledged the tombstone of bytes it
 * had already removed. Both are proven here against a fake service client.
 */

vi.mock("@tanstack/react-start", () => {
  const builder = {
    middleware: () => builder,
    validator: () => builder,
    handler: (fn: unknown) => fn,
  };
  return { createServerFn: () => builder };
});
vi.mock("@/lib/security/assurance-middleware", () => ({
  HIGH_RISK: {},
  requireAssurance: () => ({}),
}));
vi.mock("@/lib/security/sessions.functions", () => ({ callerSessionIsLive: async () => true }));

const failing = new Set<string>();
const deleteUser = vi.fn(async () => ({ error: null }));
const updates: { values: Record<string, unknown>; ids: unknown }[] = [];
let storageError: { message: string } | null = null;
let owed: { id: string; bucket: string; storage_path: string; attempts: number }[] = [];
let admins: { user_id: string }[] = [];

function table(name: string) {
  const chain: Record<string, unknown> = {};
  chain.delete = () => ({
    eq: async () => ({ error: failing.has(name) ? { message: "down" } : null }),
  });
  chain.insert = async () => ({ error: null });
  chain.select = () => {
    const read: Record<string, unknown> = {};
    for (const m of ["eq", "is", "order"]) read[m] = () => read;
    read.limit = async () => {
      const rows = owed;
      owed = [];
      return { data: rows, error: null };
    };
    read.then = (resolve: (v: unknown) => void) =>
      resolve(name === "user_roles" ? { data: admins, error: null } : { count: owed.length });
    return read;
  };
  chain.update = (values: Record<string, unknown>) => ({
    eq: async (_c: string, id: unknown) => (updates.push({ values, ids: id }), { error: null }),
    in: async (_c: string, ids: unknown) => (updates.push({ values, ids }), { error: null }),
  });
  return chain;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: table,
    rpc: async () => ({ data: 2, error: null }),
    auth: { admin: { deleteUser } },
    storage: { from: () => ({ remove: async () => ({ error: storageError }) }) },
  },
}));

const run = async () => {
  const { deleteMyAccount } = await import("../../account.functions");
  const handler = deleteMyAccount as unknown as (input: unknown) => Promise<{
    receipt: { removed: string[] };
  }>;
  return handler({
    data: { confirmation: "DELETE MY ACCOUNT" },
    context: { userId: "u1", claims: {} },
  });
};

beforeEach(() => {
  failing.clear();
  deleteUser.mockClear();
  updates.length = 0;
  storageError = null;
  owed = [];
  admins = [];
});

describe("the last operator", () => {
  it("cannot delete their own account, and nothing is removed", async () => {
    admins = [{ user_id: "u1" }];
    await expect(run()).rejects.toThrow(/only operator/);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("can once another account also operates OCADE", async () => {
    admins = [{ user_id: "u1" }, { user_id: "u2" }];
    await run();
    expect(deleteUser).toHaveBeenCalledOnce();
  });
});

describe("account deletion", () => {
  it("stops before the identity when any step fails, and gives no receipt", async () => {
    failing.add("devices");
    await expect(run()).rejects.toThrow(/stopped after 4 of 7 steps/);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the identity last and returns a receipt when every step succeeded", async () => {
    const result = await run();
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(result.receipt.removed).toContain("library files and images");
  });
});

describe("tombstone sweep", () => {
  it("acknowledges a tombstone only after Storage confirms removal", async () => {
    owed = [{ id: "t1", bucket: "library", storage_path: "u1/a", attempts: 0 }];
    const { sweepTombstones } = await import("../../library/tombstones.server");
    await sweepTombstones("u1");
    expect(updates).toHaveLength(1);
    expect(updates[0]!.values.purged_at).toBeTruthy();
    expect(updates[0]!.ids).toEqual(["t1"]);
  });

  it("keeps a tombstone pending with its error when Storage refuses", async () => {
    owed = [{ id: "t2", bucket: "library", storage_path: "u1/b", attempts: 1 }];
    storageError = { message: "storage unavailable" };
    const { sweepTombstones } = await import("../../library/tombstones.server");
    const result = await sweepTombstones("u1");
    expect(result.pending).toBe(1);
    expect(updates[0]!.values).toEqual({ attempts: 2, last_error: "storage unavailable" });
    expect(updates.some((u) => "purged_at" in u.values)).toBe(false);
  });
});

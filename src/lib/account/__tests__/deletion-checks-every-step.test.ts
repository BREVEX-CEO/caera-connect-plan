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
let owed: {
  id: string;
  bucket: string;
  storage_path: string;
  attempts: number;
  owner_id: string;
}[] = [];
let countError: { message: string } | null = null;
/** What the table still owes after the sweep: retried, and spent (dead letters). */
let backlog = { retried: 0, spent: 0 };
let staffRole: string | null = null;

function table(name: string) {
  const chain: Record<string, unknown> = {};
  chain.delete = () => ({
    eq: async () => ({ error: failing.has(name) ? { message: "down" } : null }),
  });
  chain.insert = async () => ({ error: null });
  chain.select = () => {
    const read: Record<string, unknown> = {};
    let spent = false;
    for (const m of ["eq", "is", "not", "lt", "order"]) read[m] = () => read;
    read.gte = () => ((spent = true), read);
    read.limit = async () => {
      const rows = owed;
      owed = [];
      return { data: rows, error: null };
    };
    read.maybeSingle = async () => ({
      data: name === "ocade_staff" && staffRole ? { role: staffRole } : null,
      error: null,
    });
    read.then = (resolve: (v: unknown) => void) =>
      resolve(
        countError
          ? { count: null, error: countError }
          : { count: spent ? backlog.spent : backlog.retried, error: null },
      );
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
  countError = null;
  backlog = { retried: 0, spent: 0 };
  staffRole = null;
});

describe("the Primary Owner", () => {
  it("cannot delete their own account, and nothing is removed", async () => {
    staffRole = "primary_owner";
    await expect(run()).rejects.toThrow(/Primary Owner/);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("other staff can: their role goes with the account", async () => {
    staffRole = "support";
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
    owed = [{ id: "t1", bucket: "library", storage_path: "u1/a", attempts: 0, owner_id: "u1" }];
    const { sweepTombstones } = await import("../../library/tombstones.server");
    await sweepTombstones("u1");
    expect(updates).toHaveLength(1);
    expect(updates[0]!.values.purged_at).toBeTruthy();
    expect(updates[0]!.ids).toEqual(["t1"]);
  });

  it("keeps a tombstone pending with its error when Storage refuses", async () => {
    owed = [{ id: "t2", bucket: "library", storage_path: "u1/b", attempts: 1, owner_id: "u1" }];
    storageError = { message: "storage unavailable" };
    backlog = { retried: 1, spent: 0 };
    const { sweepTombstones } = await import("../../library/tombstones.server");
    const result = await sweepTombstones("u1");
    expect(result.pending).toBe(1);
    expect(updates[0]!.values).toEqual({ attempts: 2, last_error: "storage unavailable" });
    expect(updates.some((u) => "purged_at" in u.values)).toBe(false);
  });

  it("the scheduled sweep settles an erased account's files and never another folder", async () => {
    owed = [
      { id: "t3", bucket: "library", storage_path: "gone/c", attempts: 3, owner_id: "gone" },
      { id: "t4", bucket: "library", storage_path: "other/d", attempts: 0, owner_id: "gone" },
    ];
    const { sweepTombstones } = await import("../../library/tombstones.server");
    await sweepTombstones(null, 1);
    const closed = updates.find((u) => u.values.last_error === "Not this account's object");
    expect(closed?.ids).toEqual(["t4"]);
    expect(updates.find((u) => u.values.last_error === null)?.ids).toEqual(["t3"]);
  });

  it("reports deletions that spent their attempts, not 'nothing pending' (C15)", async () => {
    owed = [];
    backlog = { retried: 0, spent: 2 };
    const { sweepTombstones } = await import("../../library/tombstones.server");
    expect(await sweepTombstones(null, 1)).toEqual({ pending: 0, deadLetters: 2 });
  });

  it("counts the whole backlog, not the one batch that failed (C15)", async () => {
    owed = [{ id: "t6", bucket: "library", storage_path: "u1/f", attempts: 0, owner_id: "u1" }];
    storageError = { message: "storage unavailable" };
    backlog = { retried: 750, spent: 0 };
    const { sweepTombstones } = await import("../../library/tombstones.server");
    expect((await sweepTombstones("u1")).pending).toBe(750);
  });

  it("reports an uncountable backlog as unknown, never as nothing pending", async () => {
    owed = [{ id: "t5", bucket: "library", storage_path: "u1/e", attempts: 0, owner_id: "u1" }];
    countError = { message: "count failed" };
    const { sweepTombstones } = await import("../../library/tombstones.server");
    expect((await sweepTombstones("u1", 1)).pending).toBe(-1);
  });
});

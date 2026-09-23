import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Which plan an account is on. The audited grant function is the only paid
 * authority; everything else is Free. The database rules are proven against
 * real PostgreSQL in the database suites; this suite proves the decision.
 */

const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => from(table),
    rpc: (name: string, args: unknown) => rpc(name, args),
  },
}));

function chainReturning(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) chain[method] = () => chain;
  chain.maybeSingle = () => Promise.resolve(result);
  return chain;
}

const ACCOUNT = "0b3f2a52-1f4c-4a0f-9a44-2f9a1b0c7d11";
const FAR_FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString();

function answerWith(options: {
  profile?: { data: unknown; error: unknown };
  grant?: { data: unknown; error: unknown };
}) {
  from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return chainReturning(
        options.profile ?? { data: { created_at: "2026-01-01T00:00:00.000Z" }, error: null },
      );
    }
    throw new Error(`the resolver read an unexpected table: ${table}`);
  });
  rpc.mockImplementation(() => Promise.resolve(options.grant ?? { data: null, error: null }));
}

async function resolve() {
  const { resolveTierFor } = await import("../entitlement-resolver");
  return resolveTierFor(ACCOUNT);
}

beforeEach(() => {
  from.mockReset();
  rpc.mockReset();
});

describe("the tier comes from the audited grant authority only", () => {
  it("is Free when there is no grant", async () => {
    answerWith({});
    await expect(resolve()).resolves.toMatchObject({ tier: "free", source: "free_default" });
  });

  it("gives the granted tier", async () => {
    answerWith({ grant: { data: [{ tier: "max", ends_at: FAR_FUTURE }], error: null } });
    await expect(resolve()).resolves.toMatchObject({ tier: "max", source: "admin_grant" });
  });

  it("asks the database which grant counts rather than deciding again here", async () => {
    answerWith({ grant: { data: [{ tier: "pro", ends_at: FAR_FUTURE }], error: null } });
    await resolve();
    expect(rpc).toHaveBeenCalledWith("ocade_active_entitlement_grant", { target_user: ACCOUNT });
  });

  it("ignores a tier the grant table should never hold", async () => {
    answerWith({ grant: { data: [{ tier: "enterprise", ends_at: FAR_FUTURE }], error: null } });
    await expect(resolve()).resolves.toMatchObject({ tier: "free", source: "free_default" });
  });

  it("fails closed to Free when the grant cannot be read", async () => {
    answerWith({ grant: { data: null, error: { message: "connection reset" } } });
    await expect(resolve()).resolves.toMatchObject({ tier: "free", source: "unreadable" });
  });

  it("never reads a retired payment table", async () => {
    answerWith({});
    await resolve();
    expect(from.mock.calls.map(([table]) => table)).toEqual(["profiles"]);
  });
});

describe("the window anchor", () => {
  it("is the account's own creation instant", async () => {
    answerWith({ profile: { data: { created_at: "2026-03-04T09:30:00.000Z" }, error: null } });
    const resolved = await resolve();
    expect(resolved.anchoredAt).toBe(Date.parse("2026-03-04T09:30:00.000Z"));
  });

  it("falls back to the epoch rather than to now, so it cannot be restarted", async () => {
    answerWith({ profile: { data: null, error: { message: "unreadable" } } });
    const resolved = await resolve();
    expect(resolved.anchoredAt).toBe(0);
  });
});

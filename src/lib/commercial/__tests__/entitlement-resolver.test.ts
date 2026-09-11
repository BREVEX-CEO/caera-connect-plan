import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * WHICH PLAN AN ACCOUNT IS ON — the decision money depends on.
 *
 * THE DEFECT THIS SUITE EXISTS AROUND. The resolver used to read
 * `ocade_subscriptions` while the signature-verified provider webhook wrote
 * `public.subscriptions`. Nothing wrote the table it read, so a customer could
 * complete a real payment, have it verified, recorded and audited — and still
 * be on Free. Phase 19 merged the two, and these are the rules that merge has
 * to keep true.
 *
 * THE CLIENT IS MODELLED, NOT THE DATABASE. What is under test is the DECISION:
 * which of two answers wins, what an expired period grants, what a failed read
 * grants. The policies and the grant function are proven against real
 * PostgreSQL in the migration's verification and in `db-twin.test.ts`; asking
 * this suite to stand up a database would make it slow enough to be skipped.
 */

const from = vi.fn();
const rpc = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => from(table),
    rpc: (name: string, args: unknown) => rpc(name, args),
  },
}));

/** A PostgREST chain that ends in `maybeSingle`, however it is narrowed. */
function chainReturning(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    chain[method] = () => chain;
  }
  chain.maybeSingle = () => Promise.resolve(result);
  return chain;
}

const ACCOUNT = "0b3f2a52-1f4c-4a0f-9a44-2f9a1b0c7d11";
const FAR_FUTURE = new Date(Date.now() + 30 * 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();

/** The three reads the resolver makes, in the order it makes them. */
function answerWith(options: {
  profile?: { data: unknown; error: unknown };
  subscription?: { data: unknown; error: unknown };
  grant?: { data: unknown; error: unknown };
}) {
  from.mockImplementation((table: string) => {
    if (table === "profiles") {
      return chainReturning(
        options.profile ?? { data: { created_at: "2026-01-01T00:00:00.000Z" }, error: null },
      );
    }
    if (table === "subscriptions") {
      return chainReturning(options.subscription ?? { data: null, error: null });
    }
    throw new Error(`the resolver read an unexpected table: ${table}`);
  });
  rpc.mockImplementation(() => Promise.resolve(options.grant ?? { data: null, error: null }));
}

async function resolve() {
  const { resolveTierFor } = await import("../entitlement-resolver");
  return resolveTierFor(ACCOUNT);
}

/** A price id the current catalogue actually sells. */
async function sellablePriceId(): Promise<string> {
  const { SELLABLE_PLANS } = await import("@/lib/payments/paddle-plans");
  const pro = SELLABLE_PLANS.find((plan) => plan.planId === "pro_monthly");
  if (!pro) throw new Error("the catalogue no longer sells pro_monthly");
  return pro.priceId;
}

beforeEach(() => {
  from.mockReset();
  rpc.mockReset();
});

describe("the tier comes from rows the account cannot write", () => {
  it("is Free when there is no subscription and no grant", async () => {
    answerWith({});
    await expect(resolve()).resolves.toMatchObject({ tier: "free", source: "free_default" });
  });

  it("reads the table the provider webhook writes, and no other", async () => {
    answerWith({
      subscription: {
        data: {
          price_id: await sellablePriceId(),
          status: "active",
          current_period_end: FAR_FUTURE,
        },
        error: null,
      },
    });
    const resolved = await resolve();
    expect(resolved).toMatchObject({ tier: "pro", source: "provider_subscription" });
    expect(from.mock.calls.map(([table]) => table)).toContain("subscriptions");
    expect(from.mock.calls.map(([table]) => table)).not.toContain("ocade_subscriptions");
  });

  it("grants nothing for a period that has already ended, whatever the status says", async () => {
    /*
     * The status is the provider's last word, and the last word can be stale: a
     * cancellation webhook that never arrived leaves `active` next to a date in
     * the past.
     */
    answerWith({
      subscription: {
        data: { price_id: await sellablePriceId(), status: "active", current_period_end: PAST },
        error: null,
      },
    });
    await expect(resolve()).resolves.toMatchObject({ tier: "free", source: "expired" });
  });

  it("grants nothing for a price the current catalogue does not sell", async () => {
    answerWith({
      subscription: {
        data: {
          price_id: "pri_retired_catalogue",
          status: "active",
          current_period_end: FAR_FUTURE,
        },
        error: null,
      },
    });
    await expect(resolve()).resolves.toMatchObject({ tier: "free", source: "expired" });
  });

  it("falls to Free when the subscription cannot be read at all", async () => {
    // Fail-closed: somebody who paid is briefly limited and can say so, rather
    // than somebody who did not pay being silently given ten times the
    // allowance.
    answerWith({ subscription: { data: null, error: { message: "connection reset" } } });
    await expect(resolve()).resolves.toMatchObject({ tier: "free", source: "unreadable" });
  });
});

describe("an audited grant is resolved separately, and the stronger answer wins", () => {
  it("gives the granted tier when there is no subscription", async () => {
    answerWith({ grant: { data: [{ tier: "max", ends_at: FAR_FUTURE }], error: null } });
    await expect(resolve()).resolves.toMatchObject({ tier: "max", source: "admin_grant" });
  });

  it("keeps Max for somebody who paid for Pro and was granted Max", async () => {
    answerWith({
      subscription: {
        data: {
          price_id: await sellablePriceId(),
          status: "active",
          current_period_end: FAR_FUTURE,
        },
        error: null,
      },
      grant: { data: [{ tier: "max", ends_at: FAR_FUTURE }], error: null },
    });
    const resolved = await resolve();
    expect(resolved.tier).toBe("max");
    expect(resolved.source).toBe("admin_grant");
  });

  it("keeps the paid tier when the grant is weaker, rather than quietly demoting", async () => {
    answerWith({
      subscription: {
        data: {
          price_id: await sellablePriceId(),
          status: "active",
          current_period_end: FAR_FUTURE,
        },
        error: null,
      },
      grant: { data: [{ tier: "pro", ends_at: FAR_FUTURE }], error: null },
    });
    await expect(resolve()).resolves.toMatchObject({
      tier: "pro",
      source: "provider_subscription",
    });
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

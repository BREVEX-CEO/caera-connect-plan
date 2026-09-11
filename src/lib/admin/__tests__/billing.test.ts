import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

/**
 * THE BILLING CONSOLE'S READS, AND THE ONE THING IT MAY WRITE.
 *
 * PLAN.md §G asks for "a billing and seat overview and payment-event state",
 * and §H adds the grants. The rules worth holding are not about rendering:
 *
 *   ONE SUBSCRIPTION AUTHORITY. This screen must read the table the provider
 *   webhook writes. Pointing it at the archived one would put an operator's
 *   answer and the customer's actual entitlement back into disagreement, which
 *   is the whole defect Phase 19 closed.
 *
 *   NO WRITE PATH TO MONEY. There is no control on this screen that creates or
 *   edits a subscription, an invoice or a payment event. An operator who could
 *   do that could manufacture a record that looks like money arriving.
 *
 *   EVERY READ BOUNDED. These tables grow with use, and a read with no cap is
 *   one that works until the deployment gets busy.
 */

const table = vi.fn();
const rpc = vi.fn();

vi.mock("@/integrations/supabase/on-demand", () => ({
  loadSupabaseClient: async () => ({
    from: (name: string) => table(name),
    rpc: (name: string) => rpc(name),
  }),
}));

/** A PostgREST read chain that records the cap it was given. */
function reader(rows: unknown[], capture: { limit?: number }) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.order = () => chain;
  chain.limit = (value: number) => {
    capture.limit = value;
    return Promise.resolve({ data: rows, error: null });
  };
  return chain;
}

beforeEach(() => {
  table.mockReset();
  rpc.mockReset();
});

describe("what the billing console reads", () => {
  it("reads the subscription table the provider webhook writes", async () => {
    const capture: { limit?: number } = {};
    table.mockImplementation(() => reader([], capture));
    const { loadSubscriptions, BILLING_LIMITS } = await import("../billing");
    await loadSubscriptions();
    expect(table).toHaveBeenCalledWith("subscriptions");
    expect(capture.limit).toBe(BILLING_LIMITS.subscriptions);
  });

  it("resolves a price to its plan, and says nothing about one the catalogue retired", async () => {
    const { SELLABLE_PLANS } = await import("@/lib/payments/paddle-plans");
    const pro = SELLABLE_PLANS.find((plan) => plan.planId === "pro_monthly")!;
    const capture: { limit?: number } = {};
    table.mockImplementation(() =>
      reader(
        [
          {
            id: "s1",
            user_id: "u1",
            price_id: pro.priceId,
            status: "active",
            current_period_end: "2026-12-01T00:00:00.000Z",
            cancel_at_period_end: false,
            environment: "sandbox",
            paddle_subscription_id: "sub_1",
          },
          {
            id: "s2",
            user_id: "u2",
            price_id: "pri_from_a_retired_catalogue",
            status: "active",
            current_period_end: null,
            cancel_at_period_end: false,
            environment: "sandbox",
            paddle_subscription_id: "sub_2",
          },
        ],
        capture,
      ),
    );
    const { loadSubscriptions } = await import("../billing");
    const { rows } = await loadSubscriptions();
    const { planById } = await import("@/lib/payments/pricing");
    expect(rows[0]).toMatchObject({
      tier: "pro",
      planName: planById(pro.planId)!.name,
    });
    // A guessed tier would say something false about what somebody bought.
    expect(rows[1]).toMatchObject({ tier: null, planName: null });
  });

  it("marks a grant live only while it has started, not ended and not been revoked", async () => {
    const capture: { limit?: number } = {};
    const soon = new Date(Date.now() + 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    table.mockImplementation(() =>
      reader(
        [
          {
            id: "g1",
            user_id: "u",
            granted_by: "a",
            tier: "pro",
            reason: "a stated reason",
            starts_at: past,
            ends_at: soon,
            revoked_at: null,
            revoked_reason: null,
          },
          {
            id: "g2",
            user_id: "u",
            granted_by: "a",
            tier: "pro",
            reason: "a stated reason",
            starts_at: past,
            ends_at: past,
            revoked_at: null,
            revoked_reason: null,
          },
          {
            id: "g3",
            user_id: "u",
            granted_by: "a",
            tier: "max",
            reason: "a stated reason",
            starts_at: past,
            ends_at: soon,
            revoked_at: past,
            revoked_reason: "given in error",
          },
        ],
        capture,
      ),
    );
    const { loadGrants } = await import("../billing");
    const { rows } = await loadGrants();
    expect(rows.map((row) => row.active)).toEqual([true, false, false]);
    // A revoked grant stays in the list: the record that access WAS given is
    // the half a dispute actually needs.
    expect(rows).toHaveLength(3);
  });

  it("caps every read it makes", async () => {
    const { BILLING_LIMITS, loadInvoices, loadPaymentEvents } = await import("../billing");
    for (const [load, cap] of [
      [loadPaymentEvents, BILLING_LIMITS.paymentEvents],
      [loadInvoices, BILLING_LIMITS.invoices],
    ] as const) {
      const capture: { limit?: number } = {};
      table.mockImplementation(() => reader([], capture));
      await load();
      expect(capture.limit).toBe(cap);
    }
  });

  it("asks the aggregate for seats rather than reading membership rows", async () => {
    rpc.mockImplementation(() => Promise.resolve({ data: [], error: null }));
    const { loadSeats } = await import("../billing");
    await loadSeats();
    expect(rpc).toHaveBeenCalledWith("ocade_admin_seat_overview");
    expect(table).not.toHaveBeenCalledWith("ocade_organization_members");
  });
});

describe("what the billing console may write", () => {
  const source = readFileSync("src/routes/_authenticated/admin.billing.tsx", "utf8");
  const module = readFileSync("src/lib/admin/billing.ts", "utf8");

  it("never writes a subscription, an invoice or a payment event", () => {
    for (const forbidden of [/\.insert\(/, /\.update\(/, /\.upsert\(/, /\.delete\(/]) {
      expect(source).not.toMatch(forbidden);
      expect(module).not.toMatch(forbidden);
    }
  });

  it("makes and revokes a grant only through the audited functions", () => {
    expect(source).toContain('rpc("ocade_grant_entitlement"');
    expect(source).toContain('rpc("ocade_revoke_entitlement"');
  });

  it("grants against the account's immutable id, using an email only to find it", () => {
    expect(source).toContain("target_user: request.userId");
    // The lookup reads the profile; it is not what the grant is made against.
    expect(source).toMatch(/from\("profiles"\)[\s\S]{0,200}\.eq\("email"/);
  });

  it("reads the one subscription authority and never the archived table", () => {
    expect(module).toContain('.from("subscriptions")');
    expect(module).not.toContain('.from("ocade_subscriptions")');
    expect(module).not.toContain('.from("ocade_retired_subscriptions")');
  });
});

describe("the grant form refuses before a round trip what the database refuses after one", () => {
  const request = {
    userId: "0b3f2a52-1f4c-4a0f-9a44-2f9a1b0c7d11",
    tier: "pro" as const,
    reason: "covering an outage on a paid account",
    days: 30,
  };

  it("accepts a complete request", async () => {
    const { grantRequestProblem } = await import("../billing");
    expect(grantRequestProblem(request)).toBeNull();
  });

  it("refuses a reason nobody could read back", async () => {
    const { grantRequestProblem } = await import("../billing");
    expect(grantRequestProblem({ ...request, reason: "x" })).toMatch(/at least 10 characters/i);
  });

  it("refuses a target that is not an account id", async () => {
    const { grantRequestProblem } = await import("../billing");
    expect(grantRequestProblem({ ...request, userId: "person@example.com" })).toMatch(
      /immutable id/i,
    );
  });

  it("refuses a window the database's own constraint would reject", async () => {
    const { grantRequestProblem, GRANT_MAX_DAYS } = await import("../billing");
    expect(grantRequestProblem({ ...request, days: 0 })).toMatch(/between 1 and/);
    expect(grantRequestProblem({ ...request, days: GRANT_MAX_DAYS + 1 })).toMatch(/between 1 and/);
  });
});

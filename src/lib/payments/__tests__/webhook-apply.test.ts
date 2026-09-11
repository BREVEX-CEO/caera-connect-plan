/**
 * WHAT A PROVIDER EVENT MAY AND MAY NOT DO.
 *
 * Every test here is a payment incident. The one that mattered most is the
 * first: OCADE listed an 8-day one-time pass for sale, and the webhook had no
 * handler for the event a one-time purchase arrives on. A customer could pay
 * and receive nothing, with /checkout/success — which correctly refuses to
 * believe the browser — telling them "pending" forever.
 */
import { describe, expect, it } from "vitest";
import { decide, grantsAccessAt, type VerifiedEventEnvelope } from "../webhook-apply";
import { SELLABLE_PLANS } from "../paddle-plans";

const T0 = "2026-03-01T12:00:00.000Z";
const T1 = "2026-03-01T13:00:00.000Z";

function envelope(over: Partial<VerifiedEventEnvelope> = {}): VerifiedEventEnvelope {
  return {
    eventId: "evt_1",
    eventType: "subscription.created",
    occurredAt: T1,
    environment: "sandbox",
    data: {},
    ...over,
  };
}

/**
 * Catalogue items as the provider sends them.
 *
 * Both cadences of one tier share a PRODUCT and differ by PRICE, which is why
 * the handler resolves plans by price id — resolving by product would make a
 * weekly purchase indistinguishable from a monthly one, and the amount charged
 * is the difference.
 */
const weeklyItem = {
  price: { import_meta: { external_id: "ocade_pro_weekly" } },
  product: { import_meta: { external_id: "ocade_pro" } },
};
const monthlyItem = {
  price: { import_meta: { external_id: "ocade_pro_monthly" } },
  product: { import_meta: { external_id: "ocade_pro" } },
};

function completedTransaction(over: Record<string, unknown> = {}) {
  return envelope({
    eventType: "transaction.completed",
    data: {
      id: "txn_abc",
      customer_id: "ctm_1",
      custom_data: { userId: "user-1" },
      items: [monthlyItem],
      billed_at: T0,
      ...over,
    },
  });
}

describe("a completed transaction never grants an entitlement by itself", () => {
  /*
   * THE ONE-TIME PASS IS RETIRED. Every plan in the catalogue is a
   * subscription, and a subscription grants its entitlement through the
   * `subscription.*` events — which carry the period, the status and the
   * cancellation state that a transaction does not.
   *
   * This matters beyond tidiness. Paddle fires `transaction.completed` for
   * every renewal of every subscription, so a path that granted access here
   * would write a second, overlapping entitlement each billing period. And a
   * grant driven by a bare transaction is precisely the shape a forged or
   * replayed purchase would take.
   *
   * So the case is explicit and refuses, rather than being deleted and falling
   * through to a default: a future one-time plan has to be implemented
   * deliberately instead of inherited.
   */
  it("ignores a renewal's transaction rather than granting a second period", () => {
    expect(decide(completedTransaction({ items: [monthlyItem] }), null)).toEqual({
      action: "ignore",
      reason: "subscription_transaction",
    });
  });

  it("ignores a transaction for an item the catalogue does not know", () => {
    const unknown = completedTransaction({
      items: [
        {
          price: { import_meta: { external_id: "ocade_unknown_once" } },
          product: { import_meta: { external_id: "ocade_unknown" } },
        },
      ],
    });
    expect(decide(unknown, null)).toEqual({
      action: "ignore",
      reason: "unknown_catalogue_item",
    });
  });

  it("ignores a transaction carrying no catalogue item at all", () => {
    expect(decide(completedTransaction({ items: [] }), null)).toEqual({
      action: "ignore",
      reason: "unknown_catalogue_item",
    });
  });

  it("never upserts from transaction.completed, whatever the payload says", () => {
    /*
     * The property, not the cases. Any transaction — a known plan, an unknown
     * one, one carrying a user id, one carrying a subscription id — must end in
     * `ignore`, so no payload shape can be found that opens a grant.
     */
    for (const over of [
      {},
      { items: [monthlyItem] },
      { custom_data: {} },
      { subscription_id: "sub_1" },
      { items: [{ price: {}, product: {} }] },
    ]) {
      expect(decide(completedTransaction(over), null).action, JSON.stringify(over)).toBe("ignore");
    }
  });

  it("tells the two cadences of one tier apart, because the price differs", () => {
    /*
     * Pro weekly and Pro monthly share a provider PRODUCT. If the handler ever
     * resolves by product, both subscriptions record the same plan and one of
     * the two prices is silently attributed to the wrong one.
     */
    const rows = [weeklyItem, monthlyItem].map((item) => {
      const result = decide(
        envelope({
          eventType: "subscription.created",
          data: {
            id: `sub_${item.price.import_meta.external_id}`,
            customer_id: "ctm_1",
            custom_data: { userId: "user-1" },
            status: "active",
            items: [item],
          },
        }),
        null,
      );
      if (result.action !== "upsert") throw new Error("expected an upsert");
      return result.row;
    });
    expect(rows[0]!.price_id).toBe("ocade_pro_weekly");
    expect(rows[1]!.price_id).toBe("ocade_pro_monthly");
    expect(rows[0]!.product_id).toBe(rows[1]!.product_id);
    expect(rows[0]!.price_id).not.toBe(rows[1]!.price_id);
  });

  it("sells no one-time plan at all", () => {
    // The catalogue and the handler agree: if this ever fails, the handler
    // above silently stopped delivering something that is on sale.
    expect(SELLABLE_PLANS.filter((plan) => (plan.cadence as string) === "one-time")).toEqual([]);
    for (const plan of SELLABLE_PLANS) {
      expect(["weekly", "monthly"]).toContain(plan.cadence);
    }
  });
});

describe("a delayed or repeated delivery changes nothing", () => {
  const existing = {
    paddleSubscriptionId: "sub_1",
    status: "active",
    providerEventAt: T1,
    environment: "sandbox",
  };

  it("ignores an event older than the last one applied", () => {
    const stale = envelope({
      eventType: "subscription.updated",
      occurredAt: T0,
      data: { id: "sub_1", status: "active" },
    });
    expect(decide(stale, existing)).toEqual({ action: "ignore", reason: "stale_event" });
  });

  it("applies an event with the same timestamp, leaving de-duplication to the event id", () => {
    const same = envelope({
      eventType: "subscription.updated",
      occurredAt: T1,
      data: { id: "sub_1", status: "past_due" },
    });
    expect(decide(same, existing).action).toBe("update");
  });

  it("records the provider's timestamp on every write, so the next event can be ordered", () => {
    const update = decide(
      envelope({
        eventType: "subscription.updated",
        occurredAt: T1,
        data: { id: "sub_1", status: "active" },
      }),
      existing,
    );
    if (update.action !== "update") throw new Error("no");
    expect(update.patch.provider_event_at).toBe(T1);
  });
});

describe("money that went back stays back", () => {
  for (const terminal of ["canceled", "refunded", "charged_back"]) {
    it(`will not reopen a ${terminal} subscription with a late update`, () => {
      const late = envelope({
        eventType: "subscription.updated",
        occurredAt: "2027-01-01T00:00:00.000Z",
        data: { id: "sub_1", status: "active" },
      });
      expect(
        decide(late, {
          paddleSubscriptionId: "sub_1",
          status: terminal,
          providerEventAt: T1,
          environment: "sandbox",
        }),
      ).toEqual({ action: "ignore", reason: "terminal_state" });
    });
  }

  it("still accepts an explicit cancellation, whatever the current state", () => {
    const cancel = envelope({ eventType: "subscription.canceled", data: { id: "sub_1" } });
    const result = decide(cancel, {
      paddleSubscriptionId: "sub_1",
      status: "active",
      providerEventAt: T0,
      environment: "sandbox",
    });
    expect(result.action).toBe("update");
    if (result.action === "update") expect(result.patch.status).toBe("canceled");
  });
});

describe("an upgrade and a downgrade reach the row, not only the audit", () => {
  /*
   * THE TIER IS RESOLVED FROM `price_id`. An update that carried only the
   * period would leave somebody who upgraded to Max paying for Max and using
   * Pro, and somebody who downgraded still holding the larger allowance —
   * money and access disagreeing, with the event recorded as applied.
   */
  const maxItem = {
    price: { import_meta: { external_id: "ocade_max_monthly" } },
    product: { import_meta: { external_id: "ocade_max" } },
  };
  const existing = {
    paddleSubscriptionId: "sub_1",
    status: "active",
    providerEventAt: T0,
    environment: "sandbox",
  };

  function updated(over: Record<string, unknown> = {}) {
    return envelope({
      eventType: "subscription.updated",
      data: {
        id: "sub_1",
        status: "active",
        current_billing_period: { starts_at: T0, ends_at: T1 },
        ...over,
      },
    });
  }

  it("carries the new plan when the event names a different item", () => {
    const result = decide(updated({ items: [maxItem] }), existing);
    expect(result.action).toBe("update");
    if (result.action !== "update") return;
    expect(result.patch.price_id).toBe("ocade_max_monthly");
    expect(result.patch.product_id).toBe("ocade_max");
  });

  it("carries a downgrade the same way, in the other direction", () => {
    const result = decide(updated({ items: [weeklyItem] }), existing);
    if (result.action !== "update") throw new Error("a downgrade was not applied");
    expect(result.patch.price_id).toBe("ocade_pro_weekly");
  });

  it("leaves the plan alone when the event carries no items at all", () => {
    /*
     * Most `subscription.updated` events report a period change and nothing
     * else. Sending the fields as null would blank the plan on the row and
     * resolve a paying account to Free on its next read.
     */
    const result = decide(updated(), existing);
    if (result.action !== "update") throw new Error("a period update was not applied");
    expect(result.patch.price_id).toBeUndefined();
    expect(result.patch.product_id).toBeUndefined();
  });

  it("still refuses to touch a terminal record, plan change or not", () => {
    expect(decide(updated({ items: [maxItem] }), { ...existing, status: "refunded" })).toEqual({
      action: "ignore",
      reason: "terminal_state",
    });
  });
});

describe("provider refund and dispute adjustments", () => {
  const existing = {
    paddleSubscriptionId: "sub_1",
    status: "active",
    providerEventAt: T0,
    environment: "sandbox",
  };

  function adjustment(
    action: string,
    status: string,
    type: "full" | "partial" = "full",
  ): VerifiedEventEnvelope {
    return envelope({
      eventType: "adjustment.updated",
      data: {
        id: "adj_1",
        subscription_id: "sub_1",
        transaction_id: "txn_1",
        action,
        status,
        type,
      },
    });
  }

  it("does not revoke access while a refund is only pending approval", () => {
    expect(decide(adjustment("refund", "pending_approval"), existing)).toEqual({
      action: "ignore",
      reason: "refund_pending_approval",
    });
  });

  it("revokes immediately when a full refund is approved", () => {
    const result = decide(adjustment("refund", "approved"), existing);
    expect(result.action).toBe("update");
    if (result.action === "update") expect(result.patch.status).toBe("refunded");
  });

  it("records but does not erase entitlement for a partial refund", () => {
    expect(decide(adjustment("refund", "approved", "partial"), existing)).toEqual({
      action: "ignore",
      reason: "partial_refund",
    });
  });

  it("suspends access for a chargeback warning and a completed chargeback", () => {
    const warning = decide(adjustment("chargeback_warning", "approved"), existing);
    const chargedBack = decide(adjustment("chargeback", "approved"), existing);
    if (warning.action !== "update" || chargedBack.action !== "update") throw new Error("no");
    expect(warning.patch.status).toBe("disputed");
    expect(chargedBack.patch.status).toBe("charged_back");
  });

  it("restores only an entitlement that an explicit chargeback reversal suspended", () => {
    const reversed = decide(adjustment("chargeback_reverse", "approved"), {
      ...existing,
      status: "charged_back",
    });
    expect(reversed.action).toBe("update");
    if (reversed.action === "update") expect(reversed.patch.status).toBe("active");

    expect(decide(adjustment("chargeback_reverse", "approved"), existing)).toEqual({
      action: "ignore",
      reason: "unexpected_chargeback_reversal",
    });
  });

  it("targets the subscription when present and a one-time transaction otherwise", async () => {
    const { targetEntityIdOf } = await import("../webhook-apply");
    expect(
      targetEntityIdOf("adjustment.created", {
        subscription_id: "sub_1",
        transaction_id: "txn_1",
      }),
    ).toBe("sub_1");
    expect(targetEntityIdOf("adjustment.created", { transaction_id: "txn_1" })).toBe("txn_1");
  });
});

describe("subscription lifecycle events form an explicit state machine", () => {
  const existing = {
    paddleSubscriptionId: "sub_1",
    status: "active",
    providerEventAt: T0,
    environment: "sandbox",
  };

  for (const [eventType, status] of [
    ["subscription.past_due", "past_due"],
    ["subscription.paused", "paused"],
    ["subscription.resumed", "active"],
    ["subscription.activated", "active"],
    ["subscription.trialing", "trialing"],
  ] as const) {
    it(`${eventType} writes ${status}`, () => {
      const result = decide(envelope({ eventType, data: { id: "sub_1" } }), existing);
      expect(result.action).toBe("update");
      if (result.action === "update") expect(result.patch.status).toBe(status);
    });
  }
});

describe("sandbox and live never touch each other", () => {
  it("refuses a live event against a sandbox row", () => {
    const live = envelope({
      environment: "live",
      eventType: "subscription.updated",
      data: { id: "sub_1" },
    });
    expect(
      decide(live, {
        paddleSubscriptionId: "sub_1",
        status: "active",
        providerEventAt: T0,
        environment: "sandbox",
      }),
    ).toEqual({ action: "ignore", reason: "environment_mismatch" });
  });
});

describe("an event OCADE cannot attribute is not applied", () => {
  it("refuses a subscription with no user id, rather than guessing an owner", () => {
    expect(
      decide(
        envelope({
          eventType: "subscription.created",
          data: {
            id: "sub_1",
            customer_id: "ctm_1",
            custom_data: {},
            status: "active",
            items: [monthlyItem],
          },
        }),
        null,
      ),
    ).toEqual({ action: "ignore", reason: "no_user_id" });
  });

  it("stores catalogue ids only, never the provider's environment-specific ones", () => {
    const result = decide(
      envelope({
        eventType: "subscription.created",
        data: {
          id: "sub_1",
          customer_id: "ctm_1",
          custom_data: { userId: "user-1" },
          status: "active",
          items: [
            {
              price: { id: "pri_live_internal", ...monthlyItem.price },
              product: monthlyItem.product,
            },
          ],
        },
      }),
      null,
    );
    if (result.action !== "upsert") throw new Error("no");
    expect(result.row.price_id).toBe("ocade_pro_monthly");
    expect(JSON.stringify(result.row)).not.toContain("pri_live_internal");
  });

  it("refuses a subscription with no catalogue ids at all", () => {
    const result = decide(
      envelope({
        eventType: "subscription.created",
        data: { id: "sub_1", customer_id: "c", custom_data: { userId: "u" }, items: [{}] },
      }),
      null,
    );
    expect(result).toEqual({ action: "ignore", reason: "no_catalogue_ids" });
  });
});

describe("a pass that has run out stops granting access", () => {
  const now = Date.parse("2026-03-09T12:00:00.000Z");

  it("grants access inside the paid period", () => {
    expect(
      grantsAccessAt({ status: "active", current_period_end: "2026-03-10T00:00:00Z" }, now),
    ).toBe(true);
  });

  it("stops the moment the period ends, with no event required", () => {
    expect(
      grantsAccessAt({ status: "active", current_period_end: "2026-03-09T00:00:00Z" }, now),
    ).toBe(false);
  });

  it("never grants access on a refunded or disputed record", () => {
    for (const status of ["refunded", "charged_back", "canceled"]) {
      expect(grantsAccessAt({ status, current_period_end: "2099-01-01T00:00:00Z" }, now)).toBe(
        false,
      );
    }
  });
});

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

const oneTimeItem = {
  price: { import_meta: { external_id: "ocade_std_8d_once" } },
  product: { import_meta: { external_id: "ocade_std_8d" } },
};
const monthlyItem = {
  price: { import_meta: { external_id: "ocade_month_1m_monthly" } },
  product: { import_meta: { external_id: "ocade_month_1m" } },
};

function completedTransaction(over: Record<string, unknown> = {}) {
  return envelope({
    eventType: "transaction.completed",
    data: {
      id: "txn_abc",
      customer_id: "ctm_1",
      custom_data: { userId: "user-1" },
      items: [oneTimeItem],
      billed_at: T0,
      ...over,
    },
  });
}

describe("the one-time pass OCADE sells can actually be delivered", () => {
  it("creates a time-limited entitlement from transaction.completed", () => {
    const result = decide(completedTransaction(), null);
    expect(result.action).toBe("upsert");
    if (result.action !== "upsert") return;
    expect(result.row.user_id).toBe("user-1");
    expect(result.row.kind).toBe("one_time");
    expect(result.row.status).toBe("active");
    expect(result.row.price_id).toBe("ocade_std_8d_once");
  });

  it("ends the pass exactly eight days after it was billed, as the page promises", () => {
    const result = decide(completedTransaction(), null);
    if (result.action !== "upsert") throw new Error("expected an entitlement");
    const start = new Date(result.row.current_period_start!).getTime();
    const end = new Date(result.row.current_period_end!).getTime();
    expect((end - start) / (24 * 60 * 60 * 1000)).toBe(8);
  });

  it("keys the row on the transaction, so a retry grants nothing extra", () => {
    const first = decide(completedTransaction(), null);
    const retry = decide(completedTransaction(), null);
    if (first.action !== "upsert" || retry.action !== "upsert") throw new Error("no");
    expect(retry.row.paddle_subscription_id).toBe(first.row.paddle_subscription_id);
  });

  it("gives a repeat purchase its own entitlement, because that is what buying again means", () => {
    const again = decide(completedTransaction({ id: "txn_def", billed_at: T1 }), null);
    if (again.action !== "upsert") throw new Error("no");
    expect(again.row.paddle_subscription_id).toBe("txn_def");
    expect(again.row.current_period_start).toBe(T1);
  });

  it("does not mistake a subscription renewal's transaction for a purchase", () => {
    const renewal = completedTransaction({ subscription_id: "sub_1", items: [monthlyItem] });
    expect(decide(renewal, null)).toEqual({
      action: "ignore",
      reason: "subscription_transaction",
    });
  });

  it("ignores a completed transaction for a plan that is not one-time", () => {
    const monthly = completedTransaction({ items: [monthlyItem] });
    expect(decide(monthly, null)).toEqual({ action: "ignore", reason: "not_a_one_time_plan" });
  });

  it("refuses to invent a duration for a one-time plan that has none", () => {
    /*
     * The guard that keeps the original defect from returning in a new shape:
     * adding a one-time plan to the catalogue without stating how long it lasts
     * must record nothing rather than granting an arbitrary length.
     */
    const unknown = completedTransaction({
      items: [
        {
          price: { import_meta: { external_id: "ocade_unknown_once" } },
          product: { import_meta: { external_id: "ocade_unknown" } },
        },
      ],
    });
    expect(decide(unknown, null).action).toBe("ignore");
  });

  it("every one-time plan in the sellable catalogue can be delivered", () => {
    for (const plan of SELLABLE_PLANS.filter((p) => p.cadence === "one-time")) {
      const result = decide(
        completedTransaction({
          items: [
            {
              price: { import_meta: { external_id: plan.priceId } },
              product: { import_meta: { external_id: plan.productId } },
            },
          ],
        }),
        null,
      );
      expect(result.action, `${plan.planId} is for sale but produces no entitlement`).toBe(
        "upsert",
      );
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
  it("refuses a purchase with no user id, rather than guessing an owner", () => {
    expect(decide(completedTransaction({ custom_data: {} }), null)).toEqual({
      action: "ignore",
      reason: "no_user_id",
    });
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
    expect(result.row.price_id).toBe("ocade_month_1m_monthly");
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

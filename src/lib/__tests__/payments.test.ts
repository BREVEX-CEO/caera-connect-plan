import { describe, it, expect } from "vitest";
import {
  verifyWebhook,
  signWebhook,
  checkoutAllowed,
  InMemorySeenEvents,
  LIVE_PAYMENTS_ENABLED,
  WEBHOOK_TOLERANCE_SECONDS,
  type PaymentProvider,
} from "../payments/provider";
import {
  applyEvent,
  emptyEntitlement,
  hasAccess,
  describeEntitlement,
  GRACE_DAYS,
  type Entitlement,
} from "../payments/entitlements";
import { PaymentProviderTwin } from "../payments/twin";

const NOW = 1_800_000_000;
const CUST = "cus_alice";
const twin = () => new PaymentProviderTwin({ now: () => NOW });

/** Apply a list of events in the given order, returning the final entitlement. */
function applyAll(events: Parameters<typeof applyEvent>[1][], start?: Entitlement) {
  let e = start ?? emptyEntitlement(CUST);
  for (const ev of events) e = applyEvent(e, ev).entitlement;
  return e;
}

describe("live payments cannot be switched on by accident", () => {
  it("keeps live payments off", () => {
    expect(LIVE_PAYMENTS_ENABLED).toBe(false);
  });

  it("REFUSES checkout from any provider claiming not to be simulated", () => {
    // Swapping in a real adapter must not silently start taking money from an
    // integration that has never been through legal identity or bank checks.
    const fakeReal = { id: "stripe", simulated: false, webhookSecret: "x" } as PaymentProvider;
    const refusal = checkoutAllowed(fakeReal);
    expect(refusal?.ok).toBe(false);
    if (refusal && !refusal.ok) expect(refusal.code).toBe("live_payments_disabled");
  });

  it("allows the twin, which cannot move money", () => {
    expect(checkoutAllowed(twin())).toBeNull();
    expect(twin().simulated).toBe(true);
  });
});

describe("checkout", () => {
  it("creates a checkout for a known plan", async () => {
    const r = await twin().createCheckout({ customerId: CUST, plan: "month_1m", idempotencyKey: "k1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.simulated).toBe(true);
  });

  it("refuses an unknown plan", async () => {
    const r = await twin().createCheckout({
      customerId: CUST,
      plan: "does_not_exist" as never,
      idempotencyKey: "k1",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("unknown_plan");
  });

  it("returns the SAME checkout for a repeated idempotency key", async () => {
    // A double-clicked button must not create two subscriptions.
    const p = twin();
    const a = await p.createCheckout({ customerId: CUST, plan: "month_1m", idempotencyKey: "same" });
    const b = await p.createCheckout({ customerId: CUST, plan: "month_1m", idempotencyKey: "same" });
    expect(a.ok && b.ok && a.checkoutId === b.checkoutId).toBe(true);
  });

  it("reports a provider failure without charging", async () => {
    const p = new PaymentProviderTwin({ now: () => NOW, failCheckout: true });
    const r = await p.createCheckout({ customerId: CUST, plan: "month_1m", idempotencyKey: "k" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Nothing was charged/);
  });
});

describe("webhook verification", () => {
  const seen = () => new InMemorySeenEvents();

  it("accepts a correctly signed, fresh event", async () => {
    const p = twin();
    const { header, payload } = await p.deliver(p.completeCheckout(CUST, "month_1m"));
    const v = await verifyWebhook({
      secret: p.webhookSecret,
      header,
      payload,
      seen: seen(),
      nowSeconds: NOW,
    });
    expect(v.ok).toBe(true);
  });

  it("REFUSES a forged signature", async () => {
    const p = twin();
    const { payload } = await p.deliver(p.completeCheckout(CUST, "month_1m"));
    const forged = await signWebhook("attacker-secret", NOW, payload);
    const v = await verifyWebhook({
      secret: p.webhookSecret,
      header: forged,
      payload,
      seen: seen(),
      nowSeconds: NOW,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.refusal).toBe("bad_signature");
  });

  it("REFUSES a tampered payload even with a once-valid signature", async () => {
    const p = twin();
    const ev = p.completeCheckout(CUST, "trial_2d");
    const { header } = await p.deliver(ev);
    const tampered = JSON.stringify({ ...ev, plan: "year_1y" });
    const v = await verifyWebhook({
      secret: p.webhookSecret,
      header,
      payload: tampered,
      seen: seen(),
      nowSeconds: NOW,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.refusal).toBe("bad_signature");
  });

  it("REFUSES a replayed event captured yesterday", async () => {
    const p = twin();
    const { header, payload } = await p.deliver(p.completeCheckout(CUST, "month_1m"));
    const v = await verifyWebhook({
      secret: p.webhookSecret,
      header,
      payload,
      seen: seen(),
      nowSeconds: NOW + WEBHOOK_TOLERANCE_SECONDS + 60,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.refusal).toBe("stale_timestamp");
  });

  it("REFUSES a future-dated webhook", async () => {
    const p = twin();
    const { header, payload } = await p.deliver(p.completeCheckout(CUST, "month_1m"));
    const v = await verifyWebhook({
      secret: p.webhookSecret,
      header,
      payload,
      seen: seen(),
      nowSeconds: NOW - WEBHOOK_TOLERANCE_SECONDS - 60,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.refusal).toBe("future_timestamp");
  });

  it("REFUSES a duplicate delivery of the same event", async () => {
    const p = twin();
    const s = seen();
    const { header, payload } = await p.deliver(p.completeCheckout(CUST, "month_1m"));
    const first = await verifyWebhook({ secret: p.webhookSecret, header, payload, seen: s, nowSeconds: NOW });
    const second = await verifyWebhook({ secret: p.webhookSecret, header, payload, seen: s, nowSeconds: NOW });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.refusal).toBe("duplicate_event");
  });

  it("does not poison the seen-event set from an UNVERIFIED body", async () => {
    // Signature is checked before parsing. Otherwise an unauthenticated caller
    // could pre-register a real event's id and block it from ever applying.
    const p = twin();
    const real = p.completeCheckout(CUST, "month_1m");
    const s = seen();
    await verifyWebhook({
      secret: p.webhookSecret,
      header: await signWebhook("wrong", NOW, JSON.stringify(real)),
      payload: JSON.stringify(real),
      seen: s,
      nowSeconds: NOW,
    });
    expect(s.has(real.id), "a forged webhook registered a real event id").toBe(false);

    const { header, payload } = await p.deliver(real);
    const v = await verifyWebhook({ secret: p.webhookSecret, header, payload, seen: s, nowSeconds: NOW });
    expect(v.ok, "the real event was blocked by a forged one").toBe(true);
  });

  it("refuses a malformed header and a malformed body", async () => {
    const p = twin();
    const bad = await verifyWebhook({
      secret: p.webhookSecret,
      header: "nonsense",
      payload: "{}",
      seen: seen(),
      nowSeconds: NOW,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.refusal).toBe("malformed");

    const notJson = "not json";
    const v = await verifyWebhook({
      secret: p.webhookSecret,
      header: await signWebhook(p.webhookSecret, NOW, notJson),
      payload: notJson,
      seen: seen(),
      nowSeconds: NOW,
    });
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.refusal).toBe("malformed");
  });
});

describe("entitlement state machine", () => {
  it("grants access after checkout completes", () => {
    const p = twin();
    const e = applyAll([p.completeCheckout(CUST, "month_1m")]);
    expect(e.status).toBe("active");
    expect(hasAccess(e, NOW)).toBe(true);
  });

  it("IGNORES an out-of-order event that would resurrect a cancellation", async () => {
    // The bug this prevents: a renewal delivered late overwriting a later
    // cancellation, giving away access indefinitely.
    const p = twin();
    const renewed = p.renew(CUST, "month_1m");
    await p.cancelSubscription(CUST);
    const cancelled = p.emitted.at(-1)!;

    const inOrder = applyAll([renewed, cancelled]);
    expect(inOrder.status).toBe("cancelled");

    /*
     * A DISTINCT event carrying an older sequence — a retry the provider sends
     * with a fresh id. Re-sending the identical event would be caught by the
     * idempotency check first and would not exercise the ordering guard at all.
     */
    const lateRenewal = { ...renewed, id: "evt_retry_of_renewal" };
    const late = applyEvent(inOrder, lateRenewal);
    expect(late.applied).toBe(false);
    expect(late.reason).toMatch(/stale event/);
    expect(late.entitlement.status).toBe("cancelled");
  });

  it("refuses to apply the same event twice", () => {
    const p = twin();
    const ev = p.completeCheckout(CUST, "month_1m");
    const once = applyEvent(emptyEntitlement(CUST), ev);
    const twice = applyEvent(once.entitlement, ev);
    expect(twice.applied).toBe(false);
    expect(twice.reason).toMatch(/already applied/);
  });

  it("refuses an event belonging to another customer", () => {
    const p = twin();
    const ev = p.completeCheckout("cus_bob", "month_1m");
    const r = applyEvent(emptyEntitlement(CUST), ev);
    expect(r.applied).toBe(false);
  });

  it("keeps access during grace after a failed renewal, then lapses", () => {
    const p = twin();
    const e = applyAll([p.completeCheckout(CUST, "month_1m"), p.failPayment(CUST, "month_1m")]);
    expect(e.status).toBe("grace");
    expect(hasAccess(e, NOW + 86_400)).toBe(true);
    expect(hasAccess(e, NOW + (GRACE_DAYS + 1) * 86_400)).toBe(false);
  });

  it("does NOT extend grace on every retry", () => {
    // A permanently failing card must not buy permanent access.
    const p = new PaymentProviderTwin({ now: () => NOW });
    let e = applyAll([p.completeCheckout(CUST, "month_1m"), p.failPayment(CUST, "month_1m")]);
    const firstGrace = e.graceEndsAt;
    const later = new PaymentProviderTwin({ now: () => NOW + 5 * 86_400 });
    // Reuse the sequence chain by applying a newer failure event.
    const secondFailure = { ...later.failPayment(CUST, "month_1m"), sequence: 99 };
    e = applyEvent(e, secondFailure).entitlement;
    expect(e.graceEndsAt).toBe(firstGrace);
  });

  it("clears grace when a payment finally succeeds", () => {
    const p = twin();
    const e = applyAll([
      p.completeCheckout(CUST, "month_1m"),
      p.failPayment(CUST, "month_1m"),
      p.renew(CUST, "month_1m"),
    ]);
    expect(e.status).toBe("active");
    expect(e.graceEndsAt).toBeNull();
  });

  it("keeps paid time after cancellation, then ends", async () => {
    const p = twin();
    let e = applyAll([p.completeCheckout(CUST, "month_1m")]);
    await p.cancelSubscription(CUST);
    e = applyEvent(e, p.emitted.at(-1)!).entitlement;
    expect(e.status).toBe("cancelled");
    expect(hasAccess(e, NOW + 86_400), "cancelling must not take away paid time").toBe(true);
    expect(hasAccess(e, NOW + 40 * 86_400)).toBe(false);
  });

  it("revokes immediately on refund — no grace", async () => {
    const p = twin();
    const checkout = p.completeCheckout(CUST, "month_1m");
    let e = applyAll([checkout]);
    await p.refund(CUST, checkout.id);
    e = applyEvent(e, p.emitted.at(-1)!).entitlement;
    expect(e.status).toBe("refunded");
    expect(hasAccess(e, NOW)).toBe(false);
  });

  it("refuses to refund a payment that does not exist", async () => {
    const p = twin();
    const r = await p.refund(CUST, "evt_does_not_exist");
    expect(r.ok).toBe(false);
  });

  it("revokes on dispute and stays revoked until the dispute is won", () => {
    const p = twin();
    let e = applyAll([p.completeCheckout(CUST, "month_1m"), p.openDispute(CUST, "month_1m")]);
    expect(hasAccess(e, NOW)).toBe(false);

    // A renewal must not quietly reactivate a disputed subscription.
    const sneaky = applyEvent(e, p.renew(CUST, "month_1m"));
    expect(sneaky.applied).toBe(false);
    expect(sneaky.reason).toMatch(/dispute/i);

    e = applyEvent(e, p.resolveDispute(CUST, "month_1m", true)).entitlement;
    expect(e.status).toBe("active");
    expect(hasAccess(e, NOW)).toBe(true);
  });

  it("applies a dispute outcome even though it arrives out of sequence", () => {
    // Chargeback results arrive long after the events they overturn; refusing
    // them on sequence would leave a lost dispute permanently unapplied.
    const p = twin();
    const e = applyAll([p.completeCheckout(CUST, "month_1m")]);
    const lost = { ...p.resolveDispute(CUST, "month_1m", false), sequence: 0 };
    const r = applyEvent(e, lost);
    expect(r.applied).toBe(true);
    expect(r.entitlement.status).toBe("disputed");
  });
});

describe("what the user is told", () => {
  it("explains grace in days, not status codes", () => {
    const p = twin();
    const e = applyAll([p.completeCheckout(CUST, "month_1m"), p.failPayment(CUST, "month_1m")]);
    const text = describeEntitlement(e, NOW);
    expect(text).toMatch(/Payment failed/);
    expect(text).toMatch(/\d+ more days?/);
    expect(text).not.toMatch(/grace|past_due/);
  });

  it("explains cancellation without implying access already ended", () => {
    const e: Entitlement = {
      ...emptyEntitlement(CUST),
      status: "cancelled",
      periodEndsAt: NOW + 10 * 86_400,
    };
    expect(describeEntitlement(e, NOW)).toMatch(/keep access for 10 more days/);
  });

  it("states plainly when there is no subscription", () => {
    expect(describeEntitlement(emptyEntitlement(CUST), NOW)).toBe("No active subscription.");
  });
});

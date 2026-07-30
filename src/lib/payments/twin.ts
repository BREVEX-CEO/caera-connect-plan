/**
 * HWE-29 — synthetic payment-provider twin (P17).
 *
 * SIMULATED. NO MONEY MOVES. There is no network call, no API key and no live
 * endpoint anywhere in this file. `simulated` is `true` and cannot be set
 * otherwise, so `checkoutAllowed` can never mistake it for a real provider.
 *
 * It exists so checkout, renewal, cancellation, refund, dispute, failed
 * payment and webhook delivery can be exercised end to end without legal
 * identity, a bank account or a provider account — none of which exist.
 *
 * Deterministic on purpose: it mints event ids and sequences from a counter
 * rather than randomness, so a failing test names the same event every run.
 * A twin whose output varies produces evidence nobody can reproduce.
 */
import {
  signWebhook,
  type CheckoutOutcome,
  type CheckoutRequest,
  type PaymentEvent,
  type PaymentEventKind,
  type PaymentProvider,
  type PlanCode,
} from "./provider";

const PLAN_DAYS: Record<PlanCode, number> = {
  trial_2d: 2,
  std_8d: 8,
  month_1m: 30,
  year_1y: 365,
};

export interface TwinOptions {
  /** Fixed clock, so periods and grace windows are reproducible. */
  now?: () => number;
  /** Force checkout to fail, to exercise the refusal path. */
  failCheckout?: boolean;
  webhookSecret?: string;
}

export class PaymentProviderTwin implements PaymentProvider {
  readonly id = "hwe29-payment-twin";
  /** Always true. The checkout guard depends on this being unforgeable. */
  readonly simulated = true as const;
  readonly webhookSecret: string;

  private seq = 0;
  private eventNo = 0;
  private readonly now: () => number;
  private readonly idempotency = new Map<string, string>();
  /** Events this twin has emitted, in order — the delivery queue. */
  readonly emitted: PaymentEvent[] = [];

  constructor(private readonly opts: TwinOptions = {}) {
    this.now = opts.now ?? (() => Math.floor(Date.now() / 1000));
    this.webhookSecret = opts.webhookSecret ?? "twin-webhook-secret";
  }

  private nextEvent(
    kind: PaymentEventKind,
    customerId: string,
    plan: PlanCode,
    extra: Partial<PaymentEvent> = {},
  ): PaymentEvent {
    this.seq += 1;
    this.eventNo += 1;
    const event: PaymentEvent = {
      id: `evt_${String(this.eventNo).padStart(4, "0")}`,
      kind,
      sequence: this.seq,
      createdAt: this.now(),
      customerId,
      plan,
      ...extra,
    };
    this.emitted.push(event);
    return event;
  }

  async createCheckout(req: CheckoutRequest): Promise<CheckoutOutcome> {
    if (!(req.plan in PLAN_DAYS)) {
      return { ok: false, code: "unknown_plan", reason: `There is no plan called "${req.plan}".` };
    }
    if (this.opts.failCheckout) {
      return {
        ok: false,
        code: "provider_error",
        reason: "The payment provider could not start checkout. Nothing was charged.",
      };
    }
    /*
     * Idempotency is the provider's job as well as ours. A double-clicked
     * button must not produce two subscriptions, and returning the SAME
     * checkout id is how a real provider expresses that.
     */
    const existing = this.idempotency.get(req.idempotencyKey);
    if (existing) {
      return { ok: true, checkoutId: existing, url: `twin://checkout/${existing}`, simulated: true };
    }
    const checkoutId = `cs_${String(this.emitted.length + 1).padStart(4, "0")}`;
    this.idempotency.set(req.idempotencyKey, checkoutId);
    return { ok: true, checkoutId, url: `twin://checkout/${checkoutId}`, simulated: true };
  }

  /** Complete a checkout, as the provider would after the user pays. */
  completeCheckout(customerId: string, plan: PlanCode): PaymentEvent {
    return this.nextEvent("checkout.completed", customerId, plan, {
      periodEndsAt: this.now() + PLAN_DAYS[plan] * 86_400,
    });
  }

  renew(customerId: string, plan: PlanCode): PaymentEvent {
    return this.nextEvent("subscription.renewed", customerId, plan, {
      periodEndsAt: this.now() + PLAN_DAYS[plan] * 86_400,
    });
  }

  failPayment(customerId: string, plan: PlanCode): PaymentEvent {
    return this.nextEvent("payment.failed", customerId, plan);
  }

  openDispute(customerId: string, plan: PlanCode): PaymentEvent {
    return this.nextEvent("dispute.opened", customerId, plan);
  }

  resolveDispute(customerId: string, plan: PlanCode, won: boolean): PaymentEvent {
    return this.nextEvent(won ? "dispute.won" : "dispute.lost", customerId, plan, {
      periodEndsAt: won ? this.now() + PLAN_DAYS[plan] * 86_400 : undefined,
    });
  }

  async cancelSubscription(customerId: string): Promise<{ ok: boolean; reason?: string }> {
    const last = [...this.emitted].reverse().find((e) => e.customerId === customerId);
    if (!last) return { ok: false, reason: "There is no subscription to cancel." };
    this.nextEvent("subscription.cancelled", customerId, last.plan, {
      periodEndsAt: last.periodEndsAt,
    });
    return { ok: true };
  }

  async refund(customerId: string, eventId: string): Promise<{ ok: boolean; reason?: string }> {
    const original = this.emitted.find((e) => e.id === eventId && e.customerId === customerId);
    if (!original) {
      // Refunding an event that does not exist must fail loudly: silently
      // succeeding would let a caller revoke access with a made-up id.
      return { ok: false, reason: `No payment ${eventId} for this customer to refund.` };
    }
    this.nextEvent("payment.refunded", customerId, original.plan, {
      amountMinor: original.amountMinor,
      currency: original.currency,
    });
    return { ok: true };
  }

  /** Serialise an event as the provider would deliver it, with a real signature. */
  async deliver(event: PaymentEvent): Promise<{ header: string; payload: string }> {
    const payload = JSON.stringify(event);
    const header = await signWebhook(this.webhookSecret, event.createdAt, payload);
    return { header, payload };
  }
}

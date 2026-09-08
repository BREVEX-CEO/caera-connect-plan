/**
 * WHAT A VERIFIED PROVIDER EVENT IS ALLOWED TO DO TO OCADE'S RECORDS.
 *
 * THE DEFECT THIS EXISTS TO CLOSE, stated plainly: OCADE sold a product it
 * could not deliver.
 *
 * `std_8d` — "8 days", "charged once" — is in `SELLABLE_PLANS` and on the
 * pricing page. A one-time purchase in Paddle does not emit
 * `subscription.created`; it emits `transaction.completed`. The webhook
 * handled three subscription events and logged everything else as
 * "Unhandled payment event". So the 8-day pass produced no row anywhere, and
 * `/checkout/success` — which correctly refuses to believe the browser and
 * polls for a row written by the signature-verified webhook — would have
 * polled for thirty seconds and then told a paying customer their purchase was
 * "pending", forever. Money in, nothing out, and no record that it happened.
 *
 * THREE MORE THINGS WERE MISSING, and each is a real incident waiting:
 *
 *   NO IDEMPOTENCY. `verifyWebhook` discarded `event_id` entirely. Providers
 *   retry — that is the contract — so the same event arrives more than once as
 *   a matter of course, and a retried `transaction.completed` would have
 *   written a second entitlement for one payment.
 *
 *   NO ORDERING. `occurred_at` was discarded too. Delivery order is not
 *   guaranteed, so a `subscription.updated` held up in a retry queue could
 *   arrive after the `subscription.canceled` that superseded it and quietly
 *   restore access somebody had already cancelled — or that had been refunded.
 *
 *   NO AUDIT. Nothing recorded that an event had been seen, so a duplicate
 *   could not be recognised and a dispute could not be reconstructed.
 *
 * This module is the decision, and it is PURE: an event and the row OCADE
 * currently holds go in, and an instruction goes out. No Supabase client, no
 * clock, no network. That is what makes "a duplicate does nothing" and "a
 * stale event does nothing" testable exhaustively instead of hopefully.
 *
 * It deliberately does not verify signatures — `verifyWebhook` owns that, and
 * nothing reaches here unverified.
 */
import { sellablePlanByPriceId } from "./paddle-plans";

export type PaddleEnv = "sandbox" | "live";

/** The envelope every Paddle event carries, once verified. */
export interface VerifiedEventEnvelope {
  eventId: string;
  eventType: string;
  /** The provider's own timestamp. The ONLY ordering key OCADE trusts. */
  occurredAt: string;
  environment: PaddleEnv;
  data: Record<string, unknown>;
}

/** What OCADE already holds for the entity this event is about. */
export interface ExistingRecord {
  paddleSubscriptionId: string;
  status: string;
  /** `occurred_at` of the last event applied to this row. */
  providerEventAt: string | null;
  environment: string;
}

export interface UpsertInstruction {
  action: "upsert";
  row: {
    user_id: string;
    paddle_subscription_id: string;
    paddle_customer_id: string;
    product_id: string;
    price_id: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at_period_end: boolean;
    environment: PaddleEnv;
    provider_event_at: string;
    /*
     * `one_time` is READ-ONLY history. The catalogue sold a one-time pass under
     * an earlier version and rows recording those purchases still exist; every
     * plan on sale now is a subscription, and nothing below writes `one_time`.
     */
    kind: "subscription" | "one_time";
  };
}

export interface UpdateInstruction {
  action: "update";
  paddleSubscriptionId: string;
  patch: {
    status?: string;
    current_period_start?: string | null;
    current_period_end?: string | null;
    cancel_at_period_end?: boolean;
    provider_event_at: string;
  };
}

export interface IgnoreInstruction {
  action: "ignore";
  /** Recorded in the audit row. Never shown to a customer. */
  reason: string;
}

export type Instruction = UpsertInstruction | UpdateInstruction | IgnoreInstruction;

/** The entitlement row an event is allowed to affect. */
export function targetEntityIdOf(eventType: string, data: Record<string, unknown>): string | null {
  if (eventType === "adjustment.created" || eventType === "adjustment.updated") {
    const subscriptionId = pick(data, "subscriptionId", "subscription_id");
    if (typeof subscriptionId === "string" && subscriptionId.length > 0) return subscriptionId;
    const transactionId = pick(data, "transactionId", "transaction_id");
    return typeof transactionId === "string" && transactionId.length > 0 ? transactionId : null;
  }
  const id = pick(data, "id");
  return typeof id === "string" && id.length > 0 ? id : null;
}

function pick(data: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = data[key];
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

/**
 * The user this event is for.
 *
 * Read from `custom_data`, which OCADE sets at checkout. An event without one
 * cannot be attributed to anybody, and guessing from an email address would
 * attach a stranger's payment to whichever account happened to match.
 */
function userIdOf(data: Record<string, unknown>): string | null {
  const custom = asRecord(pick(data, "customData", "custom_data"));
  const value = custom ? pick(custom, "userId", "user_id") : undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * The catalogue ids OCADE is allowed to record.
 *
 * `importMeta.externalId` is the human-readable id from `paddle-plans.ts`, and
 * it is deliberately the only one stored: the provider's own ids differ between
 * sandbox and live, so recording those would silently break plan attribution
 * the day the product went live.
 */
function catalogueIds(item: Record<string, unknown> | undefined): {
  priceId: string | null;
  productId: string | null;
} {
  const price = asRecord(item?.["price"]);
  const product = asRecord(item?.["product"]) ?? asRecord(price?.["product"]);
  const readExternal = (node: Record<string, unknown> | undefined): string | null => {
    const meta = node ? asRecord(pick(node, "importMeta", "import_meta")) : undefined;
    const value = meta ? pick(meta, "externalId", "external_id") : undefined;
    return typeof value === "string" && value.length > 0 ? value : null;
  };
  return { priceId: readExternal(price), productId: readExternal(product) };
}

function firstItem(data: Record<string, unknown>): Record<string, unknown> | undefined {
  const items = data["items"];
  return Array.isArray(items) ? asRecord(items[0]) : undefined;
}

/**
 * A stale event changes nothing.
 *
 * Strictly older, not older-or-equal: two events can legitimately share a
 * timestamp, and refusing the second would drop real state. Equal timestamps
 * are handled by the event-id de-duplication instead, which is exact.
 */
function isStale(envelope: VerifiedEventEnvelope, existing: ExistingRecord | null): boolean {
  if (!existing?.providerEventAt) return false;
  return new Date(envelope.occurredAt).getTime() < new Date(existing.providerEventAt).getTime();
}

/**
 * A terminal state is not reopened by a late event.
 *
 * A refund or a lost dispute means the money went back. A `subscription.updated`
 * still sitting in the provider's retry queue must not hand the product back to
 * somebody who has already been repaid — that is the concrete shape of "a
 * delayed webhook resurrecting cancelled access".
 */
const TERMINAL = new Set(["canceled", "cancelled", "refunded", "charged_back", "disputed"]);

export function decide(
  envelope: VerifiedEventEnvelope,
  existing: ExistingRecord | null,
): Instruction {
  if (existing && existing.environment !== envelope.environment) {
    // Sandbox and live share no state. A test event must never touch a real one.
    return { action: "ignore", reason: "environment_mismatch" };
  }
  if (isStale(envelope, existing)) {
    return { action: "ignore", reason: "stale_event" };
  }

  const data = envelope.data;

  switch (envelope.eventType) {
    case "subscription.created": {
      const userId = userIdOf(data);
      if (!userId) return { action: "ignore", reason: "no_user_id" };
      const item = firstItem(data);
      const { priceId, productId } = catalogueIds(item);
      if (!priceId || !productId) return { action: "ignore", reason: "no_catalogue_ids" };
      const id = pick(data, "id");
      const customerId = pick(data, "customerId", "customer_id");
      if (typeof id !== "string" || typeof customerId !== "string") {
        return { action: "ignore", reason: "no_entity_id" };
      }
      const period = asRecord(pick(data, "currentBillingPeriod", "current_billing_period"));
      return {
        action: "upsert",
        row: {
          user_id: userId,
          paddle_subscription_id: id,
          paddle_customer_id: customerId,
          product_id: productId,
          price_id: priceId,
          status: typeof data["status"] === "string" ? (data["status"] as string) : "active",
          current_period_start: (pick(period ?? {}, "startsAt", "starts_at") as string) ?? null,
          current_period_end: (pick(period ?? {}, "endsAt", "ends_at") as string) ?? null,
          cancel_at_period_end: false,
          environment: envelope.environment,
          provider_event_at: envelope.occurredAt,
          kind: "subscription",
        },
      };
    }

    case "subscription.updated": {
      const id = pick(data, "id");
      if (typeof id !== "string") return { action: "ignore", reason: "no_entity_id" };
      if (existing && TERMINAL.has(existing.status)) {
        return { action: "ignore", reason: "terminal_state" };
      }
      const period = asRecord(pick(data, "currentBillingPeriod", "current_billing_period"));
      const change = asRecord(pick(data, "scheduledChange", "scheduled_change"));
      return {
        action: "update",
        paddleSubscriptionId: id,
        patch: {
          ...(typeof data["status"] === "string" ? { status: data["status"] as string } : {}),
          current_period_start: (pick(period ?? {}, "startsAt", "starts_at") as string) ?? null,
          current_period_end: (pick(period ?? {}, "endsAt", "ends_at") as string) ?? null,
          cancel_at_period_end: change?.["action"] === "cancel",
          provider_event_at: envelope.occurredAt,
        },
      };
    }

    case "subscription.canceled": {
      const id = pick(data, "id");
      if (typeof id !== "string") return { action: "ignore", reason: "no_entity_id" };
      return {
        action: "update",
        paddleSubscriptionId: id,
        patch: { status: "canceled", provider_event_at: envelope.occurredAt },
      };
    }

    /*
     * A COMPLETED TRANSACTION IS NOT A PURCHASE TO ACT ON.
     *
     * Every plan in the current catalogue is a subscription, and a subscription
     * grants its entitlement through the `subscription.*` events below. Paddle
     * ALSO fires `transaction.completed` for each renewal of those
     * subscriptions, so acting here would write a second, overlapping
     * entitlement every billing period.
     *
     * The one-time pass this case used to serve was retired with the previous
     * catalogue. Rather than leave a path that grants access from a transaction
     * — which is the shape a forged or replayed purchase would take — the case
     * is explicit and refuses, so a future one-time plan has to be implemented
     * deliberately rather than inherited.
     */
    case "transaction.completed": {
      const item = firstItem(data);
      const { priceId } = catalogueIds(item);
      const plan = priceId ? sellablePlanByPriceId(priceId) : undefined;
      return {
        action: "ignore",
        reason: plan ? "subscription_transaction" : "unknown_catalogue_item",
      };
    }

    case "subscription.activated":
    case "subscription.resumed":
    case "subscription.past_due":
    case "subscription.paused":
    case "subscription.trialing": {
      const id = pick(data, "id");
      if (typeof id !== "string") return { action: "ignore", reason: "no_entity_id" };
      if (existing && TERMINAL.has(existing.status)) {
        return { action: "ignore", reason: "terminal_state" };
      }
      const statuses: Record<string, string> = {
        "subscription.activated": "active",
        "subscription.resumed": "active",
        "subscription.past_due": "past_due",
        "subscription.paused": "paused",
        "subscription.trialing": "trialing",
      };
      return {
        action: "update",
        paddleSubscriptionId: id,
        patch: {
          status: statuses[envelope.eventType],
          provider_event_at: envelope.occurredAt,
        },
      };
    }

    /*
     * Refunds and disputes are Adjustment events in Paddle Billing. A pending
     * refund is not money returned, a rejected refund changes nothing, and a
     * partial refund does not erase the entitlement that was partly paid for.
     * Chargebacks are different: access is suspended as soon as the provider
     * reports the dispute, then restored only by the explicit reversal event.
     */
    case "adjustment.created":
    case "adjustment.updated": {
      const target = targetEntityIdOf(envelope.eventType, data);
      if (!target) return { action: "ignore", reason: "no_adjustment_target" };
      if (!existing) return { action: "ignore", reason: "entitlement_not_found" };

      const action = pick(data, "action");
      const status = pick(data, "status");
      const adjustmentType = pick(data, "type");
      if (typeof action !== "string" || typeof status !== "string") {
        return { action: "ignore", reason: "invalid_adjustment" };
      }

      if (action === "refund") {
        if (status === "pending_approval") {
          return { action: "ignore", reason: "refund_pending_approval" };
        }
        if (status === "rejected") return { action: "ignore", reason: "refund_rejected" };
        if (status !== "approved") return { action: "ignore", reason: `refund_${status}` };
        if (adjustmentType !== "full") return { action: "ignore", reason: "partial_refund" };
        return {
          action: "update",
          paddleSubscriptionId: target,
          patch: { status: "refunded", provider_event_at: envelope.occurredAt },
        };
      }

      if (action === "chargeback" || action === "chargeback_warning") {
        return {
          action: "update",
          paddleSubscriptionId: target,
          patch: {
            status: action === "chargeback" ? "charged_back" : "disputed",
            provider_event_at: envelope.occurredAt,
          },
        };
      }

      if (action === "chargeback_reverse" || action === "chargeback_warning_reverse") {
        const reversible = existing.status === "charged_back" || existing.status === "disputed";
        if (!reversible) return { action: "ignore", reason: "unexpected_chargeback_reversal" };
        return {
          action: "update",
          paddleSubscriptionId: target,
          patch: { status: "active", provider_event_at: envelope.occurredAt },
        };
      }

      return { action: "ignore", reason: `adjustment_action:${action}` };
    }

    default:
      return { action: "ignore", reason: `unhandled:${envelope.eventType}` };
  }
}

/**
 * Whether a stored record grants access right now.
 *
 * TIME DECIDES FOR A ONE-TIME PASS, not status: nothing sends an event when
 * eight days elapse, so a row that says `active` forever would be a pass that
 * never expires. A subscription is the other way round — the provider tells us
 * when it ends — but checking the period end costs nothing and protects
 * against a missed `canceled` delivery.
 */
export function grantsAccessAt(
  record: { status: string; current_period_end: string | null },
  nowMs: number,
): boolean {
  if (TERMINAL.has(record.status)) return false;
  if (record.status !== "active" && record.status !== "trialing") return false;
  if (!record.current_period_end) return true;
  return new Date(record.current_period_end).getTime() > nowMs;
}

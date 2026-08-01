/**
 * Payment provider contract and webhook verification (P17).
 *
 * OCADE had no payment code of any kind — no provider SDK, no checkout, no
 * webhook handling, no entitlement synchronisation. This defines the contract
 * a real provider must satisfy, so the twin (HWE-29) and a future Stripe or
 * Paddle adapter are interchangeable and neither is special-cased.
 *
 * NOTHING HERE CAN CHARGE MONEY. There is no network call, no API key and no
 * live endpoint. `LIVE_PAYMENTS_ENABLED` is a hard `false` and the checkout
 * path refuses when a provider claims to be live, because a half-finished
 * payment integration that can reach production is worse than none at all.
 *
 * The webhook rules are the security-critical part, and each exists because
 * the corresponding attack is real:
 *
 *   - SIGNATURE: an unsigned webhook is an unauthenticated request that grants
 *     paid entitlements. Verified with HMAC-SHA-256 over `timestamp.payload`.
 *   - TIMESTAMP: a valid signature is valid forever, so a captured webhook can
 *     be replayed tomorrow. Events outside the tolerance window are refused.
 *   - EVENT ID: within the window, the same event can still be delivered twice
 *     — providers retry. Seen ids are refused.
 *   - ORDERING: providers do NOT guarantee order. An older event arriving after
 *     a newer one must not overwrite it.
 */

/**
 * Live payments are OFF and this is not a configuration toggle.
 *
 * Turning it on requires legal identity, bank verification and owner approval
 * — none of which exist. A constant that a deployment cannot flip by accident
 * is the honest way to hold that line.
 */
export const LIVE_PAYMENTS_ENABLED = false as const;

export type PlanCode = "trial_2d" | "std_8d" | "month_1m" | "year_1y";

export type SubscriptionStatus =
  "none" | "active" | "past_due" | "grace" | "cancelled" | "refunded" | "disputed";

export type PaymentEventKind =
  | "checkout.completed"
  | "subscription.renewed"
  | "subscription.cancelled"
  | "payment.failed"
  | "payment.refunded"
  | "dispute.opened"
  | "dispute.won"
  | "dispute.lost";

export interface PaymentEvent {
  /** Provider's event id. Used for idempotency. */
  id: string;
  kind: PaymentEventKind;
  /** Provider's own ordering value. Higher is newer. */
  sequence: number;
  /** Seconds since epoch, as providers send it. */
  createdAt: number;
  customerId: string;
  plan: PlanCode;
  /** Set on renewals and checkouts. */
  periodEndsAt?: number;
  amountMinor?: number;
  currency?: string;
}

export interface CheckoutRequest {
  customerId: string;
  plan: PlanCode;
  /** Caller-supplied key so a double-click cannot create two subscriptions. */
  idempotencyKey: string;
}

export type CheckoutOutcome =
  | { ok: true; checkoutId: string; url: string; simulated: boolean }
  | { ok: false; reason: string; code: CheckoutRefusal };

export type CheckoutRefusal =
  "live_payments_disabled" | "unknown_plan" | "duplicate_request" | "provider_error";

export interface PaymentProvider {
  readonly id: string;
  /** True for the twin. A provider claiming false is refused — see below. */
  readonly simulated: boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutOutcome>;
  cancelSubscription(customerId: string): Promise<{ ok: boolean; reason?: string }>;
  refund(customerId: string, eventId: string): Promise<{ ok: boolean; reason?: string }>;
  /** The secret this provider signs webhooks with. Never leaves the server. */
  readonly webhookSecret: string;
}

/* ------------------------------------------------------- webhook safety --- */

export type WebhookRefusal =
  "bad_signature" | "stale_timestamp" | "future_timestamp" | "duplicate_event" | "malformed";

export type WebhookVerdict =
  { ok: true; event: PaymentEvent } | { ok: false; refusal: WebhookRefusal; reason: string };

/** How far out of date a webhook may be. Providers retry for minutes, not days. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

const enc = new TextEncoder();

/** Constant-time comparison. A fast-exit compare leaks the signature by timing. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Sign a webhook exactly as the provider does.
 *
 * The timestamp is INSIDE the signed material. Signing only the payload would
 * let an attacker keep a valid signature and change the timestamp, defeating
 * the replay window entirely.
 */
export async function signWebhook(
  secret: string,
  timestamp: number,
  payload: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${timestamp}.${payload}`));
  return `t=${timestamp},v1=${toHex(sig)}`;
}

/** Tracks event ids already applied, so a retry cannot apply twice. */
export interface SeenEvents {
  has(id: string): boolean;
  add(id: string): void;
}

export class InMemorySeenEvents implements SeenEvents {
  private readonly ids = new Set<string>();
  constructor(private readonly max = 10_000) {}
  has(id: string): boolean {
    return this.ids.has(id);
  }
  add(id: string): void {
    // Bounded: an unbounded set is a memory leak an attacker can drive.
    if (this.ids.size >= this.max) {
      const first = this.ids.values().next().value;
      if (first !== undefined) this.ids.delete(first);
    }
    this.ids.add(id);
  }
}

export interface VerifyWebhookInput {
  secret: string;
  header: string;
  payload: string;
  seen: SeenEvents;
  nowSeconds?: number;
  toleranceSeconds?: number;
}

/**
 * Verify and admit one webhook.
 *
 * Order of checks matters: signature FIRST, because everything after it trusts
 * the payload. Parsing an unverified body and acting on its event id would let
 * an unauthenticated caller poison the seen-event set and block real events.
 */
export async function verifyWebhook(input: VerifyWebhookInput): Promise<WebhookVerdict> {
  const tolerance = input.toleranceSeconds ?? WEBHOOK_TOLERANCE_SECONDS;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);

  const parts = /^t=(\d+),v1=([0-9a-f]+)$/.exec(input.header.trim());
  if (!parts) {
    return { ok: false, refusal: "malformed", reason: "The signature header is not well formed." };
  }
  const timestamp = Number(parts[1]);
  const expected = await signWebhook(input.secret, timestamp, input.payload);

  if (!timingSafeEqual(expected, input.header.trim())) {
    return {
      ok: false,
      refusal: "bad_signature",
      reason: "The webhook signature does not match. It was not sent by the payment provider.",
    };
  }

  // Only now is the timestamp trustworthy.
  if (now - timestamp > tolerance) {
    return {
      ok: false,
      refusal: "stale_timestamp",
      reason: `The webhook is ${now - timestamp}s old, beyond the ${tolerance}s replay window.`,
    };
  }
  if (timestamp - now > tolerance) {
    return {
      ok: false,
      refusal: "future_timestamp",
      reason: "The webhook is dated in the future and was refused.",
    };
  }

  let event: PaymentEvent;
  try {
    event = JSON.parse(input.payload) as PaymentEvent;
  } catch {
    return { ok: false, refusal: "malformed", reason: "The webhook body is not valid JSON." };
  }
  if (!event?.id || !event.kind || typeof event.sequence !== "number") {
    return {
      ok: false,
      refusal: "malformed",
      reason: "The webhook body is missing required fields.",
    };
  }

  if (input.seen.has(event.id)) {
    return {
      ok: false,
      refusal: "duplicate_event",
      reason: `Event ${event.id} has already been applied.`,
    };
  }
  input.seen.add(event.id);
  return { ok: true, event };
}

/**
 * Guard the checkout path.
 *
 * A provider that says it is NOT simulated is refused while live payments are
 * disabled. Without this, swapping in a real adapter would silently start
 * taking money from an integration that has never been through legal identity
 * or bank verification.
 */
export function checkoutAllowed(provider: PaymentProvider): CheckoutOutcome | null {
  if (!provider.simulated && !LIVE_PAYMENTS_ENABLED) {
    return {
      ok: false,
      code: "live_payments_disabled",
      reason:
        "Live payments are disabled in this build. Real charging needs legal identity, bank verification and owner approval.",
    };
  }
  return null;
}

/**
 * Entitlement state machine (P17).
 *
 * Turns provider events into what a user is actually allowed to do. This is
 * where the subtle payment bugs live, so each rule below exists because the
 * naive version is wrong:
 *
 *   OUT-OF-ORDER. Providers do not guarantee delivery order. A `renewed` event
 *   arriving after a `cancelled` event that happened LATER would resurrect a
 *   cancelled subscription. Every event carries the provider's sequence, and an
 *   older one is ignored rather than applied.
 *
 *   GRACE. A failed renewal must not cut someone off mid-sentence. Payment
 *   failure moves to `grace` with a deadline; access continues until it passes,
 *   then lapses. The grace end is computed from the failure, not extended each
 *   time a retry fails — otherwise a permanently failing card grants permanent
 *   access.
 *
 *   REFUND AND DISPUTE revoke immediately and do NOT get a grace period. Money
 *   has gone back; continued access would be giving the product away.
 *
 *   A LOST DISPUTE is terminal. A won dispute restores the prior state, because
 *   winning means the charge was legitimate all along.
 */
import type { PaymentEvent, PlanCode, SubscriptionStatus } from "./provider";

export interface Entitlement {
  customerId: string;
  plan: PlanCode | null;
  status: SubscriptionStatus;
  /** When paid access ends. Null when there is none. */
  periodEndsAt: number | null;
  /** When grace ends, if in grace. */
  graceEndsAt: number | null;
  /** Highest provider sequence applied. Guards against out-of-order events. */
  lastSequence: number;
  /** Every event id applied, for audit. */
  appliedEvents: string[];
}

/** Days of continued access after a failed renewal. */
export const GRACE_DAYS = 7;
const GRACE_SECONDS = GRACE_DAYS * 24 * 60 * 60;

export function emptyEntitlement(customerId: string): Entitlement {
  return {
    customerId,
    plan: null,
    status: "none",
    periodEndsAt: null,
    graceEndsAt: null,
    lastSequence: 0,
    appliedEvents: [],
  };
}

export type ApplyResult =
  | { applied: true; entitlement: Entitlement; reason: string }
  | { applied: false; entitlement: Entitlement; reason: string };

/**
 * Apply one event.
 *
 * Pure: the caller owns persistence. Returning the unchanged entitlement on
 * refusal (rather than throwing) means an out-of-order or duplicate event is an
 * ordinary outcome to record, not an exception to swallow.
 */
export function applyEvent(current: Entitlement, event: PaymentEvent): ApplyResult {
  if (event.customerId !== current.customerId) {
    return {
      applied: false,
      entitlement: current,
      reason: `Event is for ${event.customerId}, not ${current.customerId}.`,
    };
  }

  if (current.appliedEvents.includes(event.id)) {
    return {
      applied: false,
      entitlement: current,
      reason: `Event ${event.id} was already applied.`,
    };
  }

  /*
   * Out-of-order guard. A dispute outcome is exempt: chargeback results arrive
   * long after the events they overturn, and refusing them on sequence would
   * leave a lost dispute permanently unapplied.
   */
  const isDisputeOutcome = event.kind === "dispute.won" || event.kind === "dispute.lost";
  if (!isDisputeOutcome && event.sequence <= current.lastSequence) {
    return {
      applied: false,
      entitlement: current,
      reason: `Event sequence ${event.sequence} is not newer than ${current.lastSequence}; ignoring a stale event.`,
    };
  }

  // A lost dispute is terminal — nothing reactivates it except a won dispute.
  if (current.status === "disputed" && event.kind !== "dispute.won") {
    return {
      applied: false,
      entitlement: current,
      reason:
        "This subscription is under a lost dispute and cannot be reactivated by payment events.",
    };
  }

  const next: Entitlement = {
    ...current,
    lastSequence: Math.max(current.lastSequence, event.sequence),
    appliedEvents: [...current.appliedEvents, event.id],
  };

  switch (event.kind) {
    case "checkout.completed":
    case "subscription.renewed":
      next.plan = event.plan;
      next.status = "active";
      next.periodEndsAt = event.periodEndsAt ?? null;
      next.graceEndsAt = null; // a successful payment clears any grace
      return { applied: true, entitlement: next, reason: `Access active on ${event.plan}.` };

    case "payment.failed":
      /*
       * Grace is set from THIS failure only if not already in grace. Extending
       * it on every retry would give a permanently failing card permanent
       * access, which is the bug this guard exists to prevent.
       */
      next.status = "grace";
      next.graceEndsAt = current.graceEndsAt ?? event.createdAt + GRACE_SECONDS;
      return {
        applied: true,
        entitlement: next,
        reason: `Payment failed; access continues until grace ends.`,
      };

    case "subscription.cancelled":
      // Cancelling keeps access until the paid period ends. Cutting access at
      // the moment of cancellation would take away time already paid for.
      next.status = "cancelled";
      next.graceEndsAt = null;
      return {
        applied: true,
        entitlement: next,
        reason: "Cancelled; access continues until the paid period ends.",
      };

    case "payment.refunded":
      next.status = "refunded";
      next.periodEndsAt = null;
      next.graceEndsAt = null;
      return { applied: true, entitlement: next, reason: "Refunded; access revoked immediately." };

    case "dispute.opened":
    case "dispute.lost":
      next.status = "disputed";
      next.periodEndsAt = null;
      next.graceEndsAt = null;
      return { applied: true, entitlement: next, reason: "Disputed; access revoked immediately." };

    case "dispute.won":
      // The charge was legitimate, so restore paid access.
      next.status = "active";
      next.periodEndsAt = event.periodEndsAt ?? current.periodEndsAt;
      return { applied: true, entitlement: next, reason: "Dispute won; access restored." };

    default:
      return { applied: false, entitlement: current, reason: `Unknown event kind.` };
  }
}

/**
 * Does this entitlement grant access right now?
 *
 * Separate from `status` on purpose: status records what the provider last
 * said, while access depends on the clock. A `cancelled` subscription still
 * grants access until its paid period ends, and an `active` one whose period
 * has quietly passed does not.
 */
export function hasAccess(e: Entitlement, nowSeconds: number): boolean {
  switch (e.status) {
    case "active":
      return e.periodEndsAt === null || nowSeconds < e.periodEndsAt;
    case "cancelled":
      return e.periodEndsAt !== null && nowSeconds < e.periodEndsAt;
    case "grace":
      return e.graceEndsAt !== null && nowSeconds < e.graceEndsAt;
    case "past_due":
    case "refunded":
    case "disputed":
    case "none":
    default:
      return false;
  }
}

/** Plain sentence for the UI. Never shows a raw status code. */
export function describeEntitlement(e: Entitlement, nowSeconds: number): string {
  if (hasAccess(e, nowSeconds)) {
    if (e.status === "grace" && e.graceEndsAt) {
      const days = Math.max(0, Math.ceil((e.graceEndsAt - nowSeconds) / 86_400));
      return `Payment failed. Access continues for ${days} more day${days === 1 ? "" : "s"} while you update it.`;
    }
    if (e.status === "cancelled" && e.periodEndsAt) {
      const days = Math.max(0, Math.ceil((e.periodEndsAt - nowSeconds) / 86_400));
      return `Cancelled. You keep access for ${days} more day${days === 1 ? "" : "s"}.`;
    }
    return "Your subscription is active.";
  }
  switch (e.status) {
    case "refunded":
      return "This subscription was refunded, so paid features are off.";
    case "disputed":
      return "This subscription is disputed, so paid features are off.";
    case "grace":
      return "The grace period ended without a successful payment.";
    case "cancelled":
      return "This subscription has ended.";
    default:
      return "No active subscription.";
  }
}

/**
 * WHAT A BILLING OPERATOR CAN SEE, AND WHERE IT COMES FROM — PLAN.md §G.
 *
 * §G asks the admin panel for "a billing and seat overview and payment-event
 * state". That was held back on purpose while the deployment carried two
 * subscription tables written by two different paths: a screen that picked one
 * of them would have been asserting an answer to the question Phase 19 exists
 * to settle. There is one authority now, so these are the reads.
 *
 * THE AUTHORISATION IS NOT HERE. Row-level security decides what comes back:
 * an account without the admin role selecting from these tables gets its own
 * rows or none, whatever this module does. `requireAdminRole` decides what to
 * RENDER; neither is the boundary on its own.
 *
 * SEATS ARE COUNTS, NOT MEMBERSHIPS. "How many seats is this workspace using"
 * does not need the identity of every member of every workspace in the
 * deployment, so it is an aggregate function with no policy on the membership
 * rows for anything else to fall back to — the same shape, and the same
 * reason, as notification delivery on the operations screen.
 *
 * A GRANT IS NOT A PAYMENT, AND THE SCREEN MUST NOT BLUR THEM. Grants are read
 * from their own table and shown in their own list: who gave it, to whom, why,
 * until when, and whether it was revoked. Nothing here writes the subscription
 * table, and there is no path in this module that could make a support
 * decision look like money that arrived.
 *
 * EVERY READ IS BOUNDED. These tables grow with use, and the screen says when a
 * cap was reached rather than showing a prefix as though it were the whole
 * thing.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { sellablePlanByPriceId } from "@/lib/payments/paddle-plans";
import { planById, type PlanTier } from "@/lib/payments/pricing";

export const BILLING_LIMITS = {
  subscriptions: 500,
  grants: 500,
  paymentEvents: 500,
  invoices: 500,
  /** Already aggregated server-side; this bounds the organizations listed. */
  seats: 500,
} as const;

export interface Bounded<T> {
  rows: T[];
  /** True when the read came back at its cap, so the screen can say so. */
  truncated: boolean;
}

export interface SubscriptionRow {
  id: string;
  userId: string;
  /** The tier the priced plan carries, or null for a retired catalogue price. */
  tier: PlanTier | null;
  planName: string | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  environment: string;
  providerSubscriptionId: string;
}

export interface GrantRow {
  id: string;
  userId: string;
  grantedBy: string;
  tier: string;
  reason: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  revokedReason: string | null;
  /** Live right now: started, not ended, not revoked. */
  active: boolean;
}

export interface PaymentEventRow {
  id: string;
  userId: string;
  provider: string;
  kind: string;
  status: string;
  amountMinor: number;
  currency: string;
  occurredAt: string;
}

export interface InvoiceRow {
  id: string;
  userId: string;
  invoiceNumber: string;
  planId: string;
  amountMinor: number;
  taxMinor: number;
  currency: string;
  status: string;
  issuedAt: string;
}

export interface SeatRow {
  id: string;
  organizationName: string;
  createdAt: string;
  seats: number;
  admins: number;
  pendingInvites: number;
}

/**
 * Provider subscriptions, the ones that are live first.
 *
 * The price is resolved to a plan here rather than on the screen, because a
 * price id from a retired catalogue has no plan and the honest rendering of
 * that is "—" rather than a tier somebody guessed.
 */
export async function loadSubscriptions(): Promise<Bounded<SubscriptionRow>> {
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "id, user_id, price_id, status, current_period_end, cancel_at_period_end, environment, paddle_subscription_id",
    )
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(BILLING_LIMITS.subscriptions);
  if (error) throw error;
  const rows = (data ?? []).map((row) => {
    const sellable = sellablePlanByPriceId(String(row.price_id));
    const plan = sellable ? planById(sellable.planId) : undefined;
    return {
      id: row.id,
      userId: row.user_id,
      tier: plan?.tier ?? null,
      planName: plan?.name ?? null,
      status: row.status,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      environment: row.environment,
      providerSubscriptionId: row.paddle_subscription_id,
    };
  });
  return { rows, truncated: rows.length >= BILLING_LIMITS.subscriptions };
}

/**
 * Audited entitlement grants, newest window first.
 *
 * Revoked grants are read too. The record of access that WAS given is the half
 * a dispute actually needs, and a list that showed only live grants would let
 * a revoked one disappear from the audit it exists for.
 */
export async function loadGrants(): Promise<Bounded<GrantRow>> {
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase
    .from("ocade_entitlement_grants")
    .select("id, user_id, granted_by, tier, reason, starts_at, ends_at, revoked_at, revoked_reason")
    .order("ends_at", { ascending: false })
    .limit(BILLING_LIMITS.grants);
  if (error) throw error;
  const now = Date.now();
  const rows = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    grantedBy: row.granted_by,
    tier: row.tier,
    reason: row.reason,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    revokedAt: row.revoked_at,
    revokedReason: row.revoked_reason,
    active: !row.revoked_at && Date.parse(row.starts_at) <= now && Date.parse(row.ends_at) > now,
  }));
  return { rows, truncated: rows.length >= BILLING_LIMITS.grants };
}

/** Payment-event state: what the provider said happened, and when. */
export async function loadPaymentEvents(): Promise<Bounded<PaymentEventRow>> {
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase
    .from("ocade_payment_events")
    .select("id, user_id, provider, kind, status, amount_minor, currency, occurred_at")
    .order("occurred_at", { ascending: false })
    .limit(BILLING_LIMITS.paymentEvents);
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    provider: row.provider,
    kind: row.kind,
    status: row.status,
    amountMinor: Number(row.amount_minor ?? 0),
    currency: row.currency,
    occurredAt: row.occurred_at,
  }));
  return { rows, truncated: rows.length >= BILLING_LIMITS.paymentEvents };
}

/** Issued invoices, newest first. */
export async function loadInvoices(): Promise<Bounded<InvoiceRow>> {
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase
    .from("ocade_invoices")
    .select(
      "id, user_id, invoice_number, plan_id, amount_minor, tax_minor, currency, status, issued_at",
    )
    .order("issued_at", { ascending: false })
    .limit(BILLING_LIMITS.invoices);
  if (error) throw error;
  const rows = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    invoiceNumber: row.invoice_number,
    planId: row.plan_id,
    amountMinor: Number(row.amount_minor ?? 0),
    taxMinor: Number(row.tax_minor ?? 0),
    currency: row.currency,
    status: row.status,
    issuedAt: row.issued_at,
  }));
  return { rows, truncated: rows.length >= BILLING_LIMITS.invoices };
}

/** Seats per organization, as counts. */
export async function loadSeats(): Promise<Bounded<SeatRow>> {
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase.rpc("ocade_admin_seat_overview");
  if (error) throw error;
  const rows = (data ?? []).slice(0, BILLING_LIMITS.seats).map((row) => ({
    id: row.organization_id,
    organizationName: row.organization_name,
    createdAt: row.created_at,
    seats: Number(row.seats ?? 0),
    admins: Number(row.admins ?? 0),
    pendingInvites: Number(row.pending_invites ?? 0),
  }));
  return { rows, truncated: (data ?? []).length > BILLING_LIMITS.seats };
}

/** The floor under a written reason, shared by the screen and the database. */
export const GRANT_REASON_MIN_LENGTH = 10;

/** How long a grant may run, matching the database's own constraint. */
export const GRANT_MAX_DAYS = 366;

export interface GrantRequest {
  userId: string;
  tier: "pro" | "max";
  reason: string;
  days: number;
}

/**
 * Why a grant request cannot be sent, or null when it can.
 *
 * The database refuses all of these itself — this is the message a person can
 * act on before a round trip, never the enforcement. An admin who bypassed
 * this screen entirely would still be refused.
 */
export function grantRequestProblem(request: GrantRequest): string | null {
  if (!/^[0-9a-f-]{36}$/i.test(request.userId)) {
    return "Choose the account from the list; a grant is made against its immutable id, not an email.";
  }
  if (request.reason.trim().length < GRANT_REASON_MIN_LENGTH) {
    return `Write a reason somebody could read back later — at least ${GRANT_REASON_MIN_LENGTH} characters.`;
  }
  if (!Number.isInteger(request.days) || request.days < 1 || request.days > GRANT_MAX_DAYS) {
    return `A grant runs for between 1 and ${GRANT_MAX_DAYS} days.`;
  }
  return null;
}

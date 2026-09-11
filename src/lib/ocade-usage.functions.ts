/**
 * WHAT THIS ACCOUNT IS ENTITLED TO, READ AS THE ACCOUNT ITSELF.
 *
 * Chat inference is local and has no usage meter; what the plan and device
 * screens need is the entitlement — which tier, until when, and whether it is
 * still live.
 *
 * ONE AUTHORITY, SINCE PHASE 19. This used to read `ocade_subscriptions`, a
 * second subscription table nothing wrote: the signature-verified provider
 * webhook writes `public.subscriptions`. So a customer could complete a real
 * payment and see Free on this screen. That table is archived; both halves of
 * the answer now come from the rows that actually decide it — the provider
 * subscription, and an audited admin grant.
 *
 * READ-ONLY, AND AS THE CALLER. Row-level security is the boundary: this runs
 * under the person's own token, so it can return their entitlement and nobody
 * else's whatever this file does. There is deliberately no admin client here
 * and no write path — an entitlement a screen could change is not an
 * entitlement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { sellablePlanByPriceId } from "@/lib/payments/paddle-plans";
import { planById, type PlanId, type PlanTier } from "@/lib/payments/pricing";

export interface EntitlementResult {
  /**
   * The plan that was PURCHASED, or null for an admin grant.
   *
   * Null rather than a plan id because a grant buys nothing: naming a plan
   * here would show a support decision on the pricing comparison as though
   * somebody had chosen and paid for it.
   */
  planId: PlanId | null;
  tier: PlanTier;
  startedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "cancelled";
  /** Why this entitlement exists, for a screen that says so honestly. */
  source: "provider_subscription" | "admin_grant";
}

/** Statuses under which the provider considers access live. */
const LIVE_STATUSES = ["active", "trialing"] as const;

const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, max: 2 };

/**
 * The account's entitlement, or null when it has never had one.
 *
 * The STRONGER of the two answers wins, exactly as the server-side resolver
 * decides it — a customer who pays for Pro and was given Max for a support
 * case is on Max, and one payment is still one payment.
 */
export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EntitlementResult | null> => {
    const [subscription, grant] = await Promise.all([
      providerEntitlement(context),
      grantedEntitlement(context),
    ]);

    if (!subscription) return grant;
    if (!grant) return subscription;
    return TIER_RANK[grant.tier] > TIER_RANK[subscription.tier] ? grant : subscription;
  });

/** The caller's own client and id, as the middleware hands them over. */
interface CallerContext {
  supabase: SupabaseClient<Database>;
  userId: string;
}

/** The entitlement a verified provider subscription currently gives. */
async function providerEntitlement(context: CallerContext): Promise<EntitlementResult | null> {
  const { data } = await context.supabase
    .from("subscriptions")
    .select("price_id, status, current_period_start, current_period_end")
    .eq("user_id", context.userId)
    .in("status", [...LIVE_STATUSES])
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;

  /*
   * A row naming a price from a retired catalogue is history, not an offer. It
   * is reported rather than dropped — somebody looking at their own plan page
   * after a catalogue change should see that they hold something, not a blank
   * screen — but it grants the tier the plan actually carries and no more.
   */
  const sellable = sellablePlanByPriceId(String(data.price_id));
  const plan = sellable ? planById(sellable.planId) : undefined;
  if (!plan) return null;

  const endsAt = data.current_period_end ? String(data.current_period_end) : null;
  if (!endsAt) return null;
  const expired = Date.parse(endsAt) <= Date.now();

  return {
    planId: plan.id,
    tier: plan.tier,
    startedAt: String(data.current_period_start ?? endsAt),
    expiresAt: endsAt,
    status: expired ? "expired" : "active",
    source: "provider_subscription",
  };
}

/** The entitlement an audited admin grant currently gives. */
async function grantedEntitlement(context: CallerContext): Promise<EntitlementResult | null> {
  /*
   * Through the no-argument function rather than the table, so "which grant
   * counts" is one expression in the database that this screen and the
   * server-side resolver both read. It can only ever mean the caller.
   */
  const { data } = await context.supabase.rpc("ocade_my_entitlement_grant");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const tier = String(row.tier ?? "");
  if (tier !== "pro" && tier !== "max") return null;

  return {
    planId: null,
    tier,
    startedAt: String(row.starts_at),
    expiresAt: String(row.ends_at),
    status: "active",
    source: "admin_grant",
  };
}

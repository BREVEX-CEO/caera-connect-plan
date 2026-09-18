/** Resolve tier from provider subscriptions and audited grants; anchor windows to profiles.created_at. */
import { sellablePlanByPriceId } from "@/lib/payments/paddle-plans";
import { planById, type PlanTier } from "@/lib/payments/pricing";

export interface ResolvedEntitlement {
  tier: PlanTier;
  /** Immutable instant the account's usage windows are anchored to. */
  anchoredAt: number;
  /** Why this tier, for an operator reading an audit line. */
  source: "provider_subscription" | "admin_grant" | "free_default" | "expired" | "unreadable";
}

const FREE_FALLBACK = (anchoredAt: number, source: ResolvedEntitlement["source"]) => ({
  tier: "free" as const,
  anchoredAt,
  source,
});

const LIVE_STATUSES = new Set(["active", "trialing"]);

/** Tiers in order, so "the stronger answer" is a comparison rather than an if. */
const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, max: 2 };

export async function resolveTierFor(userId: string): Promise<ResolvedEntitlement> {
  const anchoredAt = await accountAnchorFor(userId);
  const subscription = await providerTierFor(userId);
  const granted = await grantedTierFor(userId);

  if (!subscription && !granted) return FREE_FALLBACK(anchoredAt, "free_default");

  const best =
    subscription && granted
      ? TIER_RANK[granted.tier] > TIER_RANK[subscription.tier]
        ? granted
        : subscription
      : (subscription ?? granted)!;

  return { tier: best.tier, anchoredAt, source: best.source };
}

interface TierAnswer {
  tier: PlanTier;
  source: ResolvedEntitlement["source"];
}

/** The tier a verified provider subscription currently grants, or null. */
async function providerTierFor(userId: string): Promise<TierAnswer | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("price_id, status, current_period_end")
    .eq("user_id", userId)
    .in("status", [...LIVE_STATUSES])
    .order("current_period_end", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) return { tier: "free", source: "unreadable" };
  if (!data) return null;

  const endsAt = data.current_period_end ? Date.parse(String(data.current_period_end)) : null;
  if (endsAt !== null && Number.isFinite(endsAt) && endsAt <= Date.now()) {
    return { tier: "free", source: "expired" };
  }

  // A row naming a price from a retired catalogue is history, not an offer, and
  // it grants nothing today.
  const sellable = sellablePlanByPriceId(String(data.price_id));
  const plan = sellable ? planById(sellable.planId) : undefined;
  if (!plan) return { tier: "free", source: "expired" };

  return { tier: plan.tier, source: "provider_subscription" };
}

/** The tier an audited admin grant currently gives, or null. */
async function grantedTierFor(userId: string): Promise<TierAnswer | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  /*
   * Through the function rather than the table, so "which grant counts" is
   * decided once, in the database, by the same expression the admin surface
   * and any future job will use. A second copy of that rule in TypeScript is a
   * second chance for the two to disagree about who is paying for what.
   */
  const { data, error } = await supabaseAdmin.rpc("ocade_active_entitlement_grant", {
    target_user: userId,
  });

  if (error) return { tier: "free", source: "unreadable" };
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  const tier = String((row as { tier?: unknown }).tier ?? "");
  if (tier !== "pro" && tier !== "max") return null;
  return { tier, source: "admin_grant" };
}

async function accountAnchorFor(userId: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("created_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.created_at) return 0;
  const parsed = Date.parse(String(data.created_at));
  return Number.isFinite(parsed) ? parsed : 0;
}

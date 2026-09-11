/**
 * WHICH PLAN AN ACCOUNT IS ON, AND WHEN ITS WINDOWS TURN OVER.
 *
 * Server-side and authoritative. The tier decides an allowance, so it is
 * resolved from rows the account cannot write: a subscription written by the
 * signature-verified provider webhook, or an audited grant an admin recorded —
 * never a profile field the person can edit and never anything the browser
 * sent.
 *
 * ONE SUBSCRIPTION AUTHORITY, SINCE PHASE 19. This module used to read
 * `ocade_subscriptions` while the webhook wrote `public.subscriptions`. Nothing
 * wrote the table this read, so a customer could complete a real payment, have
 * it verified, recorded and audited — and still be on Free. It reads the
 * provider table now; the old one is archived as history that grants nothing.
 *
 * A GRANT IS NOT A PAYMENT, AND IS RESOLVED SEPARATELY. `PLAN.md` Phase 19:
 * "Admin grants are separate entitlements, never fake payments." So they come
 * from their own table, through a function that required a role, a second
 * factor and a written reason, and the stronger of the two answers wins — a
 * customer who paid for Pro and was given Max for a support case gets Max, and
 * the record still shows exactly one payment.
 *
 * FREE IS THE ANSWER TO EVERY UNCERTAINTY. No subscription, an expired one, a
 * row naming a price from a retired catalogue, a read that failed — all of them
 * resolve to Free. That is the fail-closed direction: the cost of being wrong
 * is that somebody who paid is briefly limited to the free allowance and can
 * say so, rather than that somebody who did not pay is silently given ten times
 * it.
 *
 * THE WINDOW ANCHOR IS THE ACCOUNT'S OWN CREATION INSTANT. A fixed clock
 * boundary would reset every account in the world together — mid-morning for
 * some people, mid-sleep for others — and make the reset a stampede. Anchoring
 * to the account spreads them out and gives each person a boundary in the same
 * place in their own day. It is immutable, which matters: an anchor that moved
 * would let somebody shift their window to refill early.
 */
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

/**
 * Provider statuses that mean access is live right now.
 *
 * `past_due` is deliberately absent: a failed renewal is a payment problem the
 * customer can still fix, and continuing to serve paid capacity while the
 * charge is unpaid is a decision nobody made. `canceled` is absent for the
 * obvious reason, and a cancelled-at-period-end subscription stays `active`
 * until its period ends, which is what `current_period_end` is for.
 */
const LIVE_STATUSES = new Set(["active", "trialing"]);

/** Tiers in order, so "the stronger answer" is a comparison rather than an if. */
const TIER_RANK: Record<PlanTier, number> = { free: 0, pro: 1, max: 2 };

/**
 * Resolve the account's tier and window anchor.
 *
 * Reads with the admin client because the answer must not depend on what the
 * caller's own policies let them see — an account that could hide its own
 * subscription row could not be billed, and one that could see another's could
 * spend it.
 */
export async function resolveTierFor(userId: string): Promise<ResolvedEntitlement> {
  const anchoredAt = await accountAnchorFor(userId);
  const subscription = await providerTierFor(userId);
  const granted = await grantedTierFor(userId);

  if (!subscription && !granted) return FREE_FALLBACK(anchoredAt, "free_default");

  /*
   * THE STRONGER ANSWER WINS, AND IT IS A COMPARISON.
   *
   * Taking whichever was read first would make the tier depend on query order;
   * taking the subscription always would quietly cancel a support grant given
   * to somebody who also pays. Neither is a decision anybody would defend out
   * loud.
   */
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

  /*
   * A PERIOD THAT HAS ENDED GRANTS NOTHING, whatever the status column says.
   *
   * The status is the provider's last word, and the last word can be stale: a
   * cancellation webhook that never arrived, or a renewal that failed after
   * the period closed, both leave `active` next to a date in the past.
   */
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

/**
 * The account's creation instant.
 *
 * Falls back to the epoch rather than to "now" when it cannot be read. "Now"
 * would move the anchor on every failed read, and a moving anchor is a window
 * that can be restarted at will — which is the one property this must not have.
 * The epoch is stable, shared, and wrong only in that it clusters resets, which
 * is the failure the anchor exists to avoid rather than one it creates.
 */
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

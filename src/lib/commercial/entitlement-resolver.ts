/**
 * WHICH PLAN AN ACCOUNT IS ON, AND WHEN ITS WINDOWS TURN OVER.
 *
 * Server-side and authoritative. The tier decides an allowance, so it is
 * resolved from rows the account cannot write: a subscription created by a
 * verified provider event, never a profile field the person can edit and never
 * anything the browser sent.
 *
 * FREE IS THE ANSWER TO EVERY UNCERTAINTY. No subscription, an expired one, a
 * row naming a plan from a retired catalogue, a read that failed — all of them
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
import { isPlanId, planById, type PlanTier } from "@/lib/payments/pricing";

export interface ResolvedEntitlement {
  tier: PlanTier;
  /** Immutable instant the account's usage windows are anchored to. */
  anchoredAt: number;
  /** Why this tier, for an operator reading an audit line. */
  source: "provider_subscription" | "free_default" | "expired" | "unreadable";
}

const FREE_FALLBACK = (anchoredAt: number, source: ResolvedEntitlement["source"]) => ({
  tier: "free" as const,
  anchoredAt,
  source,
});

/**
 * Resolve the account's tier and window anchor.
 *
 * Reads with the admin client because the answer must not depend on what the
 * caller's own policies let them see — an account that could hide its own
 * subscription row could not be billed, and one that could see another's could
 * spend it.
 */
export async function resolveTierFor(userId: string): Promise<ResolvedEntitlement> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const anchoredAt = await accountAnchorFor(userId);

  const { data, error } = await supabaseAdmin
    .from("ocade_subscriptions")
    .select("plan_id, status, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return FREE_FALLBACK(anchoredAt, "unreadable");
  if (!data) return FREE_FALLBACK(anchoredAt, "free_default");

  const planId = String(data.plan_id);
  // A row naming a plan from a retired catalogue is history, not an offer, and
  // it grants nothing today.
  if (!isPlanId(planId)) return FREE_FALLBACK(anchoredAt, "expired");

  const expiresAt = data.expires_at ? Date.parse(String(data.expires_at)) : null;
  if (expiresAt !== null && Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
    return FREE_FALLBACK(anchoredAt, "expired");
  }

  const plan = planById(planId);
  if (!plan) return FREE_FALLBACK(anchoredAt, "expired");
  return { tier: plan.tier, anchoredAt, source: "provider_subscription" };
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

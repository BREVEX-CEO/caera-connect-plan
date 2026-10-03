/** Resolve tier from the audited grant authority; anchor windows to profiles.created_at. */
import type { PlanTier } from "@/lib/payments/pricing";

export interface ResolvedEntitlement {
  tier: PlanTier;
  /** Immutable instant the account's usage windows are anchored to. */
  anchoredAt: number;
  /** Why this tier, for an operator reading an audit line. */
  source: "admin_grant" | "free_default" | "unreadable";
}

export async function resolveTierFor(userId: string): Promise<ResolvedEntitlement> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [anchoredAt, grant] = await Promise.all([
    accountAnchorFor(userId),
    // "Which grant counts" is decided once, in the database.
    supabaseAdmin.rpc("ocade_active_entitlement_grant", { target_user: userId }),
  ]);

  // Fail closed: an unreadable grant is Free, never ten times the allowance.
  if (grant.error) return { tier: "free", anchoredAt, source: "unreadable" };
  const row = Array.isArray(grant.data) ? grant.data[0] : grant.data;
  const tier = String((row as { tier?: unknown } | null)?.tier ?? "");
  if (tier === "pro" || tier === "max") return { tier, anchoredAt, source: "admin_grant" };
  return { tier: "free", anchoredAt, source: "free_default" };
}

/** Never stopped by a usage window: an owner, or an owner's grant. Usage is still recorded. */
export interface Unlimited {
  why: "owner" | "grant";
  /** Null: until revoked (always, for an owner). */
  endsAt: string | null;
}

/** Whether an account is unlimited right now, as the database decides it (20261003090000). */
export async function unlimitedFor(userId: string): Promise<Unlimited | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("ocade_account_unlimited", {
    target_user: userId,
  });
  // Display only: the allowance itself is enforced in the database either way.
  if (error) return null;
  const row = data?.[0];
  return row ? { why: row.why as Unlimited["why"], endsAt: row.ends_at } : null;
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

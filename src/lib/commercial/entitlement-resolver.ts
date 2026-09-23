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

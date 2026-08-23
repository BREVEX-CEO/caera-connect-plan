/** Account entitlement readback. Chat inference is local and has no usage meter. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanId } from "@/lib/ocade-allowance";

export interface EntitlementResult {
  planId: PlanId;
  startedAt: string;
  expiresAt: string;
  status: "active" | "expired" | "cancelled";
}

/** The user's most recent subscription, or null when they have never had one. */
export const getEntitlement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EntitlementResult | null> => {
    const { data } = await context.supabase
      .from("ocade_subscriptions")
      .select("plan_id, started_at, expires_at, status")
      .eq("user_id", context.userId)
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      planId: data.plan_id as PlanId,
      startedAt: data.started_at as string,
      expiresAt: data.expires_at as string,
      status: data.status as "active" | "expired" | "cancelled",
    };
  });

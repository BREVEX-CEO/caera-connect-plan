/**
 * OCADE subscriptions and cloud allowance — server functions (Plan §33, §10).
 *
 * Reads the user's entitlement and their cloud usage for the CURRENT fixed
 * 8-hour window, and consumes allowance atomically via the SECURITY DEFINER
 * function `ocade_consume_cloud_use`.
 *
 * Enforcement rules (decisions #11, #12, #37):
 *  - LOCAL inference is unlimited and is never recorded here;
 *  - only a SUCCESSFUL cloud request consumes allowance — failed, cancelled and
 *    system-retried requests are never charged;
 *  - writes go through the server: RLS grants the client read-only access so it
 *    can neither reset nor under-report its own usage.
 *
 * STATUS: backing tables ship in the READY-TO-APPLY migration
 * `20260722100000_ocade_subscriptions_usage.sql`. Until applied, table access
 * uses the single documented bridge below (remove after types regenerate).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CLOUD_ALLOWANCE,
  currentWindow,
  consumesAllowance,
  type PlanId,
  type EngineLocality,
  type RequestOutcome,
} from "@/lib/ocade-allowance";

export interface CloudUsageResult {
  usedInWindow: number;
  windowStart: string;
  windowEnd: string;
  /** When the entitlement was last confirmed against the server. */
  verifiedAt: string;
}

/** Usage for the current fixed 8-hour window. Never counts local inference. */
export const getCloudUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CloudUsageResult> => {
    const w = currentWindow();
    const { data } = await context.supabase
      .from("ocade_cloud_usage")
      .select("used_count")
      .eq("user_id", context.userId)
      .eq("window_start", w.start.toISOString())
      .maybeSingle();
    return {
      usedInWindow: Number(data?.used_count ?? 0),
      windowStart: w.start.toISOString(),
      windowEnd: w.end.toISOString(),
      verifiedAt: new Date().toISOString(),
    };
  });

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

/**
 * Consume one cloud use, atomically and only when it should be charged.
 * Returns the resulting allowance so the caller can surface it immediately.
 */
export const consumeCloudUse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        locality: z.enum(["local", "cloud"]),
        outcome: z.enum(["success", "failed", "cancelled", "system_retry"]),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const locality = data.locality as EngineLocality;
    const outcome = data.outcome as RequestOutcome;

    // The single source of truth for "should this be charged?".
    if (!consumesAllowance(locality, outcome)) {
      return { charged: false as const, reason: "This request does not use cloud allowance." };
    }

    const w = currentWindow();
    // This function is service-role-only. Authentication above establishes the
    // user ID; the privileged client is loaded only inside the server handler.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("ocade_consume_cloud_use", {
      p_user_id: context.userId,
      p_window_start: w.start.toISOString(),
      p_limit: CLOUD_ALLOWANCE,
    });
    if (error) throw new Response(error.message, { status: 500 });

    const used = Number(result ?? 0);
    return {
      charged: true as const,
      usedInWindow: used,
      remaining: Math.max(0, CLOUD_ALLOWANCE - used),
      resetsAt: w.end.toISOString(),
    };
  });

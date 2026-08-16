/**
 * Server entry points for UPI readiness and the internal payments checklist.
 *
 * Thin on purpose: every runtime helper lives in the `.server` modules so the
 * client bundle never pulls provider credentials or the admin check.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UpiReadiness } from "@/lib/payments/upi-readiness";
import type { ChecklistRun } from "@/lib/payments/checklist";

const environment = z.enum(["sandbox", "live"]);
const currency = z.enum(["USD", "EUR", "GBP", "INR"]);

/** What the signed-in buyer would see, and why. */
export const getUpiReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: string; currency: string }) =>
    z.object({ environment, currency }).parse(data),
  )
  .handler(async ({ data }): Promise<UpiReadiness> => {
    const { probeUpiReadiness } = await import("@/lib/payments/upi-readiness.server");
    return probeUpiReadiness(data.environment, data.currency);
  });

/** Admin only: run every automatable end-to-end payment verification. */
export const runPaymentsChecklist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: string }) => z.object({ environment }).parse(data))
  .handler(async ({ data, context }): Promise<ChecklistRun> => {
    const { assertAdmin, runChecklist } = await import("@/lib/payments/checklist.server");
    await assertAdmin(context.supabase, context.userId);
    return runChecklist(context.supabase, context.userId, data.environment);
  });

/** Admin only, test environment only: trigger a renewal within the hour. */
export const fastForwardTestRenewal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { environment: string }) => z.object({ environment }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertAdmin, fastForwardRenewal } = await import("@/lib/payments/checklist.server");
    await assertAdmin(context.supabase, context.userId);
    return fastForwardRenewal(context.supabase, context.userId, data.environment);
  });

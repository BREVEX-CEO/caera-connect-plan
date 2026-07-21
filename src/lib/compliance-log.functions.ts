/**
 * Protected server-side writer for the immutable compliance_audit_log.
 *
 * Plan §10 + §15: users must never directly insert, edit, or delete
 * compliance records. RLS revokes INSERT for authenticated/anon; this
 * server function uses supabaseAdmin *after* verifying the caller.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CATEGORIES = [
  "finance",
  "payment",
  "filing",
  "signature",
  "approval",
  "role_change",
  "sensitive_export",
  "deletion",
  "other",
] as const;

const inputSchema = z.object({
  action: z.string().min(1).max(200),
  featureId: z.string().min(1).max(200),
  category: z.enum(CATEGORIES),
  tenantId: z.string().uuid().nullable().optional(),
  preview: z.record(z.string(), z.unknown()).optional(),
});

export const writeComplianceLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Optional tenant check — if the caller claims a tenant, ensure membership
    // via the caller's RLS-scoped client, never via the admin bypass.
    if (data.tenantId) {
      const { data: member } = await context.supabase
        .from("tenant_members")
        .select("tenant_id")
        .eq("tenant_id", data.tenantId)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!member) {
        throw new Response("Forbidden: not a member of tenant", { status: 403 });
      }
    }

    const { error } = await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: data.tenantId ?? null,
      action: data.action,
      feature_id: data.featureId,
      category: data.category,
      preview: (data.preview ?? {}) as never,
    });
    if (error) {
      throw new Response(`Compliance log write failed: ${error.message}`, { status: 500 });
    }
    return { ok: true as const };
  });

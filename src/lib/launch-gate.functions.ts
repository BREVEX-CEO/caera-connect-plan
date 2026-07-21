/**
 * Admin Launch Gate — server-side writers.
 *
 * All mutations go through here so we can:
 *   - Verify caller is admin (never trust client claims).
 *   - Append an immutable history row per status change.
 *   - Write a compliance audit record for every change.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUS = [
  "not_started",
  "in_progress",
  "pending_review",
  "evidence_required",
  "complete",
  "waived",
] as const;

const STAGE = ["demo", "private_alpha", "beta", "ga"] as const;

const updateItemInput = z.object({
  id: z.string().uuid(),
  status: z.enum(STATUS).optional(),
  owner: z.string().max(200).nullable().optional(),
  reviewer: z.string().max(200).nullable().optional(),
  evidence_url: z.string().url().max(500).nullable().optional(),
  applicable_modules: z.array(z.string().max(64)).max(20).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  blocker: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
  history_note: z.string().max(500).optional(),
});

async function assertAdmin(
  supabase: { from: (t: string) => any },
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error || !data) {
    throw new Response("Forbidden: admin role required", { status: 403 });
  }
}


export const updateLaunchGateItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateItemInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("launch_gate_items")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (readErr || !existing) {
      throw new Response("Launch gate item not found", { status: 404 });
    }

    const patch: Record<string, unknown> = { updated_by: context.userId };
    if (data.status !== undefined) patch.status = data.status;
    if (data.owner !== undefined) patch.owner = data.owner;
    if (data.reviewer !== undefined) patch.reviewer = data.reviewer;
    if (data.evidence_url !== undefined) patch.evidence_url = data.evidence_url;
    if (data.applicable_modules !== undefined) patch.applicable_modules = data.applicable_modules;
    if (data.due_date !== undefined) patch.due_date = data.due_date;
    if (data.blocker !== undefined) patch.blocker = data.blocker;
    if (data.notes !== undefined) patch.notes = data.notes;

    const { error: updErr } = await supabaseAdmin
      .from("launch_gate_items")
      .update(patch)
      .eq("id", data.id);
    if (updErr) throw new Response(`Update failed: ${updErr.message}`, { status: 500 });

    // Append history when status transitioned
    if (data.status !== undefined && data.status !== existing.status) {
      await supabaseAdmin.from("launch_gate_history").insert({
        item_id: data.id,
        from_status: existing.status,
        to_status: data.status,
        evidence_url: data.evidence_url ?? existing.evidence_url ?? null,
        note: data.history_note ?? null,
        changed_by: context.userId,
      });
    }

    // Compliance audit
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: null,
      action: "admin.launch_gate.update",
      feature_id: "admin.launch_gate",
      category: "approval",
      preview: {
        item_id: data.id,
        key: existing.key,
        from_status: existing.status,
        to_status: data.status ?? existing.status,
        changed_fields: Object.keys(patch).filter((k) => k !== "updated_by"),
      } as never,
    });

    return { ok: true as const };
  });

const updateFlagInput = z.object({
  id: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  enabled: z.boolean().optional(),
  stage: z.enum(STAGE).optional(),
  applicable_modules: z.array(z.string().max(64)).max(20).optional(),
});

export const upsertFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateFlagInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("feature_flags")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();

    const row: Record<string, unknown> = {
      id: data.id,
      updated_by: context.userId,
    };
    row.enabled = data.enabled ?? existing?.enabled ?? false;
    row.stage = data.stage ?? existing?.stage ?? "demo";
    row.applicable_modules = data.applicable_modules ?? existing?.applicable_modules ?? [];
    row.description = data.description ?? existing?.description ?? null;

    const { error } = await supabaseAdmin.from("feature_flags").upsert(row);
    if (error) {
      // Surface the launch-gate trigger message verbatim so admins see the reason.
      return { ok: false as const, message: error.message };
    }

    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: null,
      action: "admin.feature_flag.upsert",
      feature_id: "admin.launch_gate",
      category: "approval",
      preview: {
        flag_id: data.id,
        from_stage: existing?.stage ?? null,
        to_stage: row.stage,
        from_enabled: existing?.enabled ?? null,
        to_enabled: row.enabled,
        applicable_modules: row.applicable_modules,
      } as never,
    });

    return { ok: true as const };
  });

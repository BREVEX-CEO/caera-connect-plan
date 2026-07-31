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
import {
  evaluateRolloutAdvance,
  validateControlledGateAttestation,
  type LaunchGateStatus,
  type RolloutLaunchGate,
  type RolloutStage,
} from "@/lib/control/controlled-rollout";

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
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  blocker: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
  history_note: z.string().max(500).optional(),
});

async function assertAdmin(supabase: { from: (t: string) => any }, userId: string) {
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

    const attestationIssues = validateControlledGateAttestation({
      key: existing.key,
      status: (data.status ?? existing.status) as LaunchGateStatus,
      owner: data.owner !== undefined ? data.owner : existing.owner,
      reviewer: data.reviewer !== undefined ? data.reviewer : existing.reviewer,
      evidence_url:
        data.evidence_url !== undefined ? data.evidence_url : existing.evidence_url,
    });
    if (attestationIssues.length > 0) {
      await supabaseAdmin.from("compliance_audit_log").insert({
        user_id: context.userId,
        tenant_id: null,
        action: "admin.launch_gate.refused",
        feature_id: "admin.launch_gate",
        category: "approval",
        preview: {
          item_id: data.id,
          key: existing.key,
          to_status: data.status ?? existing.status,
          refusal_reasons: attestationIssues,
        } as never,
      });
      return { ok: false as const, message: attestationIssues.join(" ") };
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
      .update(patch as never)
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

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("feature_flags")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (existingError) {
      return {
        ok: false as const,
        message: `Feature flag state could not be verified: ${existingError.message}`,
      };
    }

    const row: Record<string, unknown> = {
      id: data.id,
      updated_by: context.userId,
    };
    row.enabled = data.enabled ?? existing?.enabled ?? false;
    row.stage = data.stage ?? existing?.stage ?? "demo";
    row.applicable_modules = data.applicable_modules ?? existing?.applicable_modules ?? [];
    row.description = data.description ?? existing?.description ?? null;

    const { data: gateRows, error: gatesError } = await supabaseAdmin
      .from("launch_gate_items")
      .select("key,status,blocker,owner,reviewer,evidence_url,applicable_modules");
    if (gatesError) {
      return {
        ok: false as const,
        message: `Rollout gates could not be verified: ${gatesError.message}`,
      };
    }

    const decision = evaluateRolloutAdvance({
      fromStage: (existing?.stage ?? null) as RolloutStage | null,
      toStage: row.stage as RolloutStage,
      enabled: row.enabled as boolean,
      applicableModules: row.applicable_modules as string[],
      gates: (gateRows ?? []) as RolloutLaunchGate[],
    });
    if (!decision.allowed) {
      await supabaseAdmin.from("compliance_audit_log").insert({
        user_id: context.userId,
        tenant_id: null,
        action: "admin.feature_flag.refused",
        feature_id: "admin.launch_gate",
        category: "approval",
        preview: {
          flag_id: data.id,
          from_stage: decision.fromStage,
          to_stage: decision.toStage,
          refusal_codes: decision.refusals.map((refusal) => refusal.code),
          gate_keys: decision.checkedGateKeys,
        } as never,
      });
      return {
        ok: false as const,
        message: decision.refusals.map((refusal) => refusal.message).join(" "),
      };
    }

    const { error } = await supabaseAdmin.from("feature_flags").upsert(row as never);
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

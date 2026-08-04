/**
 * FICIA Timesheet & Attendance — server functions.
 *
 * Honest measurement rules enforced here:
 *  - Only ONE running entry per user per tenant (DB unique index).
 *  - Break windows are stored inside the entry and excluded from duration.
 *  - Activity samples are refused unless a live consent row exists (RLS).
 *  - Auto-pause closes the entry at the last-active moment when idle exceeds
 *    the company threshold; the raw run time is never counted.
 *  - Locked periods cannot be edited (DB trigger).
 *  - Approve / reject / lock / reopen write to the compliance audit log via
 *    the service-role writer.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

async function writeCompliance(args: {
  userId: string;
  action: string;
  featureId: string;
  category: string;
  tenantId?: string | null;
  preview?: Record<string, unknown>;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("compliance_audit_log").insert({
    user_id: args.userId,
    tenant_id: args.tenantId ?? null,
    action: args.action,
    feature_id: args.featureId,
    category: args.category,
    preview: args.preview ?? {},
  } as never);
}

// ============ Policies ============

const policyPatch = z.object({
  tenant_id: uuid,
  timezone: z.string().max(80).optional(),
  workdays: z.array(z.number().int().min(1).max(7)).optional(),
  weekly_offs: z.array(z.number().int().min(1).max(7)).optional(),
  shift_start: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional(),
  shift_end: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional(),
  daily_hours_target: z.number().min(0).max(24).optional(),
  weekly_hours_target: z.number().min(0).max(168).optional(),
  break_minutes_paid: z.number().int().min(0).max(480).optional(),
  break_minutes_unpaid: z.number().int().min(0).max(480).optional(),
  idle_threshold_minutes: z.number().int().min(1).max(240).optional(),
  auto_pause_enabled: z.boolean().optional(),
  overtime_rules: z.record(z.string(), z.any()).optional(),
  holidays: z.array(z.object({ date: isoDate, label: z.string().max(120) })).optional(),
  billable_default: z.boolean().optional(),
  allowed_work_modes: z.array(z.enum(["office", "remote", "hybrid", "field"])).optional(),
  screen_recording_available: z.boolean().optional(),
});

export const getPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("ficia_time_policies")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 400 });
    return { policy: row };
  });

export const savePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => policyPatch.parse(i))
  .handler(async ({ data, context }) => {
    const { tenant_id, ...patch } = data;
    const { error } = await context.supabase
      .from("ficia_time_policies")
      .upsert({ tenant_id, updated_by: context.userId, ...patch } as never, {
        onConflict: "tenant_id",
      });
    if (error) return { ok: false as const, message: error.message };
    await writeCompliance({
      userId: context.userId,
      action: "ficia.time.policy.save",
      featureId: "ficia.timesheet",
      category: "approval",
      tenantId: tenant_id,
      preview: patch,
    });
    return { ok: true as const };
  });

// ============ Projects & Tasks ============

export const listProjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ficia_projects")
      .select(
        "id, code, name, client_name, department_id, billable_default, billing_rate_cents, currency, status",
      )
      .eq("tenant_id", data.tenant_id)
      .order("name");
    if (error) throw new Response(error.message, { status: 400 });
    return { projects: rows ?? [] };
  });

const projectInput = z.object({
  tenant_id: uuid,
  id: uuid.optional(),
  code: z.string().max(40).nullable().optional(),
  name: z.string().min(1).max(200),
  client_name: z.string().max(200).nullable().optional(),
  department_id: uuid.nullable().optional(),
  billable_default: z.boolean().optional(),
  billing_rate_cents: z.number().int().min(0).nullable().optional(),
  currency: z.string().max(6).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const upsertProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => projectInput.parse(i))
  .handler(async ({ data, context }) => {
    const insertOrUpdate = { ...data, created_by: context.userId };
    const { data: row, error } = data.id
      ? await context.supabase
          .from("ficia_projects")
          .update(insertOrUpdate as never)
          .eq("id", data.id)
          .select("id")
          .single()
      : await context.supabase
          .from("ficia_projects")
          .insert(insertOrUpdate as never)
          .select("id")
          .single();
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, id: (row as any).id as string };
  });

export const listTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid, project_id: uuid.optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ficia_tasks")
      .select("id, project_id, name, billable_default, status")
      .eq("tenant_id", data.tenant_id);
    if (data.project_id) q = q.eq("project_id", data.project_id);
    const { data: rows, error } = await q.order("name");
    if (error) throw new Response(error.message, { status: 400 });
    return { tasks: rows ?? [] };
  });

const taskInput = z.object({
  tenant_id: uuid,
  id: uuid.optional(),
  project_id: uuid,
  name: z.string().min(1).max(200),
  billable_default: z.boolean().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export const upsertTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => taskInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = data.id
      ? await context.supabase
          .from("ficia_tasks")
          .update(data as never)
          .eq("id", data.id)
          .select("id")
          .single()
      : await context.supabase
          .from("ficia_tasks")
          .insert(data as never)
          .select("id")
          .single();
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, id: (row as any).id as string };
  });

// ============ Consent ============

export const getMyConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ficia_time_consents")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", context.userId)
      .is("revoked_at", null)
      .order("accepted_at", { ascending: false })
      .limit(1);
    if (error) throw new Response(error.message, { status: 400 });
    return { consent: (rows ?? [])[0] ?? null };
  });

const consentInput = z.object({
  tenant_id: uuid,
  activity_monitoring: z.boolean(),
  auto_pause: z.boolean(),
  screen_recording_optin: z.boolean(),
  accepted_terms: z.string().min(20).max(4000),
  user_agent: z.string().max(500).optional(),
});

export const saveConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => consentInput.parse(i))
  .handler(async ({ data, context }) => {
    // Revoke any active consent then insert a new one — keeps full audit trail.
    await context.supabase
      .from("ficia_time_consents")
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", context.userId)
      .is("revoked_at", null);

    const { data: row, error } = await context.supabase
      .from("ficia_time_consents")
      .insert({
        tenant_id: data.tenant_id,
        user_id: context.userId,
        activity_monitoring: data.activity_monitoring,
        auto_pause: data.auto_pause,
        screen_recording_optin: data.screen_recording_optin,
        accepted_terms: data.accepted_terms,
        user_agent: data.user_agent ?? null,
      } as never)
      .select("id")
      .single();
    if (error) return { ok: false as const, message: error.message };
    await writeCompliance({
      userId: context.userId,
      action: "ficia.time.consent.save",
      featureId: "ficia.timesheet",
      category: "consent",
      tenantId: data.tenant_id,
      preview: {
        activity_monitoring: data.activity_monitoring,
        auto_pause: data.auto_pause,
        screen_recording_optin: data.screen_recording_optin,
      },
    });
    return { ok: true as const, id: (row as any).id as string };
  });

export const revokeConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ficia_time_consents")
      .update({ revoked_at: new Date().toISOString() } as never)
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", context.userId)
      .is("revoked_at", null);
    if (error) return { ok: false as const, message: error.message };
    await writeCompliance({
      userId: context.userId,
      action: "ficia.time.consent.revoke",
      featureId: "ficia.timesheet",
      category: "consent",
      tenantId: data.tenant_id,
    });
    return { ok: true as const };
  });

// ============ Entries ============

export const getRunningEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ficia_time_entries")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", context.userId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1);
    if (error) throw new Response(error.message, { status: 400 });
    return { entry: (rows ?? [])[0] ?? null };
  });

const clockInInput = z.object({
  tenant_id: uuid,
  project_id: uuid.nullable().optional(),
  task_id: uuid.nullable().optional(),
  department_id: uuid.nullable().optional(),
  description: z.string().max(1000).optional(),
  work_mode: z.enum(["office", "remote", "hybrid", "field"]).optional(),
  billable: z.boolean().optional(),
  ai_time_source: z.enum(["manual", "assisted", "autonomous"]).default("manual"),
});

export const clockIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => clockInInput.parse(i))
  .handler(async ({ data, context }) => {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const { data: row, error } = await context.supabase
      .from("ficia_time_entries")
      .insert({
        tenant_id: data.tenant_id,
        user_id: context.userId,
        entry_date: dateStr,
        started_at: now.toISOString(),
        project_id: data.project_id ?? null,
        task_id: data.task_id ?? null,
        department_id: data.department_id ?? null,
        description: data.description ?? null,
        work_mode: data.work_mode ?? null,
        billable: data.billable ?? false,
        source: "clock",
        status: "draft",
      } as never)
      .select("*")
      .single();
    if (error) {
      if (error.message.includes("uq_ficia_time_entries_running")) {
        return { ok: false as const, message: "A timer is already running. Clock out first." };
      }
      return { ok: false as const, message: error.message };
    }
    await context.supabase.from("ficia_time_events").insert({
      tenant_id: data.tenant_id,
      user_id: context.userId,
      entry_id: (row as any).id,
      kind: "clock_in",
      metadata: { source: data.ai_time_source },
    } as never);
    return { ok: true as const, entry: row };
  });

const clockOutInput = z.object({
  tenant_id: uuid,
  entry_id: uuid,
  at: z.string().datetime().optional(), // for auto-pause: last active time
  reason: z.enum(["manual", "auto_pause"]).default("manual"),
  ai_time_split: z
    .object({
      manual_seconds: z.number().int().min(0),
      assisted_seconds: z.number().int().min(0),
      autonomous_seconds: z.number().int().min(0),
    })
    .optional(),
});

function computeEntryDuration(row: any, endedAt: Date) {
  const start = new Date(row.started_at).getTime();
  const end = endedAt.getTime();
  let breakMs = 0;
  const breaks: Array<{ start: string; end?: string }> = row.breaks ?? [];
  for (const b of breaks) {
    if (b.start && b.end)
      breakMs += Math.max(0, new Date(b.end).getTime() - new Date(b.start).getTime());
    else if (b.start && !b.end) breakMs += Math.max(0, end - new Date(b.start).getTime());
  }
  const grossSec = Math.max(0, Math.floor((end - start) / 1000));
  const breakSec = Math.min(grossSec, Math.floor(breakMs / 1000));
  return { grossSec, breakSec, netSec: grossSec - breakSec };
}

export const clockOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => clockOutInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error: readErr } = await context.supabase
      .from("ficia_time_entries")
      .select("*")
      .eq("id", data.entry_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (readErr || !row) return { ok: false as const, message: "Entry not found." };
    if ((row as any).ended_at) return { ok: false as const, message: "Entry already stopped." };

    const endedAt = data.at ? new Date(data.at) : new Date();
    // Close any open break at endedAt as well.
    const breaks: Array<{ start: string; end?: string }> = (row as any).breaks ?? [];
    const closedBreaks = breaks.map((b) =>
      b.start && !b.end ? { ...b, end: endedAt.toISOString() } : b,
    );
    const patched = { ...(row as any), breaks: closedBreaks };
    const { grossSec, breakSec, netSec } = computeEntryDuration(patched, endedAt);

    const split = data.ai_time_split ?? {
      manual_seconds: netSec,
      assisted_seconds: 0,
      autonomous_seconds: 0,
    };

    const { error } = await context.supabase
      .from("ficia_time_entries")
      .update({
        ended_at: endedAt.toISOString(),
        breaks: closedBreaks,
        duration_seconds: netSec,
        break_seconds: breakSec,
        ai_time_split: split,
      } as never)
      .eq("id", data.entry_id);
    if (error) return { ok: false as const, message: error.message };

    await context.supabase.from("ficia_time_events").insert({
      tenant_id: data.tenant_id,
      user_id: context.userId,
      entry_id: data.entry_id,
      kind: data.reason === "auto_pause" ? "auto_pause" : "clock_out",
      metadata: {
        gross_seconds: grossSec,
        net_seconds: netSec,
        break_seconds: breakSec,
        reason: data.reason,
      },
    } as never);
    return { ok: true as const, duration_seconds: netSec };
  });

export const startBreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid, entry_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("ficia_time_entries")
      .select("breaks, user_id, ended_at")
      .eq("id", data.entry_id)
      .maybeSingle();
    if (!row || (row as any).user_id !== context.userId)
      return { ok: false as const, message: "Entry not found." };
    if ((row as any).ended_at) return { ok: false as const, message: "Timer not running." };
    const breaks: Array<{ start: string; end?: string }> = (row as any).breaks ?? [];
    if (breaks.some((b) => !b.end))
      return { ok: false as const, message: "A break is already active." };
    breaks.push({ start: new Date().toISOString() });
    const { error } = await context.supabase
      .from("ficia_time_entries")
      .update({ breaks } as never)
      .eq("id", data.entry_id);
    if (error) return { ok: false as const, message: error.message };
    await context.supabase.from("ficia_time_events").insert({
      tenant_id: data.tenant_id,
      user_id: context.userId,
      entry_id: data.entry_id,
      kind: "break_start",
    } as never);
    return { ok: true as const };
  });

export const endBreak = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid, entry_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("ficia_time_entries")
      .select("breaks, user_id, ended_at")
      .eq("id", data.entry_id)
      .maybeSingle();
    if (!row || (row as any).user_id !== context.userId)
      return { ok: false as const, message: "Entry not found." };
    const breaks: Array<{ start: string; end?: string }> = (row as any).breaks ?? [];
    const open = breaks.find((b) => !b.end);
    if (!open) return { ok: false as const, message: "No active break." };
    open.end = new Date().toISOString();
    const { error } = await context.supabase
      .from("ficia_time_entries")
      .update({ breaks } as never)
      .eq("id", data.entry_id);
    if (error) return { ok: false as const, message: error.message };
    await context.supabase.from("ficia_time_events").insert({
      tenant_id: data.tenant_id,
      user_id: context.userId,
      entry_id: data.entry_id,
      kind: "break_end",
    } as never);
    return { ok: true as const };
  });

const manualEntryInput = z.object({
  tenant_id: uuid,
  entry_date: isoDate,
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  break_seconds: z.number().int().min(0).default(0),
  project_id: uuid.nullable().optional(),
  task_id: uuid.nullable().optional(),
  department_id: uuid.nullable().optional(),
  description: z.string().max(1000),
  work_mode: z.enum(["office", "remote", "hybrid", "field"]).optional(),
  billable: z.boolean().optional(),
  ai_time_split: z
    .object({
      manual_seconds: z.number().int().min(0),
      assisted_seconds: z.number().int().min(0),
      autonomous_seconds: z.number().int().min(0),
    })
    .optional(),
  evidence: z
    .array(z.object({ kind: z.string(), url: z.string(), label: z.string().max(200) }))
    .optional(),
});

export const addManualEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => manualEntryInput.parse(i))
  .handler(async ({ data, context }) => {
    const start = new Date(data.started_at).getTime();
    const end = new Date(data.ended_at).getTime();
    if (end <= start) return { ok: false as const, message: "End must be after start." };
    const grossSec = Math.floor((end - start) / 1000);
    const netSec = Math.max(0, grossSec - (data.break_seconds ?? 0));
    if (!data.description || data.description.trim().length < 3) {
      return { ok: false as const, message: "Description is required for manual entries." };
    }
    const split = data.ai_time_split ?? {
      manual_seconds: netSec,
      assisted_seconds: 0,
      autonomous_seconds: 0,
    };
    const { data: row, error } = await context.supabase
      .from("ficia_time_entries")
      .insert({
        tenant_id: data.tenant_id,
        user_id: context.userId,
        entry_date: data.entry_date,
        started_at: data.started_at,
        ended_at: data.ended_at,
        duration_seconds: netSec,
        break_seconds: data.break_seconds ?? 0,
        project_id: data.project_id ?? null,
        task_id: data.task_id ?? null,
        department_id: data.department_id ?? null,
        description: data.description,
        work_mode: data.work_mode ?? null,
        billable: data.billable ?? false,
        source: "manual",
        ai_time_split: split,
        evidence: data.evidence ?? [],
        status: "draft",
      } as never)
      .select("id")
      .single();
    if (error) return { ok: false as const, message: error.message };
    await context.supabase.from("ficia_time_events").insert({
      tenant_id: data.tenant_id,
      user_id: context.userId,
      entry_id: (row as any).id,
      kind: "manual_edit",
      metadata: { source: "manual_entry" },
    } as never);
    return { ok: true as const, id: (row as any).id as string };
  });

const updateEntryInput = z.object({
  tenant_id: uuid,
  id: uuid,
  patch: z.object({
    description: z.string().max(1000).nullable().optional(),
    project_id: uuid.nullable().optional(),
    task_id: uuid.nullable().optional(),
    department_id: uuid.nullable().optional(),
    billable: z.boolean().optional(),
    work_mode: z.enum(["office", "remote", "hybrid", "field"]).nullable().optional(),
    ai_time_split: z
      .object({
        manual_seconds: z.number().int().min(0),
        assisted_seconds: z.number().int().min(0),
        autonomous_seconds: z.number().int().min(0),
      })
      .optional(),
    evidence: z
      .array(z.object({ kind: z.string(), url: z.string(), label: z.string().max(200) }))
      .optional(),
  }),
});

export const updateEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => updateEntryInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ficia_time_entries")
      .update(data.patch as never)
      .eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

export const deleteEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid, id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ficia_time_entries").delete().eq("id", data.id);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

export const submitEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid, ids: z.array(uuid).min(1).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ficia_time_entries")
      .update({ status: "submitted" } as never)
      .in("id", data.ids)
      .eq("user_id", context.userId)
      .in("status", ["draft", "rejected"]);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, count: data.ids.length };
  });

// ============ Reads / lists ============

const rangeInput = z.object({
  tenant_id: uuid,
  from: isoDate,
  to: isoDate,
  user_id: uuid.optional(),
  project_id: uuid.optional(),
  status: z.enum(["draft", "submitted", "approved", "rejected", "locked"]).optional(),
});

export const listEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => rangeInput.parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ficia_time_entries")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .gte("entry_date", data.from)
      .lte("entry_date", data.to)
      .order("started_at", { ascending: false })
      .limit(1000);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (data.project_id) q = q.eq("project_id", data.project_id);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    return { entries: rows ?? [] };
  });

export const listApprovalQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ficia_time_entries")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .eq("status", "submitted")
      .order("entry_date", { ascending: false })
      .limit(500);
    if (error) throw new Response(error.message, { status: 400 });
    return { entries: rows ?? [] };
  });

const decideInput = z.object({
  tenant_id: uuid,
  id: uuid,
  decision: z.enum(["approve", "reject", "request_correction"]),
  reason: z.string().max(500).optional(),
});

export const decideEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => decideInput.parse(i))
  .handler(async ({ data, context }) => {
    const patch: Record<string, unknown> = {};
    if (data.decision === "approve") {
      patch.status = "approved";
      patch.approved_by = context.userId;
      patch.approved_at = new Date().toISOString();
      patch.rejected_reason = null;
    } else if (data.decision === "reject") {
      patch.status = "rejected";
      patch.rejected_reason = data.reason ?? null;
    } else {
      patch.status = "rejected";
      patch.rejected_reason = data.reason
        ? `Correction requested: ${data.reason}`
        : "Correction requested.";
    }
    const { error } = await context.supabase
      .from("ficia_time_entries")
      .update(patch as never)
      .eq("id", data.id)
      .eq("tenant_id", data.tenant_id);
    if (error) return { ok: false as const, message: error.message };
    await writeCompliance({
      userId: context.userId,
      action: `ficia.time.entry.${data.decision}`,
      featureId: "ficia.timesheet",
      category: "approval",
      tenantId: data.tenant_id,
      preview: { entry_id: data.id, reason: data.reason ?? null },
    });
    return { ok: true as const };
  });

// ============ Periods ============

const lockInput = z.object({
  tenant_id: uuid,
  period_start: isoDate,
  period_end: isoDate,
  label: z.string().max(200).optional(),
  reason: z.string().max(500).optional(),
});

export const lockPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => lockInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: period, error: pErr } = await context.supabase
      .from("ficia_time_periods")
      .insert({
        tenant_id: data.tenant_id,
        period_start: data.period_start,
        period_end: data.period_end,
        label: data.label ?? null,
        reason: data.reason ?? null,
        locked_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (pErr) return { ok: false as const, message: pErr.message };

    // Lock every APPROVED entry that falls within the range.
    const { error: eErr, count } = await context.supabase
      .from("ficia_time_entries")
      .update({ status: "locked", locked_period_id: (period as any).id } as never, {
        count: "exact",
      })
      .eq("tenant_id", data.tenant_id)
      .eq("status", "approved")
      .gte("entry_date", data.period_start)
      .lte("entry_date", data.period_end);
    if (eErr) return { ok: false as const, message: eErr.message };

    await writeCompliance({
      userId: context.userId,
      action: "ficia.time.period.lock",
      featureId: "ficia.timesheet",
      category: "approval",
      tenantId: data.tenant_id,
      preview: {
        period_start: data.period_start,
        period_end: data.period_end,
        locked_entries: count ?? 0,
      },
    });
    return { ok: true as const, id: (period as any).id, locked_entries: count ?? 0 };
  });

export const listPeriods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ficia_time_periods")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .order("period_end", { ascending: false });
    if (error) throw new Response(error.message, { status: 400 });
    return { periods: rows ?? [] };
  });

// ============ Activity samples ============

const sampleInput = z.object({
  tenant_id: uuid,
  entry_id: uuid,
  samples: z
    .array(
      z.object({
        at: z.string().datetime(),
        state: z.enum(["active", "idle", "minimized", "closed", "disconnected"]),
        idle_seconds: z.number().int().min(0).max(86400),
        window_focus: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const recordActivitySamples = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => sampleInput.parse(i))
  .handler(async ({ data, context }) => {
    const rows = data.samples.map((s) => ({
      tenant_id: data.tenant_id,
      user_id: context.userId,
      entry_id: data.entry_id,
      at: s.at,
      state: s.state,
      idle_seconds: s.idle_seconds,
      window_focus: s.window_focus ?? null,
    }));
    const { error } = await context.supabase
      .from("ficia_time_activity_samples")
      .insert(rows as never);
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const, count: rows.length };
  });

// ============ Reports ============

export const reportRollup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => rangeInput.parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ficia_time_entries")
      .select(
        "user_id, project_id, department_id, duration_seconds, break_seconds, billable, status, ai_time_split, currency, billing_rate_cents",
      )
      .eq("tenant_id", data.tenant_id)
      .gte("entry_date", data.from)
      .lte("entry_date", data.to)
      .in("status", data.status ? [data.status] : ["approved", "locked"]);
    if (data.user_id) q = q.eq("user_id", data.user_id);
    if (data.project_id) q = q.eq("project_id", data.project_id);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });

    const byUser: Record<
      string,
      {
        seconds: number;
        billable_seconds: number;
        manual: number;
        assisted: number;
        autonomous: number;
      }
    > = {};
    const byProject: Record<
      string,
      { seconds: number; billable_seconds: number; amount_cents: number; currency: string | null }
    > = {};

    for (const r of rows ?? []) {
      const secs = (r as any).duration_seconds ?? 0;
      const uid = (r as any).user_id as string;
      byUser[uid] ??= { seconds: 0, billable_seconds: 0, manual: 0, assisted: 0, autonomous: 0 };
      byUser[uid].seconds += secs;
      if ((r as any).billable) byUser[uid].billable_seconds += secs;
      const split = (r as any).ai_time_split ?? {};
      byUser[uid].manual += split.manual_seconds ?? 0;
      byUser[uid].assisted += split.assisted_seconds ?? 0;
      byUser[uid].autonomous += split.autonomous_seconds ?? 0;

      const pid = (r as any).project_id ?? "_unassigned";
      byProject[pid] ??= {
        seconds: 0,
        billable_seconds: 0,
        amount_cents: 0,
        currency: (r as any).currency ?? null,
      };
      byProject[pid].seconds += secs;
      if ((r as any).billable) {
        byProject[pid].billable_seconds += secs;
        const rate = (r as any).billing_rate_cents ?? 0;
        byProject[pid].amount_cents += Math.round((secs / 3600) * rate);
      }
    }
    return { byUser, byProject, count: rows?.length ?? 0 };
  });

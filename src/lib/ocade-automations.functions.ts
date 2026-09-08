/**
 * OCADE automations — server functions (Plan §33).
 *
 * Thin persistence + orchestration around the unit-tested engine in
 * `ocade-automations.ts`. The engine decides plans, risk, approval, retry and
 * cancellation; this module stores the result and enforces ownership.
 *
 * STATUS: backing tables ship in the READY-TO-APPLY migration
 * `20260722110000_ocade_automations.sql`. Until it is applied the generated
 * Database type has no knowledge of them, so access goes through the single
 * documented bridge below (remove after types regenerate).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  planRun,
  initialStatus,
  nextRunAt,
  applyApproval,
  canCancel,
  canPause,
  canResume,
  type Automation,
  type AutomationTrigger,
  type RunStatus,
} from "@/lib/ocade-automations";
import { type CompanionAction } from "@/lib/native/companion-bridge";
import { redactForAudit } from "@/lib/security/protected-text";
import { LIST_CAP } from "@/lib/supabase/read-all";

const uuid = z.string().uuid();

const triggerSchema: z.ZodType<AutomationTrigger> = z.union([
  z.object({ kind: z.literal("manual") }),
  z.object({
    kind: z.literal("interval"),
    everyMinutes: z
      .number()
      .int()
      .min(1)
      .max(60 * 24 * 30),
  }),
  z.object({
    kind: z.literal("daily"),
    atHourUtc: z.number().int().min(0).max(23),
    atMinuteUtc: z.number().int().min(0).max(59).optional(),
  }),
  z.object({ kind: z.literal("condition"), expression: z.string().min(1).max(500) }),
]);

const actionSchema: z.ZodType<CompanionAction> = z.union([
  z.object({ kind: z.literal("screen.read") }),
  z.object({ kind: z.literal("window.list") }),
  z.object({ kind: z.literal("window.focus"), target: z.string().min(1).max(300) }),
  z.object({
    kind: z.literal("window.arrange"),
    layout: z.enum(["left", "right", "maximize", "restore"]),
    target: z.string().max(300).optional(),
  }),
  z.object({ kind: z.literal("app.open"), appId: z.string().min(1).max(300) }),
  z.object({ kind: z.literal("file.open"), path: z.string().min(1).max(1000) }),
  z.object({ kind: z.literal("text.type"), text: z.string().max(5000) }),
  z.object({ kind: z.literal("clipboard.read") }),
  z.object({ kind: z.literal("clipboard.write"), text: z.string().max(5000) }),
  z.object({ kind: z.literal("selection.read") }),
  z.object({ kind: z.literal("selection.replace"), text: z.string().max(5000) }),
]);

export interface AutomationRow {
  id: string;
  name: string;
  enabled: boolean;
  paused: boolean;
  trigger: AutomationTrigger;
  actions: CompanionAction[];
  requires_approval: boolean;
  dry_run: boolean;
  max_attempts: number;
  next_run_at: string | null;
  last_run_at: string | null;
  updated_at: string;
}

export interface RunRow {
  id: string;
  automation_id: string;
  status: RunStatus;
  attempt: number;
  dry_run: boolean;
  highest_risk: string | null;
  blocked_reason: string | null;
  error: string | null;
  approval_decision: "approved" | "denied" | null;
  approval_expires_at: string | null;
  cancel_requested_at: string | null;
  pause_requested_at: string | null;
  deadline_at: string | null;
  created_at: string;
  finished_at: string | null;
  plan: { steps?: { summary: string; risk: string; requiresConfirmation: boolean }[] } | null;
}

function toEngine(row: AutomationRow): Automation {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    trigger: row.trigger,
    actions: row.actions,
    requiresApproval: row.requires_approval,
    dryRun: row.dry_run,
    maxAttempts: row.max_attempts,
  };
}

/* -------------------------------------------------------- automations ---- */

export const listAutomations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ocade_automations")
      .select(
        "id, name, enabled, paused, trigger, actions, requires_approval, dry_run, max_attempts, next_run_at, last_run_at, updated_at",
      )
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(LIST_CAP);
    if (error) throw new Response(error.message, { status: 500 });
    return (data ?? []) as AutomationRow[];
  });

export const createAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        trigger: triggerSchema.default({ kind: "manual" }),
        actions: z.array(actionSchema).max(50).default([]),
        requiresApproval: z.boolean().default(true),
        dryRun: z.boolean().default(false),
        maxAttempts: z.number().int().min(1).max(10).default(3),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const next = nextRunAt(data.trigger, new Date());
    const { data: row, error } = await context.supabase
      .from("ocade_automations")
      .insert({
        user_id: context.userId,
        name: data.name,
        trigger: data.trigger,
        actions: data.actions,
        requires_approval: data.requiresApproval,
        dry_run: data.dryRun,
        max_attempts: data.maxAttempts,
        next_run_at: next ? next.toISOString() : null,
      })
      .select("id, name")
      .single();
    if (error) throw new Response(error.message, { status: 500 });
    return row as { id: string; name: string };
  });

export const updateAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        id: uuid,
        name: z.string().trim().min(1).max(200).optional(),
        enabled: z.boolean().optional(),
        paused: z.boolean().optional(),
        trigger: triggerSchema.optional(),
        actions: z.array(actionSchema).max(50).optional(),
        requiresApproval: z.boolean().optional(),
        dryRun: z.boolean().optional(),
        maxAttempts: z.number().int().min(1).max(10).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    // Typed against the table's Update shape: a misspelled column is now a
    // compile error rather than a key the database silently ignores.
    const patch: Database["public"]["Tables"]["ocade_automations"]["Update"] = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.enabled !== undefined) patch.enabled = data.enabled;
    if (data.paused !== undefined) patch.paused = data.paused;
    if (data.actions !== undefined) patch.actions = data.actions;
    if (data.requiresApproval !== undefined) patch.requires_approval = data.requiresApproval;
    if (data.dryRun !== undefined) patch.dry_run = data.dryRun;
    if (data.maxAttempts !== undefined) patch.max_attempts = data.maxAttempts;
    if (data.trigger !== undefined) {
      patch.trigger = data.trigger;
      const next = nextRunAt(data.trigger, new Date());
      patch.next_run_at = next ? next.toISOString() : null;
    }
    const { error } = await context.supabase
      .from("ocade_automations")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

export const deleteAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ocade_automations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Response(error.message, { status: 500 });
    return { ok: true as const };
  });

/* ---------------------------------------------------------------- runs ---- */

async function loadAutomation(
  supabase: SupabaseClient<Database>,
  userId: string,
  id: string,
): Promise<AutomationRow> {
  const { data } = await supabase
    .from("ocade_automations")
    .select(
      "id, name, enabled, paused, trigger, actions, requires_approval, dry_run, max_attempts, next_run_at, last_run_at, updated_at",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Response("Automation not found", { status: 404 });
  return data as AutomationRow;
}

/**
 * Compute the plan WITHOUT persisting anything — the dry-run/permission preview
 * the user sees before approving.
 */
export const previewAutomation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const row = await loadAutomation(context.supabase, context.userId, data.id);
    const plan = planRun(toEngine(row));
    return {
      ...plan,
      steps: plan.steps.map((s) => ({ ...s, summary: redactForAudit(s.summary) })),
    };
  });

/** Start a run. Blocked plans are recorded as blocked and never execute. */
export const startAutomationRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({
        id: uuid,
        dryRun: z.boolean().optional(),
        deadlineAt: z.string().datetime().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const row = await loadAutomation(context.supabase, context.userId, data.id);
    const automation = toEngine(row);
    const dryRun = data.dryRun ?? automation.dryRun;
    const plan = planRun(automation);
    const status = initialStatus(plan, dryRun);
    if (data.deadlineAt && Date.parse(data.deadlineAt) <= Date.now()) {
      throw new Response("The run deadline must be in the future.", { status: 400 });
    }

    /*
     * Never double-start.
     *
     * A double-click, a second open tab, and the 60s scheduler tick racing a
     * manual "Run now" can all reach here at once. A dry run is a harmless
     * simulation and is always allowed; a real run returns the EXISTING
     * in-flight run instead of creating a second one, so this is idempotent
     * rather than an error the caller has to handle.
     *
     * A partial unique index in the migration is the authoritative guard — this
     * The enqueue RPC locks the parent row and performs the existing-run check,
     * insert, and schedule advance in one transaction; the unique index remains
     * the final database invariant.
     */
    const redactedPlan = {
      ...plan,
      steps: plan.steps.map((s) => ({
        summary: redactForAudit(s.summary),
        risk: s.risk,
        requiresConfirmation: s.requiresConfirmation,
      })),
    };

    /*
     * Advance the schedule.
     *
     * Recording only `last_run_at` left `next_run_at` permanently in the past
     * once an automation first became due. The scheduler reads that column, so
     * the automation would fire, finish, and fire again on the very next 60s
     * tick — an "every 24 hours" schedule would in practice run every minute.
     * The in-flight guard prevents CONCURRENT runs, so this showed up as a
     * runaway series of sequential runs rather than an obvious error.
     *
     * A dry run is a simulation and must not consume the schedule slot. The RPC
     * persists the run and this schedule advance atomically.
     */
    const startedAt = new Date();
    const next = dryRun ? null : nextRunAt(automation.trigger, startedAt, startedAt);
    const { data: persisted, error } = await context.supabase.rpc("ocade_enqueue_automation_run", {
      p_automation_id: row.id,
      p_status: status,
      p_dry_run: dryRun,
      p_plan: redactedPlan,
      // jsonb column: the step objects are serialised as-is. `Json` is a
      // structural type and RunStep has no index signature, so the cast
      // states what the round-trip already does rather than hiding a shape
      // mismatch — `runStepsFromJson` parses it back on the way out.
      p_execution_steps: (plan.blocked || dryRun ? [] : plan.steps) as unknown as Json,
      p_highest_risk: plan.highestRisk,
      p_blocked_reason: plan.blockedReason ?? undefined,
      p_deadline_at: data.deadlineAt ?? undefined,
      p_next_run_at: next ? next.toISOString() : undefined,
    });
    if (error) throw new Response(error.message, { status: 500 });
    const run = (Array.isArray(persisted) ? persisted[0] : persisted) as {
      id?: unknown;
      status?: unknown;
      reused?: unknown;
    } | null;
    if (
      !run ||
      typeof run.id !== "string" ||
      !["pending", "awaiting_approval", "running", "paused", "succeeded", "blocked"].includes(
        String(run.status),
      ) ||
      typeof run.reused !== "boolean"
    ) {
      throw new Response("The database returned an invalid automation enqueue result.", {
        status: 500,
      });
    }

    return {
      id: run.id,
      status: run.status as RunStatus,
      dryRun,
      reused: run.reused,
      executed: false as const,
    };
  });

export const listAutomationRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ automationId: uuid.optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("ocade_automation_runs")
      .select(
        "id, automation_id, status, attempt, dry_run, highest_risk, blocked_reason, error, approval_decision, approval_expires_at, cancel_requested_at, pause_requested_at, deadline_at, created_at, finished_at, plan",
      )
      .eq("user_id", context.userId);
    if (data.automationId) q = q.eq("automation_id", data.automationId);
    const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(100);
    if (error) throw new Response(error.message, { status: 500 });
    return (rows ?? []) as RunRow[];
  });

/** Approve or deny a run awaiting a human decision. */
export const decideAutomationRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) =>
    z
      .object({ runId: uuid, decision: z.enum(["approved", "denied"]), deviceId: uuid.optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: run } = await context.supabase
      .from("ocade_automation_runs")
      .select("id, status")
      .eq("id", data.runId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!run) throw new Response("Run not found", { status: 404 });

    // The engine decides the resulting status: approved -> queued (pending),
    // denied -> cancelled. It also refuses runs that weren't awaiting approval.
    const { status: next, reason } = applyApproval(run.status as RunStatus, data.decision);
    const { data: persisted, error } = await context.supabase.rpc("ocade_decide_automation_run", {
      p_run_id: data.runId,
      p_decision: data.decision,
      p_device_id: data.deviceId ?? undefined,
    });
    if (error) throw new Response(error.message, { status: 500 });
    if (persisted === "approval_expired") {
      throw new Response("The approval request expired before it was answered.", { status: 410 });
    }
    if (persisted !== next) {
      throw new Response("This run is no longer awaiting approval.", { status: 409 });
    }
    return { status: next, reason };
  });

/** Cancel a run. Terminal runs are rejected by the engine's canCancel guard. */
export const cancelAutomationRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ runId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: run } = await context.supabase
      .from("ocade_automation_runs")
      .select("id, status")
      .eq("id", data.runId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!run) throw new Response("Run not found", { status: 404 });
    if (!canCancel(run.status as RunStatus)) {
      throw new Response("This run has already finished and can't be cancelled.", { status: 409 });
    }
    const { data: status, error } = await context.supabase.rpc("ocade_request_automation_cancel", {
      p_run_id: data.runId,
    });
    if (error) throw new Response(error.message, { status: 500 });
    if (status !== "cancelled" && status !== "cancellation_requested") {
      throw new Response("This run is no longer cancellable.", { status: 409 });
    }
    return { status: status as "cancelled" | "cancellation_requested" };
  });

export const pauseAutomationRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ runId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: run } = await context.supabase
      .from("ocade_automation_runs")
      .select("id, status")
      .eq("id", data.runId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!run) throw new Response("Run not found", { status: 404 });
    if (!canPause(run.status as RunStatus)) {
      throw new Response("This run is not currently pausable.", { status: 409 });
    }
    const { data: status, error } = await context.supabase.rpc("ocade_request_automation_pause", {
      p_run_id: data.runId,
    });
    if (error) throw new Response(error.message, { status: 500 });
    if (status !== "paused" && status !== "pause_requested") {
      throw new Response("This run is no longer pausable.", { status: 409 });
    }
    return { status: status as "paused" | "pause_requested" };
  });

export const resumeAutomationRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((i) => z.object({ runId: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: run } = await context.supabase
      .from("ocade_automation_runs")
      .select("id, status")
      .eq("id", data.runId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!run) throw new Response("Run not found", { status: 404 });
    if (!canResume(run.status as RunStatus)) {
      throw new Response("Only a paused run can be resumed.", { status: 409 });
    }
    const { data: status, error } = await context.supabase.rpc("ocade_resume_automation_run", {
      p_run_id: data.runId,
    });
    if (error) throw new Response(error.message, { status: 500 });
    if (status !== "pending" && status !== "awaiting_approval") {
      throw new Response("This run is no longer resumable.", { status: 409 });
    }
    return { status: status as "pending" | "awaiting_approval" };
  });

/** Emergency stop: cancel every non-terminal run for this user at once. */
export const cancelAllRuns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("ocade_cancel_all_automation_runs");
    if (error) throw new Response(error.message, { status: 500 });
    // The RPC returns jsonb. Narrow before reading: an unexpected shape must
    // report zero cancellations, not crash while reporting an emergency stop.
    const counts = data && typeof data === "object" && !Array.isArray(data) ? data : {};
    return {
      cancelled: Number(counts.cancelled ?? 0),
      cancellationRequested: Number(counts.cancellation_requested ?? 0),
    };
  });

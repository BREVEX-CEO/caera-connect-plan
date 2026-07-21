/**
 * FICIA People, Roles & Approvals — server functions.
 *
 * All writes go through `requireSupabaseAuth`; RLS scopes reads/writes to
 * the caller's tenant membership. Owner/manager-only mutations are enforced
 * by the row-level policies on each table.
 *
 * Suspension propagation to `tenant_members` is handled server-side by the
 * `ficia_sync_membership` trigger — restoring, suspending or terminating an
 * employment reshapes the person's access without extra round-trips.
 *
 * Approval decisions and segregation-of-duties overrides always append to
 * `compliance_audit_log` via the service-role writer.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const uuid = z.string().uuid();

// ---------- People / employments ----------

const employmentInput = z.object({
  tenant_id: uuid,
  invited_email: z.string().email().max(200).optional(),
  user_id: uuid.optional(),
  worker_type: z.enum(["employee", "contractor", "advisor", "auditor", "consultant"]).default("employee"),
  title: z.string().max(120).optional(),
  department_id: uuid.nullable().optional(),
  team_id: uuid.nullable().optional(),
  location_id: uuid.nullable().optional(),
  manager_user_id: uuid.nullable().optional(),
  start_date: z.string().max(20).optional(),
  end_date: z.string().max(20).nullable().optional(),
});

export const listPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ficia_employments")
      .select("id, tenant_id, user_id, invited_email, worker_type, status, title, department_id, team_id, location_id, manager_user_id, start_date, end_date, created_at")
      .eq("tenant_id", data.tenant_id)
      .order("created_at", { ascending: false });
    if (error) throw new Response(error.message, { status: 400 });
    return { people: (rows ?? []) as any[] };
  });

export const invitePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => employmentInput.parse(i))
  .handler(async ({ data, context }) => {
    if (!data.invited_email && !data.user_id) {
      return { ok: false as const, message: "Provide invited email or existing user id." };
    }
    const insert = {
      tenant_id: data.tenant_id,
      user_id: data.user_id ?? null,
      invited_email: data.invited_email ?? null,
      worker_type: data.worker_type,
      status: data.user_id ? "active" : "invited",
      title: data.title ?? null,
      department_id: data.department_id ?? null,
      team_id: data.team_id ?? null,
      location_id: data.location_id ?? null,
      manager_user_id: data.manager_user_id ?? null,
      start_date: data.start_date ?? null,
      end_date: data.end_date ?? null,
      created_by: context.userId,
    };
    const { data: row, error } = await context.supabase
      .from("ficia_employments")
      .insert(insert as never)
      .select("id")
      .single();
    if (error) return { ok: false as const, message: error.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: data.tenant_id,
      action: "ficia.people.invite",
      feature_id: "ficia.people",
      category: "role_change",
      preview: { invited_email: data.invited_email ?? null, worker_type: data.worker_type, title: data.title ?? null },
    } as never);
    return { ok: true as const, id: (row as any).id as string };
  });

const employmentStatusInput = z.object({
  employment_id: uuid,
  status: z.enum(["invited", "active", "suspended", "terminated"]),
  reason: z.string().max(500).optional(),
});

export const setEmploymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => employmentStatusInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: emp, error: readErr } = await context.supabase
      .from("ficia_employments")
      .select("id, tenant_id, user_id, status")
      .eq("id", data.employment_id)
      .maybeSingle();
    if (readErr || !emp) return { ok: false as const, message: "Employment not found." };

    const patch: Record<string, unknown> = { status: data.status };
    if (data.status === "suspended") patch.suspended_reason = data.reason ?? null;
    if (data.status === "terminated") patch.terminated_reason = data.reason ?? null;
    if (data.status === "terminated") patch.end_date = new Date().toISOString().slice(0, 10);

    const { error } = await context.supabase
      .from("ficia_employments")
      .update(patch as never)
      .eq("id", data.employment_id);
    if (error) {
      if (error.message.includes("cannot_suspend_last_owner")) {
        return { ok: false as const, message: "Cannot suspend the last remaining owner." };
      }
      return { ok: false as const, message: error.message };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: (emp as any).tenant_id,
      action: `ficia.people.${data.status}`,
      feature_id: "ficia.people",
      category: "role_change",
      preview: { employment_id: data.employment_id, from: (emp as any).status, to: data.status, reason: data.reason ?? null },
    } as never);
    return { ok: true as const };
  });

// ---------- Departments / teams / locations ----------

export const listOrgUnits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const [deps, teams, locs] = await Promise.all([
      context.supabase.from("ficia_departments").select("*").eq("tenant_id", data.tenant_id).order("name"),
      context.supabase.from("ficia_teams").select("*").eq("tenant_id", data.tenant_id).order("name"),
      context.supabase.from("ficia_locations").select("*").eq("tenant_id", data.tenant_id).order("label"),
    ]);
    return { departments: deps.data ?? [], teams: teams.data ?? [], locations: locs.data ?? [] };
  });

const orgUnitMutations = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("department"), tenant_id: uuid, name: z.string().min(1).max(120), parent_id: uuid.nullable().optional(), manager_user_id: uuid.nullable().optional() }),
  z.object({ kind: z.literal("team"), tenant_id: uuid, name: z.string().min(1).max(120), department_id: uuid.nullable().optional(), manager_user_id: uuid.nullable().optional() }),
  z.object({ kind: z.literal("location"), tenant_id: uuid, label: z.string().min(1).max(120), city: z.string().max(120).optional(), country: z.string().max(2).optional() }),
]);

export const createOrgUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => orgUnitMutations.parse(i))
  .handler(async ({ data, context }) => {
    let error: { message: string } | null = null;
    if (data.kind === "department") {
      ({ error } = await context.supabase.from("ficia_departments").insert({ tenant_id: data.tenant_id, name: data.name, parent_id: data.parent_id ?? null, manager_user_id: data.manager_user_id ?? null } as never));
    } else if (data.kind === "team") {
      ({ error } = await context.supabase.from("ficia_teams").insert({ tenant_id: data.tenant_id, name: data.name, department_id: data.department_id ?? null, manager_user_id: data.manager_user_id ?? null } as never));
    } else {
      ({ error } = await context.supabase.from("ficia_locations").insert({ tenant_id: data.tenant_id, label: data.label, city: data.city ?? null, country: data.country ?? null } as never));
    }
    if (error) return { ok: false as const, message: error.message };
    return { ok: true as const };
  });

// ---------- Roles ----------

export const listRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const [tmpl, custom, grants] = await Promise.all([
      context.supabase.from("ficia_custom_roles").select("*").is("tenant_id", null),
      context.supabase.from("ficia_custom_roles").select("*").eq("tenant_id", data.tenant_id),
      context.supabase.from("ficia_role_grants").select("*").eq("tenant_id", data.tenant_id).is("revoked_at", null),
    ]);
    return {
      templates: tmpl.data ?? [],
      custom: custom.data ?? [],
      grants: grants.data ?? [],
    };
  });

const customRoleInput = z.object({
  tenant_id: uuid,
  key: z.string().min(2).max(40).regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional(),
  permissions: z.record(z.string(), z.boolean()).default({}),
});

export const upsertCustomRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => customRoleInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ficia_custom_roles").upsert({
      tenant_id: data.tenant_id,
      key: data.key,
      name: data.name,
      description: data.description ?? null,
      permissions: data.permissions,
      is_template: false,
    } as never, { onConflict: "tenant_id,key" });
    if (error) return { ok: false as const, message: error.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: data.tenant_id,
      action: "ficia.roles.upsert",
      feature_id: "ficia.roles",
      category: "role_change",
      preview: { key: data.key, name: data.name, perm_count: Object.keys(data.permissions).length },
    } as never);
    return { ok: true as const };
  });

const grantInput = z.object({
  tenant_id: uuid,
  user_id: uuid,
  role_key: z.string().min(2).max(40),
});

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => grantInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("ficia_role_grants").upsert({
      tenant_id: data.tenant_id,
      user_id: data.user_id,
      role_key: data.role_key,
      granted_by: context.userId,
      granted_at: new Date().toISOString(),
      revoked_at: null,
      revoked_by: null,
    } as never, { onConflict: "tenant_id,user_id,role_key" });
    if (error) return { ok: false as const, message: error.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: data.tenant_id,
      action: "ficia.roles.grant",
      feature_id: "ficia.roles",
      category: "role_change",
      preview: data,
    } as never);
    return { ok: true as const };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => grantInput.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ficia_role_grants")
      .update({ revoked_at: new Date().toISOString(), revoked_by: context.userId } as never)
      .eq("tenant_id", data.tenant_id)
      .eq("user_id", data.user_id)
      .eq("role_key", data.role_key)
      .is("revoked_at", null);
    if (error) return { ok: false as const, message: error.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: data.tenant_id,
      action: "ficia.roles.revoke",
      feature_id: "ficia.roles",
      category: "role_change",
      preview: data,
    } as never);
    return { ok: true as const };
  });

// ---------- Approval policies ----------

const policyInput = z.object({
  tenant_id: uuid,
  id: uuid.optional(),
  subject: z.enum(["expense", "invoice", "payroll", "tax", "files", "payments", "signatures", "export"]),
  currency: z.string().length(3).optional(),
  min_amount: z.number().nonnegative().optional(),
  max_amount: z.number().nonnegative().optional(),
  steps: z.array(z.object({ role_key: z.string().min(1).max(40), min_approvals: z.number().int().min(1).max(5) })).min(1).max(10),
  sod_enforced: z.boolean().default(true),
  is_active: z.boolean().default(true),
});

export const listApprovalPolicies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ficia_approval_policies")
      .select("*")
      .eq("tenant_id", data.tenant_id)
      .order("subject");
    if (error) throw new Response(error.message, { status: 400 });
    return { policies: rows ?? [] };
  });

export const upsertApprovalPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => policyInput.parse(i))
  .handler(async ({ data, context }) => {
    const row = {
      id: data.id,
      tenant_id: data.tenant_id,
      subject: data.subject,
      currency: data.currency ?? null,
      min_amount: data.min_amount ?? null,
      max_amount: data.max_amount ?? null,
      steps: data.steps,
      sod_enforced: data.sod_enforced,
      is_active: data.is_active,
    };
    const q = data.id
      ? context.supabase.from("ficia_approval_policies").update(row as never).eq("id", data.id)
      : context.supabase.from("ficia_approval_policies").insert(row as never);
    const { error } = await q;
    if (error) return { ok: false as const, message: error.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: data.tenant_id,
      action: "ficia.approvals.policy_upsert",
      feature_id: "ficia.approvals",
      category: "approval",
      preview: { subject: data.subject, steps: data.steps, sod_enforced: data.sod_enforced },
    } as never);
    return { ok: true as const };
  });

// ---------- Approval requests ----------

const submitRequestInput = z.object({
  tenant_id: uuid,
  subject: z.enum(["expense", "invoice", "payroll", "tax", "files", "payments", "signatures", "export"]),
  title: z.string().min(2).max(200),
  amount: z.number().optional(),
  currency: z.string().length(3).optional(),
  payload: z.record(z.string(), z.any()).default({}),
});

async function pickPolicy(supabase: any, tenant_id: string, subject: string, amount: number | null | undefined, currency: string | null | undefined) {
  const { data: rows } = await supabase
    .from("ficia_approval_policies")
    .select("*")
    .eq("tenant_id", tenant_id)
    .eq("subject", subject)
    .eq("is_active", true);
  const candidates = (rows ?? []).filter((p: any) => {
    if (p.currency && currency && p.currency !== currency) return false;
    if (p.min_amount != null && amount != null && amount < Number(p.min_amount)) return false;
    if (p.max_amount != null && amount != null && amount > Number(p.max_amount)) return false;
    return true;
  });
  return candidates[0] ?? null;
}

export const submitApprovalRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => submitRequestInput.parse(i))
  .handler(async ({ data, context }) => {
    const policy = await pickPolicy(context.supabase, data.tenant_id, data.subject, data.amount ?? null, data.currency ?? null);
    if (!policy) return { ok: false as const, message: `No active approval policy for ${data.subject}. Ask an owner to configure one.` };

    const { data: row, error } = await context.supabase
      .from("ficia_approval_requests")
      .insert({
        tenant_id: data.tenant_id,
        policy_id: policy.id,
        subject: data.subject,
        title: data.title,
        amount: data.amount ?? null,
        currency: data.currency ?? null,
        submitted_by: context.userId,
        status: "pending",
        current_step: 0,
        steps: policy.steps,
        payload: data.payload,
      } as never)
      .select("id")
      .single();
    if (error) return { ok: false as const, message: error.message };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: data.tenant_id,
      action: "ficia.approvals.submit",
      feature_id: "ficia.approvals",
      category: "approval",
      preview: { subject: data.subject, title: data.title, amount: data.amount ?? null },
    } as never);
    return { ok: true as const, id: (row as any).id as string };
  });

const decisionInput = z.object({
  request_id: uuid,
  decision: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional(),
  sod_override_reason: z.string().max(500).optional(),
});

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => decisionInput.parse(i))
  .handler(async ({ data, context }) => {
    // Load request
    const { data: req, error: readErr } = await context.supabase
      .from("ficia_approval_requests")
      .select("*")
      .eq("id", data.request_id)
      .maybeSingle();
    if (readErr || !req) return { ok: false as const, message: "Request not visible." };
    const r = req as any;
    if (r.status !== "pending") return { ok: false as const, message: `Already ${r.status}.` };

    const step = r.steps[r.current_step];
    if (!step) return { ok: false as const, message: "No step to decide." };

    // SoD check: submitter cannot approve
    const sodViolation = r.submitted_by === context.userId;
    const policy = r.policy_id
      ? (await context.supabase.from("ficia_approval_policies").select("sod_enforced").eq("id", r.policy_id).maybeSingle()).data as any
      : null;
    if (sodViolation && policy?.sod_enforced && !data.sod_override_reason) {
      return { ok: false as const, code: "sod_blocked" as const, message: "Segregation of duties: submitter cannot approve their own request without a documented override." };
    }

    // Approver must hold the step role
    const { data: hasRole } = await context.supabase
      .from("ficia_role_grants")
      .select("id")
      .eq("tenant_id", r.tenant_id)
      .eq("user_id", context.userId)
      .eq("role_key", step.role_key)
      .is("revoked_at", null)
      .maybeSingle();
    const isOwner = (await context.supabase
      .from("tenant_members")
      .select("id")
      .eq("tenant_id", r.tenant_id)
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle()).data;
    if (!hasRole && !isOwner) {
      return { ok: false as const, message: `You need the role "${step.role_key}" to approve this step.` };
    }

    // Record the decision via service role (client insert on decisions is denied)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const insertDecision = await supabaseAdmin.from("ficia_approval_decisions").insert({
      request_id: data.request_id,
      tenant_id: r.tenant_id,
      step: r.current_step,
      approver_user_id: context.userId,
      decision: data.decision,
      reason: data.reason ?? null,
    } as never);
    if (insertDecision.error) return { ok: false as const, message: insertDecision.error.message };

    let patch: Record<string, unknown> = {};
    if (data.decision === "reject") {
      patch = { status: "rejected" };
    } else {
      const { count } = await supabaseAdmin
        .from("ficia_approval_decisions")
        .select("id", { count: "exact", head: true })
        .eq("request_id", data.request_id)
        .eq("step", r.current_step)
        .eq("decision", "approve");
      if ((count ?? 0) >= (step.min_approvals ?? 1)) {
        if (r.current_step + 1 >= r.steps.length) patch = { status: "approved", current_step: r.current_step + 1 };
        else patch = { current_step: r.current_step + 1 };
      }
    }
    if (sodViolation && data.sod_override_reason) {
      patch.sod_override_reason = data.sod_override_reason;
      patch.sod_override_by = context.userId;
      patch.sod_override_at = new Date().toISOString();
    }
    if (Object.keys(patch).length > 0) {
      await supabaseAdmin.from("ficia_approval_requests").update(patch as never).eq("id", data.request_id);
    }

    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: r.tenant_id,
      action: sodViolation && data.sod_override_reason ? "ficia.approvals.sod_override" : `ficia.approvals.${data.decision}`,
      feature_id: "ficia.approvals",
      category: "approval",
      preview: {
        request_id: data.request_id,
        step: r.current_step,
        decision: data.decision,
        reason: data.reason ?? null,
        sod_override_reason: data.sod_override_reason ?? null,
      },
    } as never);

    return { ok: true as const, status: (patch.status as string | undefined) ?? "pending" };
  });

export const releaseApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ request_id: uuid, sod_override_reason: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: req } = await context.supabase.from("ficia_approval_requests").select("*").eq("id", data.request_id).maybeSingle();
    if (!req) return { ok: false as const, message: "Request not visible." };
    const r = req as any;
    if (r.status !== "approved") return { ok: false as const, message: "Only approved requests can be released." };

    const policy = r.policy_id
      ? (await context.supabase.from("ficia_approval_policies").select("sod_enforced").eq("id", r.policy_id).maybeSingle()).data as any
      : null;
    const sodViolation = r.submitted_by === context.userId
      || !!(await context.supabase.from("ficia_approval_decisions").select("id").eq("request_id", data.request_id).eq("approver_user_id", context.userId).maybeSingle()).data;
    if (sodViolation && policy?.sod_enforced && !data.sod_override_reason) {
      return { ok: false as const, code: "sod_blocked" as const, message: "Segregation of duties: releaser cannot also be submitter or approver without a documented override." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { status: "released", released_by: context.userId, released_at: new Date().toISOString() };
    if (sodViolation && data.sod_override_reason) {
      patch.sod_override_reason = data.sod_override_reason;
      patch.sod_override_by = context.userId;
      patch.sod_override_at = new Date().toISOString();
    }
    await supabaseAdmin.from("ficia_approval_requests").update(patch as never).eq("id", data.request_id);
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: context.userId,
      tenant_id: r.tenant_id,
      action: sodViolation && data.sod_override_reason ? "ficia.approvals.release_sod_override" : "ficia.approvals.release",
      feature_id: "ficia.approvals",
      category: "approval",
      preview: { request_id: data.request_id, subject: r.subject, sod_override_reason: data.sod_override_reason ?? null },
    } as never);
    return { ok: true as const };
  });

export const listApprovalRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ tenant_id: uuid, status: z.enum(["pending", "approved", "rejected", "released", "withdrawn"]).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("ficia_approval_requests").select("*").eq("tenant_id", data.tenant_id).order("created_at", { ascending: false });
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 400 });
    return { requests: rows ?? [] };
  });

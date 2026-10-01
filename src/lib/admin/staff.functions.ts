/**
 * THE OWNER AND STAFF CONSOLES' SERVER SIDE.
 *
 * `public.ocade_staff` is the one authority (migration
 * 20260930093000_one_staff_authority). Every function here either asks the
 * database through the CALLER'S client — so the permission, the second factor
 * and its recency are the caller's own — or checks `ocade_staff_can` through
 * that client first and only then reads with the service role. Nothing here
 * decides who may do what; the database does, and this file says it in words.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "@/lib/security/session-middleware";
import { HIGH_RISK, requireAssurance } from "@/lib/security/assurance-middleware";
import { assertStaff, type StaffPermission } from "./access.functions";

export type StaffRole =
  "primary_owner" | "backup_owner" | "admin" | "support" | "billing" | "operations" | "read_only";

export const STAFF_ROLE_NAMES: Record<StaffRole, string> = {
  primary_owner: "Primary Owner",
  backup_owner: "Backup Owner",
  admin: "Admin",
  support: "Support",
  billing: "Billing",
  operations: "Operations",
  read_only: "Read-only",
};

/** A server function rejects with an Error; its message is the sentence to show. */
export function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "That change was not applied.";
}

/** Every change on the record needs a reason of at least ten characters. */
export const ready = (reason: string) => reason.trim().length >= 10;

export interface MyStaff {
  role: StaffRole;
  permissions: StaffPermission[];
  /** False until this session answered its second factor; staff reads need it. */
  secondFactor: boolean;
}

const reason = z.string().trim().min(10).max(500);
const uuid = z.string().uuid();

/** The database's refusals are written for an operator; anything else is one sentence. */
function staffFailure(message: string): string {
  const known = [
    "Not found",
    "That is not a staff role.",
    "Say why, in at least ten characters.",
    "Only the Primary Owner names a Backup Owner.",
    "Nobody changes their own access.",
    "The Primary Owner's access is changed only by handing ownership over.",
    "Only the Primary Owner changes the Backup Owner.",
    "Only the Primary Owner changes an owner's access.",
    "The Primary Owner is removed only by handing ownership over.",
    "Only the Primary Owner removes the Backup Owner.",
    "Only the Primary Owner hands over ownership.",
    "Ownership goes to the Backup Owner. Name one first.",
    "An owner's sessions are ended by the owner.",
    "An owner's two-step verification is changed by the owner.",
    "Nobody turns off their own two-step verification this way.",
    "A case lasts between 1 and 72 hours.",
    "A case is about somebody else's account.",
    "This case is closed or has expired.",
  ];
  if (/Confirm (it is you|the code from your authenticator app)/i.test(message)) return message;
  return known.find((sentence) => message.includes(sentence)) ?? "That change was not applied.";
}

/** Who the caller is to OCADE's operations, or null for everybody else. */
export const readMyStaff = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<MyStaff | null> => {
    const { data, error } = await context.supabase.rpc("ocade_my_staff");
    if (error) throw new Error("OCADE could not check this account just now.");
    const row = data?.[0];
    if (!row) return null;
    return {
      role: row.role as StaffRole,
      permissions: row.permissions as StaffPermission[],
      secondFactor: row.second_factor,
    };
  });

/* ---------------------------------------------------------------- staff -- */

export interface StaffMember {
  userId: string;
  email: string | null;
  role: StaffRole;
  granted: string[];
  denied: string[];
  isSelf: boolean;
}

export interface StaffInvite {
  id: string;
  email: string;
  role: StaffRole;
  expiresAt: string;
}

export interface StaffPage {
  staff: StaffMember[];
  invites: StaffInvite[];
  /** What each role holds before any per-person change. */
  defaults: Record<StaffRole, StaffPermission[]>;
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<StaffPage> => {
    await assertStaff(context.supabase, "staff.manage");
    // The database's own matrix, asked as the caller: nothing here copies it.
    const defaults = await context.supabase.rpc("ocade_staff_role_defaults");
    if (defaults.error) throw new Error("Staff could not be read.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [staff, invites] = await Promise.all([
      supabaseAdmin
        .from("ocade_staff")
        .select("user_id, role, granted, denied")
        .order("created_at")
        .limit(500),
      supabaseAdmin
        .from("ocade_staff_invites")
        .select("id, email, role, expires_at")
        .is("accepted_at", null)
        .is("withdrawn_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (staff.error || invites.error) throw new Error("Staff could not be read.");
    const ids = (staff.data ?? []).map((row) => row.user_id);
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, email").in("id", ids).limit(ids.length)
      : { data: [] as { id: string; email: string | null }[] };
    const emailOf = new Map((profiles ?? []).map((row) => [row.id, row.email]));
    return {
      defaults: Object.fromEntries(
        (defaults.data ?? []).map((row) => [row.role, row.permissions]),
      ) as StaffPage["defaults"],
      staff: (staff.data ?? []).map((row) => ({
        userId: row.user_id,
        email: emailOf.get(row.user_id) ?? null,
        role: row.role as StaffRole,
        granted: row.granted,
        denied: row.denied,
        isSelf: row.user_id === context.userId,
      })),
      invites: (invites.data ?? []).map((row) => ({
        id: row.id,
        email: row.email,
        role: row.role as StaffRole,
        expiresAt: row.expires_at,
      })),
    };
  });

export const grantStaff = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) =>
    z
      .object({
        email: z.string().trim().email().max(320),
        role: z.enum(["backup_owner", "admin", "support", "billing", "operations", "read_only"]),
        reason,
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ status: "granted" | "invited" }> => {
    const { data: result, error } = await context.supabase.rpc("ocade_staff_grant", {
      p_email: data.email,
      p_role: data.role,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { status: (result as { status: "granted" | "invited" }).status };
  });

export const setStaffPermissions = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) =>
    z
      .object({
        userId: uuid,
        granted: z.array(z.string().max(40)).max(20),
        denied: z.array(z.string().max(40)).max(20),
        reason,
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ changed: boolean }> => {
    const { data: changed, error } = await context.supabase.rpc("ocade_staff_set_permissions", {
      p_user: data.userId,
      p_granted: data.granted,
      p_denied: data.denied,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { changed: changed === true };
  });

export const revokeStaff = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) => z.object({ userId: uuid, reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ removed: boolean }> => {
    const { data: removed, error } = await context.supabase.rpc("ocade_staff_revoke", {
      p_user: data.userId,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { removed: removed === true };
  });

export const withdrawStaffInvite = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) => z.object({ inviteId: uuid, reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ withdrawn: boolean }> => {
    const { data: withdrawn, error } = await context.supabase.rpc("ocade_staff_withdraw_invite", {
      p_invite: data.inviteId,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { withdrawn: withdrawn === true };
  });

export const transferOwnership = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) => z.object({ userId: uuid, reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("ocade_staff_transfer_ownership", {
      p_to: data.userId,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { ok: true };
  });

/** Emergency: every staff session everywhere ends, except this one. */
export const endAllStaffSessions = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) => z.object({ reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ ended: number }> => {
    const { data: ended, error } = await context.supabase.rpc("ocade_staff_end_all_sessions", {
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { ended: Number(ended ?? 0) };
  });

/* ------------------------------------------------------------ customers -- */

export interface CustomerDetail {
  usage: { kind: string; used: number; resetsAt: string }[] | null;
  tasks: { title: string; status: string; updatedAt: string }[] | null;
  security: { secondFactor: boolean; sessions: number; lastSignIn: string | null } | null;
}

/**
 * One customer, in the parts the caller may see. A part the caller has no
 * permission for is null, not an error: a Support member opening an account
 * sees its tasks, not its sessions.
 */
export const readCustomer = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((input) => z.object({ userId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<CustomerDetail> => {
    await assertStaff(context.supabase, "customers.read");
    const may = async (permission: StaffPermission) =>
      (await context.supabase.rpc("ocade_staff_can", { p_permission: permission })).data === true;
    const [usage, tasks, security] = await Promise.all([
      may("usage.read"),
      may("tasks.read"),
      may("security.read"),
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const detail: CustomerDetail = { usage: null, tasks: null, security: null };
    if (usage) {
      // The same reader the customer's own usage screen uses, for both surfaces.
      const surfaces = await Promise.all(
        (["chat", "jarvis"] as const).map((surface) =>
          supabaseAdmin.rpc("ocade_read_commercial_usage", {
            p_user_id: data.userId,
            p_surface: surface,
          }),
        ),
      );
      detail.usage = surfaces.flatMap(({ data: rows }) =>
        (rows ?? []).map((row) => ({
          kind: row.window_kind,
          used: Number(row.used_hundredths) / 100,
          resetsAt: row.reset_at,
        })),
      );
    }
    if (tasks) {
      // Titles and states only: what JARVIS was asked, never what it saw.
      const { data: rows } = await supabaseAdmin
        .from("jarvis_tasks")
        .select("title, status, updated_at")
        .eq("user_id", data.userId)
        .order("updated_at", { ascending: false })
        .limit(20);
      detail.tasks = (rows ?? []).map((row) => ({
        title: row.title,
        status: row.status,
        updatedAt: row.updated_at,
      }));
    }
    if (security) {
      const [{ data: user }, { data: factors }] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(data.userId),
        supabaseAdmin.auth.admin.mfa.listFactors({ userId: data.userId }),
      ]);
      const { data: sessions } = await supabaseAdmin.rpc("ocade_list_account_sessions", {
        p_user_id: data.userId,
      });
      detail.security = {
        secondFactor: (factors?.factors ?? []).some((factor) => factor.status === "verified"),
        sessions: (sessions ?? []).length,
        lastSignIn: user?.user?.last_sign_in_at ?? null,
      };
    }
    return detail;
  });

export const endCustomerSessions = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) => z.object({ userId: uuid, reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ ended: number }> => {
    const { data: ended, error } = await context.supabase.rpc("ocade_staff_end_customer_sessions", {
      p_user: data.userId,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { ended: Number(ended ?? 0) };
  });

/**
 * Turn off a customer's two-step verification: the phone and the recovery
 * codes are both gone. The database authorises and records it and ends their
 * sessions; the factor itself is removed through the Auth API, which also
 * tells the account by email.
 */
export const resetCustomerSecondFactor = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) => z.object({ userId: uuid, reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ removed: number }> => {
    const { data: allowed, error } = await context.supabase.rpc("ocade_staff_reset_second_factor", {
      p_user: data.userId,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    if (allowed !== true) return { removed: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: factors, error: listError } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId: data.userId,
    });
    if (listError) {
      throw new Error("It was recorded, but their authenticator could not be read. Try again.");
    }
    let removed = 0;
    for (const factor of factors?.factors ?? []) {
      const { error: removeError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: data.userId,
      });
      if (removeError) {
        throw new Error("It was recorded, but their authenticator was not removed. Try again.");
      }
      removed += 1;
    }
    const { sendNotification } = await import("@/lib/notifications/send.server");
    await sendNotification({
      userId: data.userId,
      category: "security",
      title: "OCADE turned off two-step verification on your account",
      body: "You asked for this because your authenticator was lost. If you did not, change your password and turn it on again now.",
      idempotencyKey: `second-factor-reset:${data.userId}:${new Date().toISOString().slice(0, 13)}`,
    }).catch(() => undefined);
    return { removed };
  });

/* ---------------------------------------------------------------- cases -- */

export interface SupportCase {
  id: string;
  customer: string;
  customerEmail: string | null;
  reason: string;
  expiresAt: string;
}

export const openCase = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) =>
    z.object({ userId: uuid, reason, hours: z.number().int().min(1).max(72) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("ocade_case_open", {
      p_customer: data.userId,
      p_reason: data.reason,
      p_hours: data.hours,
    });
    if (error || !id) throw new Error(staffFailure(error?.message ?? ""));
    // The customer is told, in their own notifications, that OCADE opened
    // access and until when. Access to a conversation is never silent.
    const { sendNotification } = await import("@/lib/notifications/send.server");
    await sendNotification({
      userId: data.userId,
      category: "security",
      title: "OCADE support can read your conversations for a while",
      body: `Reason: ${data.reason}. Access ends within ${data.hours} hours.`,
      idempotencyKey: `case-open:${id}`,
    }).catch(() => undefined);
    return { id: id as string };
  });

export const closeCase = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) => z.object({ caseId: uuid, reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ closed: boolean }> => {
    const { data: closed, error } = await context.supabase.rpc("ocade_case_close", {
      p_case: data.caseId,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { closed: closed === true };
  });

/** Open, unexpired cases. */
export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<SupportCase[]> => {
    await assertStaff(context.supabase, "cases.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("ocade_support_cases")
      .select("id, customer, reason, expires_at")
      .is("closed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at")
      .limit(100);
    if (error) throw new Error("Cases could not be read.");
    const ids = [...new Set((rows ?? []).map((row) => row.customer))];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, email").in("id", ids).limit(ids.length)
      : { data: [] as { id: string; email: string | null }[] };
    const emailOf = new Map((profiles ?? []).map((row) => [row.id, row.email]));
    return (rows ?? []).map((row) => ({
      id: row.id,
      customer: row.customer,
      customerEmail: emailOf.get(row.customer) ?? null,
      reason: row.reason,
      expiresAt: row.expires_at,
    }));
  });

/** The customer's conversation titles, while the case is open. */
export const listCaseConversations = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((input) => z.object({ caseId: uuid }).parse(input))
  .handler(
    async ({ data, context }): Promise<{ id: string; title: string; updatedAt: string }[]> => {
      await assertStaff(context.supabase, "cases.read");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: kase } = await supabaseAdmin
        .from("ocade_support_cases")
        .select("customer")
        .eq("id", data.caseId)
        .is("closed_at", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!kase) throw new Error("This case is closed or has expired.");
      const { data: rows, error } = await supabaseAdmin
        .from("ocade_conversations")
        .select("id, title, updated_at")
        .eq("user_id", kase.customer)
        .order("updated_at", { ascending: false })
        .limit(50);
      if (error) throw new Error("Conversations could not be read.");
      // Their titles are the customer's words too: the list is written down like a read.
      const { error: auditError } = await supabaseAdmin.from("ocade_admin_actions").insert({
        actor: context.userId,
        target_user: kase.customer,
        subject: data.caseId,
        action: "case_read",
        reason: "Listed the conversations under an open case.",
      });
      if (auditError) throw new Error("Conversations could not be read.");
      return (rows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        updatedAt: row.updated_at,
      }));
    },
  );

/** One conversation, read under the case, and written down by the database. */
export const readCaseConversation = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((input) => z.object({ caseId: uuid, conversationId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("ocade_case_messages", {
      p_case: data.caseId,
      p_conversation: data.conversationId,
    });
    if (error) throw new Error(staffFailure(error.message));
    return (rows ?? []).map((row) => ({
      role: row.role,
      content: row.content,
      createdAt: row.created_at,
    }));
  });

/* ------------------------------------------------------- health / audit -- */

export interface SystemHealth {
  devicesOnline: number;
  tasksRunning: number;
  tasksWaiting: number;
  pendingEnrollments: number;
  staff: number;
}

/** Real counts only; nothing here is estimated or invented. */
export const readSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<SystemHealth> => {
    await assertStaff(context.supabase, "health.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
      const { count: n, error } = await query;
      if (error) throw new Error("System health could not be read.");
      return n ?? 0;
    };
    const recently = new Date(Date.now() - 3 * 60_000).toISOString();
    const [devicesOnline, tasksRunning, tasksWaiting, pendingEnrollments, staff] =
      await Promise.all([
        count(
          supabaseAdmin
            .from("jarvis_devices")
            .select("id", { count: "exact", head: true })
            .is("revoked_at", null)
            .not("user_id", "is", null)
            .gt("last_seen_at", recently),
        ),
        count(
          supabaseAdmin
            .from("jarvis_tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", "running"),
        ),
        count(
          supabaseAdmin
            .from("jarvis_tasks")
            .select("id", { count: "exact", head: true })
            .in("status", ["waiting", "taken_over"]),
        ),
        count(
          supabaseAdmin
            .from("jarvis_devices")
            .select("id", { count: "exact", head: true })
            .is("user_id", null),
        ),
        count(supabaseAdmin.from("ocade_staff").select("user_id", { count: "exact", head: true })),
      ]);
    return { devicesOnline, tasksRunning, tasksWaiting, pendingEnrollments, staff };
  });

export interface AuditEntry {
  id: string;
  at: string;
  action: string;
  actor: string | null;
  target: string | null;
  reason: string;
}

export const listAudit = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<AuditEntry[]> => {
    await assertStaff(context.supabase, "audit.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("ocade_admin_actions")
      .select("id, created_at, action, actor, target_user, reason")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("The audit record could not be read.");
    const ids = [
      ...new Set(
        (rows ?? []).flatMap((row) => [row.actor, row.target_user]).filter(Boolean) as string[],
      ),
    ];
    const { data: profiles } = ids.length
      ? await supabaseAdmin.from("profiles").select("id, email").in("id", ids).limit(ids.length)
      : { data: [] as { id: string; email: string | null }[] };
    const name = (id: string | null) =>
      id ? ((profiles ?? []).find((row) => row.id === id)?.email ?? id) : null;
    return (rows ?? []).map((row) => ({
      id: row.id,
      at: row.created_at,
      action: row.action,
      actor: name(row.actor),
      target: name(row.target_user),
      reason: row.reason,
    }));
  });

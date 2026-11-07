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
import { unlimitedFor, type Unlimited } from "@/lib/commercial/entitlement-resolver";

export type { Unlimited };

export type StaffRole =
  "primary_owner" | "backup_owner" | "admin" | "support" | "billing" | "operations" | "read_only";

export const STAFF_ROLE_NAMES: Record<StaffRole, string> = {
  primary_owner: "Primary Owner",
  backup_owner: "Owner",
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
  /** A factor was added during this session: staff authority waits for the next sign-in. */
  newFactor: boolean;
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
    "Ownership goes to an Owner. Make them an Owner first.",
    "Only an owner changes unlimited use.",
    "Nobody grants themselves.",
    "An owner already has unlimited use.",
    "End it between five minutes and ten years from now, or not at all.",
    "An owner's sessions are ended by the owner.",
    "An owner's two-step verification is changed by the owner.",
    "Nobody turns off their own two-step verification this way.",
    "A case lasts between 1 and 72 hours.",
    "A case is about somebody else's account.",
    "This case is closed or has expired.",
    "Nobody does this to their own account.",
    "An owner's account is changed by the owner.",
    "A member of staff is changed by an owner.",
    "No such account.",
    "Choose Chat or JARVIS, and this session or this week.",
    "Change usage by between one hundredth and a thousand uses.",
    "Remove their staff role before deleting the account.",
    "Type the account's email address exactly to delete it.",
    "This account's deletion was started. Finish deleting it.",
  ];
  if (/Confirm (it is you|the code from your authenticator app)/i.test(message)) return message;
  const sentence = known.find((known) => message.includes(known)) ?? "That change was not applied.";
  // The database still says "Backup Owner"; the product calls every other owner an Owner.
  return sentence.replace(/(a|the) Backup Owner/, "another Owner");
}

/** Who the caller is to OCADE's operations, or null for everybody else. */
export const readMyStaff = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<MyStaff | null> => {
    const { data, error } = await context.supabase.rpc("ocade_my_staff");
    if (error) throw new Error("OCADE could not check this account just now.");
    const row = data?.[0];
    if (!row) return null;
    const { data: newFactor, error: factorError } = await context.supabase.rpc(
      "ocade_factor_added_since_sign_in",
    );
    if (factorError) throw new Error("OCADE could not check this account just now.");
    return {
      role: row.role as StaffRole,
      permissions: row.permissions as StaffPermission[],
      secondFactor: row.second_factor,
      newFactor: newFactor === true,
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

/**
 * The words the database's gate compares a spent proof with (20261018090000): the kind of
 * operator change and whom it is for, so one confirmation pays for that operator only.
 */
const operatorChange = (what: string, field: string) => (input: unknown) =>
  `change who operates OCADE: ${what} ${String(
    (input as Record<string, unknown> | null)?.[field] ?? "",
  )
    .trim()
    .toLowerCase()}`;

export const grantStaff = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK, { proves: operatorChange("add", "email") })])
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
  .middleware([requireAssurance(HIGH_RISK, { proves: operatorChange("permissions of", "userId") })])
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
  .middleware([requireAssurance(HIGH_RISK, { proves: operatorChange("remove", "userId") })])
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
  .middleware([
    requireAssurance(HIGH_RISK, { proves: operatorChange("withdraw invite", "inviteId") }),
  ])
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
  .middleware([requireAssurance(HIGH_RISK, { proves: "hand over ownership" })])
  .validator((input) => z.object({ userId: uuid, reason, stayOwner: z.boolean() }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("ocade_staff_transfer_ownership", {
      p_to: data.userId,
      p_reason: data.reason,
      p_stay_owner: data.stayOwner,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { ok: true };
  });

/* -------------------------------------------------------- unlimited use -- */

/** An owner gives an account unlimited use until a time, or until revoked. */
export const grantUnlimited = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK, { proves: "give unlimited use" })])
  .validator((input) =>
    z.object({ userId: uuid, until: z.string().datetime().nullable(), reason }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("ocade_grant_unlimited", {
      p_user: data.userId,
      p_until: data.until as string,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { ok: true };
  });

/** Back to the account's normal limits, at once. */
export const revokeUnlimited = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK, { proves: "end unlimited use" })])
  .validator((input) => z.object({ userId: uuid, reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ revoked: boolean }> => {
    const { data: revoked, error } = await context.supabase.rpc("ocade_revoke_unlimited", {
      p_user: data.userId,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { revoked: revoked === true };
  });

/** Emergency: every staff session everywhere ends, except this one. */
export const endAllStaffSessions = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK, { proves: "sign every staff member out" })])
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
  usage: { surface: "chat" | "jarvis"; kind: string; used: number; resetsAt: string }[] | null;
  /** With usage: never stopped by a window (an owner, or an owner's grant), and the last use of each. */
  unlimited: Unlimited | null;
  lastUsed: { chat: string | null; jarvis: string | null } | null;
  security: {
    secondFactor: boolean;
    sessions: number;
    lastSignIn: string | null;
    suspended: boolean;
  } | null;
}

/**
 * One customer, in the parts the caller may see. A part the caller has no
 * permission for is null, not an error: a Support member opening an account
 * sees its usage, not its sessions.
 */
export const readCustomer = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((input) => z.object({ userId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<CustomerDetail> => {
    await assertStaff(context.supabase, "customers.read");
    const may = async (permission: StaffPermission) =>
      (await context.supabase.rpc("ocade_staff_can", { p_permission: permission })).data === true;
    const [usage, security] = await Promise.all([may("usage.read"), may("security.read")]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // A failed read is not an empty history: the whole detail fails and says so.
    const must = <R extends { data: unknown; error: unknown }>(result: R, what: string) => {
      if (result.error) throw new Error(`This customer's ${what} could not be read. Try again.`);
      return result.data as R["data"];
    };
    const detail: CustomerDetail = {
      usage: null,
      unlimited: null,
      lastUsed: null,
      security: null,
    };
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
      detail.usage = surfaces.flatMap((result, at) =>
        (must(result, "usage") ?? []).map((row) => ({
          surface: at === 0 ? ("chat" as const) : ("jarvis" as const),
          kind: row.window_kind,
          used: Number(row.used_hundredths) / 100,
          resetsAt: row.reset_at,
        })),
      );
      const last = (surface: "chat" | "jarvis") =>
        supabaseAdmin
          .from("ocade_generation_permits")
          .select("issued_at")
          .eq("user_id", data.userId)
          .eq("surface", surface)
          .order("issued_at", { ascending: false })
          .limit(1)
          .then((result) => must(result, "last use")?.[0]?.issued_at ?? null);
      const [unlimited, chat, jarvis] = await Promise.all([
        unlimitedFor(data.userId),
        last("chat"),
        last("jarvis"),
      ]);
      detail.unlimited = unlimited;
      detail.lastUsed = { chat, jarvis };
    }
    if (security) {
      const [userRead, factorRead, sessionRead] = await Promise.all([
        supabaseAdmin.auth.admin.getUserById(data.userId),
        supabaseAdmin.auth.admin.mfa.listFactors({ userId: data.userId }),
        supabaseAdmin.rpc("ocade_list_account_sessions", { p_user_id: data.userId }),
      ]);
      const user = must(userRead, "sign-in record");
      const factors = must(factorRead, "second factor");
      const sessions = must(sessionRead, "sessions");
      detail.security = {
        secondFactor: (factors?.factors ?? []).some((factor) => factor.status === "verified"),
        sessions: (sessions ?? []).length,
        lastSignIn: user?.user?.last_sign_in_at ?? null,
        suspended: Date.parse(user?.user?.banned_until ?? "") > Date.now(),
      };
    }
    return detail;
  });

/** A recent confirmation names the customer, including direct database calls. */
const customerChange = (action: string) => (input: unknown) =>
  `${action}: ${String((input as { userId?: unknown } | null)?.userId ?? "")
    .trim()
    .toLowerCase()}`;

export const endCustomerSessions = createServerFn({ method: "POST" })
  .middleware([
    requireAssurance(HIGH_RISK, { proves: customerChange("end a customer's sessions") }),
  ])
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
  .middleware([
    requireAssurance(HIGH_RISK, {
      proves: customerChange("turn off a customer's two-step verification"),
    }),
  ])
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

/**
 * Give a customer uses back (or charge them) in the window they are in now.
 * The database authorises it, records it where nothing can change it, and audits it.
 */
export const adjustCustomerUsage = createServerFn({ method: "POST" })
  .middleware([
    requireAssurance(HIGH_RISK, { proves: customerChange("change a customer's usage") }),
  ])
  .validator((input) =>
    z
      .object({
        userId: uuid,
        surface: z.enum(["chat", "jarvis"]),
        window: z.enum(["session", "week"]),
        uses: z
          .number()
          .min(-1000)
          .max(1000)
          .refine((n) => n !== 0),
        reason,
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ used: number }> => {
    const { data: used, error } = await context.supabase.rpc("ocade_staff_adjust_usage", {
      p_user: data.userId,
      p_surface: data.surface,
      p_window_kind: data.window,
      p_delta_hundredths: Math.round(data.uses * 100),
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { used: Number(used ?? 0) / 100 };
  });

/**
 * Suspend an account — it cannot sign in, every session ends, its computers and
 * phones are disconnected and its open and scheduled JARVIS work stops — or
 * restore it, after which it signs in and connects its devices again.
 */
export const suspendCustomer = createServerFn({ method: "POST" })
  .middleware([
    requireAssurance(HIGH_RISK, {
      proves: (input) =>
        (input as { suspend?: unknown } | null)?.suspend === true
          ? customerChange("suspend an account")(input)
          : customerChange("restore an account")(input),
    }),
  ])
  .validator((input) => z.object({ userId: uuid, suspend: z.boolean(), reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase.rpc("ocade_staff_suspend_account", {
      p_user: data.userId,
      p_suspend: data.suspend,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { ok: true };
  });

/**
 * An owner deletes a customer's account: the database stops it first (as a
 * suspension) and records why; then the same erasure the customer's own
 * deletion uses removes its data and its sign-in. The record outlives it with
 * no subject but the reference.
 */
export const deleteCustomerAccount = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK, { proves: customerChange("delete an account") })])
  .validator((input) =>
    z.object({ userId: uuid, email: z.string().trim().min(3).max(320), reason }).parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ reference: string; pendingFiles: number; recorded: boolean }> => {
      // One reference on both records, so the start and the end of a deletion are found together.
      const reference = `DEL-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const { error } = await context.supabase.rpc("ocade_staff_begin_account_deletion", {
        p_user: data.userId,
        p_email: data.email,
        p_reason: `${data.reason.slice(0, 480)} (${reference})`,
      });
      if (error) throw new Error(staffFailure(error.message));
      const { eraseAccount } = await import("@/lib/account/erase.server");
      const { pendingFiles } = await eraseAccount(data.userId).catch((cause: unknown) => {
        throw new Error(
          `The account is suspended, but ${cause instanceof Error ? cause.message : "its deletion stopped"}`,
        );
      });
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: unrecorded } = await supabaseAdmin.from("ocade_admin_actions").insert({
        actor: context.userId,
        target_user: null,
        action: "account_deleted",
        reason: `Account deleted from the console, reference ${reference}`,
      });
      return { reference, pendingFiles, recorded: !unrecorded };
    },
  );

/* ---------------------------------------------------------------- cases -- */

export interface SupportCase {
  id: string;
  customer: string;
  customerEmail: string | null;
  reason: string;
  expiresAt: string;
  /** The one conversation the case covers, and whether the caller is the one who reads it. */
  conversation: { id: string; title: string } | null;
  mine: boolean;
}

export const openCase = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK, { proves: "open a support case" })])
  .validator((input) =>
    z
      .object({
        userId: uuid,
        reason,
        hours: z.number().int().min(1).max(72),
        conversationId: uuid,
        assigneeId: uuid.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: id, error } = await context.supabase.rpc("ocade_case_open", {
      p_customer: data.userId,
      p_reason: data.reason,
      p_hours: data.hours,
      p_conversation: data.conversationId,
      ...(data.assigneeId ? { p_assignee: data.assigneeId } : {}),
    });
    if (error || !id) throw new Error(staffFailure(error?.message ?? ""));
    // The customer is told, in their own notifications, that OCADE opened
    // access and until when. Access to a conversation is never silent.
    const { sendNotification } = await import("@/lib/notifications/send.server");
    await sendNotification({
      userId: data.userId,
      category: "security",
      title: "OCADE support can read one of your conversations for a while",
      body: `Reason: ${data.reason}. Access ends within ${data.hours} hours.`,
      idempotencyKey: `case-open:${id}`,
    }).catch(() => undefined);
    return { id: id as string };
  });

/**
 * A customer's conversation titles, for choosing the one a case will cover. Only for whoever
 * opens cases, and written down like a read: titles are the customer's words too.
 */
export const listCustomerConversations = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .validator((input) => z.object({ userId: uuid }).parse(input))
  .handler(async ({ data, context }): Promise<{ id: string; title: string }[]> => {
    // The database checks the permission and writes the listing down, in one step.
    const { data: rows, error } = await context.supabase.rpc("ocade_case_conversations", {
      p_customer: data.userId,
    });
    if (error) throw new Error(staffFailure(error.message));
    return (rows ?? []).map((row) => ({ id: row.id, title: row.title }));
  });

export const closeCase = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK, { proves: "close a support case" })])
  .validator((input) => z.object({ caseId: uuid, reason }).parse(input))
  .handler(async ({ data, context }): Promise<{ closed: boolean }> => {
    const { data: closed, error } = await context.supabase.rpc("ocade_case_close", {
      p_case: data.caseId,
      p_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { closed: closed === true };
  });

/**
 * Open, unexpired cases: the ones the caller reads, and (for whoever opens and closes cases)
 * every open one, without their content. A case shows the one conversation it covers.
 */
export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<SupportCase[]> => {
    await assertStaff(context.supabase, "cases.read");
    const manages = await context.supabase.rpc("ocade_staff_can", { p_permission: "cases.manage" });
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("ocade_support_cases")
      .select("id, customer, reason, expires_at, assignee, conversation")
      .is("closed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at")
      .limit(100);
    if (manages.data !== true) query = query.eq("assignee", context.userId);
    const { data: rows, error } = await query;
    if (error) throw new Error("Cases could not be read.");
    const ids = [...new Set((rows ?? []).map((row) => row.customer))];
    const conversations = (rows ?? []).map((row) => row.conversation).filter(Boolean) as string[];
    const [{ data: profiles, error: profileError }, { data: titles, error: titleError }] =
      await Promise.all([
        ids.length
          ? supabaseAdmin.from("profiles").select("id, email").in("id", ids).limit(ids.length)
          : Promise.resolve({ data: [] as { id: string; email: string | null }[], error: null }),
        conversations.length
          ? supabaseAdmin
              .from("ocade_conversations")
              .select("id, title")
              .in("id", conversations)
              .limit(conversations.length)
          : Promise.resolve({ data: [] as { id: string; title: string }[], error: null }),
      ]);
    // A failed companion read is not an unknown customer or an untitled conversation.
    if (profileError || titleError) throw new Error("Cases could not be read.");
    const emailOf = new Map((profiles ?? []).map((row) => [row.id, row.email]));
    const titleOf = new Map((titles ?? []).map((row) => [row.id, row.title]));
    return (rows ?? []).map((row) => ({
      id: row.id,
      customer: row.customer,
      customerEmail: emailOf.get(row.customer) ?? null,
      reason: row.reason,
      expiresAt: row.expires_at,
      conversation: row.conversation
        ? { id: row.conversation, title: titleOf.get(row.conversation) ?? "Untitled" }
        : null,
      mine: row.assignee === context.userId,
    }));
  });

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
  staff: number;
}

/** Real counts only; nothing here is estimated or invented. */
export const readSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<SystemHealth> => {
    await assertStaff(context.supabase, "health.read");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("ocade_staff")
      .select("user_id", { count: "exact", head: true });
    if (error) throw new Error("System health could not be read.");
    return { staff: count ?? 0 };
  });

/* ----------------------------------------------------- emergency pause -- */

export interface ServiceControl {
  key: string;
  paused: boolean;
  reason: string | null;
  changedAt: string;
}

/**
 * The emergency switches (incident response): new JARVIS tasks, work on customers'
 * computers, the Android companion. The database decides who may read them.
 */
export const readServiceControls = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<ServiceControl[]> => {
    const { data, error } = await context.supabase.rpc("ocade_read_service_controls");
    if (error) throw new Error(staffFailure(error.message));
    return (data ?? []).map((row) => ({
      key: row.key,
      paused: row.paused,
      reason: row.reason,
      changedAt: row.changed_at,
    }));
  });

/**
 * Pause or resume one switch. The caller's own client, so the database checks the role, a
 * recent second factor and the reason, and writes the change with who made it.
 */
export const setServiceControl = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((input) =>
    z
      .object({
        key: z.enum(["jarvis_agent", "jarvis_execution", "jarvis_android"]),
        pause: z.boolean(),
        reason,
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ paused: boolean }> => {
    const { data: changed, error } = await context.supabase.rpc("ocade_set_service_control", {
      control_key: data.key,
      pause: data.pause,
      change_reason: data.reason,
    });
    if (error) throw new Error(staffFailure(error.message));
    return { paused: changed?.paused === true };
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

/**
 * MANUAL ACCESS, THROUGH THE AUTHORITY THAT ALREADY OWNS IT.
 *
 * `PLAN.md` Phase 3 asks that an operator be able to find an account, see what
 * tier it is on, give it Free/Pro/Max for a while with a written reason, and
 * take that back — auditably, without editing `auth.users`, and without a
 * manual grant ever being mistaken for a payment.
 *
 * All of that already exists in the database. `ocade_grant_entitlement` and
 * `ocade_revoke_entitlement` check the admin role, require a recent second
 * factor, refuse a self-grant, bound the duration, and write who did it and
 * why. What was missing was any way to CALL them: the hidden admin screen
 * could list accounts and roles and nothing else, so the one operational task
 * the plan names was a SQL console job.
 *
 * So this adds no authority. The two writes go through the caller's own
 * Supabase client, which means the database still decides — a non-admin, or an
 * admin without a second factor, is refused by Postgres rather than by this
 * file. What needs the admin client is the READ: `ocade_entitlement_grants`
 * has row-level security on and no policy, so nothing reachable by a browser
 * token can see a grant at all.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlanTier } from "@/lib/payments/pricing";

export interface AdminAccountRow {
  id: string;
  email: string | null;
  displayName: string | null;
  createdAt: string;
  roles: string[];
  /** The live manual grant, when there is one. Never a payment. */
  grant: {
    id: string;
    tier: PlanTier;
    reason: string | null;
    endsAt: string;
  } | null;
  /** The operator's own account, which the grant function refuses to target. */
  isSelf: boolean;
}

/**
 * How many accounts one answer carries.
 *
 * SEARCHING USED TO HAPPEN IN THE BROWSER over the 200 newest profiles. That
 * works until the two hundred and first account exists, and then an operator
 * looking for a customer who signed up last month is told "No matching
 * accounts" — a screen saying a real person does not exist. The search is the
 * database's now, so the page size is only how much an operator reads at once.
 */
const ACCOUNT_LIMIT = 50;

/** Refuse before reading anything if the caller is not an admin. */
async function assertAdmin(
  supabase: {
    rpc: (
      name: "has_role",
      args: { _user_id: string; _role: "admin" },
    ) => PromiseLike<{
      data: unknown;
      error: unknown;
    }>;
  },
  userId: string,
): Promise<void> {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || data !== true) {
    // Deliberately the same sentence a missing page would give. A hidden area
    // that explains itself tells anybody who guessed the URL that it is there.
    throw new Error("Not found");
  }
}

/**
 * A search term reduced to something PostgREST's filter grammar can carry.
 *
 * `,` and `(` `)` separate and group filters in an `or=(...)`, and `%` and `_`
 * are wildcards, so a term containing any of them either changes the query's
 * shape or silently matches more than was asked for. Replaced rather than
 * rejected: an operator pasting a name with a comma in it should get a search,
 * not a complaint.
 */
export function searchableAccountTerm(term: string): string {
  return term.replace(/[%_,()\\*]/g, " ").trim();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AdminAccountPage {
  accounts: AdminAccountRow[];
  /** More accounts match than were returned, so the term needs narrowing. */
  more: boolean;
}

/**
 * Accounts, their roles and their live manual grant.
 *
 * With no term this is the newest page, which is what an operator opening the
 * screen wants to see. With one, the DATABASE matches it — an exact account id,
 * or an email or name containing the term — so the answer does not depend on
 * whether that customer happens to be among the most recent.
 */
export const listAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ query: z.string().trim().max(200).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminAccountPage> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const term = searchableAccountTerm(data.query ?? "");
    let accountQuery = supabaseAdmin
      .from("profiles")
      .select("id, display_name, email, created_at")
      .order("created_at", { ascending: false })
      // One more than the page, which is how "there are others" is known
      // without a second counting query.
      .limit(ACCOUNT_LIMIT + 1);
    if (UUID.test(term)) accountQuery = accountQuery.eq("id", term);
    else if (term.length > 0) {
      accountQuery = accountQuery.or(`email.ilike.%${term}%,display_name.ilike.%${term}%`);
    }

    const { data: matched, error: matchError } = await accountQuery;
    if (matchError) throw new Error(matchError.message);
    const page = (matched ?? []).slice(0, ACCOUNT_LIMIT);
    const ids = page.map((row) => row.id);
    if (ids.length === 0) return { accounts: [], more: false };

    /*
     * THE COMPANION READS ARE SCOPED TO THE PAGE, not to the whole table.
     * They used to read a thousand rows each and join in memory, which is a
     * growing read for a shrinking answer.
     */
    const [roles, grants] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", ids)
        // Each read is already bounded by the page it is for; the limits are
        // the ceiling on how many rows one of those accounts could contribute.
        .limit(ACCOUNT_LIMIT * 8),
      supabaseAdmin
        .from("ocade_entitlement_grants")
        .select("id, user_id, tier, reason, ends_at")
        .in("user_id", ids)
        .is("revoked_at", null)
        .gt("ends_at", new Date().toISOString())
        // Live grants only, and the strongest wins below — so this is generous
        // enough that truncation cannot change which one an operator is shown.
        .limit(ACCOUNT_LIMIT * 20),
    ]);

    for (const result of [roles, grants]) {
      if (result.error) throw new Error(result.error.message);
    }

    const rolesByUser = new Map<string, string[]>();
    for (const row of roles.data ?? []) {
      rolesByUser.set(row.user_id, [...(rolesByUser.get(row.user_id) ?? []), row.role]);
    }
    const grantByUser = new Map<string, AdminAccountRow["grant"]>();
    for (const row of grants.data ?? []) {
      // The strongest live grant wins, which is the same rule
      // `ocade_active_entitlement_grant` applies when it decides a tier.
      const existing = grantByUser.get(row.user_id);
      if (existing && existing.tier === "max") continue;
      grantByUser.set(row.user_id, {
        id: row.id,
        tier: row.tier as PlanTier,
        reason: row.reason,
        endsAt: row.ends_at,
      });
    }

    return {
      accounts: page.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: row.display_name,
        createdAt: row.created_at,
        roles: rolesByUser.get(row.id) ?? [],
        grant: grantByUser.get(row.id) ?? null,
        isSelf: row.id === context.userId,
      })),
      more: (matched ?? []).length > ACCOUNT_LIMIT,
    };
  });

/**
 * Give an account Pro or Max for a bounded time, with a reason on the record.
 *
 * Free is not grantable and that is not an omission: Free is what an account
 * has when nothing else applies, so "granting" it would mean revoking, which
 * is what revoke is for.
 */
export const grantAccountAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        tier: z.enum(["pro", "max"]),
        days: z.number().int().min(1).max(366),
        // The database refuses a reason under ten characters; say so first.
        reason: z.string().trim().min(10).max(500),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    /*
     * THE CALLER'S CLIENT, NOT THE ADMIN ONE. The function checks the admin
     * role and a recent second factor from the JWT it is called with; going
     * through the service role would satisfy both trivially and turn a guarded
     * operation into an unguarded one.
     */
    const { error } = await context.supabase.rpc("ocade_grant_entitlement", {
      target_user: data.userId,
      grant_tier: data.tier,
      grant_reason: data.reason,
      days: data.days,
    });
    if (error) throw new Error(adminFailure(error.message));
    return { ok: true };
  });

/** Take a manual grant back. The record keeps it, revoked and attributed. */
export const revokeAccountAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({ grantId: z.string().uuid(), reason: z.string().trim().min(3).max(500) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ revoked: boolean }> => {
    await assertAdmin(context.supabase, context.userId);
    const { data: revoked, error } = await context.supabase.rpc("ocade_revoke_entitlement", {
      grant_id: data.grantId,
      revoke_reason: data.reason,
    });
    if (error) throw new Error(adminFailure(error.message));
    return { revoked: revoked === true };
  });

/**
 * The database's own refusals, which are written for an operator and are worth
 * showing; anything else becomes one sentence.
 *
 * An operator who is told "needs a recent second factor" can act. One told
 * "something went wrong" opens a ticket.
 */
function adminFailure(message: string): string {
  const known = [
    "Only support admins may grant an entitlement.",
    "Only support admins may revoke an entitlement.",
    "Granting an entitlement needs a recent second factor.",
    "Revoking an entitlement needs a recent second factor.",
    "An entitlement cannot be granted to the account granting it.",
    "A grant runs for between 1 and 366 days.",
    "Only support admins may change a service control.",
    "Only support admins may read service controls.",
    "Changing a service control needs a recent second factor.",
    "Only support admins may remove a device.",
    "Removing a device needs a recent second factor.",
    "Say why, in at least ten characters.",
  ];
  return known.find((sentence) => message.includes(sentence)) ?? "That change was not applied.";
}

/** JARVIS device work: running or paused, and the last change's reason. */
export const readJarvisExecution = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase.rpc("ocade_read_service_controls");
    if (error) throw new Error(adminFailure(error.message));
    const row = (data ?? []).find((control) => control.key === "jarvis_execution");
    return {
      paused: Boolean(row?.paused),
      reason: row?.reason ?? null,
      changedAt: row?.changed_at ?? null,
    };
  });

/**
 * Pause or resume every JARVIS device action at once. The database requires
 * the admin role, a recent second factor and a reason, and keeps the record.
 */
export const setJarvisExecution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z.object({ paused: z.boolean(), reason: z.string().trim().min(10).max(500) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ paused: boolean }> => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase.rpc("ocade_set_service_control", {
      control_key: "jarvis_execution",
      pause: data.paused,
      change_reason: data.reason,
    });
    if (error) throw new Error(adminFailure(error.message));
    return { paused: Boolean(row?.paused) };
  });

export interface AdminDeviceRow {
  id: string;
  name: string;
  platform: string | null;
  kind: string;
  lastSeenAt: string | null;
  removedAt: string | null;
}

/** One account's JARVIS computers and browsers, newest first. Never their keys. */
export const listAccountDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AdminDeviceRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("jarvis_devices")
      .select("id, name, platform, kind, last_seen_at, revoked_at")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      platform: row.platform,
      kind: row.kind,
      lastSeenAt: row.last_seen_at,
      removedAt: row.revoked_at,
    }));
  });

/**
 * Remove a customer's device: its key is gone and its open work stops. The
 * database requires the admin role, a recent second factor and a reason, and
 * keeps the record.
 */
export const removeAccountDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input) =>
    z
      .object({ deviceId: z.string().uuid(), reason: z.string().trim().min(10).max(500) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ removed: boolean }> => {
    await assertAdmin(context.supabase, context.userId);
    const { data: removed, error } = await context.supabase.rpc("ocade_admin_remove_device", {
      device: data.deviceId,
      remove_reason: data.reason,
    });
    if (error) throw new Error(adminFailure(error.message));
    return { removed: removed === true };
  });

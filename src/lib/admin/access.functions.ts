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
  /** True when a verified provider subscription is live. Shown, never edited. */
  paid: boolean;
}

const ACCOUNT_LIMIT = 200;

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
    throw new Response("Not found", { status: 404 });
  }
}

/**
 * Accounts, their roles, their live manual grant and whether they pay.
 *
 * Capped rather than paged: an operator searches for somebody, they do not
 * browse. The search happens in the browser over this one page.
 */
export const listAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminAccountRow[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [profiles, roles, grants, subscriptions] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, display_name, email, created_at")
        .order("created_at", { ascending: false })
        .limit(ACCOUNT_LIMIT),
      supabaseAdmin.from("user_roles").select("user_id, role").limit(1_000),
      supabaseAdmin
        .from("ocade_entitlement_grants")
        .select("id, user_id, tier, reason, ends_at")
        .is("revoked_at", null)
        .gt("ends_at", new Date().toISOString())
        .limit(1_000),
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, status")
        .in("status", ["active", "trialing"])
        .limit(1_000),
    ]);

    for (const result of [profiles, roles, grants, subscriptions]) {
      if (result.error) throw new Response(result.error.message, { status: 500 });
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
    const paying = new Set((subscriptions.data ?? []).map((row) => row.user_id));

    return (profiles.data ?? []).map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      createdAt: row.created_at,
      roles: rolesByUser.get(row.id) ?? [],
      grant: grantByUser.get(row.id) ?? null,
      paid: paying.has(row.id),
    }));
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
        reason: z.string().trim().min(3).max(500),
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
    if (error) throw new Response(adminFailure(error.message), { status: 400 });
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
    if (error) throw new Response(adminFailure(error.message), { status: 400 });
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
  ];
  return known.find((sentence) => message.includes(sentence)) ?? "That change was not applied.";
}

/**
 * ONE ADMIN GATE, USED BY EVERY ADMINISTRATION ROUTE.
 *
 * The check was written out four times — once in each `/admin/*` route's
 * `beforeLoad` — and the four copies had already begun to differ in the only
 * part that is visible to a person: the sentence explaining what they are
 * missing. Four copies of an authorisation check is four places for one of them
 * to be forgotten when a fifth screen is added, and the failure mode of
 * forgetting is an admin page anybody can open.
 *
 * WHAT THIS IS NOT. It is not the authorisation itself. Row-level security on
 * `user_roles` and on every table an admin screen reads is what actually
 * prevents access; this decides what to RENDER. A gate in the browser that was
 * the only protection would be no protection at all — anyone can skip a
 * redirect — and every table these screens touch is policy-protected on the
 * server for exactly that reason.
 *
 * WHY IT REDIRECTS RATHER THAN RENDERING NOTHING. A blank admin screen is
 * indistinguishable from a broken one, and somebody who reached it by following
 * a link deserves to be told which door they are at and why it is shut.
 */
import { redirect } from "@tanstack/react-router";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

/**
 * Throw unless the caller holds the admin role.
 *
 * `area` completes the sentence "You do not have access to …", so it reads as
 * a place rather than as a permission string: "the customer support queue",
 * not "ADMIN_SUPPORT_READ".
 */
export async function requireAdminRole(area: string): Promise<void> {
  const supabase = await loadSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw redirect({ to: "/auth" });

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) {
    throw redirect({
      to: "/access-denied",
      search: {
        area,
        reason: "This area requires the admin role on your CARCC CADANE account.",
      },
    });
  }
}

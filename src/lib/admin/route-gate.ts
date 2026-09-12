/**
 * ONE ADMIN GATE, USED BY THE ADMINISTRATION ROUTE.
 *
 * WHAT THIS IS NOT. It is not the authorisation itself. Row-level security on
 * `user_roles` and on every table the admin screen reads is what actually
 * prevents access; this decides what to RENDER. A gate in the browser that was
 * the only protection would be no protection at all — anyone can skip a
 * redirect — and every table the screen touches is policy-protected on the
 * server for exactly that reason.
 *
 * A HIDDEN AREA DOES NOT EXPLAIN ITSELF. This used to send a non-admin to an
 * `/access-denied` page naming the area and the role it wanted, which told
 * anybody who guessed a URL that the area exists and what it is called.
 * Administration is not customer navigation, so a non-admin is simply returned
 * to Chat.
 */
import { redirect } from "@tanstack/react-router";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

export async function requireAdminRole(): Promise<void> {
  const supabase = await loadSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw redirect({ to: "/auth" });

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!role) throw redirect({ to: "/" });
}

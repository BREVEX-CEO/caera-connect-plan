/**
 * ONE STAFF GATE, USED BY THE CONSOLE ROUTE.
 *
 * WHAT THIS IS NOT. It is not the authorisation itself. Every read and change
 * the console makes is checked by the database against `public.ocade_staff`;
 * this only decides what to RENDER. A gate in the browser that was the only
 * protection would be no protection at all — anyone can skip a redirect.
 *
 * A HIDDEN AREA DOES NOT EXPLAIN ITSELF. Anybody who is not staff is simply
 * returned to Chat, told nothing about what is here or what it wanted.
 */
import { redirect } from "@tanstack/react-router";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { readMyStaff, type MyStaff } from "./staff.functions";

export async function requireStaff(): Promise<MyStaff> {
  const supabase = await loadSupabaseClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw redirect({ to: "/auth" });
  const staff = await readMyStaff().catch(() => null);
  if (!staff) throw redirect({ to: "/" });
  return staff;
}

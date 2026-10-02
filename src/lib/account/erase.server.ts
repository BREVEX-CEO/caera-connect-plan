/**
 * ONE ERASURE OF AN ACCOUNT, used by the customer's own deletion and by an
 * owner's deletion from the console, so the two can never drift apart.
 *
 * The parent rows go and their constraints take the rest: `ocade_messages` is
 * ON DELETE CASCADE from its conversation, a library row's trigger tombstones
 * its stored object, and anything else with a cascade to auth.users goes with
 * the identity. Every step is checked: PostgREST reports a failure in `error`
 * without throwing, so an unchecked step looked like success and the receipt
 * said data was gone that was not. The identity is deleted only after every
 * step succeeded, and every step is idempotent, so asking again is safe.
 */
export async function eraseAccount(userId: string): Promise<{ pendingFiles: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const steps = [
    () => supabaseAdmin.from("ocade_conversations").delete().eq("user_id", userId),
    () => supabaseAdmin.from("ocade_library_items").delete().eq("user_id", userId),
    // Listed explicitly so the scrub does not depend on a constraint being present.
    () => supabaseAdmin.from("user_settings").delete().eq("user_id", userId),
    () => supabaseAdmin.from("user_private_records").delete().eq("user_id", userId),
    () => supabaseAdmin.from("devices").delete().eq("user_id", userId),
    () => supabaseAdmin.from("user_roles").delete().eq("user_id", userId),
    () => supabaseAdmin.from("profiles").delete().eq("id", userId),
  ];
  for (const [index, step] of steps.entries()) {
    const { error } = await step();
    if (error) {
      throw new Error(
        `Account deletion stopped after ${index} of ${steps.length} steps. Try again to finish.`,
      );
    }
  }
  // Library bytes: removed now where Storage allows, otherwise a durable tombstone that is retried.
  const { pending } = await (
    await import("@/lib/library/tombstones.server")
  )
    .sweepTombstones(userId)
    .catch(() => ({ pending: -1 }));
  // The identity last. After this no session can be refreshed.
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error)
    throw new Error(`Account records were removed but sign-in deletion failed: ${error.message}`);
  return { pendingFiles: pending };
}

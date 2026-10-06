/**
 * Settle the bytes an account is owed a deletion for.
 *
 * A deleted Library row leaves a tombstone naming its object (trigger-written,
 * so cascades cannot skip it). This removes those objects and marks a
 * tombstone purged only after Storage confirms. A failure stays pending with
 * its error, and the next deletion by the same owner retries it. The service
 * role is needed because no browser role may write tombstones; the scope is
 * always one owner, chosen by the server.
 */
const BATCH = 500;
const MAX_BATCHES = 20;

export async function sweepTombstones(ownerId: string): Promise<{ pending: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const { data: owed, error } = await supabaseAdmin
      .from("storage_tombstones")
      .select("id, bucket, storage_path, attempts")
      .eq("owner_id", ownerId)
      .is("purged_at", null)
      .order("requested_at")
      .limit(BATCH);
    if (error) throw new Error(error.message);
    if (!owed?.length) return { pending: 0 };

    let settled = 0;
    // Only this owner's own folder is ever removed with the service role. A path that names
    // somebody else's object (a forged index row) is closed without touching it.
    const foreign = owed.filter((row) => !row.storage_path.startsWith(`${ownerId}/`));
    if (foreign.length) {
      const closed = await supabaseAdmin
        .from("storage_tombstones")
        .update({ purged_at: new Date().toISOString(), last_error: "Not this account's object" })
        .in(
          "id",
          foreign.map((row) => row.id),
        );
      if (closed.error) throw new Error(closed.error.message);
      settled += foreign.length;
    }
    const own = owed.filter((row) => row.storage_path.startsWith(`${ownerId}/`));
    for (const bucket of new Set(own.map((row) => row.bucket))) {
      const rows = own.filter((row) => row.bucket === bucket);
      // Removing an object that is already gone is not an error, so a retry
      // acknowledges it instead of failing forever.
      const removed = await supabaseAdmin.storage
        .from(bucket)
        .remove(rows.map((row) => row.storage_path));
      if (removed.error) {
        for (const row of rows) {
          await supabaseAdmin
            .from("storage_tombstones")
            .update({ attempts: row.attempts + 1, last_error: removed.error.message.slice(0, 500) })
            .eq("id", row.id);
        }
        continue;
      }
      const marked = await supabaseAdmin
        .from("storage_tombstones")
        .update({ purged_at: new Date().toISOString(), last_error: null })
        .in(
          "id",
          rows.map((row) => row.id),
        );
      if (marked.error) throw new Error(marked.error.message);
      settled += rows.length;
    }
    // Nothing moved this round: the rest is failing and stays pending.
    if (settled === 0) return { pending: owed.length };
  }

  const { count } = await supabaseAdmin
    .from("storage_tombstones")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .is("purged_at", null);
  return { pending: count ?? 0 };
}

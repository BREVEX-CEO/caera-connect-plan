/**
 * Settle the bytes an account is owed a deletion for.
 *
 * A deleted Library row leaves a tombstone naming its object (trigger-written,
 * so cascades cannot skip it). This removes those objects and marks a
 * tombstone purged only after Storage confirms. A failure stays pending with
 * its error. One owner's sweep runs at their deletion; the scheduled sweep
 * (`ownerId` null) retries every account's due objects, including accounts
 * already erased, until the attempt budget is spent and the row stays for an
 * operator. The service role is needed because no browser role may write
 * tombstones; every object is checked against its own row's owner folder.
 * `pending` is every deletion still owed that a sweep retries; `deadLetters` the
 * ones that spent their attempts and wait for an operator. Both are counted from
 * the table, never from one batch, and -1 when they could not be: unknown is
 * never zero (C15).
 */
const BATCH = 500;
const MAX_BATCHES = 20;
const MAX_ATTEMPTS = 10;

export async function sweepTombstones(
  ownerId: string | null,
  maxBatches = MAX_BATCHES,
): Promise<{ pending: number; deadLetters: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const due = () => {
    const query = supabaseAdmin
      .from("storage_tombstones")
      .select("id, bucket, storage_path, attempts, owner_id")
      .is("purged_at", null)
      .not("owner_id", "is", null);
    return ownerId ? query.eq("owner_id", ownerId) : query.lt("attempts", MAX_ATTEMPTS);
  };

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const { data: owed, error } = await due().order("requested_at").limit(BATCH);
    if (error) throw new Error(error.message);
    if (!owed?.length) break;

    let settled = 0;
    // Only an owner's own folder is ever removed with the service role. A path that names
    // somebody else's object (a forged index row) is closed without touching it.
    const ownFolder = (row: (typeof owed)[number]) =>
      row.storage_path.startsWith(`${row.owner_id}/`);
    const foreign = owed.filter((row) => !ownFolder(row));
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
    const own = owed.filter(ownFolder);
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
    // Nothing moved this round: the rest is failing and stays owed.
    if (settled === 0) break;
  }

  const owedRows = () => {
    const query = supabaseAdmin
      .from("storage_tombstones")
      .select("id", { count: "exact", head: true })
      .is("purged_at", null)
      .not("owner_id", "is", null);
    return ownerId ? query.eq("owner_id", ownerId) : query;
  };
  const [retried, spent] = await Promise.all([
    ownerId ? owedRows() : owedRows().lt("attempts", MAX_ATTEMPTS),
    owedRows().gte("attempts", MAX_ATTEMPTS),
  ]);
  const known = (counted: { count: number | null; error: unknown }) =>
    counted.error || counted.count === null ? -1 : counted.count;
  return { pending: known(retried), deadLetters: known(spent) };
}

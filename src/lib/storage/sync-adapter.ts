/**
 * Private Sync adapter — DEVICE FIRST, then Supabase in the background.
 *
 * WHAT WAS WRONG, AND WHY IT MATTERED MOST HERE. Every method in this file
 * used to be a bare Supabase call. There was no IndexedDB write, no queue and
 * no retry anywhere in it — a grep for `indexedDB|localStorage|queue` returned
 * nothing. So `private_sync`, which is the DEFAULT privacy mode and the one
 * whose name promises the most, was the only mode that kept nothing on the
 * user's own machine:
 *
 *   - a message written with the network down was lost outright;
 *   - Chat waited on a round trip before it could show what you typed;
 *   - and Supabase being briefly unreachable made Chat unusable rather than
 *     merely un-synchronised.
 *
 * The ordering is the fix. A write lands in the browser vault first and
 * returns; the obligation to upload it goes in the outbox; a drain sends it
 * when there is a network. A read prefers the device, because the device is
 * now authoritative for anything not yet acknowledged.
 *
 * Records still reach `user_private_records` keyed by (user_id, data_class,
 * id) and everything is protected by RLS scoped to auth.uid(). Nothing here
 * bypasses it.
 *
 * WHY NO MERGE LOGIC. The records this carries are append-only and immutable
 * once written: nobody edits message four of a conversation from two laptops
 * at once. The only conflict possible is "sent twice", and the id — generated
 * on the client and used as the upsert key — settles that without merging.
 * Deletion travels as its own outbox entry so it reaches other devices instead
 * of the row quietly reappearing on the next sync.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { DataClass, StorageAdapter, StoredRecord } from "./types";
import { indexedDbAdapter } from "./indexeddb-adapter";
import { enqueue, enqueueDelete, drainNow } from "./sync-queue";

type Row = {
  user_id: string;
  data_class: string;
  id: string;
  value: Json;
  created_at: string;
  updated_at: string;
};

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Private Sync requires an authenticated session.");
  return id;
}

function toRecord<T>(r: Row): StoredRecord<T> {
  return {
    id: r.id,
    dataClass: r.data_class as DataClass,
    createdAt: Date.parse(r.created_at),
    updatedAt: Date.parse(r.updated_at),
    value: r.value as T,
  };
}

export const syncAdapter: StorageAdapter = {
  mode: "private_sync",

  async put<T>(dataClass: DataClass, id: string, value: T) {
    /*
     * THE DEVICE WRITE IS THE ONE THAT MUST NOT FAIL, SO IT GOES FIRST.
     *
     * If this throws, nothing is queued and the caller learns immediately —
     * which is correct, because a message OCADE cannot store anywhere is a
     * message the user has to be told about. If it succeeds, the record
     * exists and is readable whatever the network does next.
     */
    await indexedDbAdapter.put(dataClass, id, value);
    await enqueue({ dataClass, id, value });
    /*
     * Fire and forget. A send that is still in flight must not hold up the
     * reply appearing on screen, and a send that fails is already queued.
     */
    void drainNow();
  },
  async get<T>(dataClass: DataClass, id: string) {
    /*
     * The device is authoritative for anything it holds. A record written a
     * moment ago and not yet acknowledged exists here and does not exist
     * upstream, and reading upstream first would make it vanish between being
     * written and being synchronised.
     */
    const local = await indexedDbAdapter.get<T>(dataClass, id);
    if (local) return local;
    const user_id = await uid();
    const { data, error } = await supabase
      .from("user_private_records")
      .select("*")
      .eq("user_id", user_id)
      .eq("data_class", dataClass)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? toRecord<T>(data as Row) : null;
  },
  async list<T>(dataClass: DataClass) {
    const local = await indexedDbAdapter.list<T>(dataClass);
    let remote: StoredRecord<T>[] = [];
    try {
      const user_id = await uid();
      const { data, error } = await supabase
        .from("user_private_records")
        .select("*")
        .eq("user_id", user_id)
        .eq("data_class", dataClass);
      if (error) throw error;
      remote = ((data ?? []) as Row[]).map((r) => toRecord<T>(r));
    } catch {
      /*
       * Offline, or Supabase down. The device's own records are a complete
       * answer for this device, and throwing here would empty a conversation
       * the user is reading because a background service is unavailable.
       * Anything only the server has arrives on the next successful list.
       */
      return local;
    }

    /*
     * Union by id, device wins.
     *
     * A record that exists in both is the same record — the id IS the
     * idempotency key — so preferring the local copy costs nothing and keeps
     * an unacknowledged write visible. A record only on the server is one
     * another device wrote, and it is added.
     */
    const byId = new Map(local.map((r) => [r.id, r]));
    const unseen: StoredRecord<T>[] = [];
    for (const r of remote) {
      if (byId.has(r.id)) continue;
      byId.set(r.id, r);
      unseen.push(r);
    }
    // A successful sync is also an offline cache fill. Best effort: returning
    // the server rows is still useful if the browser refuses a cache write.
    await Promise.allSettled(
      unseen.map((record) => indexedDbAdapter.put(dataClass, record.id, record.value)),
    );
    return [...byId.values()];
  },
  async delete(dataClass, id) {
    /*
     * Deleted here first, and the deletion is OWED to the server the same way
     * a write is. A delete that only happened online would come back on the
     * next list from a device that was offline when it was made — the classic
     * "I deleted that yesterday" bug — which is what the tombstone entry in
     * the outbox exists to prevent.
     */
    await indexedDbAdapter.delete(dataClass, id);
    await enqueueDelete({ dataClass, id });
    void drainNow();
  },
  async clear(dataClass) {
    const classes: DataClass[] = dataClass
      ? [dataClass]
      : ["chats", "images", "files", "recordings", "copilot", "learning_replays"];
    for (const klass of classes) {
      const existing = await indexedDbAdapter.list(klass);
      for (const record of existing) {
        await indexedDbAdapter.delete(klass, record.id);
        await enqueueDelete({ dataClass: klass, id: record.id });
      }
    }
    void drainNow();
  },
};

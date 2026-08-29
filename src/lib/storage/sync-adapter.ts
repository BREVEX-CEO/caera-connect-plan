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

let cacheModule: Promise<typeof import("./private-sync-cache-adapter")> | undefined;
const privateCache = () => (cacheModule ??= import("./private-sync-cache-adapter"));

let queueModule: Promise<typeof import("./sync-queue")> | undefined;
const syncQueue = () => (queueModule ??= import("./sync-queue"));

type Row = {
  user_id: string;
  data_class: string;
  id: string;
  value: Json;
  created_at: string;
  updated_at: string;
};

async function uid(expected?: string): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Private Sync requires an authenticated session.");
  if (expected && id !== expected) {
    throw new Error("The signed-in account changed before Private Sync completed.");
  }
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

/**
 * How many rows to ask for at once.
 *
 * Well under PostgREST's own ceiling so the page size is OURS rather than the
 * server's, and small enough that one request is a reasonable thing to retry.
 */
const PAGE_ROWS = 500;

/**
 * Refuses to loop forever if the server keeps answering with full pages.
 * 400 pages is 200,000 records — far past any real account, and a bounded
 * mistake instead of a browser tab that grows until it is killed.
 */
const MAX_PAGES = 400;

/**
 * EVERY row of a data class, in pages, because "all of them" was a lie.
 *
 * This used to be one `.select("*")` with no bound at all. Two things were
 * wrong with that, and the second is a data-loss bug rather than a slow query:
 *
 *   1. It transferred every record and its whole JSON body in a single
 *      response — the entire chat history of an account, each time anything
 *      asked for a list.
 *   2. PostgREST caps how many rows it will return (`db-max-rows`, 1,000 by
 *      default on Supabase) and it does so SILENTLY: the response is a
 *      well-formed array of the first N rows with no error and no marker. An
 *      account with more than N records in a class therefore synchronised the
 *      first N and quietly never saw the rest. Nothing failed, so nothing
 *      reported anything, and the missing records looked like records the user
 *      had never written.
 *
 * Paging by the primary key rather than by offset: the key is
 * (user_id, data_class, id), so ordering by `id` inside a fixed user and class
 * walks that index directly, and a row inserted mid-walk cannot shift the
 * window the way an OFFSET can. A short page means the end, which is the one
 * signal a capped response cannot fake.
 */
async function listEveryPage<T>(userId: string, dataClass: DataClass): Promise<StoredRecord<T>[]> {
  const out: StoredRecord<T>[] = [];
  let after: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let request = supabase
      .from("user_private_records")
      .select("*")
      .eq("user_id", userId)
      .eq("data_class", dataClass)
      .order("id", { ascending: true })
      .limit(PAGE_ROWS);
    if (after !== null) request = request.gt("id", after);

    const { data, error } = await request;
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    for (const row of rows) out.push(toRecord<T>(row));
    // A page shorter than we asked for is the end. A full page might be the
    // end too, so the next request settles it rather than a guess.
    if (rows.length < PAGE_ROWS) return out;
    after = rows[rows.length - 1]!.id;
  }

  /*
   * Ran out of pages. Returning what we have beats throwing: a partial list is
   * still a useful answer, and the device's own copy is unioned over it.
   */
  console.warn(
    `[sync] stopped after ${MAX_PAGES} pages of ${dataClass}; some records were not read`,
  );
  return out;
}

/**
 * One Private Sync adapter per account.
 *
 * The resolver already knows the user id. Binding it here means the automatic
 * encrypted cache never has to infer an owner from mutable global auth state,
 * and a sign-out/sign-in race cannot read one account's device cache as
 * another. The unbound export at the bottom remains for older internal callers
 * and tests; production resolution always supplies the id.
 */
export function syncAdapterFor(boundUserId?: string): StorageAdapter {
  const owner = async () => boundUserId ?? uid();

  return {
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
      const userId = await owner();
      const { privateSyncCacheAdapterFor } = await privateCache();
      await privateSyncCacheAdapterFor(userId).put(dataClass, id, value);
      const { enqueue, drainNow } = await syncQueue();
      await enqueue({ userId, dataClass, id, value });
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
      const userId = await owner();
      const { privateSyncCacheAdapterFor } = await privateCache();
      const cache = privateSyncCacheAdapterFor(userId);
      const local = await cache.get<T>(dataClass, id);
      if (local) return local;
      const user_id = await uid(userId);
      const { data, error } = await supabase
        .from("user_private_records")
        .select("*")
        .eq("user_id", user_id)
        .eq("data_class", dataClass)
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const record = toRecord<T>(data as Row);
      await cache.put(dataClass, record.id, record.value).catch(() => undefined);
      return record;
    },
    async list<T>(dataClass: DataClass) {
      const userId = await owner();
      const { privateSyncCacheAdapterFor, putPrivateSyncCacheRecords } = await privateCache();
      const cache = privateSyncCacheAdapterFor(userId);
      const local = await cache.list<T>(dataClass);
      let remote: StoredRecord<T>[] = [];
      try {
        const user_id = await uid(userId);
        remote = await listEveryPage<T>(user_id, dataClass);
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
      await putPrivateSyncCacheRecords(
        userId,
        dataClass,
        unseen.map((record) => ({
          id: record.id,
          value: record.value,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        })),
      ).catch(() => undefined);
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
      const userId = await owner();
      const { privateSyncCacheAdapterFor } = await privateCache();
      await privateSyncCacheAdapterFor(userId).delete(dataClass, id);
      const { enqueueDelete, drainNow } = await syncQueue();
      await enqueueDelete({ userId, dataClass, id });
      void drainNow();
    },
    async clear(dataClass) {
      const userId = await owner();
      const { privateSyncCacheAdapterFor } = await privateCache();
      const cache = privateSyncCacheAdapterFor(userId);
      const { enqueueDelete, drainNow } = await syncQueue();
      const classes: DataClass[] = dataClass
        ? [dataClass]
        : ["chats", "images", "files", "recordings", "copilot", "learning_replays"];
      for (const klass of classes) {
        const existing = await cache.list(klass);
        for (const record of existing) {
          await cache.delete(klass, record.id);
          await enqueueDelete({ userId, dataClass: klass, id: record.id });
        }
      }
      void drainNow();
    },
  };
}

export const syncAdapter = syncAdapterFor();

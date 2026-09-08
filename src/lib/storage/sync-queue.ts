/**
 * The browser end of the outbox: where entries live, and when they are sent.
 *
 * `outbox.ts` holds the pure drain logic so it can be exhaustively tested with
 * no browser and no clock. This file is the part that has to touch the world —
 * localStorage, `navigator.onLine`, and Supabase.
 *
 * WHY localStorage RATHER THAN THE INDEXEDDB VAULT. The queue is metadata
 * about work owed, not user content: ids, timestamps and attempt counts. It
 * must be readable at start-up before the vault is unlocked, because a locked
 * vault must not stop OCADE from finishing a sync it already owes. The
 * PAYLOADS are the records themselves, which are already stored encrypted by
 * the vault — the queue references them rather than copying them.
 */
/*
 * ON DEMAND: this module is reachable from a route module the generated route
 * tree imports statically, so a top-level import put the Supabase client on the
 * entry chunk's graph. Every use is inside an async function already awaiting
 * the network.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import type { Json } from "@/integrations/supabase/types";
import type { DataClass } from "./types";
import { drainOutbox, type OutboxEntry, type OutboxStore } from "./outbox";
import { privateSyncCacheAdapterFor } from "./private-sync-cache-adapter";

const QUEUE_KEY = "ocade.sync.outbox.v1";

interface MessagePayload {
  userId: string;
  dataClass: DataClass;
  id: string;
  value: unknown;
}

interface QueuedRecordRef {
  /** Missing only on an entry written by a pre-isolation build. */
  userId?: string;
  dataClass: DataClass;
  id: string;
}

/** Fail closed unless the queue itself proves which account owns the entry. */
export function queueOwnerMismatchReason(
  payload: { userId?: string },
  signedInUserId: string,
): string | null {
  if (payload.userId === signedInUserId) return null;
  return payload.userId ? "signed in as another user" : "legacy entry has no verified owner";
}

/**
 * Remove record bodies written by older builds. The queue is deliberately
 * plaintext metadata so it can be inspected before vault unlock; user content
 * must never be part of it.
 */
function metadataOnly(entry: OutboxEntry): OutboxEntry {
  if (entry.kind !== "message" || !entry.payload || typeof entry.payload !== "object") return entry;
  const payload = entry.payload as Partial<MessagePayload>;
  if (!payload.dataClass || typeof payload.id !== "string") return entry;
  return {
    ...entry,
    payload: {
      ...(typeof payload.userId === "string" ? { userId: payload.userId } : {}),
      dataClass: payload.dataClass,
      id: payload.id,
    } satisfies QueuedRecordRef,
  };
}

function read(): OutboxEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries = (parsed as OutboxEntry[]).map(metadataOnly);
    // Rewrite once so plaintext bodies left by an older build are removed as
    // soon as this version reads the queue.
    if (JSON.stringify(entries) !== raw) write(entries);
    return entries;
  } catch {
    /*
     * A corrupt queue must not brick sync. Everything it referenced is still
     * on the device, so the worst case is that some records upload later than
     * they would have, rather than a start-up that throws.
     */
    return [];
  }
}

function write(entries: OutboxEntry[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
  } catch {
    /* Quota or private mode. The device copy of the record is unaffected. */
  }
}

export const browserOutbox: OutboxStore = {
  async all() {
    return read();
  },
  async put(entry) {
    const entries = read().filter((e) => e.id !== entry.id);
    entries.push(entry);
    write(entries);
  },
  async remove(id) {
    write(read().filter((e) => e.id !== id));
  },
};

/**
 * Queue an upload.
 *
 * The entry id is `${dataClass}:${id}`, not a fresh random value, so writing
 * the same record twice before either send succeeds leaves ONE obligation
 * rather than two. That is the difference between a retry and a duplicate.
 */
export async function enqueue(payload: MessagePayload): Promise<void> {
  await browserOutbox.put({
    id: `put:${payload.userId}:${payload.dataClass}:${payload.id}`,
    kind: "message",
    conversationId: payload.id,
    payload: {
      userId: payload.userId,
      dataClass: payload.dataClass,
      id: payload.id,
    } satisfies QueuedRecordRef,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: 0,
  });
}

export async function enqueueDelete(payload: {
  userId: string;
  dataClass: DataClass;
  id: string;
}): Promise<void> {
  /*
   * A delete supersedes a pending write of the same record. Leaving both
   * queued would upload the row and then remove it, which works but means a
   * deleted message briefly exists on the server and on any device that syncs
   * in between.
   */
  await browserOutbox.remove(`put:${payload.userId}:${payload.dataClass}:${payload.id}`);
  // A pre-isolation build did not include the owner in the id. Once this user
  // deletes the referenced record, that legacy put must not race the tombstone.
  await browserOutbox.remove(`put:${payload.dataClass}:${payload.id}`);
  await browserOutbox.put({
    id: `del:${payload.userId}:${payload.dataClass}:${payload.id}`,
    kind: "delete",
    conversationId: payload.id,
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: 0,
  });
}

/** Whether the last drain found sync genuinely unavailable, for the UI. */
let reporting = false;
export function syncIsUnavailable(): boolean {
  return reporting;
}

async function deliver(
  entry: OutboxEntry,
): Promise<{ ok: boolean; permanent?: boolean; reason?: string }> {
  const supabase = await loadSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const user_id = data.user?.id;
  /*
   * No session is not a failure to retry against — it is a signed-out user,
   * and hammering the server while they are signed out achieves nothing. The
   * entry stays queued and goes out when they sign in again.
   */
  if (!user_id) return { ok: false, reason: "signed out" };

  if (entry.kind === "delete") {
    const payload = entry.payload as QueuedRecordRef;
    const ownerMismatch = queueOwnerMismatchReason(payload, user_id);
    if (ownerMismatch) return { ok: false, reason: ownerMismatch };
    const { error } = await supabase
      .from("user_private_records")
      .delete()
      .eq("user_id", user_id)
      .eq("data_class", payload.dataClass)
      .eq("id", payload.id);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  }

  const payload = entry.payload as QueuedRecordRef;
  const ownerMismatch = queueOwnerMismatchReason(payload, user_id);
  if (ownerMismatch) return { ok: false, reason: ownerMismatch };

  const cache = privateSyncCacheAdapterFor(user_id);
  let local;
  try {
    local = await cache.get<unknown>(payload.dataClass, payload.id);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "browser vault is locked",
    };
  }
  if (!local) {
    // A later delete removes the pending put before queuing its tombstone. If
    // no record exists here, retrying this write can never recover a body.
    return { ok: false, permanent: true, reason: "local record no longer exists" };
  }
  const { error } = await supabase.from("user_private_records").upsert(
    {
      user_id,
      data_class: payload.dataClass,
      id: payload.id,
      value: local.value as Json,
    },
    /*
     * The upsert key is what makes a retry safe. A send that timed out may
     * well have succeeded server-side, and without this the retry would
     * insert a second copy — so the commonest failure would produce the
     * commonest duplicate.
     */
    { onConflict: "user_id,data_class,id" },
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

let draining: Promise<void> | null = null;

/**
 * Send whatever is due, once.
 *
 * Serialised with a module-level promise: several writes in quick succession
 * each call this, and concurrent drains would race over the same entries and
 * could deliver one twice.
 */
export function drainNow(): Promise<void> {
  if (draining) return draining;
  draining = (async () => {
    try {
      const result = await drainOutbox({ store: browserOutbox, deliver });
      reporting = result.shouldReport;
    } finally {
      draining = null;
    }
  })();
  return draining;
}

/**
 * Drain on reconnect and periodically.
 *
 * The `online` event is the important one — it is what turns "your chats are
 * staying on this device" back into a synchronised account without the user
 * doing anything. The interval is a backstop for the case where the event does
 * not fire, which happens on some mobile browsers returning from suspension.
 */
export function startSyncLoop(intervalMs = 60_000): () => void {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => void drainNow();
  window.addEventListener("online", onOnline);
  const timer = setInterval(() => void drainNow(), intervalMs);
  void drainNow();
  return () => {
    window.removeEventListener("online", onOnline);
    clearInterval(timer);
  };
}

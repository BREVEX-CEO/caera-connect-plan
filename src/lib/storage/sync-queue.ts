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
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { DataClass } from "./types";
import { drainOutbox, type OutboxEntry, type OutboxStore } from "./outbox";

const QUEUE_KEY = "ocade.sync.outbox.v1";

interface MessagePayload {
  dataClass: DataClass;
  id: string;
  value: unknown;
}

function read(): OutboxEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxEntry[]) : [];
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
    id: `put:${payload.dataClass}:${payload.id}`,
    kind: "message",
    conversationId: payload.id,
    payload,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    nextAttemptAt: 0,
  });
}

export async function enqueueDelete(payload: { dataClass: DataClass; id: string }): Promise<void> {
  /*
   * A delete supersedes a pending write of the same record. Leaving both
   * queued would upload the row and then remove it, which works but means a
   * deleted message briefly exists on the server and on any device that syncs
   * in between.
   */
  await browserOutbox.remove(`put:${payload.dataClass}:${payload.id}`);
  await browserOutbox.put({
    id: `del:${payload.dataClass}:${payload.id}`,
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
  const { data } = await supabase.auth.getUser();
  const user_id = data.user?.id;
  /*
   * No session is not a failure to retry against — it is a signed-out user,
   * and hammering the server while they are signed out achieves nothing. The
   * entry stays queued and goes out when they sign in again.
   */
  if (!user_id) return { ok: false, reason: "signed out" };

  if (entry.kind === "delete") {
    const payload = entry.payload as { dataClass: DataClass; id: string };
    const { error } = await supabase
      .from("user_private_records")
      .delete()
      .eq("user_id", user_id)
      .eq("data_class", payload.dataClass)
      .eq("id", payload.id);
    if (error) return { ok: false, reason: error.message };
    return { ok: true };
  }

  const payload = entry.payload as MessagePayload;
  const { error } = await supabase.from("user_private_records").upsert(
    {
      user_id,
      data_class: payload.dataClass,
      id: payload.id,
      value: payload.value as Json,
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

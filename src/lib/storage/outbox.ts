/**
 * The outbox: what OCADE still owes the server.
 *
 * WHAT WAS WRONG. `private_sync` — the DEFAULT privacy mode, and the one whose
 * name promises the most — wrote nothing to the device. Every message went
 * straight to Supabase through a server function, and `sync-adapter.ts` had no
 * IndexedDB call, no queue and no retry anywhere in it. So:
 *
 *   - a message sent with the network down was simply lost;
 *   - Chat waited on a round trip before it could show what you typed;
 *   - and a new conversation could not even be STARTED offline, because the
 *     conversation id came from the server.
 *
 * That is the opposite of local-first. The fix is not a smarter server call,
 * it is an ordering: write to this device, return, and owe the server a copy.
 *
 * WHAT THIS FILE IS NOT. It is not a general sync engine and does not try to
 * merge concurrent edits. Chat messages are append-only and immutable once
 * written — nobody edits message #4 of a conversation from two laptops at
 * once — so the only conflict that can occur is "sent twice", which an
 * idempotency key settles without any merge logic at all. Deletion is the one
 * mutation, and it travels as a tombstone.
 */

/** What kind of thing is owed. */
export type OutboxKind = "message" | "delete";

export interface OutboxEntry {
  /**
   * Client-generated, stable, and the idempotency key.
   *
   * The server must treat a second arrival of the same id as the same event.
   * Without that, every retry after a timeout risks a duplicate — and a
   * timeout is exactly when a retry happens, so duplicates would be the normal
   * case rather than the rare one.
   */
  id: string;
  kind: OutboxKind;
  conversationId: string;
  /** The record to upload, or the id to tombstone. */
  payload: unknown;
  /** When this was first queued, ISO. Ordering is by this, oldest first. */
  queuedAt: string;
  /** How many delivery attempts have been made. */
  attempts: number;
  /** Earliest time a further attempt should be made, epoch ms. */
  nextAttemptAt: number;
  /** Why the last attempt failed, for a human-readable status. */
  lastError?: string;
}

export interface OutboxStore {
  all(): Promise<OutboxEntry[]>;
  put(entry: OutboxEntry): Promise<void>;
  remove(id: string): Promise<void>;
}

/**
 * Backoff, capped.
 *
 * Uncapped exponential backoff means a laptop that was closed for a weekend
 * comes back and waits four hours before trying again, which reads as "sync is
 * broken". Capped at five minutes, a reconnect is noticed promptly and a
 * genuinely dead server is not hammered.
 */
export const MAX_BACKOFF_MS = 5 * 60_000;

export function backoffFor(attempts: number): number {
  const base = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1));
  /*
   * Jitter, because every tab of every device reconnects at the same instant
   * when the wifi comes back, and a fixed schedule turns that into a stampede
   * against a server that has just come up.
   */
  return Math.round(base * (0.5 + Math.random() * 0.5));
}

/**
 * How many failures before OCADE stops promising and starts telling.
 *
 * The entry is NOT discarded at this point — losing somebody's message to
 * protect a counter would be indefensible. It stays queued and keeps retrying
 * at the capped interval; the count only decides when the UI stops saying
 * "syncing" and starts saying "cloud sync is unavailable, your chats are
 * staying on this device."
 */
export const ATTEMPTS_BEFORE_REPORTING = 3;

export interface DrainResult {
  delivered: number;
  failed: number;
  /** True when at least one entry has failed enough times to be worth saying. */
  shouldReport: boolean;
  remaining: number;
}

export interface DrainDeps {
  store: OutboxStore;
  /**
   * Deliver one entry. Resolving means the server has it; rejecting means try
   * again later. A permanent rejection must resolve `{ permanent: true }`
   * rather than reject, so an entry the server will never accept does not
   * retry forever.
   */
  deliver: (entry: OutboxEntry) => Promise<{ ok: boolean; permanent?: boolean; reason?: string }>;
  now?: () => number;
  online?: () => boolean;
}

/**
 * Send everything that is due.
 *
 * Sequential rather than parallel on purpose: messages within a conversation
 * have an order, and firing them together lets them land out of order on a
 * server that is under load. Chat history that reads backwards is a worse bug
 * than a slightly slower drain.
 */
export async function drainOutbox(deps: DrainDeps): Promise<DrainResult> {
  const now = deps.now ?? (() => Date.now());
  const online =
    deps.online ?? (() => (typeof navigator === "undefined" ? true : navigator.onLine));

  if (!online()) {
    const queued = await deps.store.all();
    return { delivered: 0, failed: 0, shouldReport: false, remaining: queued.length };
  }

  const entries = [...(await deps.store.all())].sort((a, b) =>
    a.queuedAt === b.queuedAt ? a.id.localeCompare(b.id) : a.queuedAt.localeCompare(b.queuedAt),
  );

  let delivered = 0;
  let failed = 0;
  let shouldReport = false;

  for (const entry of entries) {
    if (entry.nextAttemptAt > now()) continue;

    let outcome: { ok: boolean; permanent?: boolean; reason?: string };
    try {
      outcome = await deps.deliver(entry);
    } catch (cause) {
      outcome = { ok: false, reason: cause instanceof Error ? cause.message : "delivery failed" };
    }

    if (outcome.ok) {
      await deps.store.remove(entry.id);
      delivered += 1;
      continue;
    }

    if (outcome.permanent) {
      /*
       * The server has refused this permanently — a deleted conversation, a
       * revoked account. Retrying cannot help, so the entry leaves the queue.
       * The message itself is untouched on the device; only the obligation to
       * upload it ends.
       */
      await deps.store.remove(entry.id);
      failed += 1;
      shouldReport = true;
      continue;
    }

    const attempts = entry.attempts + 1;
    await deps.store.put({
      ...entry,
      attempts,
      nextAttemptAt: now() + backoffFor(attempts),
      ...(outcome.reason ? { lastError: outcome.reason } : {}),
    });
    failed += 1;
    if (attempts >= ATTEMPTS_BEFORE_REPORTING) shouldReport = true;
  }

  return { delivered, failed, shouldReport, remaining: (await deps.store.all()).length };
}

/**
 * The offline queue, and crash recovery for what somebody was typing.
 *
 * Two failure modes the queue removes:
 *  1. LOST WORK — an action raised while offline disappears the moment it
 *     fails to send.
 *  2. UNSAFE REPLAY — a queue that blindly replays everything can re-fire a
 *     "stop" or an approval against a task that has since changed.
 *
 * THE QUEUE IS HELD IN THE TAB, NOT WRITTEN TO THE BROWSER. It used to be
 * `localStorage`, and its payloads carry real content — the text of a handoff,
 * a clipboard. `PLAN.md` Phase 2 gives ordinary content one persistent
 * authority, and a second copy sitting in the browser waiting to be sent is
 * exactly the copy that outlives a sign-out, survives an account deletion, and
 * is invisible to every export the account offers. Held in memory it lasts as
 * long as the tab, and the screen says so rather than promising durability it
 * would then have to be trusted for.
 *
 * DRAFTS ARE DIFFERENT and stay in the browser. An unsent draft is what the
 * person is looking at, it is never sent anywhere on its own, and losing it to
 * a refresh is the failure the feature exists to prevent. It is gated by
 * Settings › Chat › Keep unsent drafts, so somebody on a shared computer can
 * turn it off.
 *
 * All reads are still defensive — a payload is data like any other.
 */

export interface QueuedItem<T> {
  id: string;
  payload: T;
  queuedAt: string;
  /** Attempts already made; used to give up on a poisoned item. */
  attempts: number;
}

export interface QueueOptions {
  /** Hard cap; the oldest item is dropped past this. */
  maxItems?: number;
  /** Give up on an item after this many failed sends. */
  maxAttempts?: number;
  /** Maximum UTF-8 bytes accepted for one payload. */
  maxPayloadBytes?: number;
  /** Maximum UTF-8 bytes parsed or persisted for the complete queue. */
  maxStoredBytes?: number;
}

export interface QueueSendContext {
  /** Stable idempotency key. Reconnect retries MUST reuse this value. */
  idempotencyKey: string;
  queuedAt: string;
  attempt: number;
}

const DEFAULTS = {
  maxItems: 200,
  maxAttempts: 5,
  maxPayloadBytes: 64 * 1024,
  maxStoredBytes: 2 * 1024 * 1024,
};
const MAX_DRAFT_CHARACTERS = 100_000;

/**
 * Every queue's contents, for as long as this tab is open.
 *
 * Serialised rather than held as objects, so a caller cannot mutate what is
 * queued after the fact and so the size budgets below mean the same thing they
 * meant when this was a browser store.
 */
const HELD = new Map<string, string>();

function readRaw(key: string, maxStoredBytes: number): unknown[] {
  try {
    const raw = HELD.get(key) ?? "[]";
    if (utf8Bytes(raw) > maxStoredBytes) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Forget every queue. Used by sign-out and by the local-data authority: what
 * one person's tab was holding must not be waiting when the next person signs
 * in on the same machine.
 */
export function forgetAllQueues(): void {
  HELD.clear();
}

function isQueued<T>(v: unknown): v is QueuedItem<T> {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Partial<QueuedItem<T>>;
  const queuedAt = typeof o.queuedAt === "string" ? new Date(o.queuedAt) : null;
  return (
    typeof o.id === "string" &&
    o.id.trim().length > 0 &&
    o.id.length <= 300 &&
    queuedAt !== null &&
    Number.isFinite(queuedAt.getTime()) &&
    queuedAt.toISOString() === o.queuedAt &&
    Number.isInteger(o.attempts) &&
    Number(o.attempts) >= 0 &&
    "payload" in o
  );
}

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) && Number.isInteger(value) && Number(value) > 0
    ? Number(value)
    : fallback;
}

/**
 * A crash-durable FIFO queue.
 *
 * `isReplayable` is required, not optional: the caller must state explicitly
 * which payloads are safe to send later. Anything else is refused at enqueue
 * time rather than silently stored and replayed at a surprising moment.
 */
export class OfflineQueue<T> {
  private readonly maxItems: number;
  private readonly maxAttempts: number;
  private readonly maxPayloadBytes: number;
  private readonly maxStoredBytes: number;

  constructor(
    private readonly storageKey: string,
    private readonly isReplayable: (payload: T) => boolean,
    options: QueueOptions = {},
  ) {
    this.maxItems = positiveInteger(options.maxItems, DEFAULTS.maxItems);
    this.maxAttempts = positiveInteger(options.maxAttempts, DEFAULTS.maxAttempts);
    this.maxPayloadBytes = positiveInteger(options.maxPayloadBytes, DEFAULTS.maxPayloadBytes);
    this.maxStoredBytes = positiveInteger(options.maxStoredBytes, DEFAULTS.maxStoredBytes);
  }

  all(): QueuedItem<T>[] {
    return readRaw(this.storageKey, this.maxStoredBytes)
      .filter(isQueued<T>)
      .filter((item) => this.isReplayable(item.payload));
  }

  get size(): number {
    return this.all().length;
  }

  private write(items: QueuedItem<T>[]): boolean {
    const bounded = [...items];
    let serialized = serialiseQueue(bounded);
    while (
      serialized !== null &&
      utf8Bytes(serialized) > this.maxStoredBytes &&
      bounded.length > 0
    ) {
      bounded.shift();
      serialized = serialiseQueue(bounded);
    }
    if (serialized === null || utf8Bytes(serialized) > this.maxStoredBytes) return false;
    HELD.set(this.storageKey, serialized);
    return true;
  }

  /** Returns the stored item, or a refusal when the payload must not be replayed. */
  enqueue(
    payload: T,
    now: Date = new Date(),
    id: string = `q-${now.getTime()}-${Math.random().toString(16).slice(2, 8)}`,
  ): { queued: true; item: QueuedItem<T> } | { queued: false; reason: string } {
    if (!this.isReplayable(payload)) {
      return {
        queued: false,
        reason: "This needs a live connection — it can't be queued and replayed later.",
      };
    }
    if (!id.trim() || id.length > 300) {
      return { queued: false, reason: "The queue operation id is invalid." };
    }
    if (!Number.isFinite(now.getTime())) {
      return { queued: false, reason: "The queue timestamp is invalid." };
    }
    const payloadJson = serialiseQueue(payload);
    if (payloadJson === null || utf8Bytes(payloadJson) > this.maxPayloadBytes) {
      return {
        queued: false,
        reason: `The queued payload exceeds its ${this.maxPayloadBytes}-byte storage budget.`,
      };
    }
    if (this.all().some((existing) => existing.id === id)) {
      return {
        queued: false,
        reason: "This operation is already queued; no duplicate was created.",
      };
    }
    const item: QueuedItem<T> = { id, payload, queuedAt: now.toISOString(), attempts: 0 };
    const itemRecord = serialiseQueue([item]);
    if (itemRecord === null || utf8Bytes(itemRecord) > this.maxStoredBytes) {
      return {
        queued: false,
        reason: "This operation cannot fit inside the queue's total storage budget.",
      };
    }
    const items = [...this.all(), item].slice(-this.maxItems);
    if (!this.write(items)) {
      return {
        queued: false,
        reason: "This operation could not be saved durably, so it was not queued.",
      };
    }
    if (!this.all().some((stored) => stored.id === id)) {
      return {
        queued: false,
        reason: "This operation was not present after storage verification, so it was not queued.",
      };
    }
    return { queued: true, item };
  }

  remove(id: string): boolean {
    return this.write(this.all().filter((i) => i.id !== id));
  }

  clear(): boolean {
    return this.write([]);
  }

  /**
   * Attempt every queued item oldest-first.
   *
   * A successful send removes the item. A failure increments its attempt count
   * and keeps it — until `maxAttempts`, after which it is dropped so one
   * poisoned item can never block the queue forever.
   */
  async flush(
    send: (payload: T, context: QueueSendContext) => Promise<boolean>,
  ): Promise<{ sent: number; failed: number; dropped: number }> {
    let sent = 0;
    let failed = 0;
    let dropped = 0;

    for (const item of this.all()) {
      let ok = false;
      try {
        ok = await send(item.payload, {
          idempotencyKey: item.id,
          queuedAt: item.queuedAt,
          attempt: item.attempts + 1,
        });
      } catch {
        ok = false;
      }
      if (ok) {
        if (this.remove(item.id)) sent++;
        else failed++;
        continue;
      }
      const attempts = item.attempts + 1;
      if (attempts >= this.maxAttempts) {
        if (this.remove(item.id)) dropped++;
        else failed++;
      } else {
        this.write(this.all().map((i) => (i.id === item.id ? { ...i, attempts } : i)));
        failed++;
      }
    }
    return { sent, failed, dropped };
  }
}

/* ------------------------------------------------------- draft recovery -- */

export interface RecoveredDraft {
  text: string;
  savedAt: string;
}

const DRAFT_PREFIX = "caera:draft:";

/**
 * Persist an in-progress message so a crash, reload or accidental close does
 * not lose what the user typed. Scoped per conversation.
 */
export function saveDraft(conversationId: string, text: string, now: Date = new Date()): void {
  if (typeof localStorage === "undefined" || !conversationId) return;
  try {
    if (
      text.length > MAX_DRAFT_CHARACTERS ||
      conversationId.length > 300 ||
      !Number.isFinite(now.getTime())
    ) {
      localStorage.removeItem(DRAFT_PREFIX + conversationId);
      return;
    }
    if (!text.trim()) {
      localStorage.removeItem(DRAFT_PREFIX + conversationId);
      return;
    }
    localStorage.setItem(
      DRAFT_PREFIX + conversationId,
      JSON.stringify({ text, savedAt: now.toISOString() }),
    );
  } catch {
    /* storage unavailable — drafts are best-effort */
  }
}

export function recoverDraft(conversationId: string): RecoveredDraft | null {
  if (typeof localStorage === "undefined" || !conversationId || conversationId.length > 300)
    return null;
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + conversationId);
    if (!raw || raw.length > MAX_DRAFT_CHARACTERS + 1_000) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as RecoveredDraft).text === "string" &&
      (parsed as RecoveredDraft).text.trim().length > 0 &&
      (parsed as RecoveredDraft).text.length <= MAX_DRAFT_CHARACTERS &&
      typeof (parsed as RecoveredDraft).savedAt === "string" &&
      Number.isFinite(Date.parse((parsed as RecoveredDraft).savedAt))
    ) {
      return parsed as RecoveredDraft;
    }
    return null;
  } catch {
    return null;
  }
}

export function clearDraft(conversationId: string): void {
  if (typeof localStorage === "undefined" || !conversationId) return;
  try {
    localStorage.removeItem(DRAFT_PREFIX + conversationId);
  } catch {
    /* ignore */
  }
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function serialiseQueue(value: unknown): string | null {
  try {
    const serialised = JSON.stringify(value);
    return typeof serialised === "string" ? serialised : null;
  } catch {
    return null;
  }
}

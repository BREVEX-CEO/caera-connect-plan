/**
 * Server-backed lists that survive losing the network.
 *
 * THE FAILURE THIS FIXES
 * ----------------------
 * OCADE tells people their work stays on their device and that the engine runs
 * on their own hardware. Then Tasks, Projects and the rest fetched from the
 * server on every render and showed an error when it was not there — so a
 * laptop on a plane, holding a local model and a local vault, could hold a
 * conversation and could not tell you what it was scheduled to do at nine.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not a general offline database, and it deliberately does not pretend
 * the server's answer is optional. Every read still goes to the server first
 * when there is a network; the mirror answers only when that fails. A person
 * looking at a mirrored list is TOLD they are, with the time it was taken,
 * because a stale schedule presented as current is worse than no schedule.
 *
 * WHY MUTATIONS ARE QUEUED RATHER THAN APPLIED
 * --------------------------------------------
 * Pausing an automation offline cannot pause anything: the thing that would run
 * it is not on this device. What CAN be honest is recording the intent, showing
 * it as pending, and applying it the moment the connection returns. The queue
 * is the existing outbox, so it inherits the backoff, the jitter and the
 * idempotency key that were already thought through there — a second queue
 * would have needed all three thought through again.
 */

const DB_NAME = "ocade-offline-mirror";
const DB_VERSION = 1;
const STORE = "lists";

/**
 * What may be mirrored.
 *
 * A closed set rather than a free string, so a mirror cannot be created for
 * something that should never be cached — an authorisation result, a payment
 * state — by a caller who did not think about it.
 */
export type MirrorKey = "automations" | "automation_runs" | "projects" | "conversations";

interface MirrorRow<T> {
  key: string;
  /** When the server last answered successfully. */
  takenAt: number;
  items: T[];
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function scopedKey(key: MirrorKey, userId: string | null): string {
  /*
   * Scoped to the account. A shared machine that showed the previous person's
   * schedule because the network happened to be down would be a data leak
   * dressed as a convenience.
   */
  return `${userId ?? "anonymous"}:${key}`;
}

export function mirrorAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

export async function writeMirror<T>(
  key: MirrorKey,
  userId: string | null,
  items: T[],
): Promise<void> {
  if (!mirrorAvailable()) return;
  try {
    const db = await openDb();
    const row: MirrorRow<T> = { key: scopedKey(key, userId), takenAt: Date.now(), items };
    await promisify(db.transaction(STORE, "readwrite").objectStore(STORE).put(row));
    db.close();
  } catch {
    /*
     * A browser in private mode, out of quota, or with storage blocked. The
     * live path still works; only the offline fallback is lost, and failing the
     * user's actual request to report that would be the wrong trade.
     */
  }
}

export interface MirrorRead<T> {
  items: T[];
  /** When the server last answered. Shown to the person, never hidden. */
  takenAt: number;
}

export async function readMirror<T>(
  key: MirrorKey,
  userId: string | null,
): Promise<MirrorRead<T> | null> {
  if (!mirrorAvailable()) return null;
  try {
    const db = await openDb();
    const row = await promisify<MirrorRow<T> | undefined>(
      db.transaction(STORE, "readonly").objectStore(STORE).get(scopedKey(key, userId)),
    );
    db.close();
    if (!row || !Array.isArray(row.items)) return null;
    return { items: row.items, takenAt: row.takenAt };
  } catch {
    return null;
  }
}

export async function clearMirror(userId: string | null): Promise<void> {
  if (!mirrorAvailable()) return;
  try {
    const db = await openDb();
    const store = db.transaction(STORE, "readwrite").objectStore(STORE);
    const keys = await promisify<IDBValidKey[]>(store.getAllKeys());
    const prefix = `${userId ?? "anonymous"}:`;
    for (const key of keys) {
      if (typeof key === "string" && key.startsWith(prefix)) store.delete(key);
    }
    db.close();
  } catch {
    /* Nothing to clear is indistinguishable from cleared. */
  }
}

/**
 * Fetch, mirroring on success and falling back on failure.
 *
 * The order is deliberate and is the whole contract: the server is asked first,
 * every time, and its answer always wins. A cache-first read would show
 * yesterday's schedule to somebody with a perfectly good connection.
 */
export async function fetchWithMirror<T>(
  key: MirrorKey,
  userId: string | null,
  fetcher: () => Promise<T[]>,
): Promise<{ items: T[]; stale: false } | { items: T[]; stale: true; takenAt: number }> {
  try {
    const items = await fetcher();
    void writeMirror(key, userId, items);
    return { items, stale: false };
  } catch (error) {
    const mirrored = await readMirror<T>(key, userId);
    if (mirrored) return { items: mirrored.items, stale: true, takenAt: mirrored.takenAt };
    throw error;
  }
}

/** How long ago the mirror was taken, in words. */
export function describeStaleness(takenAt: number, now = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - takenAt) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes === 1) return "a minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours === 1) return "an hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

/** A queued change that could not be applied because there was no network. */
export interface PendingIntent {
  id: string;
  /** What the person asked for, in words, for the pending badge. */
  label: string;
  queuedAt: number;
}

const PENDING_KEY = "ocade:pending-intents:v1";

export function readPendingIntents(): PendingIntent[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PendingIntent =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as PendingIntent).id === "string" &&
        typeof (entry as PendingIntent).label === "string",
    );
  } catch {
    return [];
  }
}

export function writePendingIntents(intents: PendingIntent[]): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(intents.slice(0, 100)));
  } catch {
    /* Blocked storage: the intent is lost, and the UI reports it was not saved. */
  }
}

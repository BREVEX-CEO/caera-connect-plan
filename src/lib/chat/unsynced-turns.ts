/**
 * TURNS THE ACCOUNT HAS NOT RECEIVED YET, KEPT ENCRYPTED UNTIL IT HAS.
 *
 * Supabase is the one authority for chat. The exception is a turn written while
 * the database is unreachable: it waits here, in memory for the screen and in
 * an encrypted IndexedDB journal so a closed tab or a browser restart does not
 * lose it. The journal key is AES-GCM, generated per account, non-extractable,
 * and never leaves this browser; signing out deletes the account's entries and
 * key. Each turn carries a `clientKey` the server refuses to store twice, so a
 * replay after a restart still yields exactly one row.
 */
import type { ChatAttachmentMeta } from "@/lib/ocade-chat-store";

export interface UnsyncedTurn {
  /** Idempotency key. Also this buffer's map key. */
  clientKey: string;
  conversationId: string;
  /** Title for a conversation that was started without a connection. */
  title?: string;
  role: "user" | "assistant";
  content: string;
  modelId: string | null;
  providerId: string | null;
  attachments: ChatAttachmentMeta[];
  /** When the turn happened, not when it was uploaded. */
  createdAt: string;
}

const DB_NAME = "ocade-offline-journal";
const TURNS = "turns";
const KEYS = "keys";

const buffer = new Map<string, UnsyncedTurn>();
const inFlight = new Set<string>();
let account: string | null = null;
let ready: Promise<void> = Promise.resolve();

interface JournalRow {
  clientKey: string;
  accountId: string;
  iv: Uint8Array<ArrayBuffer>;
  data: ArrayBuffer;
}

function db(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === "undefined" || !globalThis.crypto?.subtle) return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(TURNS, { keyPath: "clientKey" });
      request.result.createObjectStore(KEYS, { keyPath: "accountId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(
  store: string,
  mode: IDBTransactionMode,
  act: (s: IDBObjectStore) => IDBRequest<T>,
) {
  const opened = db();
  if (!opened) return Promise.resolve(undefined);
  return opened.then((database) =>
    new Promise<T>((resolve, reject) => {
      const request = act(database.transaction(store, mode).objectStore(store));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).finally(() => database.close()),
  );
}

const keys = new Map<string, Promise<CryptoKey>>();
/** One key per account, even when two writes ask for it at once. */
function keyFor(accountId: string): Promise<CryptoKey> {
  let key = keys.get(accountId);
  if (!key) {
    key = (async () => {
      const found = await run<{ key: CryptoKey } | undefined>(KEYS, "readonly", (s) =>
        s.get(accountId),
      );
      if (found) return found.key;
      const made = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
        "encrypt",
        "decrypt",
      ]);
      await run(KEYS, "readwrite", (s) => s.put({ accountId, key: made }));
      return made;
    })();
    keys.set(accountId, key);
    key.catch(() => keys.delete(accountId));
  }
  return key;
}

/** Every journal change runs in order, so a delete never lands before its write. */
let queue: Promise<unknown> = Promise.resolve();
function inOrder<T>(op: () => Promise<T>): Promise<T | undefined> {
  const next = queue.then(op).catch(() => undefined);
  queue = next;
  return next;
}

async function write(accountId: string, turn: UnsyncedTurn): Promise<void> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const data = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await keyFor(accountId),
    new TextEncoder().encode(JSON.stringify(turn)),
  );
  await run(TURNS, "readwrite", (s) =>
    s.put({ clientKey: turn.clientKey, accountId, iv, data } satisfies JournalRow),
  );
}

async function load(accountId: string): Promise<void> {
  const rows = (await run<JournalRow[]>(TURNS, "readonly", (s) => s.getAll())) ?? [];
  const mine = rows.filter((row) => row.accountId === accountId);
  if (mine.length === 0) return;
  const key = await keyFor(accountId);
  for (const row of mine) {
    try {
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: row.iv }, key, row.data);
      const turn = JSON.parse(new TextDecoder().decode(plain)) as UnsyncedTurn;
      if (account === accountId) buffer.set(turn.clientKey, turn);
    } catch {
      // Unreadable (key gone): it can never be sent, so it is dropped.
      await run(TURNS, "readwrite", (s) => s.delete(row.clientKey));
    }
  }
}

/** Switch to an account's journal; resolves once its saved turns are loaded. */
export function openJournal(accountId: string | null): Promise<void> {
  if (accountId === account) return ready;
  account = accountId;
  buffer.clear();
  ready = accountId ? inOrder(() => load(accountId)).then(() => undefined) : Promise.resolve();
  return ready;
}

/** Hold a turn the database could not be told about yet. */
export function rememberUnsyncedTurn(turn: UnsyncedTurn): void {
  buffer.set(turn.clientKey, turn);
  const owner = account;
  if (owner) void inOrder(() => write(owner, turn));
}

/** Every waiting turn, oldest first, so a flush replays them in order. */
export function unsyncedTurns(): UnsyncedTurn[] {
  return [...buffer.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** Retire one turn, because the database now holds it. */
export function forgetUnsyncedTurn(clientKey: string): void {
  buffer.delete(clientKey);
  void inOrder(() => run(TURNS, "readwrite", (s) => s.delete(clientKey)));
}

/** Claim a turn for uploading, or refuse because another drain has it. */
export function claimUnsyncedTurn(clientKey: string): boolean {
  if (inFlight.has(clientKey)) return false;
  inFlight.add(clientKey);
  return true;
}

export function releaseUnsyncedTurn(clientKey: string): void {
  inFlight.delete(clientKey);
}

/** Discard an account's waiting turns and its journal key. Sign-out, after a warning. */
export async function forgetAllUnsyncedTurns(owner: string): Promise<void> {
  if (owner === account) buffer.clear();
  await inOrder(async () => {
    const rows = (await run<JournalRow[]>(TURNS, "readonly", (s) => s.getAll())) ?? [];
    for (const row of rows.filter((r) => r.accountId === owner)) {
      await run(TURNS, "readwrite", (s) => s.delete(row.clientKey));
    }
    await run(KEYS, "readwrite", (s) => s.delete(owner));
    keys.delete(owner);
  });
}

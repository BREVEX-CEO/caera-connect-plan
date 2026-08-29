/**
 * Automatic encrypted device cache for Private Sync.
 *
 * Browser Only and Private Sync have different promises, so they must not share
 * an unlock key. Browser Only deliberately keeps its key in memory and requires
 * a person to unlock it. Private Sync is the normal signed-in mode: Supabase is
 * the synchronised authority, while this cache must work on a plane and after a
 * reload without asking the person to configure a second product first.
 *
 * The cache key is a non-extractable AES-GCM CryptoKey stored by IndexedDB's
 * structured-clone implementation. JavaScript can ask WebCrypto to use it but
 * cannot export its bytes. There is one key and one record namespace per user,
 * so signing into another account in the same browser cannot reveal or upload
 * the previous account's cache.
 *
 * Recovery is deliberately conservative. A missing key is created only when
 * there are no records for that user. If records exist but their key is gone or
 * a ciphertext cannot be authenticated, the adapter throws instead of silently
 * replacing the key and making unsynchronised work unrecoverable. Synced rows
 * can then be restored from Supabase; a caller may explicitly clear the broken
 * cache after that decision.
 */

import type { DataClass, StorageAdapter, StoredRecord } from "./types";
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  b64decode,
  b64encode,
  bytesToJson,
  jsonToBytes,
} from "./vault-crypto";

const DB_NAME = "ocade-private-sync-cache";
const DB_VERSION = 1;
const KEY_STORE = "device_keys";
const RECORD_STORE = "records";
const CACHE_FORMAT = "private-sync-cache-v1";

type KeyRow = {
  userId: string;
  key: CryptoKey;
  createdAt: number;
  format: typeof CACHE_FORMAT;
};

type CacheRow = {
  key: string;
  userId: string;
  dataClass: DataClass;
  id: string;
  createdAt: number;
  updatedAt: number;
  iv: string;
  ciphertext: string;
  format: typeof CACHE_FORMAT;
};

export class PrivateSyncCacheError extends Error {
  constructor(message = "OCADE could not open this device's Private Sync cache safely.") {
    super(message);
    this.name = "PrivateSyncCacheError";
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE, { keyPath: "userId" });
      }
      if (!db.objectStoreNames.contains(RECORD_STORE)) {
        const records = db.createObjectStore(RECORD_STORE, { keyPath: "key" });
        records.createIndex("by_user_class", ["userId", "dataClass"], { unique: false });
        records.createIndex("by_user", "userId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function rowKey(userId: string, dataClass: DataClass, id: string): string {
  return `${encodeURIComponent(userId)}|${dataClass}|${id}`;
}

function additionalData(userId: string, dataClass: DataClass, id: string): Uint8Array {
  return new TextEncoder().encode(`${CACHE_FORMAT}|${userId}|${dataClass}|${id}`);
}

async function hasRecordsForUser(db: IDBDatabase, userId: string): Promise<boolean> {
  const transaction = db.transaction(RECORD_STORE, "readonly");
  const count = await requestResult(
    transaction.objectStore(RECORD_STORE).index("by_user").count(IDBKeyRange.only(userId)),
  );
  await transactionDone(transaction);
  return count > 0;
}

async function readKey(db: IDBDatabase, userId: string): Promise<CryptoKey | null> {
  const transaction = db.transaction(KEY_STORE, "readonly");
  const row = (await requestResult(transaction.objectStore(KEY_STORE).get(userId))) as
    KeyRow | undefined;
  await transactionDone(transaction);
  return row?.key ?? null;
}

async function generateNonExtractableKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function keyForUser(db: IDBDatabase, userId: string): Promise<CryptoKey> {
  const existing = await readKey(db, userId);
  if (existing) return existing;

  if (await hasRecordsForUser(db, userId)) {
    throw new PrivateSyncCacheError(
      "This device's Private Sync key is missing, so OCADE left the encrypted cache untouched.",
    );
  }

  const candidate = await generateNonExtractableKey();
  const transaction = db.transaction(KEY_STORE, "readwrite");
  try {
    transaction.objectStore(KEY_STORE).add({
      userId,
      key: candidate,
      createdAt: Date.now(),
      format: CACHE_FORMAT,
    } satisfies KeyRow);
    await transactionDone(transaction);
    return candidate;
  } catch (error) {
    // Another tab may have won the add race. Its key is canonical; discard the
    // candidate and read the winner rather than overwriting it.
    if (error instanceof DOMException && error.name === "ConstraintError") {
      const winner = await readKey(db, userId);
      if (winner) return winner;
    }
    throw error;
  }
}

async function decryptRow<T>(key: CryptoKey, row: CacheRow): Promise<T> {
  try {
    const plaintext = await aesGcmDecrypt(
      key,
      b64decode(row.iv),
      b64decode(row.ciphertext),
      additionalData(row.userId, row.dataClass, row.id),
    );
    return bytesToJson<T>(plaintext);
  } catch {
    throw new PrivateSyncCacheError(
      "OCADE could not authenticate an encrypted Private Sync record on this device.",
    );
  }
}

const adapters = new Map<string, StorageAdapter>();

/** Fill the offline cache from a successful sync without opening one database
 * and one transaction per row. Large accounts routinely arrive in thousands of
 * records; batching makes that a single durable commit instead of thousands. */
export async function putPrivateSyncCacheRecords<T>(
  userId: string,
  dataClass: DataClass,
  records: Array<{ id: string; value: T; createdAt?: number; updatedAt?: number }>,
): Promise<void> {
  if (records.length === 0) return;
  const db = await openDb();
  try {
    const key = await keyForUser(db, userId);
    const encrypted = await Promise.all(
      records.map(async (record) => {
        const result = await aesGcmEncrypt(
          key,
          jsonToBytes(record.value),
          additionalData(userId, dataClass, record.id),
        );
        return { record, result };
      }),
    );
    const now = Date.now();
    const transaction = db.transaction(RECORD_STORE, "readwrite");
    const store = transaction.objectStore(RECORD_STORE);
    for (const { record, result } of encrypted) {
      store.put({
        key: rowKey(userId, dataClass, record.id),
        userId,
        dataClass,
        id: record.id,
        createdAt: record.createdAt ?? now,
        updatedAt: record.updatedAt ?? now,
        iv: b64encode(result.iv),
        ciphertext: b64encode(result.ciphertext),
        format: CACHE_FORMAT,
      } satisfies CacheRow);
    }
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}

/** A stable adapter bound to exactly one signed-in user. */
export function privateSyncCacheAdapterFor(userId: string): StorageAdapter {
  const hit = adapters.get(userId);
  if (hit) return hit;

  const adapter: StorageAdapter = {
    mode: "private_sync",

    async put(dataClass, id, value) {
      const db = await openDb();
      try {
        const key = await keyForUser(db, userId);
        const recordKey = rowKey(userId, dataClass, id);
        const read = db.transaction(RECORD_STORE, "readonly");
        const existing = (await requestResult(read.objectStore(RECORD_STORE).get(recordKey))) as
          CacheRow | undefined;
        await transactionDone(read);

        const encrypted = await aesGcmEncrypt(
          key,
          jsonToBytes(value),
          additionalData(userId, dataClass, id),
        );
        const now = Date.now();
        const write = db.transaction(RECORD_STORE, "readwrite");
        write.objectStore(RECORD_STORE).put({
          key: recordKey,
          userId,
          dataClass,
          id,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          iv: b64encode(encrypted.iv),
          ciphertext: b64encode(encrypted.ciphertext),
          format: CACHE_FORMAT,
        } satisfies CacheRow);
        await transactionDone(write);
      } finally {
        db.close();
      }
    },

    async get<T>(dataClass: DataClass, id: string) {
      const db = await openDb();
      try {
        const read = db.transaction(RECORD_STORE, "readonly");
        const row = (await requestResult(
          read.objectStore(RECORD_STORE).get(rowKey(userId, dataClass, id)),
        )) as CacheRow | undefined;
        await transactionDone(read);
        if (!row) return null;
        const key = await keyForUser(db, userId);
        return {
          id: row.id,
          dataClass: row.dataClass,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          value: await decryptRow<T>(key, row),
        } satisfies StoredRecord<T>;
      } finally {
        db.close();
      }
    },

    async list<T>(dataClass: DataClass) {
      const db = await openDb();
      try {
        const read = db.transaction(RECORD_STORE, "readonly");
        const rows = (await requestResult(
          read
            .objectStore(RECORD_STORE)
            .index("by_user_class")
            .getAll(IDBKeyRange.only([userId, dataClass])),
        )) as CacheRow[];
        await transactionDone(read);
        if (rows.length === 0) return [];
        const key = await keyForUser(db, userId);
        return Promise.all(
          rows.map(async (row) => ({
            id: row.id,
            dataClass: row.dataClass,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            value: await decryptRow<T>(key, row),
          })),
        );
      } finally {
        db.close();
      }
    },

    async delete(dataClass, id) {
      const db = await openDb();
      try {
        const transaction = db.transaction(RECORD_STORE, "readwrite");
        transaction.objectStore(RECORD_STORE).delete(rowKey(userId, dataClass, id));
        await transactionDone(transaction);
      } finally {
        db.close();
      }
    },

    async clear(dataClass) {
      const db = await openDb();
      try {
        const transaction = db.transaction(RECORD_STORE, "readwrite");
        const records = transaction.objectStore(RECORD_STORE);
        const index = records.index(dataClass ? "by_user_class" : "by_user");
        const range = IDBKeyRange.only(dataClass ? [userId, dataClass] : userId);
        const keys = (await requestResult(index.getAllKeys(range))) as IDBValidKey[];
        for (const key of keys) records.delete(key);
        await transactionDone(transaction);
      } finally {
        db.close();
      }
    },
  };

  adapters.set(userId, adapter);
  return adapter;
}

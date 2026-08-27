/**
 * Encrypted IndexedDB adapter for Browser Only storage.
 *
 * Every record's `value` is encrypted at rest with AES-GCM under the
 * in-memory DEK from vault-session. Metadata (id, dataClass, timestamps)
 * stays clear so we can list/query without an unlock; the payload is
 * opaque ciphertext.
 */

import {
  StorageLockedError,
  type DataClass,
  type StorageAdapter,
  type StoredRecord,
} from "./types";
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  b64decode,
  b64encode,
  bytesToJson,
  jsonToBytes,
} from "./vault-crypto";
import { isUnlocked, requireKey } from "./vault-session";

const DB_NAME = "caera-browser-vault";
const DB_VERSION = 1;
const STORE = "records";

type Row = {
  key: string; // `${dataClass}:${id}`
  dataClass: DataClass;
  id: string;
  createdAt: number;
  updatedAt: number;
  iv: string;
  ciphertext: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "key" });
        store.createIndex("by_class", "dataClass", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}
function promisify<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function encryptValue(value: unknown, dataClass: DataClass, id: string) {
  const key = requireKey();
  const aad = new TextEncoder().encode(`${dataClass}|${id}`);
  const { iv, ciphertext } = await aesGcmEncrypt(key, jsonToBytes(value), aad);
  return { iv: b64encode(iv), ciphertext: b64encode(ciphertext) };
}
async function decryptValue<T>(row: Row): Promise<T> {
  const key = requireKey();
  const aad = new TextEncoder().encode(`${row.dataClass}|${row.id}`);
  const pt = await aesGcmDecrypt(key, b64decode(row.iv), b64decode(row.ciphertext), aad);
  return bytesToJson<T>(pt);
}

export const indexedDbAdapter: StorageAdapter = {
  mode: "browser_only",

  async put(dataClass, id, value) {
    const db = await openDb();
    const now = Date.now();
    const existing = (await promisify(tx(db, "readonly").get(`${dataClass}:${id}`))) as
      Row | undefined;
    const { iv, ciphertext } = await encryptValue(value, dataClass, id);
    const row: Row = {
      key: `${dataClass}:${id}`,
      dataClass,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      iv,
      ciphertext,
    };
    await promisify(tx(db, "readwrite").put(row));
    db.close();
  },

  async get<T>(dataClass: DataClass, id: string) {
    const db = await openDb();
    const row = (await promisify(tx(db, "readonly").get(`${dataClass}:${id}`))) as Row | undefined;
    db.close();
    if (!row) return null;
    const value = await decryptValue<T>(row);
    return {
      id: row.id,
      dataClass: row.dataClass,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      value,
    } satisfies StoredRecord<T>;
  },

  async list<T>(dataClass: DataClass) {
    /*
     * AN EMPTY LOCKED VAULT IS NOT AN EMPTY VAULT.
     *
     * The loop below decrypts row by row, so `requireKey` only ever ran when
     * there was at least one row — and a store with none returned `[]` without
     * touching the key. A locked vault was therefore indistinguishable from an
     * unlocked empty one, which is precisely the state every brand-new account
     * is in.
     *
     * The result was a workspace that lied to its newest users: Projects
     * rendered "No projects yet", a factual-sounding sentence that was not
     * true, above a Create button that failed on every press with a toast that
     * scrolled away. The page has an honest locked state — `SetupRequiredState`
     * with a retry — and it could not reach it, because reading never failed.
     *
     * "I cannot read this store" is true whether or not the store happens to
     * be empty, so it is said either way. Callers that already handle a
     * storage failure now get the locked state for free.
     */
    if (!isUnlocked()) throw new StorageLockedError();
    const db = await openDb();
    const store = tx(db, "readonly");
    const idx = store.index("by_class");
    const rows = (await promisify(idx.getAll(IDBKeyRange.only(dataClass)))) as Row[];
    db.close();
    const out: StoredRecord<T>[] = [];
    for (const row of rows) {
      const value = await decryptValue<T>(row);
      out.push({
        id: row.id,
        dataClass: row.dataClass,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        value,
      });
    }
    return out;
  },

  async delete(dataClass, id) {
    const db = await openDb();
    await promisify(tx(db, "readwrite").delete(`${dataClass}:${id}`));
    db.close();
  },

  async clear(dataClass) {
    const db = await openDb();
    if (!dataClass) {
      await promisify(tx(db, "readwrite").clear());
    } else {
      const store = tx(db, "readwrite");
      const idx = store.index("by_class");
      const keys = (await promisify(idx.getAllKeys(IDBKeyRange.only(dataClass)))) as IDBValidKey[];
      for (const k of keys) await promisify(store.delete(k));
    }
    db.close();
  },
};

/** Count-only helper for the empty-state UI — safe when the vault is locked. */
export async function countBrowserVaultRecords(): Promise<number> {
  if (typeof indexedDB === "undefined") return 0;
  const db = await openDb();
  const n = await promisify(tx(db, "readonly").count());
  db.close();
  return n;
}

import { i as StorageLockedError } from "./companion-bridge-CJ48JKAT.mjs";
import { i as requireKey, n as isUnlocked } from "./vault-session-Bh1128Qc.mjs";
import { a as bytesToJson, i as b64encode, m as jsonToBytes, n as aesGcmEncrypt, r as b64decode, t as aesGcmDecrypt } from "./vault-crypto-CDLLjPFZ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/indexeddb-adapter-C1VT61Sn.js
/**
* Encrypted IndexedDB adapter for Browser Only storage.
*
* Every record's `value` is encrypted at rest with AES-GCM under the
* in-memory DEK from vault-session. Metadata (id, dataClass, timestamps)
* stays clear so we can list/query without an unlock; the payload is
* opaque ciphertext.
*/
var DB_NAME = "caera-browser-vault";
var DB_VERSION = 1;
var STORE = "records";
function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" }).createIndex("by_class", "dataClass", { unique: false });
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
function tx(db, mode) {
	return db.transaction(STORE, mode).objectStore(STORE);
}
function promisify(req) {
	return new Promise((resolve, reject) => {
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}
async function encryptValue(value, dataClass, id) {
	const key = requireKey();
	const aad = new TextEncoder().encode(`${dataClass}|${id}`);
	const { iv, ciphertext } = await aesGcmEncrypt(key, jsonToBytes(value), aad);
	return {
		iv: b64encode(iv),
		ciphertext: b64encode(ciphertext)
	};
}
async function decryptValue(row) {
	const key = requireKey();
	const aad = new TextEncoder().encode(`${row.dataClass}|${row.id}`);
	return bytesToJson(await aesGcmDecrypt(key, b64decode(row.iv), b64decode(row.ciphertext), aad));
}
var indexedDbAdapter = {
	mode: "browser_only",
	async put(dataClass, id, value) {
		const db = await openDb();
		const now = Date.now();
		const existing = await promisify(tx(db, "readonly").get(`${dataClass}:${id}`));
		const { iv, ciphertext } = await encryptValue(value, dataClass, id);
		const row = {
			key: `${dataClass}:${id}`,
			dataClass,
			id,
			createdAt: existing?.createdAt ?? now,
			updatedAt: now,
			iv,
			ciphertext
		};
		await promisify(tx(db, "readwrite").put(row));
		db.close();
	},
	async get(dataClass, id) {
		const db = await openDb();
		const row = await promisify(tx(db, "readonly").get(`${dataClass}:${id}`));
		db.close();
		if (!row) return null;
		const value = await decryptValue(row);
		return {
			id: row.id,
			dataClass: row.dataClass,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
			value
		};
	},
	async list(dataClass) {
		if (!isUnlocked()) throw new StorageLockedError();
		const db = await openDb();
		const rows = await promisify(tx(db, "readonly").index("by_class").getAll(IDBKeyRange.only(dataClass)));
		db.close();
		const out = [];
		for (const row of rows) {
			const value = await decryptValue(row);
			out.push({
				id: row.id,
				dataClass: row.dataClass,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
				value
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
		if (!dataClass) await promisify(tx(db, "readwrite").clear());
		else {
			const store = tx(db, "readwrite");
			const keys = await promisify(store.index("by_class").getAllKeys(IDBKeyRange.only(dataClass)));
			for (const k of keys) await promisify(store.delete(k));
		}
		db.close();
	}
};
/** Count-only helper for the empty-state UI — safe when the vault is locked. */
async function countBrowserVaultRecords() {
	if (typeof indexedDB === "undefined") return 0;
	const db = await openDb();
	const n = await promisify(tx(db, "readonly").count());
	db.close();
	return n;
}
//#endregion
export { indexedDbAdapter as n, countBrowserVaultRecords as t };

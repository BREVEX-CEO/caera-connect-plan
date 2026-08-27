import { n as supabase } from "./client-BvyzyYvI.mjs";
import { r as NativeCompanionRequiredError } from "./companion-bridge-CJ48JKAT.mjs";
import { m as indexedDbAdapter } from "./indexeddb-adapter-DlTSuI3A.mjs";
import { n as enqueue, r as enqueueDelete, t as drainNow } from "./sync-queue-Cda0l5N0.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/resolver-gEbqMemW.js
/** PC Device Vault requires the OCADE Native Companion process on the OS.
*  On the web this adapter surfaces a clear error instead of falling back
*  silently to browser storage — the No-Dead-Button policy expects a
*  Native Companion Required state at every call site. */
var pcVaultAdapter = {
	mode: "pc_vault",
	async put() {
		throw new NativeCompanionRequiredError();
	},
	async get() {
		throw new NativeCompanionRequiredError();
	},
	async list() {
		throw new NativeCompanionRequiredError();
	},
	async delete() {
		throw new NativeCompanionRequiredError();
	},
	async clear() {
		throw new NativeCompanionRequiredError();
	}
};
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
async function uid() {
	const { data } = await supabase.auth.getUser();
	const id = data.user?.id;
	if (!id) throw new Error("Private Sync requires an authenticated session.");
	return id;
}
function toRecord(r) {
	return {
		id: r.id,
		dataClass: r.data_class,
		createdAt: Date.parse(r.created_at),
		updatedAt: Date.parse(r.updated_at),
		value: r.value
	};
}
var syncAdapter = {
	mode: "private_sync",
	async put(dataClass, id, value) {
		await indexedDbAdapter.put(dataClass, id, value);
		await enqueue({
			dataClass,
			id,
			value
		});
		drainNow();
	},
	async get(dataClass, id) {
		const local = await indexedDbAdapter.get(dataClass, id);
		if (local) return local;
		const user_id = await uid();
		const { data, error } = await supabase.from("user_private_records").select("*").eq("user_id", user_id).eq("data_class", dataClass).eq("id", id).maybeSingle();
		if (error) throw error;
		return data ? toRecord(data) : null;
	},
	async list(dataClass) {
		const local = await indexedDbAdapter.list(dataClass);
		let remote = [];
		try {
			const user_id = await uid();
			const { data, error } = await supabase.from("user_private_records").select("*").eq("user_id", user_id).eq("data_class", dataClass);
			if (error) throw error;
			remote = (data ?? []).map((r) => toRecord(r));
		} catch {
			return local;
		}
		const byId = new Map(local.map((r) => [r.id, r]));
		const unseen = [];
		for (const r of remote) {
			if (byId.has(r.id)) continue;
			byId.set(r.id, r);
			unseen.push(r);
		}
		await Promise.allSettled(unseen.map((record) => indexedDbAdapter.put(dataClass, record.id, record.value)));
		return [...byId.values()];
	},
	async delete(dataClass, id) {
		await indexedDbAdapter.delete(dataClass, id);
		await enqueueDelete({
			dataClass,
			id
		});
		drainNow();
	},
	async clear(dataClass) {
		const classes = dataClass ? [dataClass] : [
			"chats",
			"images",
			"files",
			"recordings",
			"copilot",
			"learning_replays"
		];
		for (const klass of classes) {
			const existing = await indexedDbAdapter.list(klass);
			for (const record of existing) {
				await indexedDbAdapter.delete(klass, record.id);
				await enqueueDelete({
					dataClass: klass,
					id: record.id
				});
			}
		}
		drainNow();
	}
};
/**
* Resolves the correct StorageAdapter for a given (user, data class).
*
* Reads the user's data_class_privacy row and returns the matching
* adapter. Callers should never instantiate adapters directly — that
* would bypass the user's privacy choice.
*/
var DEFAULT_MODE = {
	chats: "private_sync",
	images: "private_sync",
	files: "private_sync",
	recordings: "browser_only",
	copilot: "browser_only",
	learning_replays: "browser_only"
};
var cache = /* @__PURE__ */ new Map();
function adapterFor(mode) {
	switch (mode) {
		case "browser_only": return indexedDbAdapter;
		case "pc_vault": return pcVaultAdapter;
		case "private_sync": return syncAdapter;
	}
}
async function getModeFor(userId, dataClass) {
	const key = `${userId}:${dataClass}`;
	const hit = cache.get(key);
	if (hit) return hit;
	const { data } = await supabase.from("data_class_privacy").select("mode").eq("user_id", userId).eq("data_class", dataClass).maybeSingle();
	const mode = data?.mode ?? DEFAULT_MODE[dataClass];
	cache.set(key, mode);
	return mode;
}
async function setModeFor(userId, dataClass, mode) {
	const { error } = await supabase.from("data_class_privacy").upsert({
		user_id: userId,
		data_class: dataClass,
		mode
	}, { onConflict: "user_id,data_class" });
	if (error) throw error;
	cache.set(`${userId}:${dataClass}`, mode);
}
async function loadAllModes(userId) {
	const { data } = await supabase.from("data_class_privacy").select("data_class, mode").eq("user_id", userId);
	const out = { ...DEFAULT_MODE };
	for (const row of data ?? []) {
		out[row.data_class] = row.mode;
		cache.set(`${userId}:${row.data_class}`, row.mode);
	}
	return out;
}
async function resolveAdapter(userId, dataClass) {
	return adapterFor(await getModeFor(userId, dataClass));
}
function invalidateModeCache(userId) {
	if (!userId) return cache.clear();
	for (const k of Array.from(cache.keys())) if (k.startsWith(`${userId}:`)) cache.delete(k);
}
//#endregion
export { setModeFor as a, resolveAdapter as i, invalidateModeCache as n, loadAllModes as r, getModeFor as t };

import { n as supabase } from "./client-D46NpEQY.mjs";
import { r as NativeCompanionRequiredError } from "./companion-bridge-CJ48JKAT.mjs";
import { m as indexedDbAdapter } from "./indexeddb-adapter-D2eAwAIr.mjs";
import { n as enqueue, r as enqueueDelete, t as drainNow } from "./sync-queue-DpGk6846.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/resolver-CR5RuR-0.js
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
/**
* How many rows to ask for at once.
*
* Well under PostgREST's own ceiling so the page size is OURS rather than the
* server's, and small enough that one request is a reasonable thing to retry.
*/
var PAGE_ROWS = 500;
/**
* Refuses to loop forever if the server keeps answering with full pages.
* 400 pages is 200,000 records — far past any real account, and a bounded
* mistake instead of a browser tab that grows until it is killed.
*/
var MAX_PAGES = 400;
/**
* EVERY row of a data class, in pages, because "all of them" was a lie.
*
* This used to be one `.select("*")` with no bound at all. Two things were
* wrong with that, and the second is a data-loss bug rather than a slow query:
*
*   1. It transferred every record and its whole JSON body in a single
*      response — the entire chat history of an account, each time anything
*      asked for a list.
*   2. PostgREST caps how many rows it will return (`db-max-rows`, 1,000 by
*      default on Supabase) and it does so SILENTLY: the response is a
*      well-formed array of the first N rows with no error and no marker. An
*      account with more than N records in a class therefore synchronised the
*      first N and quietly never saw the rest. Nothing failed, so nothing
*      reported anything, and the missing records looked like records the user
*      had never written.
*
* Paging by the primary key rather than by offset: the key is
* (user_id, data_class, id), so ordering by `id` inside a fixed user and class
* walks that index directly, and a row inserted mid-walk cannot shift the
* window the way an OFFSET can. A short page means the end, which is the one
* signal a capped response cannot fake.
*/
async function listEveryPage(userId, dataClass) {
	const out = [];
	let after = null;
	for (let page = 0; page < MAX_PAGES; page += 1) {
		let request = supabase.from("user_private_records").select("*").eq("user_id", userId).eq("data_class", dataClass).order("id", { ascending: true }).limit(PAGE_ROWS);
		if (after !== null) request = request.gt("id", after);
		const { data, error } = await request;
		if (error) throw error;
		const rows = data ?? [];
		for (const row of rows) out.push(toRecord(row));
		if (rows.length < PAGE_ROWS) return out;
		after = rows[rows.length - 1].id;
	}
	console.warn(`[sync] stopped after ${MAX_PAGES} pages of ${dataClass}; some records were not read`);
	return out;
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
			remote = await listEveryPage(await uid(), dataClass);
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
var REMEMBERED = "ocade.storage.mode.v1";
/** Long enough for a slow connection, short enough not to read as a hang. */
var LOOKUP_TIMEOUT_MS = 4e3;
var OFFLINE_LOOKUP_TIMEOUT_MS = 400;
function remembered() {
	if (typeof localStorage === "undefined") return {};
	try {
		const raw = localStorage.getItem(REMEMBERED);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}
function remember(key, mode) {
	cache.set(key, mode);
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(REMEMBERED, JSON.stringify({
			...remembered(),
			[key]: mode
		}));
	} catch {}
}
function adapterFor(mode) {
	switch (mode) {
		case "browser_only": return indexedDbAdapter;
		case "pc_vault": return pcVaultAdapter;
		case "private_sync": return syncAdapter;
	}
}
async function getModeFor(userId, dataClass) {
	const key = `${userId}:${dataClass}`;
	const hit = cache.get(key) ?? remembered()[key];
	if (hit) {
		cache.set(key, hit);
		return hit;
	}
	const lookup = Promise.resolve(supabase.from("data_class_privacy").select("mode").eq("user_id", userId).eq("data_class", dataClass).maybeSingle()).then(({ data }) => data?.mode).catch(() => void 0);
	const offline = typeof navigator !== "undefined" && navigator.onLine === false;
	const timeout = new Promise((resolve) => setTimeout(() => resolve(void 0), offline ? OFFLINE_LOOKUP_TIMEOUT_MS : LOOKUP_TIMEOUT_MS));
	const answered = await Promise.race([lookup, timeout]);
	if (!answered) return DEFAULT_MODE[dataClass];
	remember(key, answered);
	return answered;
}
async function setModeFor(userId, dataClass, mode) {
	const { error } = await supabase.from("data_class_privacy").upsert({
		user_id: userId,
		data_class: dataClass,
		mode
	}, { onConflict: "user_id,data_class" });
	if (error) throw error;
	remember(`${userId}:${dataClass}`, mode);
}
async function loadAllModes(userId) {
	const { data } = await supabase.from("data_class_privacy").select("data_class, mode").eq("user_id", userId);
	const out = { ...DEFAULT_MODE };
	for (const row of data ?? []) {
		out[row.data_class] = row.mode;
		remember(`${userId}:${row.data_class}`, row.mode);
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

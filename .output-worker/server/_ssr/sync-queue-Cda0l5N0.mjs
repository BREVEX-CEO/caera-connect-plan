import { n as supabase } from "./client-BvyzyYvI.mjs";
import { m as indexedDbAdapter } from "./indexeddb-adapter-DlTSuI3A.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/sync-queue-Cda0l5N0.js
/**
* Backoff, capped.
*
* Uncapped exponential backoff means a laptop that was closed for a weekend
* comes back and waits four hours before trying again, which reads as "sync is
* broken". Capped at five minutes, a reconnect is noticed promptly and a
* genuinely dead server is not hammered.
*/
var MAX_BACKOFF_MS = 5 * 6e4;
function backoffFor(attempts) {
	const base = Math.min(MAX_BACKOFF_MS, 1e3 * 2 ** Math.max(0, attempts - 1));
	return Math.round(base * (.5 + Math.random() * .5));
}
/**
* Send everything that is due.
*
* Sequential rather than parallel on purpose: messages within a conversation
* have an order, and firing them together lets them land out of order on a
* server that is under load. Chat history that reads backwards is a worse bug
* than a slightly slower drain.
*/
async function drainOutbox(deps) {
	const now = deps.now ?? (() => Date.now());
	if (!(deps.online ?? (() => typeof navigator === "undefined" ? true : navigator.onLine))()) return {
		delivered: 0,
		failed: 0,
		shouldReport: false,
		remaining: (await deps.store.all()).length
	};
	const entries = [...await deps.store.all()].sort((a, b) => a.queuedAt === b.queuedAt ? a.id.localeCompare(b.id) : a.queuedAt.localeCompare(b.queuedAt));
	let delivered = 0;
	let failed = 0;
	let shouldReport = false;
	for (const entry of entries) {
		if (entry.nextAttemptAt > now()) continue;
		let outcome;
		try {
			outcome = await deps.deliver(entry);
		} catch (cause) {
			outcome = {
				ok: false,
				reason: cause instanceof Error ? cause.message : "delivery failed"
			};
		}
		if (outcome.ok) {
			await deps.store.remove(entry.id);
			delivered += 1;
			continue;
		}
		if (outcome.permanent) {
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
			...outcome.reason ? { lastError: outcome.reason } : {}
		});
		failed += 1;
		if (attempts >= 3) shouldReport = true;
	}
	return {
		delivered,
		failed,
		shouldReport,
		remaining: (await deps.store.all()).length
	};
}
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
var QUEUE_KEY = "ocade.sync.outbox.v1";
/**
* Remove record bodies written by older builds. The queue is deliberately
* plaintext metadata so it can be inspected before vault unlock; user content
* must never be part of it.
*/
function metadataOnly(entry) {
	if (entry.kind !== "message" || !entry.payload || typeof entry.payload !== "object") return entry;
	const payload = entry.payload;
	if (!payload.dataClass || typeof payload.id !== "string") return entry;
	return {
		...entry,
		payload: {
			dataClass: payload.dataClass,
			id: payload.id
		}
	};
}
function read() {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(QUEUE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		const entries = parsed.map(metadataOnly);
		if (JSON.stringify(entries) !== raw) write(entries);
		return entries;
	} catch {
		return [];
	}
}
function write(entries) {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(QUEUE_KEY, JSON.stringify(entries));
	} catch {}
}
var browserOutbox = {
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
	}
};
/**
* Queue an upload.
*
* The entry id is `${dataClass}:${id}`, not a fresh random value, so writing
* the same record twice before either send succeeds leaves ONE obligation
* rather than two. That is the difference between a retry and a duplicate.
*/
async function enqueue(payload) {
	await browserOutbox.put({
		id: `put:${payload.dataClass}:${payload.id}`,
		kind: "message",
		conversationId: payload.id,
		payload: {
			dataClass: payload.dataClass,
			id: payload.id
		},
		queuedAt: (/* @__PURE__ */ new Date()).toISOString(),
		attempts: 0,
		nextAttemptAt: 0
	});
}
async function enqueueDelete(payload) {
	await browserOutbox.remove(`put:${payload.dataClass}:${payload.id}`);
	await browserOutbox.put({
		id: `del:${payload.dataClass}:${payload.id}`,
		kind: "delete",
		conversationId: payload.id,
		payload,
		queuedAt: (/* @__PURE__ */ new Date()).toISOString(),
		attempts: 0,
		nextAttemptAt: 0
	});
}
async function deliver(entry) {
	const { data } = await supabase.auth.getUser();
	const user_id = data.user?.id;
	if (!user_id) return {
		ok: false,
		reason: "signed out"
	};
	if (entry.kind === "delete") {
		const payload = entry.payload;
		const { error } = await supabase.from("user_private_records").delete().eq("user_id", user_id).eq("data_class", payload.dataClass).eq("id", payload.id);
		if (error) return {
			ok: false,
			reason: error.message
		};
		return { ok: true };
	}
	const payload = entry.payload;
	let local;
	try {
		local = await indexedDbAdapter.get(payload.dataClass, payload.id);
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : "browser vault is locked"
		};
	}
	if (!local) return {
		ok: false,
		permanent: true,
		reason: "local record no longer exists"
	};
	const { error } = await supabase.from("user_private_records").upsert({
		user_id,
		data_class: payload.dataClass,
		id: payload.id,
		value: local.value
	}, { onConflict: "user_id,data_class,id" });
	if (error) return {
		ok: false,
		reason: error.message
	};
	return { ok: true };
}
var draining = null;
/**
* Send whatever is due, once.
*
* Serialised with a module-level promise: several writes in quick succession
* each call this, and concurrent drains would race over the same entries and
* could deliver one twice.
*/
function drainNow() {
	if (draining) return draining;
	draining = (async () => {
		try {
			(await drainOutbox({
				store: browserOutbox,
				deliver
			})).shouldReport;
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
function startSyncLoop(intervalMs = 6e4) {
	if (typeof window === "undefined") return () => {};
	const onOnline = () => void drainNow();
	window.addEventListener("online", onOnline);
	const timer = setInterval(() => void drainNow(), intervalMs);
	drainNow();
	return () => {
		window.removeEventListener("online", onOnline);
		clearInterval(timer);
	};
}
//#endregion
export { startSyncLoop as i, enqueue as n, enqueueDelete as r, drainNow as t };

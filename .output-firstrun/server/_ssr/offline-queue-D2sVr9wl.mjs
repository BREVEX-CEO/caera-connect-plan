//#region node_modules/.nitro/vite/services/ssr/assets/offline-queue-D2sVr9wl.js
var DEFAULTS = {
	maxItems: 200,
	maxAttempts: 5,
	maxPayloadBytes: 64 * 1024,
	maxStoredBytes: 2 * 1024 * 1024
};
var MAX_DRAFT_CHARACTERS = 1e5;
function readRaw(key, maxStoredBytes) {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(key) ?? "[]";
		if (utf8Bytes(raw) > maxStoredBytes) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
function isQueued(v) {
	if (typeof v !== "object" || v === null) return false;
	const o = v;
	const queuedAt = typeof o.queuedAt === "string" ? new Date(o.queuedAt) : null;
	return typeof o.id === "string" && o.id.trim().length > 0 && o.id.length <= 300 && queuedAt !== null && Number.isFinite(queuedAt.getTime()) && queuedAt.toISOString() === o.queuedAt && Number.isInteger(o.attempts) && Number(o.attempts) >= 0 && "payload" in o;
}
function positiveInteger(value, fallback) {
	return Number.isFinite(value) && Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}
/**
* A crash-durable FIFO queue.
*
* `isReplayable` is required, not optional: the caller must state explicitly
* which payloads are safe to send later. Anything else is refused at enqueue
* time rather than silently stored and replayed at a surprising moment.
*/
var OfflineQueue = class {
	storageKey;
	isReplayable;
	maxItems;
	maxAttempts;
	maxPayloadBytes;
	maxStoredBytes;
	constructor(storageKey, isReplayable, options = {}) {
		this.storageKey = storageKey;
		this.isReplayable = isReplayable;
		this.maxItems = positiveInteger(options.maxItems, DEFAULTS.maxItems);
		this.maxAttempts = positiveInteger(options.maxAttempts, DEFAULTS.maxAttempts);
		this.maxPayloadBytes = positiveInteger(options.maxPayloadBytes, DEFAULTS.maxPayloadBytes);
		this.maxStoredBytes = positiveInteger(options.maxStoredBytes, DEFAULTS.maxStoredBytes);
	}
	all() {
		return readRaw(this.storageKey, this.maxStoredBytes).filter(isQueued).filter((item) => this.isReplayable(item.payload));
	}
	get size() {
		return this.all().length;
	}
	write(items) {
		if (typeof localStorage === "undefined") return false;
		const bounded = [...items];
		let serialized = serialiseQueue(bounded);
		while (serialized !== null && utf8Bytes(serialized) > this.maxStoredBytes && bounded.length > 0) {
			bounded.shift();
			serialized = serialiseQueue(bounded);
		}
		if (serialized === null || utf8Bytes(serialized) > this.maxStoredBytes) return false;
		try {
			localStorage.setItem(this.storageKey, serialized);
			return true;
		} catch {
			try {
				const reduced = serialiseQueue(bounded.slice(-Math.ceil(bounded.length / 2)));
				if (reduced === null || utf8Bytes(reduced) > this.maxStoredBytes) return false;
				localStorage.setItem(this.storageKey, reduced);
				return true;
			} catch {
				return false;
			}
		}
	}
	/** Returns the stored item, or a refusal when the payload must not be replayed. */
	enqueue(payload, now = /* @__PURE__ */ new Date(), id = `q-${now.getTime()}-${Math.random().toString(16).slice(2, 8)}`) {
		if (!this.isReplayable(payload)) return {
			queued: false,
			reason: "This needs a live connection — it can't be queued and replayed later."
		};
		if (!id.trim() || id.length > 300) return {
			queued: false,
			reason: "The queue operation id is invalid."
		};
		if (!Number.isFinite(now.getTime())) return {
			queued: false,
			reason: "The queue timestamp is invalid."
		};
		const payloadJson = serialiseQueue(payload);
		if (payloadJson === null || utf8Bytes(payloadJson) > this.maxPayloadBytes) return {
			queued: false,
			reason: `The queued payload exceeds its ${this.maxPayloadBytes}-byte storage budget.`
		};
		if (this.all().some((existing) => existing.id === id)) return {
			queued: false,
			reason: "This operation is already queued; no duplicate was created."
		};
		const item = {
			id,
			payload,
			queuedAt: now.toISOString(),
			attempts: 0
		};
		const itemRecord = serialiseQueue([item]);
		if (itemRecord === null || utf8Bytes(itemRecord) > this.maxStoredBytes) return {
			queued: false,
			reason: "This operation cannot fit inside the queue's total storage budget."
		};
		const items = [...this.all(), item].slice(-this.maxItems);
		if (!this.write(items)) return {
			queued: false,
			reason: "This operation could not be saved durably, so it was not queued."
		};
		if (!this.all().some((stored) => stored.id === id)) return {
			queued: false,
			reason: "This operation was not present after storage verification, so it was not queued."
		};
		return {
			queued: true,
			item
		};
	}
	remove(id) {
		return this.write(this.all().filter((i) => i.id !== id));
	}
	clear() {
		return this.write([]);
	}
	/**
	* Attempt every queued item oldest-first.
	*
	* A successful send removes the item. A failure increments its attempt count
	* and keeps it — until `maxAttempts`, after which it is dropped so one
	* poisoned item can never block the queue forever.
	*/
	async flush(send) {
		let sent = 0;
		let failed = 0;
		let dropped = 0;
		for (const item of this.all()) {
			let ok = false;
			try {
				ok = await send(item.payload, {
					idempotencyKey: item.id,
					queuedAt: item.queuedAt,
					attempt: item.attempts + 1
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
			if (attempts >= this.maxAttempts) if (this.remove(item.id)) dropped++;
			else failed++;
			else {
				this.write(this.all().map((i) => i.id === item.id ? {
					...i,
					attempts
				} : i));
				failed++;
			}
		}
		return {
			sent,
			failed,
			dropped
		};
	}
};
var DRAFT_PREFIX = "caera:draft:";
/**
* Persist an in-progress message so a crash, reload or accidental close does
* not lose what the user typed. Scoped per conversation.
*/
function saveDraft(conversationId, text, now = /* @__PURE__ */ new Date()) {
	if (typeof localStorage === "undefined" || !conversationId) return;
	try {
		if (text.length > MAX_DRAFT_CHARACTERS || conversationId.length > 300 || !Number.isFinite(now.getTime())) {
			localStorage.removeItem(DRAFT_PREFIX + conversationId);
			return;
		}
		if (!text.trim()) {
			localStorage.removeItem(DRAFT_PREFIX + conversationId);
			return;
		}
		localStorage.setItem(DRAFT_PREFIX + conversationId, JSON.stringify({
			text,
			savedAt: now.toISOString()
		}));
	} catch {}
}
function recoverDraft(conversationId) {
	if (typeof localStorage === "undefined" || !conversationId || conversationId.length > 300) return null;
	try {
		const raw = localStorage.getItem(DRAFT_PREFIX + conversationId);
		if (!raw || raw.length > 101e3) return null;
		const parsed = JSON.parse(raw);
		if (typeof parsed === "object" && parsed !== null && typeof parsed.text === "string" && parsed.text.trim().length > 0 && parsed.text.length <= MAX_DRAFT_CHARACTERS && typeof parsed.savedAt === "string" && Number.isFinite(Date.parse(parsed.savedAt))) return parsed;
		return null;
	} catch {
		return null;
	}
}
function clearDraft(conversationId) {
	if (typeof localStorage === "undefined" || !conversationId) return;
	try {
		localStorage.removeItem(DRAFT_PREFIX + conversationId);
	} catch {}
}
function utf8Bytes(value) {
	return new TextEncoder().encode(value).byteLength;
}
function serialiseQueue(value) {
	try {
		const serialised = JSON.stringify(value);
		return typeof serialised === "string" ? serialised : null;
	} catch {
		return null;
	}
}
//#endregion
export { saveDraft as i, clearDraft as n, recoverDraft as r, OfflineQueue as t };

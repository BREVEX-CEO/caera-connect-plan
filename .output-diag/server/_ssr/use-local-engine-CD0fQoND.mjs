import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { r as discoverLocalModels, t as DEFAULT_LOCAL_BRIDGE_URL } from "./ocade-local-D4ziVbup.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-local-engine-CD0fQoND.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* Request hardening (Plan §39).
*
* Three problems this solves, all of which cause real user-visible damage:
*  1. DUPLICATE REQUESTS — a panel that mounts twice, or a user double-clicking,
*     fires the same call repeatedly. `singleFlight` coalesces concurrent
*     identical calls into one.
*  2. HANGS — a call that never settles leaves a spinner forever.
*     `withTimeout` bounds it and reports honestly.
*  3. LEAKS — a component unmounts while a call is in flight and then sets
*     state. `abortable` + `isAbortError` make cancellation explicit.
*
* Pure and dependency-free so it is unit-testable without a DOM.
*/
/** Error thrown when a guarded call exceeds its budget. */
var RequestTimeoutError = class extends Error {
	constructor(ms) {
		super(`This took longer than ${ms}ms and was stopped.`);
		this.name = "RequestTimeoutError";
	}
};
function isTimeoutError(e) {
	return e instanceof RequestTimeoutError;
}
var DEFAULT_MAX_INFLIGHT = 100;
var MAX_REQUEST_KEY_CHARACTERS = 256;
function validRequestKey(key) {
	return typeof key === "string" && key.trim().length > 0 && key.length <= MAX_REQUEST_KEY_CHARACTERS;
}
/**
* Coalesces concurrent calls sharing a key into ONE underlying call.
*
* Deliberately does not cache results: once a call settles the key is released,
* so the next call runs fresh. This removes duplicate work without introducing
* stale data.
*/
var SingleFlight = class {
	maxInflight;
	inflight = /* @__PURE__ */ new Map();
	constructor(maxInflight = DEFAULT_MAX_INFLIGHT) {
		this.maxInflight = maxInflight;
		if (!Number.isInteger(maxInflight) || maxInflight < 1) throw new Error("Single-flight capacity must be a positive integer.");
	}
	run(key, fn) {
		if (!validRequestKey(key)) return Promise.reject(/* @__PURE__ */ new Error(`A request key must contain 1-${MAX_REQUEST_KEY_CHARACTERS} characters.`));
		const existing = this.inflight.get(key);
		if (existing) return existing.promise;
		if (this.inflight.size >= this.maxInflight) return Promise.reject(/* @__PURE__ */ new Error(`Single-flight capacity (${this.maxInflight}) is full; apply backpressure before starting more unique work.`));
		const promise = (async () => fn())().finally(() => {
			if (this.inflight.get(key)?.promise === promise) this.inflight.delete(key);
		});
		this.inflight.set(key, {
			promise,
			startedAt: Date.now()
		});
		return promise;
	}
	/** How many calls are currently in flight (used in tests and diagnostics). */
	get size() {
		return this.inflight.size;
	}
	has(key) {
		return this.inflight.has(key);
	}
	clear() {
		this.inflight.clear();
	}
};
var globalSingleFlight = new SingleFlight();
/**
* Bound a promise. Rejects with RequestTimeoutError if the budget elapses.
* The timer is always cleared, so a fast success leaves nothing pending.
*/
function withTimeout(promise, ms) {
	if (!Number.isFinite(ms) || ms <= 0) return Promise.reject(/* @__PURE__ */ new Error("The request timeout budget must be a positive finite number."));
	let timer;
	const timeout = new Promise((_resolve, reject) => {
		timer = setTimeout(() => reject(new RequestTimeoutError(ms)), ms);
	});
	return Promise.race([promise, timeout]).finally(() => {
		if (timer) clearTimeout(timer);
	});
}
/**
* Small bounded cache for READ-ONLY lookups (capability probes, device lists).
* Bounded size prevents unbounded growth; entries expire so data can't go stale
* indefinitely. Never used for anything the user mutates.
*/
var TtlCache = class {
	map = /* @__PURE__ */ new Map();
	ttlMs;
	maxEntries;
	constructor(ttlMs, maxEntries = 50) {
		if (!Number.isSafeInteger(ttlMs) || ttlMs < 1) throw new Error("Cache TTL must be a positive safe integer.");
		if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new Error("Cache capacity must be a positive integer.");
		this.ttlMs = ttlMs;
		this.maxEntries = maxEntries;
	}
	get(key, now = Date.now()) {
		this.assertKeyAndClock(key, now);
		const hit = this.map.get(key);
		if (!hit) return void 0;
		if (now >= hit.expiresAt) {
			this.map.delete(key);
			return;
		}
		this.map.delete(key);
		this.map.set(key, hit);
		return hit.value;
	}
	set(key, value, now = Date.now()) {
		this.assertKeyAndClock(key, now);
		const expiresAt = now + this.ttlMs;
		if (!Number.isSafeInteger(expiresAt)) throw new Error("Cache expiry exceeds the safe clock range.");
		if (this.map.has(key)) this.map.delete(key);
		this.map.set(key, {
			value,
			expiresAt
		});
		while (this.map.size > this.maxEntries) {
			const oldest = this.map.keys().next().value;
			if (oldest === void 0) break;
			this.map.delete(oldest);
		}
	}
	get size() {
		return this.map.size;
	}
	clear() {
		this.map.clear();
	}
	assertKeyAndClock(key, now) {
		if (!validRequestKey(key)) throw new Error(`A cache key must contain 1-${MAX_REQUEST_KEY_CHARACTERS} characters.`);
		if (!Number.isSafeInteger(now) || now < 0) throw new Error("Cache time must be a non-negative safe integer.");
	}
};
/**
* Convenience: de-duplicated, timed-out, optionally cached read.
* Cache is consulted first, then a single in-flight call is shared.
*/
async function guardedRead(options) {
	const { key, fn, timeoutMs = 1e4, cache, flight = globalSingleFlight } = options;
	const cached = cache?.get(key);
	if (cached !== void 0) return cached;
	const value = await flight.run(key, () => withTimeout(fn(), timeoutMs));
	cache?.set(key, value);
	return value;
}
var discoveryCache = new TtlCache(15e3, 4);
/**
* Detects and monitors the on-device OCADE Local engine (Ollama-compatible)
* from the browser. Purely a read/health probe — no prompts are sent. Exposes
* the discovered models (already classified into OCADE capability labels) and a
* manual refresh. Raw model names stay internal to the discovery result.
*/
function useLocalEngine(bridgeUrl = DEFAULT_LOCAL_BRIDGE_URL, enabled = true) {
	const [state, setState] = (0, import_react.useState)({
		ok: false,
		reachable: false,
		models: []
	});
	const [status, setStatus] = (0, import_react.useState)("idle");
	const active = (0, import_react.useRef)(true);
	const refresh = (0, import_react.useCallback)((force = false) => {
		if (!enabled) {
			setStatus("idle");
			return;
		}
		if (force) discoveryCache.clear();
		setStatus("checking");
		guardedRead({
			key: `local-engine:${bridgeUrl}`,
			fn: () => discoverLocalModels(bridgeUrl),
			timeoutMs: 3e4,
			cache: discoveryCache
		}).then((d) => {
			if (!active.current) return;
			setState(d);
			setStatus(d.ok ? "ready" : "unavailable");
		}).catch((e) => {
			if (!active.current) return;
			const timedOut = isTimeoutError(e);
			setState({
				ok: false,
				reachable: timedOut,
				models: [],
				reason: timedOut ? "The local engine is taking longer than expected — it may still be loading a model. Try again in a moment." : "No local engine is running on this computer."
			});
			setStatus("unavailable");
		});
	}, [bridgeUrl, enabled]);
	(0, import_react.useEffect)(() => {
		active.current = true;
		refresh();
		return () => {
			active.current = false;
		};
	}, [refresh]);
	return {
		...state,
		status,
		refresh
	};
}
//#endregion
export { useLocalEngine as t };

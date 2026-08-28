import { i as emptyLimitState, n as checkLimit, o as recordUse, t as DEFAULT_POLICY } from "./server-D2G3TBGg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-limits-hIa_un-u.js
/**
* The limits engine, attached to the device it is protecting.
*
* WHY THE STATE IS LOCAL
* ----------------------
* OCADE's expensive work happens on the user's own machine: a model turn, a
* research retrieval, a screen capture. Nobody is billed for any of it, and
* there is no server that could count it accurately anyway — an offline session
* is still a session. So the counter lives where the work does.
*
* That makes it a resource governor rather than a paywall, and it is honest
* about which: a person who clears their browser storage resets it, and that is
* fine, because what it protects against is a loop that got away rather than a
* person determined to use their own computer.
*
* The server-side half — the endpoints that DO cost something, like OAuth
* refresh and the payment routes — enforces its own limits with `Retry-After`,
* from the same policy, in `limits/server.ts`.
*/
var KEY_PREFIX = "ocade:limits:v1:";
function storage() {
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		return null;
	}
}
function loadLimitState(bucket) {
	const store = storage();
	if (!store) return emptyLimitState();
	try {
		const raw = store.getItem(`${KEY_PREFIX}${bucket}`);
		if (!raw) return emptyLimitState();
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed.events)) return emptyLimitState();
		return { events: parsed.events.filter((event) => !!event && typeof event === "object" && Number.isFinite(event.at) && Number.isFinite(event.cost)).map((event) => ({
			at: event.at,
			cost: Math.max(0, Math.min(1e3, event.cost))
		})) };
	} catch {
		return emptyLimitState();
	}
}
function saveLimitState(bucket, state) {
	const store = storage();
	if (!store) return;
	try {
		store.setItem(`${KEY_PREFIX}${bucket}`, JSON.stringify(state));
	} catch {}
}
/**
* Ask whether an action may run, and record it when it does.
*
* Returns the decision so a caller can show a warning without blocking. A
* `rejected` decision carries both the wait and a sentence to show; callers
* must not invent their own wording, or the same limit reads differently in
* three places.
*/
function consume(bucket, options = {}) {
	const policy = options.policy ?? DEFAULT_POLICY;
	const state = loadLimitState(bucket);
	const decision = checkLimit(state, {
		...options.now === void 0 ? {} : { now: options.now },
		...options.cost === void 0 ? {} : { cost: options.cost },
		policy
	});
	if (decision.outcome !== "rejected" && !options.dryRun) saveLimitState(bucket, recordUse(state, {
		...options.now === void 0 ? {} : { now: options.now },
		...options.cost === void 0 ? {} : { cost: options.cost },
		policy
	}));
	return decision;
}
/** Read the current position without recording anything. For a usage screen. */
function inspect(bucket, now) {
	return checkLimit(loadLimitState(bucket), {
		...now === void 0 ? {} : { now },
		cost: 0
	});
}
//#endregion
export { inspect as n, consume as t };

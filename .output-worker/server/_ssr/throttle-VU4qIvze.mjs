//#region node_modules/.nitro/vite/services/ssr/assets/throttle-VU4qIvze.js
/** Failures that pass without any wait, so an ordinary typo costs nothing. */
var FREE_ATTEMPTS = 2;
var FIRST_DELAY_SECONDS = 1;
var MAX_DELAY_SECONDS = 300;
function emptyThrottle() {
	return {
		failures: 0,
		lastFailureAt: 0
	};
}
/**
* The wait a given number of failures earns.
*
* Exported because the UI needs to explain the wait BEFORE it starts — "try
* again in 4 seconds" is information; a button that silently does nothing is a
* bug as far as the person pressing it is concerned.
*/
function delayAfter(failures) {
	if (failures <= FREE_ATTEMPTS) return 0;
	const doublings = failures - FREE_ATTEMPTS - 1;
	return Math.min(MAX_DELAY_SECONDS, FIRST_DELAY_SECONDS * 2 ** doublings);
}
/**
* Seconds still to wait, or 0 when an attempt is allowed.
*
* A `lastFailureAt` in the future — a clock that moved backwards, a tab
* restored from a suspended session — is treated as "the full wait remains"
* rather than trusted, so a bad timestamp can never grant free attempts. It
* also cannot lock anyone out for longer than the cap.
*/
function secondsUntilAllowed(state, now) {
	const required = delayAfter(state.failures);
	if (required === 0) return 0;
	const elapsed = (now - state.lastFailureAt) / 1e3;
	if (!Number.isFinite(elapsed) || elapsed < 0) return required;
	return Math.max(0, Math.ceil(required - elapsed));
}
function recordFailure(state, now) {
	return {
		failures: state.failures + 1,
		lastFailureAt: now
	};
}
/** A success clears the history: the person proved they are who they said. */
function recordSuccess() {
	return emptyThrottle();
}
/**
* What to tell someone who has to wait.
*
* Never says how many attempts remain, and never distinguishes "wrong code"
* from "no such account" — the gap between those two sentences is exactly what
* somebody working through a list of addresses is trying to measure.
*/
function describeWait(seconds) {
	if (seconds <= 0) return "";
	if (seconds === 1) return "Try again in 1 second.";
	if (seconds < 60) return `Try again in ${seconds} seconds.`;
	const minutes = Math.ceil(seconds / 60);
	return minutes === 1 ? "Try again in about a minute." : `Try again in about ${minutes} minutes.`;
}
/**
* Per-action, per-identifier storage.
*
* Keyed by the identifier so that one person's failed attempts on their work
* address do not lock them out of their personal one on the same machine. The
* identifier is hashed rather than stored: a shared or borrowed computer should
* not carry a readable list of the addresses somebody tried to sign in with.
*/
function throttleKey(action, identifier) {
	let hash = 0;
	const normalised = identifier.trim().toLowerCase();
	for (let i = 0; i < normalised.length; i++) hash = (hash << 5) - hash + normalised.charCodeAt(i) | 0;
	return `ocade:throttle:${action}:${(hash >>> 0).toString(36)}`;
}
function storage() {
	try {
		return typeof window === "undefined" ? null : window.localStorage;
	} catch {
		return null;
	}
}
function loadThrottle(action, identifier) {
	const store = storage();
	if (!store) return emptyThrottle();
	try {
		const raw = store.getItem(throttleKey(action, identifier));
		if (!raw) return emptyThrottle();
		const parsed = JSON.parse(raw);
		return {
			failures: typeof parsed.failures === "number" && Number.isFinite(parsed.failures) && parsed.failures > 0 ? Math.min(64, Math.floor(parsed.failures)) : 0,
			lastFailureAt: typeof parsed.lastFailureAt === "number" && Number.isFinite(parsed.lastFailureAt) ? parsed.lastFailureAt : 0
		};
	} catch {
		return emptyThrottle();
	}
}
function saveThrottle(action, identifier, state) {
	const store = storage();
	if (!store) return;
	try {
		if (state.failures === 0) {
			store.removeItem(throttleKey(action, identifier));
			return;
		}
		store.setItem(throttleKey(action, identifier), JSON.stringify(state));
	} catch {}
}
//#endregion
export { saveThrottle as a, recordSuccess as i, loadThrottle as n, secondsUntilAllowed as o, recordFailure as r, describeWait as t };

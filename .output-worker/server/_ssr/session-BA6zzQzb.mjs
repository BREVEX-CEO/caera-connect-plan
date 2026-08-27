//#region node_modules/.nitro/vite/services/ssr/assets/session-BA6zzQzb.js
/**
* The 28-minute demo session and its device-local 28-hour reset window.
*
* A demo that never ends is a free tier nobody asked for; a demo that ends
* without warning loses the user's work and their goodwill in the same second.
* So the session has a fixed length, a visible clock, a warning before it goes,
* and a defined end state — generation stopped, temporary conversations cleared,
* user returned to the landing page.
*
* THE CLOCK IS ABSOLUTE, NOT A COUNTDOWN. It is stored as a wall-clock deadline
* rather than as "minutes remaining" ticked down by a timer. A background tab
* throttles `setInterval` to once a minute or stops it entirely, and a laptop
* that sleeps stops it completely — a counter would come back showing time the
* user never spent. Every read recomputes from `Date.now()`, so closing the lid
* for an hour ends the session, which is the truthful outcome.
*
* Pure and injectable: `now` is a parameter everywhere, so expiry, the warning
* threshold and the boundary between them are all reachable from a test without
* waiting 28 minutes.
*/
/**
* Session length. THE ONE PLACE IT IS DECIDED.
*
* Every surface — the badge, the warning, the progress ring, the expiry handler
* — derives from this constant, so the demo cannot be eight minutes in the copy
* and something else in the timer. Changing this number changes the demo; there
* is no second duration anywhere that could disagree with it.
*/
var DEMO_SESSION_MS = 1680 * 1e3;
/** One demo per durable browser profile during this reset window. */
var DEMO_RESET_MS = 1680 * 60 * 1e3;
var STORAGE_KEY = "caera:demo:session:v2";
var NEXT_ELIGIBLE_KEY = "caera:demo:next-eligible:v1";
/** Read the stored deadline. Never throws — storage can be unavailable. */
function readDeadline(storage) {
	const store = storage ?? safeLocal();
	if (!store) return null;
	try {
		const raw = store.getItem(STORAGE_KEY);
		if (!raw) return null;
		const value = Number(raw);
		return Number.isFinite(value) && value > 0 ? value : null;
	} catch {
		return null;
	}
}
/** Read when this durable browser profile may start another demo. */
function readNextEligibleAt(storage) {
	const store = storage ?? safeLocal();
	if (!store) return null;
	try {
		const raw = store.getItem(NEXT_ELIGIBLE_KEY);
		if (!raw) return null;
		const value = Number(raw);
		return Number.isFinite(value) && value > 0 ? value : null;
	} catch {
		return null;
	}
}
/**
* Begin a session, or return the one already running.
*
* Deliberately NOT restarting an existing session: a visitor who opens the demo
* in a second tab, or reloads, must not be handed a fresh 28 minutes. The
* deadline is set once and every surface reads the same one.
*/
function startSession(now, storage) {
	const store = storage ?? safeLocal();
	if (!store) return null;
	const existing = readDeadline(store);
	if (existing !== null && existing > now) return existing;
	const nextEligibleAt = readNextEligibleAt(store);
	if (nextEligibleAt !== null && nextEligibleAt > now) return null;
	const deadline = now + DEMO_SESSION_MS;
	try {
		store.setItem(STORAGE_KEY, String(deadline));
		store.setItem(NEXT_ELIGIBLE_KEY, String(now + DEMO_RESET_MS));
	} catch {
		return null;
	}
	return deadline;
}
/** Clear the session. Used at expiry and when the visitor leaves deliberately. */
function endSession(storage) {
	const store = storage ?? safeLocal();
	try {
		store?.removeItem(STORAGE_KEY);
	} catch {}
}
/** Human-readable reset time for the sign-in handoff. */
function formatResetRemaining(nextEligibleAt, now) {
	if (nextEligibleAt === null || nextEligibleAt <= now) return "now";
	const totalMinutes = Math.ceil((nextEligibleAt - now) / 6e4);
	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;
	if (hours <= 0) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
	return `${hours} hour${hours === 1 ? "" : "s"}${minutes ? ` ${minutes} minutes` : ""}`;
}
/**
* Derive the whole visible state from a deadline and the current time.
*
* One pure function so the badge, the warning and the expiry handler can never
* disagree about which phase the session is in.
*/
function sessionState(deadline, now) {
	if (deadline === null) return {
		phase: "idle",
		expiresAt: null,
		remainingMs: 0,
		elapsedFraction: 0
	};
	const remainingMs = Math.max(0, deadline - now);
	const elapsedFraction = Math.min(1, Math.max(0, 1 - remainingMs / DEMO_SESSION_MS));
	return {
		phase: remainingMs <= 0 ? "expired" : remainingMs <= 18e4 ? "ending" : "active",
		expiresAt: deadline,
		remainingMs,
		elapsedFraction
	};
}
/**
* The clock as a person reads it.
*
* `m:ss` under ten minutes and whole minutes above it. The longer opening
* portion stays calm by showing whole minutes; the final ten minutes expose
* seconds so the end of the session is unambiguous.
*/
function formatRemaining(remainingMs) {
	const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1e3));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes >= 10) return `${minutes} min left`;
	return `${minutes}:${String(seconds).padStart(2, "0")} left`;
}
/** The sentence shown when the warning window opens. */
function warningMessage(remainingMs) {
	const minutes = Math.max(1, Math.ceil(remainingMs / 6e4));
	return `Your demo ends in about ${minutes} minute${minutes === 1 ? "" : "s"}. Anything here is temporary — create an account to keep your conversations.`;
}
function safeLocal() {
	if (typeof window === "undefined") return null;
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}
//#endregion
export { readNextEligibleAt as a, warningMessage as c, readDeadline as i, formatRemaining as n, sessionState as o, formatResetRemaining as r, startSession as s, endSession as t };

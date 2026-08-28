import { n as __exportAll } from "../_runtime.mjs";
import { i as StorageLockedError } from "./companion-bridge-CJ48JKAT.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/vault-session-Bh1128Qc.js
var vault_session_Bh1128Qc_exports = /* @__PURE__ */ __exportAll({
	a: () => setLockTimeout,
	c: () => vault_session_exports,
	i: () => requireKey,
	n: () => isUnlocked,
	o: () => subscribe,
	r: () => lock,
	s: () => unlockWith,
	t: () => applyStoredLockTimeout
});
/**
* In-memory holder for the unwrapped Browser Only Data Encryption Key.
*
* The DEK never touches disk, never syncs to Supabase, and auto-locks after
* inactivity. Any storage write for a browser-only data class routes through
* this holder — a locked vault surfaces a StorageLockedError instead of
* silently falling back to plaintext.
*/
var vault_session_exports = /* @__PURE__ */ __exportAll$1({
	DEFAULT_LOCK_TIMEOUT_SECONDS: () => 900,
	applyStoredLockTimeout: () => applyStoredLockTimeout,
	isUnlocked: () => isUnlocked,
	lock: () => lock,
	requireKey: () => requireKey,
	setLockTimeout: () => setLockTimeout,
	subscribe: () => subscribe,
	unlockWith: () => unlockWith
});
var dek = null;
var timeoutMs = 900 * 1e3;
var timer = null;
var listeners = /* @__PURE__ */ new Set();
function notify() {
	for (const l of listeners) l();
}
function resetTimer() {
	if (timer) clearTimeout(timer);
	if (dek) timer = setTimeout(() => lock(), timeoutMs);
}
/**
* Set the auto-lock delay from a value a PERSON chose. Strict on purpose:
* silently accepting nonsense from a settings field hides a broken control.
*/
function setLockTimeout(seconds) {
	if (!Number.isFinite(seconds)) throw new Error("The vault lock timeout is invalid.");
	timeoutMs = Math.max(60, seconds) * 1e3;
	resetTimer();
}
/**
* Set it from a STORED value, which is a different situation entirely.
*
* The unlock paths read this column out of the vault's configuration row and
* fed it straight to the strict setter, at the very end of unlocking — after
* the key had been derived and the data was already reachable. A row whose
* timeout was missing or malformed therefore threw, the unlock was abandoned,
* and the person was told "The vault lock timeout is invalid": a sentence
* about a preference, in answer to "let me at my work". They cannot fix it,
* cannot see what it refers to, and every retry fails the same way.
*
* The database defaults this column and constrains it, so in practice it is
* always a sane number. In practice is not the same as always — an older row,
* a partially-applied migration, a different backend — and none of those are
* worth locking somebody out of their own encrypted data over. An unusable
* value falls back to the default here; the auto-lock still happens, on the
* schema's own timing, and the unlock completes.
*/
function applyStoredLockTimeout(seconds) {
	setLockTimeout(typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 60 && seconds <= 86400 ? seconds : 900);
}
function unlockWith(key) {
	dek = key;
	resetTimer();
	notify();
}
function lock() {
	dek = null;
	if (timer) {
		clearTimeout(timer);
		timer = null;
	}
	notify();
}
function isUnlocked() {
	return dek !== null;
}
function requireKey() {
	if (!dek) throw new StorageLockedError();
	resetTimer();
	return dek;
}
function subscribe(l) {
	listeners.add(l);
	return () => listeners.delete(l);
}
if (typeof window !== "undefined") {
	const bump = () => {
		if (dek) resetTimer();
	};
	window.addEventListener("pointerdown", bump, { passive: true });
	window.addEventListener("keydown", bump, { passive: true });
}
//#endregion
export { setLockTimeout as a, vault_session_Bh1128Qc_exports as c, requireKey as i, isUnlocked as n, subscribe as o, lock as r, unlockWith as s, applyStoredLockTimeout as t };

import { r as __exportAll } from "../_runtime.mjs";
import { i as StorageLockedError } from "./companion-bridge-CJ48JKAT.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/vault-session-BnXa9NHK.js
var vault_session_BnXa9NHK_exports = /* @__PURE__ */ __exportAll({
	a: () => subscribe,
	i: () => setLockTimeout,
	n: () => lock,
	o: () => unlockWith,
	r: () => requireKey,
	s: () => vault_session_exports,
	t: () => isUnlocked
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
function setLockTimeout(seconds) {
	if (!Number.isFinite(seconds)) throw new Error("The vault lock timeout is invalid.");
	timeoutMs = Math.max(60, seconds) * 1e3;
	resetTimer();
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
export { subscribe as a, setLockTimeout as i, lock as n, unlockWith as o, requireKey as r, vault_session_BnXa9NHK_exports as s, isUnlocked as t };

//#region node_modules/.nitro/vite/services/ssr/assets/error-journal-BvqPVLIA.js
/**
* WHAT BROKE, KEPT WHERE THE PERSON IT HAPPENED TO CAN READ IT.
*
* Until now a crash reached `reportRuntimeError`, which forwards to two globals
* that exist only inside a development preview. On ocade.in they are undefined,
* so both calls are no-ops — which is exactly the privacy property this product
* wants, and it left nothing behind at all. Settings › Diagnostics offered
* "error triage" and had no errors to triage. Somebody whose sidebar went blank
* yesterday had nothing to show support but a sentence.
*
* So the journal is local and stays local: a ring buffer in this browser's own
* storage, shown on the diagnostics screen, copyable by its owner, and never
* sent anywhere by anything in this file. There is no endpoint here to disable
* later, which is the point — the previous design was safe because nothing was
* listening, and this one is safe because there is nothing to listen to.
*
* REDACTED BEFORE IT IS WRITTEN, NOT BEFORE IT IS SHOWN. A stack frame carries
* URLs, and a URL carries query strings, and a query string carries tokens. A
* message carries whatever was interpolated into it, which on an auth path is
* an email address. Redacting at read time means the secret was on disk in the
* meantime, so it happens on the way in.
*/
var STORAGE_KEY = "ocade.diagnostics.errors.v1";
var REDACTIONS = [
	[/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g, "[token]"],
	[/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[email]"],
	[/([?&](?:access_token|refresh_token|token|key|apikey|api_key|code|secret|password)=)[^&\s"']+/gi, "$1[redacted]"],
	[/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, "[key]"],
	[/\b[A-Za-z0-9_-]{40,}\b/g, "[opaque]"]
];
/** Strip anything that should not be written down, before writing it down. */
function redactForJournal(text) {
	let out = text;
	for (const [pattern, replacement] of REDACTIONS) out = out.replace(pattern, replacement);
	return out;
}
function read() {
	if (typeof localStorage === "undefined") return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
function write(entries) {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
	} catch {}
}
/** Newest first, because the last thing that happened is what you came for. */
function readErrorJournal() {
	return read();
}
function clearErrorJournal() {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {}
}
/**
* Record one failure. Never throws — a journal that can break the app it is
* describing is worse than no journal.
*/
function recordErrorInJournal(entry) {
	try {
		write([{
			at: entry.at ?? (/* @__PURE__ */ new Date()).toISOString(),
			where: redactForJournal(entry.where).slice(0, 80),
			route: redactForJournal(entry.route).slice(0, 200),
			message: redactForJournal(entry.message).slice(0, 500),
			stack: entry.stack ? redactForJournal(entry.stack).split("\n").slice(0, 5).join("\n").slice(0, 800) : void 0
		}, ...read()].slice(0, 50));
	} catch {}
}
/** The whole journal as text, for pasting into a support message. */
function formatErrorJournal(entries = read()) {
	if (entries.length === 0) return "No errors recorded on this device.";
	return entries.map((e) => {
		const head = `${e.at}  ${e.where}  ${e.route}\n  ${e.message}`;
		return e.stack ? `${head}\n${e.stack.replace(/^/gm, "  ")}` : head;
	}).join("\n\n");
}
//#endregion
export { recordErrorInJournal as i, formatErrorJournal as n, readErrorJournal as r, clearErrorJournal as t };

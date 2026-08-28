import "./browser-catalogue-BYTmauOS.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tier-benchmark-store-DlIk7w-n.js
/**
* What this device has actually proven it can run.
*
* Promotion to a larger browser model happens on evidence and nothing else, so
* the evidence has to survive a reload — otherwise every visit starts from
* zero and nobody is ever promoted.
*
* PER BROWSER, NOT PER ACCOUNT. This describes the machine in front of the
* user, and syncing it would tell a phone that a workstation's result applies
* to it. That is the same class of mistake as reading the server's RAM and
* calling it the user's.
*/
var KEY = "ocade.brain.tier-benchmark.v1";
function read() {
	if (typeof window === "undefined") return {};
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null ? parsed : {};
	} catch {
		return {};
	}
}
function loadBenchmark(kind) {
	const entry = read()[kind];
	if (!entry || typeof entry.provenRank !== "number" || typeof entry.firstTokenMs !== "number" || entry.provenRank < 0 || entry.firstTokenMs <= 0) return null;
	return entry;
}
/**
* Record a completed generation.
*
* Only a SUCCESSFUL, non-cancelled generation counts, and only an improvement
* is written — a single slow run on a busy machine should not demote a device
* that has already proven itself, and a cancelled run measures the user's
* patience rather than the hardware.
*/
function recordBenchmark(kind, rank, firstTokenMs) {
	if (typeof window === "undefined") return;
	if (!Number.isFinite(firstTokenMs) || firstTokenMs <= 0) return;
	if (firstTokenMs > 4e3) return;
	try {
		const all = read();
		const existing = all[kind];
		if (existing && existing.provenRank > rank) return;
		if (existing && existing.provenRank === rank && existing.firstTokenMs <= firstTokenMs) return;
		all[kind] = {
			provenRank: rank,
			firstTokenMs: Math.round(firstTokenMs),
			...existing?.failedRank !== void 0 ? { failedRank: existing.failedRank } : {}
		};
		window.localStorage.setItem(KEY, JSON.stringify(all));
	} catch {}
}
/**
* Record that a tier could not run here.
*
* Called when a larger tier crashes, exhausts memory, or loads and then
* answers slower than the ceiling. Without it, a device that is fast at the
* smaller tier gets promoted, dies, falls back, is fast again, and gets
* promoted again — a silent loop that costs a large download each time.
*
* Only ever LOWERS the ceiling. A tier failing at rank 2 tells us nothing
* good about rank 3, so the lowest failure wins.
*/
function recordTierFailure(kind, rank) {
	if (typeof window === "undefined") return;
	if (!Number.isFinite(rank) || rank < 0) return;
	try {
		const all = read();
		const existing = all[kind];
		if (existing?.failedRank !== void 0 && existing.failedRank <= rank) return;
		all[kind] = {
			provenRank: existing?.provenRank ?? 0,
			firstTokenMs: existing?.firstTokenMs ?? 1,
			failedRank: rank
		};
		window.localStorage.setItem(KEY, JSON.stringify(all));
	} catch {}
}
/** Forget everything measured here. Used by the storage settings page. */
function clearBenchmarks() {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(KEY);
	} catch {}
}
//#endregion
export { recordTierFailure as i, loadBenchmark as n, recordBenchmark as r, clearBenchmarks as t };

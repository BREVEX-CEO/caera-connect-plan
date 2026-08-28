import { n as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/paired-credentials-DTehWMvo.js
var paired_credentials_DTehWMvo_exports = /* @__PURE__ */ __exportAll({
	a: () => savePairing,
	i: () => paired_credentials_exports,
	n: () => hasPairing,
	r: () => pairedCredentials,
	t: () => forgetPairing
});
var paired_credentials_exports = /* @__PURE__ */ __exportAll$1({
	forgetPairing: () => forgetPairing,
	hasPairing: () => hasPairing,
	pairedCredentials: () => pairedCredentials,
	savePairing: () => savePairing
});
/**
* Where this browser keeps its pairing.
*
* The shared secret lives here and is used only to SIGN — it is never sent
* anywhere, which is what makes storing it defensible at all. It is scoped to
* this browser deliberately: a pairing authorises one specific device to use
* one specific computer, and syncing it would silently extend that permission
* to every device the user signs in on.
*/
var KEY = "ocade.pairing.v1";
function read() {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (typeof parsed.deviceId !== "string" || typeof parsed.bridgeUrl !== "string" || typeof parsed.secret !== "string" || !parsed.deviceId || !parsed.secret) return null;
		let url;
		try {
			url = new URL(parsed.bridgeUrl);
		} catch {
			return null;
		}
		const loopback = [
			"localhost",
			"127.0.0.1",
			"[::1]"
		].includes(url.hostname);
		if (url.protocol !== "https:" && !loopback) return null;
		return {
			deviceId: parsed.deviceId,
			bridgeUrl: parsed.bridgeUrl,
			secret: parsed.secret
		};
	} catch {
		return null;
	}
}
var pairedCredentials = { current: read };
/** Store a pairing after the user approved it on the desktop. */
function savePairing(credentials) {
	if (typeof window === "undefined") return false;
	try {
		window.localStorage.setItem(KEY, JSON.stringify(credentials));
		return true;
	} catch {
		return false;
	}
}
/** Forget the pairing on THIS device. Revoking on the desktop is separate. */
function forgetPairing() {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(KEY);
	} catch {}
}
function hasPairing() {
	return read() !== null;
}
//#endregion
export { savePairing as a, paired_credentials_DTehWMvo_exports as i, hasPairing as n, pairedCredentials as r, forgetPairing as t };

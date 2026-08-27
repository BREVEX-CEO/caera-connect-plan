//#region node_modules/.nitro/vite/services/ssr/assets/safe-next-DgGuzc4L.js
/**
* Resolve a `next` parameter to a path OCADE may navigate to, or null.
*
* @param value  Whatever arrived in the URL. Untrusted.
* @param origin The origin to resolve against. Defaults to this window's.
*/
function safeNext(value, origin) {
	if (!value) return null;
	const base = origin ?? (typeof window === "undefined" ? void 0 : window.location.origin);
	if (!base) return /^\/[^/\\]/.test(value) || value === "/" ? value : null;
	let resolved;
	try {
		resolved = new URL(value, base);
	} catch {
		return null;
	}
	if (resolved.origin !== new URL(base).origin) return null;
	const path = `${resolved.pathname}${resolved.search}${resolved.hash}`;
	return path.startsWith("//") ? null : path;
}
//#endregion
export { safeNext as t };

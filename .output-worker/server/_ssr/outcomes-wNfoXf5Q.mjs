//#region node_modules/.nitro/vite/services/ssr/assets/outcomes-wNfoXf5Q.js
function ok(data, detail, extra) {
	return {
		kind: "success",
		data,
		detail,
		...extra
	};
}
function fail(kind, detail) {
	return {
		kind,
		detail
	};
}
/**
* Whether trying the SAME call again could plausibly succeed.
*
* `state_changed` is deliberately false: the call may well succeed after a
* fresh observation, but repeating it against a stale plan is exactly the
* mistake this taxonomy exists to prevent. The loop re-observes first.
*/
function isRetryable(kind) {
	return kind === "retryable_failure" || kind === "offline";
}
/** Whether the loop should stop and hand back to the user. */
function isTerminal(kind) {
	return kind === "blocked" || kind === "permission_required" || kind === "cancelled" || kind === "unsupported";
}
/**
* Detect a loop repeating itself.
*
* Not a counter but a signature: the same tool with the same arguments failing
* the same way twice is a loop that has stopped learning, and the honest move
* is to tell the user what is in the way rather than to keep pulling the
* handle.
*/
function signatureOf(tool, args, kind) {
	return `${tool}::${stableStringify(args)}::${kind}`;
}
function stableStringify(value) {
	if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	return `{${Object.entries(value).filter(([, v]) => v !== void 0).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}
//#endregion
export { signatureOf as a, ok as i, isRetryable as n, isTerminal as r, fail as t };

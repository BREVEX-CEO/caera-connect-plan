//#region node_modules/.nitro/vite/services/ssr/assets/oauth-errors-B12ZR1R7.js
var providerLabel = {
	google: "Google",
	apple: "Apple",
	microsoft: "Microsoft"
};
function label(provider) {
	return providerLabel[provider] ?? "your provider";
}
/**
* Maps a raw error (code, description or thrown Error) from an OAuth attempt
* into a message a non-technical person can act on.
*/
function describeOAuthError(provider, raw, description) {
	const name = label(provider);
	const text = [typeof raw === "string" ? raw : raw instanceof Error ? raw.message : "", description ?? ""].join(" ").toLowerCase();
	const has = (...needles) => needles.some((n) => text.includes(n));
	if (has("access_denied", "user_cancelled", "user_canceled", "cancelled", "canceled", "denied")) return {
		message: `Sign-in with ${name} was cancelled.`,
		hint: `You closed the ${name} window or declined the permission request. You can try again, or use phone or email instead.`,
		retryable: true,
		cancelled: true
	};
	if (has("popup", "window closed", "closed by user", "blocked")) return {
		message: `The ${name} sign-in window didn't finish.`,
		hint: "It may have been closed or blocked by your browser. Allow pop-ups for this site and try again.",
		retryable: true,
		cancelled: true
	};
	if (has("unsupported provider", "provider is not enabled", "not enabled", "validation_failed")) return {
		message: `${name} sign-in isn't available right now.`,
		hint: "Please use phone or email sign-in for now. Our team has been notified.",
		retryable: false,
		cancelled: false
	};
	if (has("network", "failed to fetch", "offline", "timeout", "timed out")) return {
		message: "We couldn't reach the sign-in service.",
		hint: "Check your internet connection and try again.",
		retryable: true,
		cancelled: false
	};
	if (has("expired", "state", "invalid_grant", "invalid request", "code verifier", "pkce")) return {
		message: "That sign-in link has expired.",
		hint: `Start again from this page to get a fresh ${name} sign-in.`,
		retryable: true,
		cancelled: false
	};
	if (has("email", "already registered", "identity_already_exists")) return {
		message: "That email is already linked to another sign-in method.",
		hint: "Sign in with the method you used originally, or use email sign-in with the same address.",
		retryable: false,
		cancelled: false
	};
	if (has("rate limit", "too many", "429")) return {
		message: "Too many sign-in attempts.",
		hint: "Please wait a minute before trying again.",
		retryable: true,
		cancelled: false
	};
	return {
		message: `We couldn't complete sign-in with ${name}.`,
		hint: "Please try again, or use phone or email sign-in instead.",
		retryable: true,
		cancelled: false
	};
}
/** Reads OAuth error details that providers return in the URL query or hash. */
function readOAuthErrorFromUrl(search, hash) {
	if (search.error) return {
		code: search.error,
		description: search.error_description
	};
	const raw = (hash ?? "").replace(/^#/, "");
	if (!raw) return null;
	const params = new URLSearchParams(raw);
	const code = params.get("error") ?? params.get("error_code");
	if (!code) return null;
	return {
		code,
		description: params.get("error_description") ?? void 0
	};
}
//#endregion
export { readOAuthErrorFromUrl as n, describeOAuthError as t };

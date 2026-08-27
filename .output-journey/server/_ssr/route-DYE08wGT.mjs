import { n as supabase } from "./client-YIOAnk22.mjs";
import { N as redirect, h as createFileRoute, m as lazyRouteComponent } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/route-DYE08wGT.js
/** Substrings that only ever appear on a request that never got an answer. */
var TRANSPORT_MESSAGES = [
	"failed to fetch",
	"networkerror",
	"network error",
	"network request failed",
	"load failed",
	"fetch failed",
	"the internet connection appears to be offline",
	"err_internet_disconnected",
	"err_name_not_resolved",
	"err_connection",
	"getaddrinfo",
	"enotfound",
	"eai_again",
	"econnrefused",
	"econnreset",
	"etimedout",
	"timeout",
	"timed out",
	"aborted"
];
/**
* There is no such thing as a transport STATUS.
*
* An HTTP status only exists because a server answered. 408, 429 and every 5xx
* are answers too — a proxy in front of the auth server can return 502 while
* happily returning 401 a second later, and a rate limiter returning 429 has
* definitely seen the request. The previous version of this file treated all
* of those as unreachability, which meant a hostile or misbehaving edge could
* turn a revoked session into an authenticated one by answering 500.
*
* So: any explicit status fails closed. Retryable server conditions are still
* distinguishable, but only when the LIBRARY says the request never completed
* (see `isRetryableTransport`), never from the status number alone.
*/
function statusIsRejection(status) {
	return status > 0;
}
/**
* Signals from supabase-js / fetch that a request did not complete.
*
* `AuthRetryableFetchError` is the one supabase-js raises when its own fetch
* threw, and it carries `status: 0`. A `TypeError` from fetch has no status at
* all. Those are the only two shapes that can honestly be called transport.
*/
function isRetryableTransport(err) {
	if (String(err.name ?? "").toLowerCase().includes("retryable")) return true;
	return false;
}
function classifyAuthFailure(error) {
	if (!error) return "rejected";
	const err = error;
	if (isRetryableTransport(err)) return "transport";
	if (typeof err.status === "number" && statusIsRejection(err.status)) return "rejected";
	const name = String(err.name ?? "").toLowerCase();
	if (name.includes("authapierror") || name.includes("sessionmissing")) return "rejected";
	if (name.includes("weakpassword") || name.includes("invalidcredentials")) return "rejected";
	const message = String(err.message ?? "").toLowerCase();
	if (TRANSPORT_MESSAGES.some((needle) => message.includes(needle))) return "transport";
	if (err.cause && err.cause !== error) return classifyAuthFailure(err.cause);
	return "rejected";
}
/** True only when it is safe to stand in the locally persisted session. */
function mayUseCachedSession(error) {
	return classifyAuthFailure(error) === "transport";
}
/**
* Is a cached session still usable on its own terms?
*
* Expiry is a timestamp, so it needs no network to evaluate and offline grace
* never covers it. A session missing `expires_at` is refused rather than
* assumed eternal.
*/
function cachedSessionIsCurrent(session, now = Date.now()) {
	return (session?.expires_at ? session.expires_at * 1e3 : 0) > now;
}
var $$splitErrorComponentImporter = () => import("./route-tGcpS1k0.mjs");
var $$splitComponentImporter = () => import("./route-rIv5LIp-.mjs");
/**
* Integration-managed protected layout. Runs client-only because the Supabase
* session lives in localStorage. All routes under src/routes/_authenticated/
* inherit this gate, plus the onboarding gate below.
*/
var Route = createFileRoute("/_authenticated")({
	ssr: false,
	beforeLoad: async ({ location }) => {
		if (typeof window === "undefined") return;
		const { data, error } = await supabase.auth.getUser();
		let user = error ? null : data.user;
		let offline = false;
		if (error && !user && mayUseCachedSession(error)) {
			const { data: cached } = await supabase.auth.getSession();
			const session = cached.session;
			const expiresAt = session?.expires_at ? session.expires_at * 1e3 : 0;
			if (session?.user && cachedSessionIsCurrent(session) && expiresAt > Date.now()) {
				user = session.user;
				offline = true;
			}
		}
		const signedIn = Boolean(user);
		const isSettings = location.pathname.startsWith("/settings");
		if (!signedIn && !isSettings) throw redirect({
			to: "/auth",
			reloadDocument: true,
			search: { next: location.pathname + location.searchStr }
		});
		if (!signedIn) return { user: null };
		if (!location.pathname.startsWith("/onboarding")) {
			if (!offline) {
				const { data: profile, error: profileError } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle();
				if (!profileError && !profile?.onboarding_completed) throw redirect({ to: "/onboarding" });
			}
		}
		return { user };
	},
	component: lazyRouteComponent($$splitComponentImporter, "component"),
	errorComponent: lazyRouteComponent($$splitErrorComponentImporter, "errorComponent")
});
//#endregion
export { Route as t };

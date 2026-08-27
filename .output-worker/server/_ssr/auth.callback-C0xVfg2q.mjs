import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-BvyzyYvI.mjs";
import { y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { Wt as LoaderCircle } from "../_libs/lucide-react.mjs";
import { t as safeNext } from "./safe-next-DgGuzc4L.mjs";
import { t as AuthShell } from "./AuthShell-DJc19O9f.mjs";
import { n as readOAuthErrorFromUrl, t as describeOAuthError } from "./oauth-errors-B12ZR1R7.mjs";
import { t as Route } from "./auth.callback-BAMtjFHt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.callback-C0xVfg2q.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CallbackPage() {
	const { next, code, error: providerError, error_description } = Route.useSearch();
	const navigate = useNavigate();
	const inbound = readOAuthErrorFromUrl({
		error: providerError,
		error_description
	}, typeof window !== "undefined" ? window.location.hash : "");
	const inboundFriendly = inbound ? describeOAuthError("google", inbound.code, inbound.description) : null;
	const [error, setError] = (0, import_react.useState)(inboundFriendly?.message ?? null);
	const [hint, setHint] = (0, import_react.useState)(inboundFriendly?.hint ?? null);
	(0, import_react.useEffect)(() => {
		if (error) return;
		const target = safeNext(next) ?? "/home";
		let cancelled = false;
		let done = false;
		const fail = (cause) => {
			if (cancelled || done) return;
			const friendly = describeOAuthError("google", cause);
			setError(friendly.message);
			setHint(friendly.hint ?? null);
		};
		/**
		* Where the user should land. Onboarding is gated downstream anyway, but
		* resolving it here avoids bouncing through a page the gate will reject.
		* A failed read is not fatal — the gate re-asserts on the next navigation.
		*/
		const resolveDestination = async (userId) => {
			try {
				const { data, error: profileError } = await supabase.from("profiles").select("onboarding_completed").eq("id", userId).maybeSingle();
				if (!profileError && !data?.onboarding_completed) return "/onboarding";
			} catch {}
			return target;
		};
		const finish = async () => {
			if (cancelled || done) return;
			const { data, error: userError } = await supabase.auth.getUser();
			if (cancelled || done) return;
			if (userError || !data.user) return;
			done = true;
			const destination = await resolveDestination(data.user.id);
			if (cancelled) return;
			navigate({
				to: destination,
				replace: true
			});
		};
		const restore = async () => {
			try {
				const { data } = await supabase.auth.getSession();
				if (cancelled) return;
				if (data.session) {
					await finish();
					return;
				}
				const url = typeof window !== "undefined" ? window.location.href : "";
				if (code ?? new URLSearchParams(window.location.search).get("code")) {
					const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(url);
					if (cancelled) return;
					if (exchangeError && !/code verifier|already/i.test(exchangeError.message)) {
						fail(exchangeError.message);
						return;
					}
					await finish();
				}
			} catch (e) {
				fail(e);
			}
		};
		restore();
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			if (cancelled || done || !session) return;
			finish();
		});
		const poll = window.setInterval(() => {
			if (cancelled || done) return;
			supabase.auth.getSession().then(({ data }) => {
				if (data.session) finish();
			});
		}, 1200);
		const timeout = window.setTimeout(() => {
			if (!cancelled && !done) {
				setError("Sign-in is taking longer than expected.");
				setHint("Your connection may have dropped. Please return to sign-in and try again.");
			}
		}, 15e3);
		return () => {
			cancelled = true;
			sub.subscription.unsubscribe();
			window.clearInterval(poll);
			window.clearTimeout(timeout);
		};
	}, [
		code,
		error,
		navigate,
		next
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthShell, {
		title: "Signing you in",
		subtitle: "Completing your sign-in — this should only take a moment.",
		children: error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "alert",
				"aria-live": "polite",
				className: "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium",
					children: error
				}), hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-destructive/85",
					children: hint
				}) : null]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				onClick: () => navigate({ to: "/auth" }),
				className: "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground",
				children: "Back to sign-in"
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-5 w-5 animate-spin text-primary" }), "Verifying your session…"]
		})
	});
}
//#endregion
export { CallbackPage as component };

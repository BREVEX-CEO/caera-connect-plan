import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-D46NpEQY.mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { Wt as LoaderCircle } from "../_libs/lucide-react.mjs";
import { c as stringType } from "../_libs/zod.mjs";
import { t as AuthShell } from "./AuthShell-DJc19O9f.mjs";
import { i as secondsUntilResend, n as describeResend, r as friendlyOtpError } from "./otp-DmZTmTKV.mjs";
import { a as saveThrottle, i as recordSuccess, n as loadThrottle, o as secondsUntilAllowed, r as recordFailure, t as describeWait } from "./throttle-VU4qIvze.mjs";
import { t as Route } from "./auth.verify-B2tlJ-CV.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth.verify-D5kjaMnA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function VerifyPage() {
	const { channel, identifier, next, intent } = Route.useSearch();
	const navigate = useNavigate();
	const [code, setCode] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [resent, setResent] = (0, import_react.useState)(false);
	const [resending, setResending] = (0, import_react.useState)(false);
	const [lastSentAt, setLastSentAt] = (0, import_react.useState)(() => Date.now());
	const [cooldown, setCooldown] = (0, import_react.useState)(60);
	const [throttle, setThrottle] = (0, import_react.useState)(() => loadThrottle("otp_verify", identifier));
	const [wait, setWait] = (0, import_react.useState)(0);
	(0, import_react.useEffect)(() => {
		const tick = () => setWait(secondsUntilAllowed(throttle, Date.now()));
		tick();
		const id = window.setInterval(tick, 500);
		return () => window.clearInterval(id);
	}, [throttle]);
	(0, import_react.useEffect)(() => {
		const tick = () => setCooldown(secondsUntilResend(lastSentAt, Date.now()));
		tick();
		const id = window.setInterval(tick, 1e3);
		return () => window.clearInterval(id);
	}, [lastSentAt]);
	const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
	async function verify(e) {
		e.preventDefault();
		const remaining = secondsUntilAllowed(throttle, Date.now());
		if (remaining > 0) {
			setError(describeWait(remaining));
			return;
		}
		setBusy(true);
		setError(null);
		const parsed = stringType().trim().regex(/^\d{4,8}$/, "Enter the numeric code we sent you.").safeParse(code);
		if (!parsed.success) {
			setError(parsed.error.issues[0].message);
			setBusy(false);
			return;
		}
		const { error: err } = channel === "phone" ? await supabase.auth.verifyOtp({
			phone: identifier,
			token: parsed.data,
			type: "sms"
		}) : await supabase.auth.verifyOtp({
			email: identifier,
			token: parsed.data,
			type: "email"
		});
		if (err) {
			const next = recordFailure(throttle, Date.now());
			setThrottle(next);
			saveThrottle("otp_verify", identifier, next);
			const delay = secondsUntilAllowed(next, Date.now());
			setError([friendlyOtpError(err.message), describeWait(delay)].filter(Boolean).join(" "));
			setBusy(false);
			return;
		}
		const cleared = recordSuccess();
		setThrottle(cleared);
		saveThrottle("otp_verify", identifier, cleared);
		navigate({
			to: target,
			replace: true
		});
	}
	async function resend() {
		if (cooldown > 0 || resending) return;
		setError(null);
		setResent(false);
		setResending(true);
		setLastSentAt(Date.now());
		const options = { shouldCreateUser: intent === "signup" };
		const { error: err } = channel === "phone" ? await supabase.auth.signInWithOtp({
			phone: identifier,
			options
		}) : await supabase.auth.signInWithOtp({
			email: identifier,
			options
		});
		setResending(false);
		if (err) setError(friendlyOtpError(err.message));
		else setResent(true);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthShell, {
		title: "Enter your code",
		subtitle: `We sent a one-time code to ${identifier}.`,
		footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			"Wrong ",
			channel === "phone" ? "number" : "address",
			"?",
			" ",
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/auth",
				className: "text-foreground underline-offset-4 hover:underline",
				children: "Go back"
			})
		] }),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: verify,
			className: "flex flex-col gap-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					htmlFor: "code",
					className: "text-xs font-medium text-muted-foreground",
					children: "One-time code"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					id: "code",
					type: "text",
					inputMode: "numeric",
					autoComplete: "one-time-code",
					value: code,
					onChange: (e) => setCode(e.target.value),
					className: "border-b border-border/70 bg-transparent px-1 py-3 text-center font-mono text-2xl tracking-[0.5em] text-foreground outline-none transition-colors focus:border-foreground/70",
					placeholder: "••••••",
					maxLength: 8
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "submit",
					disabled: busy || wait > 0,
					className: "inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60",
					children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : null, wait > 0 ? `Wait ${wait}s` : "Verify and continue"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: resend,
					disabled: cooldown > 0 || resending,
					className: "inline-flex min-h-[24px] items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-70",
					children: [resending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
						className: "h-3.5 w-3.5 animate-spin",
						"aria-hidden": true
					}) : null, describeResend(cooldown)]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					"aria-live": "polite",
					className: "sr-only",
					children: resent ? "A new code has been sent." : ""
				}),
				resent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "A new code is on its way. The previous one no longer works."
				}) : null,
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "alert",
					className: "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
					children: error
				}) : null,
				intent === "signin" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-xs text-muted-foreground",
					children: [
						"No code arriving? If you have not created an OCADE account yet,",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/auth",
							className: "text-foreground underline underline-offset-4",
							children: "create one"
						}),
						" ",
						"— signing in only works for an address that already has one."
					]
				}) : null
			]
		})
	});
}
//#endregion
export { VerifyPage as component };

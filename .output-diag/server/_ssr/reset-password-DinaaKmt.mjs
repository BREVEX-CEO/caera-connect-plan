import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-D46NpEQY.mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { Qt as KeyRound, Wt as LoaderCircle } from "../_libs/lucide-react.mjs";
import { t as AuthShell } from "./AuthShell-DJc19O9f.mjs";
import { r as friendlyOtpError } from "./otp-DmZTmTKV.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/reset-password-DinaaKmt.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function paramsOf(raw) {
	return new URLSearchParams(raw.startsWith("#") || raw.startsWith("?") ? raw.slice(1) : raw);
}
/**
* Read what a navigation says about a password reset, and nothing else.
*
* An unparseable URL is `none`, never an assumption in the user's favour: this
* gate fails closed, because the cost of a wrong "yes" is somebody else's
* account and the cost of a wrong "no" is requesting another email.
*/
function readRecoveryEvidence(href) {
	let url;
	try {
		url = new URL(href);
	} catch {
		return { kind: "none" };
	}
	const hash = paramsOf(url.hash);
	const query = url.searchParams;
	const described = hash.get("error_description") ?? query.get("error_description");
	if (described) return {
		kind: "error",
		message: described
	};
	const code = hash.get("error") ?? query.get("error");
	if (code) return {
		kind: "error",
		message: code
	};
	if (hash.get("type") === "recovery" && hash.get("access_token")) return { kind: "recovery_token" };
	const pkce = query.get("code");
	if (pkce) return {
		kind: "recovery_code",
		code: pkce
	};
	return { kind: "none" };
}
/**
* True only for evidence that may open the new-password form.
*
* `recovery_code` is deliberately NOT included: a code is a claim until the
* exchange succeeds, and treating the claim as the proof is how the original
* defect worked.
*/
function opensResetForm(evidence) {
	return evidence.kind === "recovery_token";
}
function ResetPasswordPage() {
	const navigate = useNavigate();
	const [ready, setReady] = (0, import_react.useState)(false);
	const [linkValid, setLinkValid] = (0, import_react.useState)(false);
	const [password, setPassword] = (0, import_react.useState)("");
	const [confirm, setConfirm] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const [done, setDone] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		let cancelled = false;
		const sub = supabase.auth.onAuthStateChange((event) => {
			if (event === "PASSWORD_RECOVERY" && !cancelled) {
				setLinkValid(true);
				setReady(true);
			}
		});
		(async () => {
			const evidence = readRecoveryEvidence(window.location.href);
			if (evidence.kind === "error") {
				if (!cancelled) {
					setError(evidence.message);
					setReady(true);
				}
				return;
			}
			if (evidence.kind === "recovery_code") {
				const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(evidence.code).catch((e) => ({ error: e }));
				if (cancelled) return;
				setLinkValid(!exchangeError);
				setReady(true);
				return;
			}
			if (cancelled) return;
			setLinkValid(opensResetForm(evidence));
			setReady(true);
		})();
		return () => {
			cancelled = true;
			sub.data.subscription.unsubscribe();
		};
	}, []);
	async function submit(e) {
		e.preventDefault();
		setError(null);
		if (password.length < 8) {
			setError("Your new password needs at least 8 characters.");
			return;
		}
		if (password !== confirm) {
			setError("Both passwords must match.");
			return;
		}
		setBusy(true);
		const { error: err } = await supabase.auth.updateUser({ password });
		setBusy(false);
		if (err) {
			setError(/same.*password|should be different/i.test(err.message) ? "That is the password you already had. Choose a different one." : /expired|invalid|token/i.test(err.message) ? "This reset link has expired. Ask for a new one from the sign-in page." : friendlyOtpError(err.message));
			return;
		}
		setDone(true);
		setTimeout(() => navigate({
			to: "/home",
			replace: true
		}), 1200);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AuthShell, {
		title: "Choose a new password",
		subtitle: "Set a new password for your CARCC CADANE account.",
		footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			"Changed your mind?",
			" ",
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/auth",
				className: "underline underline-offset-2",
				children: "Back to sign in"
			}),
			"."
		] }),
		children: !ready ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2 text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Checking your reset link…"]
		}) : done ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary",
			children: "Password updated. Taking you to your workspace…"
		}) : !linkValid ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "alert",
				className: "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: "This reset link is no longer valid."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-destructive/85",
						children: error ?? "Open this page from the link in your reset email. Reset links expire quickly and can only be used once."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-destructive/85",
						children: "Already signed in and just want a new password? Change it in Settings › Security, where OCADE asks for your current one first."
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/auth",
				className: "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground",
				children: "Request a new link"
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
			onSubmit: submit,
			className: "flex flex-col gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					htmlFor: "new-password",
					className: "text-xs font-medium text-muted-foreground",
					children: "New password"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, {
						className: "h-4 w-4 text-muted-foreground",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "new-password",
						type: "password",
						autoComplete: "new-password",
						value: password,
						onChange: (e) => setPassword(e.target.value),
						placeholder: "At least 8 characters",
						className: "flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					htmlFor: "confirm-password",
					className: "text-xs font-medium text-muted-foreground",
					children: "Confirm new password"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, {
						className: "h-4 w-4 text-muted-foreground",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						id: "confirm-password",
						type: "password",
						autoComplete: "new-password",
						value: confirm,
						onChange: (e) => setConfirm(e.target.value),
						className: "flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none"
					})]
				}),
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "alert",
					className: "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
					children: error
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "submit",
					disabled: busy,
					className: "inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60",
					children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : null, "Update password"]
				})
			]
		})
	});
}
//#endregion
export { ResetPasswordPage as component };

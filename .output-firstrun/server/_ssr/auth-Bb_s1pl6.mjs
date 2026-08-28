import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase, t as getSupabaseBrowserConfiguration } from "./client-D46NpEQY.mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { Cn as Eye, Qt as KeyRound, Rt as Mail, Wt as LoaderCircle, ut as Phone, wn as EyeOff } from "../_libs/lucide-react.mjs";
import { c as stringType } from "../_libs/zod.mjs";
import { t as safeNext } from "./safe-next-DgGuzc4L.mjs";
import { n as Route, t as LegalDialog } from "./auth-ClbsO0Dd.mjs";
import { i as observeNow, o as readNextEligibleAt, r as formatResetRemaining } from "./session-CBMwV_c3.mjs";
import { t as AuthShell } from "./AuthShell-DJc19O9f.mjs";
import { n as readOAuthErrorFromUrl, t as describeOAuthError } from "./oauth-errors-B12ZR1R7.mjs";
import { r as friendlyOtpError, t as OTP_SENT_NOTICE } from "./otp-DmZTmTKV.mjs";
import { a as saveThrottle, i as recordSuccess, n as loadThrottle, o as secondsUntilAllowed, r as recordFailure, t as describeWait } from "./throttle-VU4qIvze.mjs";
import { t as createLovableAuth } from "../_libs/lovable.dev__cloud-auth-js.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/auth-Bb_s1pl6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var lovableAuth = createLovableAuth();
/**
* Lovable previews expose their own `/~oauth/initiate` broker. Ordinary OCADE
* hosts do not: localhost and ocade.in must begin OAuth at the configured
* Supabase project or the relative broker URL becomes an application 404.
*/
function oauthTransportForHostname(hostname, provider) {
	const normalized = hostname.trim().toLowerCase().replace(/\.$/, "");
	return !(normalized === "lovable.dev" || normalized.endsWith(".lovable.app") || normalized.endsWith(".lovableproject.com")) && (provider === "google" || provider === "apple") ? "supabase" : "lovable";
}
var lovable = { auth: { signInWithOAuth: async (provider, opts) => {
	if (typeof window !== "undefined" && (provider === "google" || provider === "apple") && oauthTransportForHostname(window.location.hostname, provider) === "supabase") {
		const { data, error } = await supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: opts?.redirect_uri,
				queryParams: opts?.extraParams,
				skipBrowserRedirect: true
			}
		});
		if (error) return { error };
		if (!data.url) return { error: /* @__PURE__ */ new Error("Supabase did not return an OAuth URL") };
		window.location.assign(data.url);
		return {
			error: null,
			redirected: true
		};
	}
	const result = await lovableAuth.signInWithOAuth(provider, {
		...opts,
		extraParams: { ...opts?.extraParams }
	});
	if (result.redirected) return result;
	if (result.error) return result;
	try {
		await supabase.auth.setSession(result.tokens);
	} catch (e) {
		return { error: e instanceof Error ? e : new Error(String(e)) };
	}
	return result;
} } };
function booleanFlag(value, fallback) {
	if (value === true || value === "true") return true;
	if (value === false || value === "false") return false;
	return fallback;
}
/**
* Public provider readiness, never provider credentials.
*
* Development and test sessions keep every form reachable. Production is
* fail-closed: a provider only appears after its external configuration has
* been completed and the matching public build flag has been set. This avoids
* sending a person into a provider that the live Supabase project will reject.
*/
function resolveAuthProviderAvailability(environment = {
	"BASE_URL": "/",
	"DEV": false,
	"MODE": "production",
	"PROD": true,
	"SSR": true,
	"TSS_DEV_SERVER": "false",
	"TSS_DEV_SSR_STYLES_BASEPATH": "/",
	"TSS_DEV_SSR_STYLES_ENABLED": "true",
	"TSS_DISABLE_CSRF_MIDDLEWARE_WARNING": "false",
	"TSS_INLINE_CSS_ENABLED": "false",
	"TSS_ROUTER_BASEPATH": "",
	"TSS_SERVER_FN_BASE": "/_serverFn/",
	"VITE_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_ocade_local_audit_key",
	"VITE_SUPABASE_URL": "http://127.0.0.1:54321"
}) {
	const developmentFallback = !(environment.PROD === true || environment.MODE === "production");
	return {
		google: booleanFlag(environment.VITE_AUTH_GOOGLE_ENABLED, developmentFallback),
		apple: booleanFlag(environment.VITE_AUTH_APPLE_ENABLED, developmentFallback),
		phone: booleanFlag(environment.VITE_AUTH_PHONE_ENABLED, developmentFallback),
		emailDelivery: booleanFlag(environment.VITE_AUTH_EMAIL_DELIVERY_READY, developmentFallback)
	};
}
var authProviderAvailability = resolveAuthProviderAvailability();
var methods = [
	...authProviderAvailability.google ? [{
		id: "google",
		label: "Google"
	}] : [],
	...authProviderAvailability.apple ? [{
		id: "apple",
		label: "Apple"
	}] : [],
	...authProviderAvailability.phone ? [{
		id: "phone",
		label: "Phone"
	}] : [],
	{
		id: "email",
		label: "Email"
	}
];
function AuthPage() {
	const navigate = useNavigate();
	const search = Route.useSearch();
	const nextPath = safeNext(search.next) ?? "/home";
	const [method, setMethod] = (0, import_react.useState)(methods[0]?.id ?? "email");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const inboundOAuthError = readOAuthErrorFromUrl({
		error: search.error,
		error_description: search.error_description
	}, typeof window !== "undefined" ? window.location.hash : "");
	const inboundFriendly = inboundOAuthError ? describeOAuthError(search.provider ?? "google", inboundOAuthError.code, inboundOAuthError.description) : null;
	const [error, setError] = (0, import_react.useState)(inboundFriendly?.message ?? null);
	const [errorHint, setErrorHint] = (0, import_react.useState)(inboundFriendly?.hint ?? null);
	const [phone, setPhone] = (0, import_react.useState)("");
	const [email, setEmail] = (0, import_react.useState)("");
	const [password, setPassword] = (0, import_react.useState)("");
	const [notice, setNotice] = (0, import_react.useState)(search.message ?? null);
	const authConfigured = getSupabaseBrowserConfiguration().configured;
	const fromExpiredDemo = search.reason === "demo-expired";
	const [demoResetsIn, setDemoResetsIn] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		const nextEligibleAt = readNextEligibleAt();
		if (nextEligibleAt === null) return;
		const now = observeNow(Date.now());
		if (nextEligibleAt <= now) return;
		setDemoResetsIn(formatResetRemaining(nextEligibleAt, now));
	}, []);
	(0, import_react.useEffect)(() => {
		setError(null);
		setErrorHint(null);
	}, [method]);
	async function signInOAuth(provider) {
		if (!authProviderAvailability[provider]) {
			setError(`${provider === "google" ? "Google" : "Apple"} sign-in is not available yet.`);
			setErrorHint("Use an enabled sign-in method, or try again after launch configuration is complete.");
			return;
		}
		setBusy(true);
		setError(null);
		setErrorHint(null);
		try {
			const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: `${window.location.origin}/auth/callback${nextPath !== "/home" ? `?next=${encodeURIComponent(nextPath)}` : ""}` });
			if (result.error) {
				const friendly = describeOAuthError(provider, result.error.message);
				setError(friendly.message);
				setErrorHint(friendly.hint ?? null);
				setBusy(false);
				return;
			}
			if (result.redirected) return;
			navigate({
				to: nextPath,
				replace: true
			});
		} catch (e) {
			const friendly = describeOAuthError(provider, e);
			setError(friendly.message);
			setErrorHint(friendly.hint ?? null);
			setBusy(false);
		}
	}
	async function sendPhoneOtp(e) {
		e.preventDefault();
		if (!authProviderAvailability.phone) {
			setError("Phone sign-in is not available yet.");
			return;
		}
		setBusy(true);
		setError(null);
		const parsed = stringType().trim().regex(/^\+[1-9]\d{6,14}$/, "Enter a phone number in international format, e.g. +14155551234.").safeParse(phone);
		if (!parsed.success) {
			setError(parsed.error.issues[0].message);
			setBusy(false);
			return;
		}
		const sendWait = blockedFor("otp_send", parsed.data);
		if (sendWait > 0) {
			setError(describeWait(sendWait));
			setBusy(false);
			return;
		}
		const creating = signupIntent;
		const { error: err } = await supabase.auth.signInWithOtp({
			phone: parsed.data,
			options: { shouldCreateUser: creating }
		});
		noteAttempt("otp_send", parsed.data, false);
		if (err && !/user|not found|signups? not allowed|otp_disabled/i.test(err.message)) {
			setError([friendlyOtpError(err.message), describeWait(blockedFor("otp_send", parsed.data))].filter(Boolean).join(" "));
			setBusy(false);
			return;
		}
		setNotice("If that number can receive one, a one-time code is on its way.");
		navigate({
			to: "/auth/verify",
			search: {
				channel: "phone",
				identifier: parsed.data,
				next: nextPath,
				intent: creating ? "signup" : "signin"
			}
		});
	}
	const [legalOpen, setLegalOpen] = (0, import_react.useState)(null);
	const [signupIntent, setSignupIntent] = (0, import_react.useState)(false);
	const [showPassword, setShowPassword] = (0, import_react.useState)(false);
	async function submitPassword(intent) {
		setBusy(true);
		setError(null);
		setErrorHint(null);
		setNotice(null);
		const parsedEmail = stringType().trim().email("Enter a valid email address.").safeParse(email);
		if (!parsedEmail.success) {
			setError(parsedEmail.error.issues[0].message);
			setBusy(false);
			return;
		}
		if (password.length < 8) {
			setError("Your password needs at least 8 characters.");
			setBusy(false);
			return;
		}
		if (intent === "signup") {
			if (!authProviderAvailability.emailDelivery) {
				setError("New email accounts are temporarily unavailable while production mail is prepared.");
				setErrorHint("No account was created. Existing members can still sign in with a password.");
				setBusy(false);
				return;
			}
			const { data, error: err } = await supabase.auth.signUp({
				email: parsedEmail.data,
				password,
				options: { emailRedirectTo: `${window.location.origin}/auth/callback${nextPath !== "/home" ? `?next=${encodeURIComponent(nextPath)}` : ""}` }
			});
			if (err) {
				const delay = noteAttempt("signup", parsedEmail.data, false);
				setError([/already registered|already exists/i.test(err.message) ? "That address cannot be used to create a new account. If it is yours, sign in — or reset the password." : friendlyOtpError(err.message), describeWait(delay)].filter(Boolean).join(" "));
				setBusy(false);
				return;
			}
			if (!data.session) {
				setNotice("Account created. Check your inbox and open the confirmation link to finish signing in.");
				setBusy(false);
				return;
			}
			navigate({
				to: nextPath,
				replace: true
			});
			return;
		}
		const waiting = blockedFor("password_signin", parsedEmail.data);
		if (waiting > 0) {
			setError(describeWait(waiting));
			setErrorHint("You can also sign in with a one-time code, or reset your password below.");
			setBusy(false);
			return;
		}
		const { error: err } = await supabase.auth.signInWithPassword({
			email: parsedEmail.data,
			password
		});
		if (err) {
			const delay = noteAttempt("password_signin", parsedEmail.data, false);
			setError([err.message.toLowerCase().includes("invalid login") ? "That email and password combination did not match an account." : friendlyOtpError(err.message), describeWait(delay)].filter(Boolean).join(" "));
			setErrorHint("You can also sign in with a one-time code, or reset your password below.");
			setBusy(false);
			return;
		}
		noteAttempt("password_signin", parsedEmail.data, true);
		navigate({
			to: nextPath,
			replace: true
		});
	}
	/**
	* The wait an attempt has earned, and the record of it.
	*
	* Kept as two small functions rather than a hook so every path on this screen
	* — password sign-in, sign-up, reset, one-time code — goes through the same
	* two lines. Four screens each remembering to back off in their own way is
	* three chances to forget.
	*/
	function blockedFor(action, identifier) {
		return secondsUntilAllowed(loadThrottle(action, identifier), Date.now());
	}
	function noteAttempt(action, identifier, ok) {
		if (ok) {
			saveThrottle(action, identifier, recordSuccess());
			return 0;
		}
		const next = recordFailure(loadThrottle(action, identifier), Date.now());
		saveThrottle(action, identifier, next);
		return secondsUntilAllowed(next, Date.now());
	}
	async function sendPasswordReset() {
		if (!authProviderAvailability.emailDelivery) {
			setError("Password reset email is temporarily unavailable while production mail is prepared.");
			return;
		}
		setBusy(true);
		setError(null);
		setErrorHint(null);
		setNotice(null);
		const parsedEmail = stringType().trim().email("Enter a valid email address.").safeParse(email);
		if (!parsedEmail.success) {
			setError("Enter your email address first, then choose Forgot password.");
			setBusy(false);
			return;
		}
		const waiting = blockedFor("password_reset", parsedEmail.data);
		if (waiting > 0) {
			setBusy(false);
			setError(describeWait(waiting));
			return;
		}
		const { error: err } = await supabase.auth.resetPasswordForEmail(parsedEmail.data, { redirectTo: `${window.location.origin}/reset-password` });
		setBusy(false);
		if (err) {
			const delay = noteAttempt("password_reset", parsedEmail.data, false);
			setError([friendlyOtpError(err.message), describeWait(delay)].filter(Boolean).join(" "));
			return;
		}
		noteAttempt("password_reset", parsedEmail.data, false);
		setNotice("If that address has an account, a password reset link is on its way. The link expires shortly.");
	}
	async function sendEmailOtp(e) {
		e.preventDefault();
		if (!authProviderAvailability.emailDelivery) {
			setError("Email one-time codes are temporarily unavailable while production mail is prepared.");
			return;
		}
		setBusy(true);
		setError(null);
		const parsed = stringType().trim().email("Enter a valid email address.").safeParse(email);
		if (!parsed.success) {
			setError(parsed.error.issues[0].message);
			setBusy(false);
			return;
		}
		const creating = signupIntent;
		const { error: err } = await supabase.auth.signInWithOtp({
			email: parsed.data,
			options: {
				shouldCreateUser: creating,
				emailRedirectTo: `${window.location.origin}/auth/callback${nextPath !== "/home" ? `?next=${encodeURIComponent(nextPath)}` : ""}`
			}
		});
		if (err && !/user|not found|signups? not allowed|otp_disabled/i.test(err.message)) {
			setError(friendlyOtpError(err.message));
			setBusy(false);
			return;
		}
		setNotice(OTP_SENT_NOTICE);
		navigate({
			to: "/auth/verify",
			search: {
				channel: "email",
				identifier: parsed.data,
				next: nextPath,
				intent: creating ? "signup" : "signin"
			}
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AuthShell, {
		title: fromExpiredDemo ? "Continue with OCADE" : "Welcome to CARCC CADANE",
		subtitle: fromExpiredDemo ? "Your 28-minute demo has ended. An account keeps the next one." : "One account for OCADE.",
		footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
			"Read our",
			` `,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setLegalOpen("terms"),
				className: "-mx-1 inline-flex min-h-6 items-center rounded px-1 underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				children: "terms"
			}),
			` `,
			"and",
			` `,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => setLegalOpen("privacy"),
				className: "-mx-1 inline-flex min-h-6 items-center rounded px-1 underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
				children: "privacy notice"
			}),
			". Your workspace defaults to Private Sync — you can switch it to Device Only anytime."
		] }),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-5",
			children: [
				!authConfigured ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "status",
					className: "rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-3 py-2 text-xs text-[color:var(--state-warning)]",
					children: "Sign-in is temporarily unavailable because this deployment is missing its private service configuration. The public information pages remain available, and no data was sent to another service."
				}) : null,
				fromExpiredDemo ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "status",
					className: "rounded-lg border border-primary/30 bg-primary/[0.07] px-4 py-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm font-medium text-foreground",
						children: "Your demo has ended"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs leading-relaxed text-muted-foreground",
						children: "The demo runs for 28 minutes and saves nothing. Everything you tried is gone, which is the point of a demo. An account keeps your conversations, projects and tasks on your own device, and syncs them only if you ask it to."
					})]
				}) : notice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary",
					children: notice
				}) : null,
				demoResetsIn ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground",
					children: [
						"The demo is available again in ",
						demoResetsIn,
						". An account has no such limit."
					]
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/demo",
					className: "flex items-center justify-between rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-3 py-2 text-xs text-[color:var(--state-warning)] hover:bg-[color:var(--state-warning)]/20",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Just looking? Try the demo — no sign-in, sample data only." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-semibold uppercase tracking-wider",
						children: "Demo →"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/blog/$slug",
					params: { slug: "why-ocade-starts-local" },
					className: "rounded-md border border-border/60 bg-background/35 px-3 py-2.5 text-xs hover:border-primary/35",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block font-medium text-foreground",
						children: "Why OCADE starts local"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-1 block text-muted-foreground",
						children: "Read the product note before deciding whether to sign in or create an account."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "radiogroup",
					"aria-label": "Are you signing in or creating an account?",
					className: "grid grid-cols-2 gap-1 rounded-lg bg-muted/40 p-1",
					children: [{
						id: false,
						label: "I have an account",
						hint: "Sign in to OCADE"
					}, {
						id: true,
						label: "I am new here",
						hint: "Create an OCADE account"
					}].map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						role: "radio",
						"aria-checked": signupIntent === option.id,
						title: option.hint,
						onClick: () => {
							setSignupIntent(option.id);
							setNotice(null);
							setError(null);
							setErrorHint(null);
						},
						className: cn("inline-flex min-h-[32px] items-center justify-center rounded-md px-2 py-1.5", "text-xs font-medium transition-colors", signupIntent === option.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
						children: option.label
					}, String(option.id)))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "tablist",
					"aria-label": "Sign-in method",
					className: "grid gap-1 rounded-lg bg-muted/40 p-1",
					style: { gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` },
					children: methods.map((m) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						role: "tab",
						"aria-selected": method === m.id,
						onClick: () => {
							setMethod(m.id);
							setNotice(null);
						},
						className: cn("inline-flex min-h-[24px] items-center justify-center rounded-md px-2 py-1.5", "text-xs font-medium transition-colors", method === m.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"),
						children: m.label
					}, m.id))
				}),
				method === "google" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					disabled: busy || !authConfigured,
					onClick: () => signInOAuth("google"),
					className: "inline-flex items-center justify-center gap-2 rounded-lg border border-border/70 bg-background/60 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60",
					children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoogleGlyph, {}), "Continue with Google"]
				}) : null,
				method === "apple" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					disabled: busy || !authConfigured,
					onClick: () => signInOAuth("apple"),
					className: "inline-flex items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:opacity-90 disabled:opacity-60",
					children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppleGlyph, {}), "Continue with Apple"]
				}) : null,
				method === "phone" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: sendPhoneOtp,
					className: "flex flex-col gap-3",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							htmlFor: "phone",
							className: "text-xs font-medium text-muted-foreground",
							children: "Phone number"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Phone, {
								className: "h-4 w-4 text-muted-foreground",
								"aria-hidden": true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								id: "phone",
								type: "tel",
								inputMode: "tel",
								autoComplete: "tel",
								placeholder: "+14155551234",
								value: phone,
								onChange: (e) => setPhone(e.target.value),
								className: "flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "submit",
							disabled: busy || !authConfigured,
							className: "inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60",
							children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : null, "Send one-time code"]
						})
					]
				}) : null,
				method === "email" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
					onSubmit: sendEmailOtp,
					className: "flex flex-col gap-3",
					children: [
						!authProviderAvailability.emailDelivery ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							role: "status",
							className: "rounded-md border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-3 py-2 text-xs text-[color:var(--state-warning)]",
							children: "Existing members can sign in with a password. New email accounts, one-time codes, and password reset will open after production mail delivery is verified."
						}) : null,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							htmlFor: "email",
							className: "text-xs font-medium text-muted-foreground",
							children: "Email"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, {
								className: "h-4 w-4 text-muted-foreground",
								"aria-hidden": true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								id: "email",
								type: "email",
								autoComplete: "email",
								placeholder: "you@example.com",
								value: email,
								onChange: (e) => setEmail(e.target.value),
								className: "flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							htmlFor: "password",
							className: "text-xs font-medium text-muted-foreground",
							children: [
								"Password",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-normal",
									children: "(optional — leave empty for a one-time code)"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2 border-b border-border/70 bg-transparent px-0.5 transition-colors focus-within:border-foreground/70",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(KeyRound, {
									className: "h-4 w-4 text-muted-foreground",
									"aria-hidden": true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									id: "password",
									type: showPassword ? "text" : "password",
									autoComplete: signupIntent ? "new-password" : "current-password",
									placeholder: "At least 8 characters",
									value: password,
									onChange: (e) => setPassword(e.target.value),
									className: "flex-1 bg-transparent py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									onClick: () => setShowPassword((v) => !v),
									"aria-pressed": showPassword,
									"aria-label": showPassword ? "Hide password" : "Show password",
									className: "inline-flex min-h-[24px] min-w-[24px] items-center justify-center text-muted-foreground hover:text-foreground",
									children: showPassword ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, {
										className: "h-4 w-4",
										"aria-hidden": true
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, {
										className: "h-4 w-4",
										"aria-hidden": true
									})
								})
							]
						}),
						password.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => submitPassword(signupIntent ? "signup" : "signin"),
							disabled: busy || !authConfigured || signupIntent && !authProviderAvailability.emailDelivery,
							className: "inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60",
							children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : null, signupIntent ? "Create account" : "Sign in"]
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "submit",
							disabled: busy || !authConfigured || !authProviderAvailability.emailDelivery,
							className: "inline-flex items-center justify-center gap-2 rounded-none bg-primary px-4 py-3 text-[13px] font-medium uppercase tracking-[0.18em] text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60",
							children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : null, signupIntent ? "Create account with a one-time code" : "Send one-time code"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: sendPasswordReset,
							disabled: busy || !authConfigured || !authProviderAvailability.emailDelivery,
							className: "self-start text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-60",
							children: "Forgot password?"
						})
					]
				}) : null,
				error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					role: "alert",
					"aria-live": "polite",
					className: "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium",
						children: error
					}), errorHint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-destructive/85",
						children: errorHint
					}) : null]
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-center text-xs text-muted-foreground",
					children: [
						"Your choice above decides whether OCADE signs you in or makes a new account.",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/",
							className: "text-foreground underline-offset-4 hover:underline",
							children: "Back to home"
						})
					]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LegalDialog, {
			open: legalOpen !== null,
			document: legalOpen ?? "terms",
			onOpenChange: (next) => {
				if (!next) setLegalOpen(null);
			}
		})]
	});
}
function GoogleGlyph() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		className: "h-4 w-4",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M21.35 11.1H12v3.2h5.35c-.23 1.38-1.62 4.05-5.35 4.05-3.22 0-5.85-2.66-5.85-5.95S8.78 6.45 12 6.45c1.83 0 3.06.78 3.76 1.45l2.57-2.48C16.86 3.98 14.66 3 12 3 6.98 3 3 6.98 3 12s3.98 9 9 9c5.19 0 8.63-3.64 8.63-8.78 0-.59-.06-1.05-.28-1.12Z",
			fill: "currentColor"
		})
	});
}
function AppleGlyph() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		className: "h-4 w-4",
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M16.36 12.55c-.03-2.63 2.15-3.9 2.25-3.96-1.23-1.79-3.14-2.03-3.82-2.06-1.63-.16-3.18.96-4.01.96-.84 0-2.11-.94-3.47-.91-1.78.03-3.43 1.03-4.35 2.62-1.85 3.21-.47 7.95 1.33 10.55.88 1.27 1.93 2.7 3.29 2.65 1.32-.05 1.82-.85 3.41-.85 1.59 0 2.05.85 3.45.83 1.43-.03 2.33-1.3 3.2-2.58 1-1.48 1.42-2.92 1.44-3-.03-.01-2.76-1.06-2.79-4.19ZM13.86 4.6c.73-.88 1.22-2.11 1.09-3.33-1.05.04-2.32.7-3.07 1.58-.68.78-1.27 2.03-1.11 3.22 1.17.09 2.36-.59 3.09-1.47Z",
			fill: "currentColor"
		})
	});
}
//#endregion
export { AuthPage as component };

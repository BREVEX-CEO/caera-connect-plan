import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-D46NpEQY.mjs";
import { _ as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { Wt as LoaderCircle, ir as Check } from "../_libs/lucide-react.mjs";
import { n as DATA_CLASSES } from "./companion-bridge-CJ48JKAT.mjs";
import { t as useSession } from "./session-VpaXwoLS.mjs";
import { t as BrandMark } from "./BrandMark-C9Qs_Jak.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { o as readNextEligibleAt } from "./session-CBMwV_c3.mjs";
import { a as setModeFor } from "./resolver-CR5RuR-0.mjs";
import { t as isVaultConfigured } from "./vault-Bo97usys.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/onboarding-CGozjUNy.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function OnboardingShell({ children, step, total, title, subtitle }) {
	const pct = Math.round(step / total * 100);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-screen",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: "#main-content",
				className: "skip-link",
				children: "Skip to content"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "border-b border-border/60",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mx-auto flex h-16 max-w-3xl items-center justify-between px-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						"aria-label": "CARCC CADANE home",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, {})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-xs text-muted-foreground",
						children: [
							"Step ",
							step,
							" of ",
							total
						]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "h-1 w-full bg-border/40",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-full bg-primary transition-all",
						style: { width: `${pct}%` },
						"aria-label": `${pct}% complete`
					})
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				id: "main-content",
				tabIndex: -1,
				className: "mx-auto w-full max-w-3xl px-4 py-8 focus:outline-none",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mb-6",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "text-2xl font-semibold tracking-tight text-foreground",
						children: title
					}), subtitle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: subtitle
					}) : null]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
					strong: true,
					className: "p-6",
					children
				})]
			})
		]
	});
}
/**
* Carry the demo forward from the browser to the account.
*
* The 28-minute session and its reset window live in this browser's storage,
* which is the only place an anonymous visitor exists at all. That is honest
* and it is erasable: clearing site data starts a new one. It is deliberately
* NOT defended with fingerprinting — identifying an anonymous person across
* profiles is precisely what this product refuses to do, and it does not work
* reliably enough to be worth the cost of trying.
*
* What can be recorded truthfully is the moment somebody stops being
* anonymous. If an account is created from a browser that has used a demo,
* the account carries that from then on, on every device they sign in from.
* It is a fact about the account, not a claim about the person.
*
* WRITTEN ONCE. A later sign-in from the same browser must not move the
* timestamp forward, or "when did this account use its demo" becomes "when did
* it last sign in from a browser that had". The guard is `is null`, so the
* first write wins and every later one matches no rows.
*/
async function recordDemoConsumed(userId) {
	if (readNextEligibleAt() === null) return "none";
	try {
		const { error } = await supabase.from("profiles").update({ demo_consumed_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", userId).is("demo_consumed_at", null);
		return error ? "failed" : "recorded";
	} catch {
		return "failed";
	}
}
/**
* What a new account can actually turn on.
*
* Offering FICIA, MADEE and CANIA here would ask someone to choose modules
* that do not exist, and then store the answer as a preference nothing reads.
* They are reserved names, not options.
*/
var modules = [{
	id: "ocade",
	label: "OCADE — assistant"
}];
function OnboardingPage() {
	const { user } = useSession();
	const navigate = useNavigate();
	const [step, setStep] = (0, import_react.useState)(1);
	const [displayName, setDisplayName] = (0, import_react.useState)("");
	const [locale, setLocale] = (0, import_react.useState)(typeof navigator !== "undefined" ? navigator.language ?? "en-US" : "en-US");
	const [timezone, setTimezone] = (0, import_react.useState)(typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
	const [accountType, setAccountType] = (0, import_react.useState)("solo");
	const [privacy, setPrivacy] = (0, import_react.useState)("private_sync");
	const [enabled, setEnabled] = (0, import_react.useState)(["ocade"]);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	const total = 5;
	const canNext = (0, import_react.useMemo)(() => {
		if (step === 1) return displayName.trim().length >= 2;
		return true;
	}, [step, displayName]);
	function toggle(id) {
		setEnabled((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
	}
	async function finish() {
		if (!user) return;
		setBusy(true);
		setError(null);
		const { error: profileErr } = await supabase.from("profiles").update({
			display_name: displayName.trim(),
			locale,
			timezone,
			onboarding_completed: true,
			onboarding_step: "done"
		}).eq("id", user.id);
		if (profileErr) {
			setError(profileErr.message);
			setBusy(false);
			return;
		}
		const { error: settingsErr } = await supabase.from("user_settings").upsert({
			user_id: user.id,
			main_purpose: accountType,
			privacy_chats: privacy,
			privacy_files: privacy,
			privacy_images: privacy,
			privacy_copilot: privacy,
			privacy_recordings: privacy,
			privacy_resumes: privacy,
			privacy_company: privacy,
			privacy_timesheets: privacy,
			modules: enabled,
			family_planning_enabled: false
		}, { onConflict: "user_id" });
		if (settingsErr) {
			setError(settingsErr.message);
			setBusy(false);
			return;
		}
		const storageMode = privacy === "device_only" ? "browser_only" : "private_sync";
		const refused = (await Promise.allSettled(DATA_CLASSES.map((dataClass) => setModeFor(user.id, dataClass, storageMode)))).filter((outcome) => outcome.status === "rejected");
		if (refused.length) {
			setError(`Your privacy choice could not be saved for ${refused.length} of ${DATA_CLASSES.length} kinds of data. Set it in Settings › Privacy before adding anything you care about.`);
			setBusy(false);
			return;
		}
		recordDemoConsumed(user.id);
		let vaultReady = true;
		try {
			vaultReady = await isVaultConfigured(user.id);
		} catch {
			vaultReady = true;
		}
		navigate({
			to: vaultReady ? "/home" : "/settings/vault",
			replace: true
		});
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(OnboardingShell, {
		step,
		total,
		title: titleFor(step),
		subtitle: subtitleFor(step),
		children: [
			step === 1 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
					label: "How should OCADE address you?",
					htmlFor: "displayName",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						"aria-label": "How should OCADE address you?",
						id: "displayName",
						value: displayName,
						onChange: (e) => setDisplayName(e.target.value),
						autoFocus: true,
						placeholder: "e.g. Alex Rivera",
						className: "w-full rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "grid gap-4 sm:grid-cols-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Language",
						htmlFor: "locale",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							"aria-label": "Language",
							id: "locale",
							value: locale,
							onChange: (e) => setLocale(e.target.value),
							className: "w-full rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Timezone",
						htmlFor: "tz",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							"aria-label": "Timezone",
							id: "tz",
							value: timezone,
							onChange: (e) => setTimezone(e.target.value),
							className: "w-full rounded-lg border border-border/70 bg-background/50 px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
						})
					})]
				})]
			}) : null,
			step === 2 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, {
				value: accountType,
				onChange: (v) => setAccountType(v),
				options: [
					{
						value: "solo",
						title: "Solo",
						desc: "Just you. Personal projects, resumes, private assistant."
					},
					{
						value: "small_business",
						title: "Small business",
						desc: "Up to a small team. Company profile, invoices, timesheets."
					},
					{
						value: "enterprise",
						title: "Enterprise",
						desc: "Multi-tenant, roles, audit — ships after Foundation Alpha."
					}
				]
			}) : null,
			step === 3 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadioGroup, {
				value: privacy,
				onChange: (v) => setPrivacy(v),
				options: [{
					value: "private_sync",
					title: "Private Sync (recommended)",
					desc: "Encrypted account sync across your approved devices. RLS enforced on every read."
				}, {
					value: "device_only",
					title: "Device Only",
					desc: "Chats, files and project data stay on this device. No cloud sync."
				}]
			}) : null,
			step === 4 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-col gap-2",
				children: modules.map((m) => {
					const active = enabled.includes(m.id);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						"aria-pressed": active,
						type: "button",
						onClick: () => toggle(m.id),
						className: cn("flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors", active ? "border-primary/60 bg-primary/10 text-foreground" : "border-border/60 bg-background/40 text-muted-foreground hover:text-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: m.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("flex h-5 w-5 items-center justify-center rounded-md border", active ? "border-primary bg-primary text-primary-foreground" : "border-border"),
							children: active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "h-3.5 w-3.5" }) : null
						})]
					}, m.id);
				})
			}) : null,
			step === 5 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3 text-sm text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Display name",
						value: displayName
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Language",
						value: locale
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Timezone",
						value: timezone
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Account type",
						value: labelFor(accountType)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Privacy",
						value: privacy === "device_only" ? "Device Only" : "Private Sync"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Modules",
						value: enabled.length ? enabled.map((id) => modules.find((m) => m.id === id)?.label).join(", ") : "None"
					}),
					error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
						children: error
					}) : null
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-6 flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: step === 1 || busy,
					onClick: () => setStep((s) => Math.max(1, s - 1)),
					className: "text-sm text-muted-foreground hover:text-foreground disabled:opacity-40",
					children: "Back"
				}), step < total ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					disabled: !canNext,
					onClick: () => setStep((s) => Math.min(total, s + 1)),
					className: "inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60",
					children: "Continue"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: finish,
					disabled: busy,
					className: "inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60",
					children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : null, "Enter workspace"]
				})]
			})
		]
	});
}
function titleFor(step) {
	switch (step) {
		case 1: return "Tell us about you";
		case 2: return "How will you use CARCC CADANE?";
		case 3: return "Choose your privacy mode";
		case 4: return "Pick your starting modules";
		default: return "Review and continue";
	}
}
function subtitleFor(step) {
	switch (step) {
		case 1: return "Basic profile — you can change any of this later in Settings.";
		case 2: return "This sets sensible defaults. You can switch account type anytime.";
		case 3: return "You can change this per-project and per-module later.";
		case 4: return "Every module can be enabled or hidden later — no dead buttons.";
		default: return "Confirm your setup and enter your workspace.";
	}
}
function labelFor(t) {
	return {
		solo: "Solo",
		small_business: "Small business",
		enterprise: "Enterprise"
	}[t];
}
function Field({ label, htmlFor, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
			htmlFor,
			className: "text-xs font-medium text-muted-foreground",
			children: label
		}), children]
	});
}
function Row({ label, value }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start justify-between gap-4 border-b border-border/40 pb-2 last:border-none",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-xs uppercase tracking-wider text-muted-foreground",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "text-right text-sm text-foreground",
			children: value
		})]
	});
}
function RadioGroup({ value, onChange, options }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "radiogroup",
		className: "flex flex-col gap-2",
		children: options.map((o) => {
			const active = value === o.value;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				role: "radio",
				"aria-checked": active,
				onClick: () => onChange(o.value),
				className: cn("flex flex-col rounded-lg border px-4 py-3 text-left transition-colors", active ? "border-primary/60 bg-primary/10" : "border-border/60 bg-background/40 hover:bg-accent/40"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm font-medium text-foreground",
					children: o.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-xs text-muted-foreground",
					children: o.desc
				})]
			}, o.value);
		})
	});
}
//#endregion
export { OnboardingPage as component };

import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ln as Cloud, Q as Radio, Wt as LoaderCircle, jn as Cpu, k as Shield, on as HardDrive } from "../_libs/lucide-react.mjs";
import { n as DATA_CLASSES } from "./companion-bridge-CJ48JKAT.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as useSession } from "./session-C8v4p4SE.mjs";
import { i as recordAction } from "./actions-CaB-ibgo.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as isUnlocked } from "./vault-session-Bh1128Qc.mjs";
import { a as setModeFor, r as loadAllModes } from "./resolver-BwyMoUKb.mjs";
import { t as isVaultConfigured } from "./vault-Ciia7Xhf.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.privacy-Q39tm7V0.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* The ONLY fields that may leave the device.
*
* Deliberately boring and low-cardinality. Anything identifying a person, a
* document or a machine is absent by construction rather than removed later.
*/
var ALLOWED_FIELDS = [
	"schemaVersion",
	"occurredAt",
	"kind",
	"route",
	"appId",
	"appVersion",
	"osFamily",
	"osVersion",
	"ocadeVersion",
	"failureCode",
	"durationMs",
	"retryCount",
	"installId"
];
/**
* Patterns that must never appear in a transmitted value.
*
* This is a SECOND line of defence, not the first. The allow-list already
* excludes free text; this catches an allowed field that unexpectedly contains
* something sensitive — a failure code built from a file path, say.
*/
var SENSITIVE = [
	{
		name: "absolute path",
		re: /(?:[A-Za-z]:\\|\/(?:home|Users|var|etc)\/)[^\s"']*/g
	},
	{
		name: "email",
		re: /[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/g
	},
	{
		name: "bearer token",
		re: /\b(?:sk-|ghp_|xox[baprs]-)[A-Za-z0-9_-]{10,}/g
	},
	{
		name: "jwt",
		re: /\beyJ[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]+/g
	},
	{
		name: "ip address",
		re: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g
	},
	{
		name: "long digit run",
		re: /\b\d{7,}\b/g
	}
];
/** Replace anything sensitive with a label naming what was removed. */
function redact(input) {
	let value = input;
	const redactions = [];
	for (const { name, re } of SENSITIVE) value = value.replace(new RegExp(re.source, re.flags), () => {
		redactions.push(name);
		return `[redacted ${name}]`;
	});
	return {
		value,
		redactions
	};
}
/** Install id: random, never derived from anything about the user or machine. */
function newInstallId() {
	const bytes = /* @__PURE__ */ new Uint8Array(16);
	crypto.getRandomValues(bytes);
	return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
/**
* Build a transmittable report from a raw failure.
*
* Everything not in `ALLOWED_FIELDS` is dropped, including fields the caller
* added that this module has never heard of. That is the point of an
* allow-list: unknown data is discarded rather than forwarded.
*/
function buildReport(raw, env, occurredAt) {
	const candidate = {
		schemaVersion: 1,
		occurredAt: occurredAt.toISOString(),
		kind: raw.kind,
		route: raw.route,
		appId: raw.appId,
		appVersion: raw.appVersion,
		failureCode: raw.failureCode,
		durationMs: raw.durationMs,
		retryCount: raw.retryCount,
		osFamily: env.osFamily,
		osVersion: env.osVersion,
		ocadeVersion: env.ocadeVersion,
		installId: env.installId
	};
	const report = {};
	const redactions = [];
	for (const field of ALLOWED_FIELDS) {
		const v = candidate[field];
		if (v === void 0 || v === null) continue;
		if (typeof v === "number") {
			report[field] = v;
			continue;
		}
		const r = redact(String(v));
		report[field] = r.value;
		redactions.push(...r.redactions);
	}
	return {
		report,
		redactions
	};
}
/**
* The queue. Redaction happens on the way IN.
*
* A report sitting here with a password in it has already been written to disk
* if this queue is ever persisted, so redacting on the way out would be too
* late.
*/
var TelemetryQueue = class {
	env;
	now;
	consent = "none";
	items = [];
	constructor(env, now = () => /* @__PURE__ */ new Date()) {
		this.env = env;
		this.now = now;
	}
	/** Consent is explicit and revocable. Revoking DISCARDS what was queued. */
	setConsent(next) {
		this.consent = next;
		if (next === "none") this.items.length = 0;
	}
	get currentConsent() {
		return this.consent;
	}
	record(raw) {
		if (this.consent === "none") return {
			queued: false,
			refusal: "no_consent",
			reason: "Failure reporting is off, so nothing was collected."
		};
		if (raw.kind === "unknown" && this.consent !== "failures_and_performance") return {
			queued: false,
			refusal: "performance_not_consented",
			reason: "Only failures are shared, and this is not a failure."
		};
		if (this.items.length >= 50) return {
			queued: false,
			refusal: "queue_full",
			reason: "The report queue is full; the earliest failures are kept."
		};
		const { report, redactions } = buildReport(raw, this.env, this.now());
		this.items.push(report);
		return {
			queued: true,
			report,
			redactions
		};
	}
	/** Exactly what would be transmitted, for the user to read. */
	pending() {
		return this.items.map((r) => ({ ...r }));
	}
	clear() {
		this.items.length = 0;
	}
	get size() {
		return this.items.length;
	}
};
/**
* Prove a report carries no field outside the allow-list.
*
* Used by tests and by the panel, so "only allowed fields are sent" is a
* checkable property rather than a claim in a comment.
*/
function containsOnlyAllowedFields(report) {
	const extra = Object.keys(report).filter((k) => !ALLOWED_FIELDS.includes(k));
	return {
		ok: extra.length === 0,
		extra
	};
}
/**
* Production owner for opt-in failure telemetry (HWE-38).
*
* The panel shows the ACTUAL fields that would be transmitted, from the real
* queue, rather than describing them in prose. A privacy claim a user cannot
* check is a privacy claim they have to take on faith, and this is the one
* place where that is least acceptable.
*
* Consent starts off and there is no pre-ticked box. Withdrawing it discards
* anything already collected — otherwise "off" would mean "stops collecting
* more" while a queue of reports waited on disk.
*/
var CHOICES = [
	{
		value: "none",
		label: "Send nothing",
		blurb: "Nothing is collected. This is the default."
	},
	{
		value: "failures_only",
		label: "Failures only",
		blurb: "Which applications and routes OCADE fails on. No file names, titles or content."
	},
	{
		value: "failures_and_performance",
		label: "Failures and timing",
		blurb: "Adds how long actions took, so slow paths can be found."
	}
];
function TelemetryPanel() {
	const env = (0, import_react.useMemo)(() => ({
		osFamily: typeof navigator === "undefined" ? "unknown" : navigator.platform || "unknown",
		osVersion: "unknown",
		ocadeVersion: "0.1.0",
		installId: newInstallId()
	}), []);
	const queue = (0, import_react.useMemo)(() => new TelemetryQueue(env), [env]);
	const [consent, setConsentState] = (0, import_react.useState)("none");
	const [pending, setPending] = (0, import_react.useState)(() => queue.pending());
	const choose = (0, import_react.useCallback)((next) => {
		queue.setConsent(next);
		setConsentState(next);
		setPending(queue.pending());
	}, [queue]);
	/** Record a sample failure so the user can read a real report. */
	const sample = (0, import_react.useCallback)(() => {
		queue.record({
			kind: "control_route_failed",
			failureCode: "stale_target",
			route: "accessibility",
			appId: "com.example.editor",
			appVersion: "4.1.0",
			durationMs: 812,
			windowTitle: "Quarterly results FINAL.xlsx"
		});
		setPending(queue.pending());
	}, [queue]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "p-4",
		"data-testid": "telemetry-panel",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
				className: "mb-1 flex items-center gap-2 text-sm font-semibold",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Radio, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), "Failure reporting"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted-foreground",
				children: "OCADE collects nothing unless you turn this on. When it is on, only the fields listed below are sent — never file names, window titles, clipboard contents or anything you typed."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex flex-col gap-2",
				children: CHOICES.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-start gap-2 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "radio",
						name: "telemetry-consent",
						className: "mt-0.5",
						checked: consent === c.value,
						onChange: () => choose(c.value)
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: c.label
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("br", {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: c.blurb
						})
					] })]
				}, c.value))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 flex flex-wrap items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: sample,
						disabled: consent === "none",
						children: "Show me a real report"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "outline",
						onClick: () => {
							queue.clear();
							setPending(queue.pending());
						},
						disabled: pending.length === 0,
						children: "Delete collected reports"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "text-xs text-muted-foreground",
						children: [
							pending.length,
							" report",
							pending.length === 1 ? "" : "s",
							" waiting"
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", {
				className: "mt-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("summary", {
					className: "cursor-pointer text-xs text-muted-foreground",
					children: [
						"Every field that can be sent (",
						ALLOWED_FIELDS.length,
						")"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-1.5 flex flex-wrap gap-1",
					children: ALLOWED_FIELDS.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground",
						children: f
					}, f))
				})]
			}),
			pending.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-3 rounded border border-border/70 p-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium",
						children: "Exactly what would be sent"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
						className: "mt-1 overflow-x-auto text-[10px] text-muted-foreground",
						children: JSON.stringify(pending[0], null, 2)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-[10px] text-muted-foreground",
						children: containsOnlyAllowedFields(pending[0]).ok ? "Checked: no field outside the list above." : "A field outside the list was found — this is a defect."
					})
				]
			})
		]
	});
}
var LABELS = {
	chats: {
		label: "Chats",
		help: "OCADE conversations and threads."
	},
	files: {
		label: "Files",
		help: "Documents attached to OCADE conversations and projects."
	},
	images: {
		label: "Images",
		help: "Generated or uploaded images."
	},
	recordings: {
		label: "Recordings",
		help: "Optional screen/voice captures — always opt-in per session."
	},
	copilot: {
		label: "Copilot history",
		help: "Plans, steps and results from Copilot runs."
	},
	learning_replays: {
		label: "Learning replays",
		help: "Intern-mode workflow captures."
	}
};
var MODES = [
	{
		mode: "browser_only",
		label: "Browser Only",
		icon: HardDrive
	},
	{
		mode: "pc_vault",
		label: "PC Vault",
		icon: Cpu
	},
	{
		mode: "private_sync",
		label: "Private Sync",
		icon: Cloud
	}
];
function PrivacyPage() {
	const { user } = useSession();
	const [values, setValues] = (0, import_react.useState)(null);
	const [busyKey, setBusyKey] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [vaultReady, setVaultReady] = (0, import_react.useState)({
		configured: false,
		unlocked: isUnlocked()
	});
	(0, import_react.useEffect)(() => {
		if (!user) return;
		loadAllModes(user.id).then(setValues);
		isVaultConfigured(user.id).then((configured) => setVaultReady((v) => ({
			...v,
			configured
		})));
	}, [user]);
	async function change(key, mode) {
		if (!user || !values) return;
		setBusyKey(key);
		setError(null);
		try {
			await setModeFor(user.id, key, mode);
			setValues({
				...values,
				[key]: mode
			});
			await recordAction({
				actionId: "settings.privacy.change",
				metadata: {
					key,
					mode
				}
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusyKey(null);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "Account · Privacy",
			title: "Per-data-class privacy",
			description: "Pick where each kind of data lives. Browser Only writes never reach the cloud.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings",
				className: "inline-flex min-h-[24px] items-center px-1 py-1 text-sm text-muted-foreground hover:text-foreground",
				children: "← Back to Settings"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-4",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TelemetryPanel, {})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-4 flex items-start gap-3 p-4 text-xs text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Shield, {
				className: "mt-0.5 h-4 w-4 shrink-0 text-primary",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-1",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
							className: "text-foreground",
							children: "Browser Only"
						}),
						" — encrypted in this browser (AES-GCM), never syncs. Requires the",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/settings/vault",
							className: "underline",
							children: "Browser Vault"
						}),
						" ",
						"to be set up and unlocked. Data is lost if you clear this browser's storage."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
							className: "text-foreground",
							children: "PC Vault"
						}),
						" — OS-level encrypted storage via the OCADE Native Companion. ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("em", { children: "Native Companion Required" }),
						" — ships with the desktop package."
					] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "text-foreground",
						children: "Private Sync"
					}), " — stored in your account with RLS enforced, synced across your approved devices."] })
				]
			})]
		}),
		!vaultReady.configured ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "mt-3 flex items-start justify-between gap-3 p-4 text-xs",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-muted-foreground",
				children: "Browser Vault is not set up yet. Browser Only writes will surface as “vault locked” until you finish setup."
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
				to: "/settings/vault",
				className: "rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:opacity-90",
				children: "Set up vault"
			})]
		}) : null,
		error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
			children: error
		}) : null,
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "mt-6 divide-y divide-border/40",
			children: values === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Loading…"]
			}) : DATA_CLASSES.map((dc) => {
				const v = values[dc];
				const meta = LABELS[dc];
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-medium text-foreground",
							children: meta.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-xs text-muted-foreground",
							children: meta.help
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1 rounded-lg bg-muted/40 p-1",
						children: MODES.map(({ mode, label, icon: Icon }) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							disabled: busyKey === dc,
							onClick: () => change(dc, mode),
							title: mode === "pc_vault" ? "Native Companion Required" : label,
							className: cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors", v === mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground", mode === "pc_vault" && "opacity-70"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "h-3.5 w-3.5",
									"aria-hidden": true
								}),
								" ",
								label
							]
						}, mode))
					})]
				}, dc);
			})
		})
	] });
}
//#endregion
export { PrivacyPage as component };

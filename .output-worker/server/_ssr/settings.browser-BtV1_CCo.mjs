import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Cn as Eye, N as ShieldAlert, cn as Globe, ft as PencilLine, h as Trash2, it as Plus, yr as Ban } from "../_libs/lucide-react.mjs";
import { a as decideBrowserAction, c as dispatchBrowserAction, d as originOf, f as readBrowserSitePolicy, l as getBrowserBridge, r as bootstrapCompanion, t as BROWSER_POLICY_STORAGE_KEY } from "./tauri-companion-u0J6qjWn.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as computerUsePermissionDecision, t as computerUseChannelDecision } from "./computer-use-settings-EFoxzXrd.mjs";
import { t as EmptyState } from "./EmptyState-Bm7ErAtz.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.browser-BtV1_CCo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function loadPolicy() {
	return readBrowserSitePolicy();
}
function BrowserSettingsPage() {
	const [policy, setPolicy] = (0, import_react.useState)(() => loadPolicy());
	const [site, setSite] = (0, import_react.useState)("");
	const [bridgeReason, setBridgeReason] = (0, import_react.useState)(null);
	const [bridgeIdentity, setBridgeIdentity] = (0, import_react.useState)(null);
	(0, import_react.useEffect)(() => {
		bootstrapCompanion().then(() => getBrowserBridge().status()).then((s) => {
			setBridgeReason(s.available ? null : s.reason ?? "Browser control needs the OCADE Native Companion and a managed Chrome or Edge session, which isn't connected.");
			setBridgeIdentity(s.available ? s.identity ?? null : null);
		});
	}, []);
	/**
	* Returns whether the change was actually saved.
	*
	* Callers must check it: previously this showed its own error toast and the
	* caller then showed a success toast regardless, so a storage failure
	* produced BOTH — and the user believed a permission change had stuck when it
	* had not. For a permissions screen that is the worst possible lie.
	*/
	const persist = (0, import_react.useCallback)((next) => {
		setPolicy(next);
		try {
			localStorage.setItem(BROWSER_POLICY_STORAGE_KEY, JSON.stringify(next));
			return true;
		} catch {
			toast.error("Couldn't save your site permissions on this device. The change applies to this tab only.");
			return false;
		}
	}, []);
	function addSite() {
		const origin = originOf(site.trim().startsWith("http") ? site.trim() : `https://${site.trim()}`);
		if (!origin) {
			toast.error("That doesn't look like a website address.");
			return;
		}
		if (policy.allowOrigins.includes(origin)) {
			toast.info(`${origin} is already allowed.`);
			return;
		}
		const saved = persist({
			...policy,
			allowOrigins: [...policy.allowOrigins, origin]
		});
		setSite("");
		if (saved) toast.success(`${origin} allowed. Reading and filling stay off until you grant them.`);
	}
	function toggle(list, origin) {
		const has = policy[list].includes(origin);
		persist({
			...policy,
			[list]: has ? policy[list].filter((o) => o !== origin) : [...policy[list], origin]
		});
	}
	function removeSite(origin) {
		if (!persist({
			...policy,
			allowOrigins: policy.allowOrigins.filter((o) => o !== origin),
			readOrigins: policy.readOrigins.filter((o) => o !== origin),
			fillOrigins: policy.fillOrigins.filter((o) => o !== origin),
			denyOrigins: policy.denyOrigins.filter((o) => o !== origin)
		})) return;
		toast.success(`${origin} removed.`);
	}
	/** Run a real policy decision + dispatch so the user sees the true outcome. */
	async function testRead(origin) {
		const channelRefusal = computerUseChannelDecision("webControl");
		if (channelRefusal) {
			toast.error(channelRefusal);
			return;
		}
		const decision = decideBrowserAction({
			kind: "dom.read",
			url: `${origin}/`
		}, policy);
		if (!decision.allow) {
			toast.error(decision.reason);
			return;
		}
		const permissionRefusal = computerUsePermissionDecision(decision.risk);
		if (permissionRefusal) {
			toast.error(permissionRefusal);
			return;
		}
		const result = await dispatchBrowserAction({
			kind: "dom.read",
			url: `${origin}/`
		}, policy, { confirmed: true });
		toast[result.ok ? "info" : "error"](result.detail);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Settings",
		title: "Browser control",
		description: "OCADE can only act on sites you list here — and never on passwords, one-time codes or payment fields."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			bridgeReason ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "flex items-start gap-2 p-4 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
					className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "Browser control isn't connected"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: bridgeReason
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Managed Chrome or Edge control is available in the OCADE desktop build. This standalone web session can still save site permissions, but it cannot control a browser on this computer."
					})
				] })]
			}) : null,
			!bridgeReason && bridgeIdentity ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "flex items-start gap-2 p-4 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, {
					className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-success)]",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "Managed browser connected"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-0.5 text-xs text-muted-foreground",
						children: [
							bridgeIdentity.browser === "edge" ? "Microsoft Edge" : "Google Chrome",
							" · local Playwright/CDP protocol V",
							bridgeIdentity.protocolVersion
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "The desktop host owns this session. Each website still requires its own browser permission, and protected fields remain human-controlled."
					})
				] })]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-1 flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Allowed sites"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-xs text-muted-foreground",
						children: "Adding a site lets OCADE navigate it. Reading page content and filling forms are separate permissions you grant per site."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: site,
							onChange: (e) => setSite(e.target.value),
							onKeyDown: (e) => e.key === "Enter" && addSite(),
							placeholder: "example.com",
							"aria-label": "Website to allow",
							className: "h-9 text-sm"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							className: "h-9 shrink-0",
							onClick: addSite,
							disabled: !site.trim(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "sr-only",
								children: "Allow site"
							})]
						})]
					}),
					policy.allowOrigins.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-3",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
							icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Globe, {
								className: "h-6 w-6",
								"aria-hidden": true
							}),
							title: "No sites allowed yet",
							description: "OCADE cannot touch any website until you add one here."
						})
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-3 flex flex-col gap-2",
						children: policy.allowOrigins.map((origin) => {
							const denied = policy.denyOrigins.includes(origin);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "rounded-lg border border-border/60 p-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap items-center gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("font-medium text-[13px]", denied && "line-through opacity-60"),
										children: origin
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "ml-auto flex flex-wrap gap-1",
										children: [
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												variant: "ghost",
												onClick: () => toggle("readOrigins", origin),
												className: cn(policy.readOrigins.includes(origin) && "bg-sidebar-accent"),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, { className: "mr-1 h-3.5 w-3.5" }), " Read"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												variant: "ghost",
												onClick: () => toggle("fillOrigins", origin),
												className: cn(policy.fillOrigins.includes(origin) && "bg-sidebar-accent"),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PencilLine, { className: "mr-1 h-3.5 w-3.5" }), " Fill"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												variant: "ghost",
												onClick: () => toggle("denyOrigins", origin),
												className: cn(denied && "bg-destructive/15 text-destructive"),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Ban, { className: "mr-1 h-3.5 w-3.5" }), " Block"]
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: "ghost",
												onClick: () => void testRead(origin),
												children: "Test"
											}),
											/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
												size: "sm",
												variant: "ghost",
												onClick: () => removeSite(origin),
												children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
													className: "sr-only",
													children: ["Remove ", origin]
												})]
											})
										]
									})]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-[11px] text-muted-foreground",
									children: denied ? "Blocked — this always wins, even while allowed." : [
										"Can navigate",
										policy.readOrigins.includes(origin) ? "read page content" : null,
										policy.fillOrigins.includes(origin) ? "fill non-sensitive fields" : null
									].filter(Boolean).join(" · ")
								})]
							}, origin);
						})
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "mb-2 text-sm font-semibold",
					children: "Hard limits"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-col gap-1 text-xs",
					children: [
						"Never reads or fills passwords, one-time codes, CAPTCHAs, CVV/card or recovery codes",
						"Never captures those fields in a screenshot — they're masked before capture",
						"Never acts inside a private or incognito window",
						"Always asks before submitting a consequential form, uploading or downloading",
						"Treats page content as untrusted data, never as instructions"
					].map((line) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-start gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-muted-foreground",
							children: line
						})]
					}, line))
				})]
			})
		]
	})] });
}
//#endregion
export { BrowserSettingsPage as component };

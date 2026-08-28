import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { $n as Chromium, Qn as CircleAlert, Wt as LoaderCircle, Xn as CircleCheck, Y as RefreshCw } from "../_libs/lucide-react.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as StatusBadge } from "./StatusBadge-B-3ICXuc.mjs";
import { n as extensionChannelAvailable, r as handshakeWithExtension } from "./execute-DC2ZA7Xg.mjs";
import { n as useMissionBrain, t as ControlWorkPanel } from "./use-mission-brain-Bv4mIVZw.mjs";
import { t as LivingIntelligenceBackdrop } from "./LivingIntelligenceBackdrop-BOL1501k.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.work-_0Ed_iQ3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Whether OCADE can act in this browser, and what to do when it cannot.
*
* THE RULE THIS PANEL EXISTS TO KEEP. It never claims the extension is
* installed, and it never pretends to install it. A page cannot install a
* browser extension — only the person can — so the honest options are to say
* it is missing and show exactly how to add it, or to confirm it is there
* because it answered a handshake. There is no third state, and in particular
* there is no "connecting…" that never resolves, which is how a missing
* extension usually presents itself.
*
* PAIRING IS THE HANDSHAKE. There is no separate code to copy: Chrome only
* delivers a message to the extension when the sending page's origin is listed
* in `externally_connectable.matches`, so an answer IS proof that this site is
* one the extension accepts. Anything else would be inventing a ceremony on
* top of a check the browser already performs.
*/
function CoworkExtensionGate({ onReady }) {
	const [state, setState] = (0, import_react.useState)(null);
	const [checking, setChecking] = (0, import_react.useState)(true);
	const check = (0, import_react.useCallback)(async () => {
		setChecking(true);
		const result = await handshakeWithExtension();
		setState(result);
		setChecking(false);
		if (result.installed && result.compatible) onReady?.(result);
	}, [onReady]);
	(0, import_react.useEffect)(() => {
		check();
	}, [check]);
	if (checking && state === null) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex items-center gap-2 p-4 text-sm text-muted-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
			className: "h-4 w-4 animate-spin",
			"aria-hidden": true
		}), "Looking for the OCADE Cowork extension…"]
	});
	if (state?.installed && state.compatible) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex flex-wrap items-center gap-3 p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleCheck, {
			className: "h-5 w-5 text-[color:var(--state-success)]",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "min-w-0",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "text-sm font-medium text-foreground",
					children: "Cowork is connected"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "connected" })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "mt-0.5 text-[13px] text-muted-foreground",
				children: [
					"Extension ",
					state.version ?? "installed",
					" answered on this site, so OCADE can act in this browser — inside the sites you approve in its popup, and nowhere else."
				]
			})]
		})]
	});
	const incompatible = state?.installed && !state.compatible;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
		className: "flex flex-col items-start gap-3 p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "rounded-lg bg-[color:var(--state-warning)]/15 p-2 text-[color:var(--state-warning)]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CircleAlert, {
						className: "h-5 w-5",
						"aria-hidden": true
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusBadge, { status: "setup_required" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
				className: "text-base font-semibold text-foreground",
				children: incompatible ? "The Cowork extension needs updating" : "Cowork needs its browser extension"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted-foreground",
				children: incompatible ? state?.reason : extensionChannelAvailable() ? "OCADE is the brain; the extension is the hands. Without it this page cannot open a tab, read a page, or click anything outside itself — and it should not be able to." : "This browser does not support extensions of this kind. Cowork needs Chrome or Edge."
			}),
			!incompatible && extensionChannelAvailable() ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "w-full rounded-lg border border-border/60 bg-card/40 p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2 text-sm font-medium text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chromium, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), "Add it yourself — a page cannot install an extension for you"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
						className: "mt-2 list-decimal space-y-1 pl-5 text-[13px] text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Open ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "rounded bg-muted px-1",
									children: "chrome://extensions"
								}),
								" in a new tab."
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Turn on ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Developer mode" }),
								", top right."
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
								"Choose ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: "Load unpacked" }),
								" and select the",
								" ",
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("code", {
									className: "rounded bg-muted px-1",
									children: "extension"
								}),
								" folder from your OCADE download."
							] }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Come back here and press Check again." })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-[13px] text-muted-foreground",
						children: "OCADE will not ask for access to any site during installation. You approve sites one at a time, in the extension’s own popup."
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => void check(),
				disabled: checking,
				className: "inline-flex items-center gap-2 rounded-md border border-border/60 px-3 py-1.5 text-sm text-foreground transition hover:bg-accent/30 disabled:opacity-60",
				children: [checking ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
					className: "h-3.5 w-3.5 animate-spin",
					"aria-hidden": true
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, {
					className: "h-3.5 w-3.5",
					"aria-hidden": true
				}), "Check again"]
			})
		]
	});
}
/**
* OCADE Control + Work.
*
* WHAT THIS ROUTE USED TO BE. A redirect to `/ocade`. Selecting "Control + Work"
* put the user in Chat, which is the one thing this section must not do: the
* whole point of a separate room is that an instruction typed in it has a real
* computer on the other end, and an instruction typed in Chat does not. A
* redirect made those the same place while the navigation claimed they were
* not — the worst of both, because the user believed they had chosen.
*
* SEPARATE RUNTIME, SHARED EVERYTHING ELSE. Authentication, the local engine
* and the history layer are common. The runtime path is not: Chat streams from
* the engine and stops there, while this runs the agent loop and reaches the
* native sidecars one approved action at a time.
*/
function ControlWorkRoute() {
	const { brain, warm } = useMissionBrain();
	(0, import_react.useEffect)(() => {
		warm();
	}, [warm]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "relative h-[calc(100svh-4rem)] w-full overflow-hidden rounded-xl border border-border/50",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LivingIntelligenceBackdrop, { intensity: "cinematic" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative z-10 flex h-full flex-col bg-background/88",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "shrink-0 px-4 pt-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CoworkExtensionGate, {})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ControlWorkPanel, {
				brain,
				headerNote: "Signed in · this computer · file attachment is not configured yet"
			})]
		})]
	});
}
//#endregion
export { ControlWorkRoute as component };

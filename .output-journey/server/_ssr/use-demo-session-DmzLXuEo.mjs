import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Ot as MonitorCog, R as Settings2, g as Timer, gt as PanelLeft, t as X, wr as ArrowLeft } from "../_libs/lucide-react.mjs";
import { a as readNextEligibleAt, i as readDeadline, n as formatRemaining, o as sessionState, s as startSession, t as endSession } from "./session-BA6zzQzb.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-demo-session-DmzLXuEo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function ChatShell({ sidebar, header, composer, children, banner, sidebarLabel = "Chat history" }) {
	const [drawerOpen, setDrawerOpen] = (0, import_react.useState)(false);
	const drawerRef = (0, import_react.useRef)(null);
	const openerRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!drawerOpen) return;
		const onKey = (e) => {
			if (e.key === "Escape") {
				setDrawerOpen(false);
				openerRef.current?.focus();
			}
		};
		document.addEventListener("keydown", onKey);
		drawerRef.current?.focus();
		return () => document.removeEventListener("keydown", onKey);
	}, [drawerOpen]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-[100dvh] min-h-0 w-full overflow-hidden bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
				"aria-label": sidebarLabel,
				className: "hidden w-[17.5rem] shrink-0 border-r border-border/60 bg-card/30 lg:block",
				children: sidebar
			}),
			drawerOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "fixed inset-0 z-50 lg:hidden",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": "Close chat history",
					onClick: () => {
						setDrawerOpen(false);
						openerRef.current?.focus();
					},
					className: "absolute inset-0 bg-background/70 backdrop-blur-sm"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					ref: drawerRef,
					role: "dialog",
					"aria-modal": "true",
					"aria-label": sidebarLabel,
					tabIndex: -1,
					className: "absolute inset-y-0 left-0 flex w-[85vw] max-w-[19rem] flex-col border-r border-border/60 bg-card shadow-xl outline-none",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between border-b border-border/60 px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[13px] font-medium text-foreground",
							children: sidebarLabel
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setDrawerOpen(false);
								openerRef.current?.focus();
							},
							"aria-label": "Close chat history",
							className: "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-4 w-4" })
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-h-0 flex-1",
						children: sidebar
					})]
				})]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
						className: "flex h-14 shrink-0 items-center gap-2 border-b border-border/60 px-3 sm:px-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							ref: openerRef,
							type: "button",
							onClick: () => setDrawerOpen(true),
							"aria-label": "Open chat history",
							"aria-expanded": drawerOpen,
							className: "inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeft, { className: "h-4 w-4" })
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "min-w-0 flex-1",
							children: header
						})]
					}),
					banner ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "shrink-0 px-3 pt-3 sm:px-4",
						children: banner
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
						className: cn("min-h-0 flex-1 overflow-y-auto"),
						"aria-label": "Conversation",
						children
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "shrink-0 border-t border-border/60 bg-background/80 backdrop-blur",
						children: composer
					})
				]
			})
		]
	});
}
/**
* The demo clock.
*
* Present without being loud. A countdown that pulses, reddens and grows is a
* pressure device, and the product's own charter rules out artificial urgency —
* so this stays a quiet chip until the last three minutes, when the information
* genuinely changes what the visitor should do.
*
* The progress ring is drawn from the same `elapsedFraction` the session state
* computes, so the ring and the words can never disagree.
*/
function DemoSessionBadge({ session, className }) {
	if (session.phase === "idle") return null;
	const ending = session.phase === "ending" || session.phase === "expired";
	const circumference = 2 * Math.PI * 7;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		className: cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium tabular-nums transition-colors", ending ? "border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 text-[color:var(--state-warning)]" : "border-border/60 bg-secondary/40 text-muted-foreground", className),
		role: "status",
		"aria-live": "polite",
		"aria-label": `Demo session: ${formatRemaining(session.remainingMs)}`,
		title: "Your demo session. Nothing here is saved.",
		children: [ending ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Timer, {
			className: "h-3.5 w-3.5",
			"aria-hidden": true
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			className: "h-4 w-4 -rotate-90",
			viewBox: "0 0 18 18",
			"aria-hidden": true,
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "9",
				cy: "9",
				r: "7",
				fill: "none",
				stroke: "currentColor",
				strokeOpacity: "0.2",
				strokeWidth: "2"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "9",
				cy: "9",
				r: "7",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "2",
				strokeLinecap: "round",
				strokeDasharray: circumference,
				strokeDashoffset: circumference * session.elapsedFraction
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"aria-hidden": true,
			children: formatRemaining(session.remainingMs)
		})]
	});
}
/**
* The demo's two rooms, and the ways out.
*
* Control + Work is a NAVIGATION ENTRY rather than a mode switch inside Chat,
* and that is a safety decision rather than a layout one. A toggle inside one
* screen means a sentence can change what it does without the user having gone
* anywhere — and the difference between these two rooms is whether typing
* something moves the mouse. Moving between them should feel like moving,
* because it is.
*/
function DemoSidebarNav({ active }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-1",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/demo/settings",
			preload: "render",
			className: "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings2, {
				className: "h-3.5 w-3.5 shrink-0",
				"aria-hidden": true
			}), "Settings"]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
			to: "/",
			className: "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, {
				className: "h-3.5 w-3.5 shrink-0",
				"aria-hidden": true
			}), "Leave the demo"]
		})]
	});
}
/** The action room belongs beside the conversation, not in the utility footer. */
function DemoControlNav({ active }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: active === "control" ? "/demo/ocade" : "/demo/control",
		className: cn("ocade-depth ocade-depth-lift depth-raised flex items-center justify-between gap-3 rounded-xl border px-3 py-3 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active === "control" ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/70 bg-card/50 text-foreground hover:border-primary/35 hover:bg-primary/5"),
		"aria-current": active === "control" ? "page" : void 0,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
			className: "flex items-center gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonitorCog, {
				className: "h-4 w-4 shrink-0 text-primary",
				"aria-hidden": true
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block font-medium",
				children: "OCADE Control + Work"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "mt-0.5 block text-[10.5px] text-muted-foreground",
				children: active === "control" ? "Return to normal chat" : "Act on this device"
			})] })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"aria-hidden": true,
			className: "text-primary",
			children: "→"
		})]
	});
}
/**
* Runs the demo clock and fires the end of the session exactly once.
*
* TICK RATE. Once a second while the warning is showing, once every fifteen
* otherwise. The badge displays whole minutes above ten minutes remaining, so
* a per-second re-render for most of the 28 minutes would
* repaint the tree for a string that did not change.
*
* EXPIRY FIRES ONCE. `onExpire` stops generation, clears the temporary
* conversation and navigates away, and every one of those is unsafe to run
* twice. A background tab can deliver several ticks in a burst when it is
* refocused, so the guard is a ref rather than state — state would not have
* settled before the second tick arrived.
*/
function useDemoSession(options) {
	const { autoStart, onWarn, onExpire, onBlocked } = options;
	const [session, setSession] = (0, import_react.useState)(() => sessionState(typeof window === "undefined" ? null : readDeadline(), Date.now()));
	const [blockedUntil, setBlockedUntil] = (0, import_react.useState)(null);
	const warnedRef = (0, import_react.useRef)(false);
	const expiredRef = (0, import_react.useRef)(false);
	const warnRef = (0, import_react.useRef)(onWarn);
	const expireRef = (0, import_react.useRef)(onExpire);
	const blockedRef = (0, import_react.useRef)(onBlocked);
	warnRef.current = onWarn;
	expireRef.current = onExpire;
	blockedRef.current = onBlocked;
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined") return;
		const deadline = autoStart ? startSession(Date.now()) : readDeadline();
		if (deadline === null) {
			setSession(sessionState(null, Date.now()));
			const nextEligibleAt = readNextEligibleAt();
			setBlockedUntil(nextEligibleAt);
			if (autoStart) blockedRef.current?.(nextEligibleAt);
			return;
		}
		setBlockedUntil(null);
		let timer;
		const tick = () => {
			const next = sessionState(deadline, Date.now());
			setSession(next);
			if (next.phase === "ending" && !warnedRef.current) {
				warnedRef.current = true;
				warnRef.current?.(next);
			}
			if (next.phase === "expired") {
				if (!expiredRef.current) {
					expiredRef.current = true;
					endSession();
					expireRef.current?.();
				}
				return;
			}
			timer = setTimeout(tick, next.remainingMs <= 18e4 ? 1e3 : 15e3);
		};
		tick();
		return () => clearTimeout(timer);
	}, [autoStart]);
	return {
		session,
		blockedUntil,
		end: (0, import_react.useCallback)(() => {
			expiredRef.current = true;
			endSession();
			setSession(sessionState(null, Date.now()));
		}, [])
	};
}
//#endregion
export { useDemoSession as a, DemoSidebarNav as i, DemoControlNav as n, DemoSessionBadge as r, ChatShell as t };

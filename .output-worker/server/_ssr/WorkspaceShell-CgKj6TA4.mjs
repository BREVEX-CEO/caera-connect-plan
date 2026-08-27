import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { n as useAppearance } from "./use-appearance-DRtxpe7r.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-BvyzyYvI.mjs";
import { _ as Link, u as useRouterState, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Search, Bt as LogIn, Cr as ArrowRight, D as SlidersHorizontal, En as Earth, Gt as ListChecks, L as Settings, M as ShieldCheck, Nt as MessageSquare, Ot as MonitorCog, T as Sparkles, Tt as Monitor, V as ScrollText, Xt as Laptop, _r as Bell, er as ChevronUp, gt as PanelLeft, ht as PanelRight, o as Waves, pn as FolderOpen, q as RotateCcw, t as X, ur as Building2, wr as ArrowLeft, wt as Moon, x as Sun, zt as LogOut } from "../_libs/lucide-react.mjs";
import { n as chooseRenderTier } from "./universe-CvRdDAaW.mjs";
import { i as closeActiveCompanionSession } from "./tauri-companion-u0J6qjWn.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as useSession } from "./session-Bq1TXK1R.mjs";
import { i as recordAction } from "./actions-DvPqa8hX.mjs";
import { t as BrandMark } from "./BrandMark-C9Qs_Jak.mjs";
import { d as subscribeToRuns, n as describeRuns } from "./runs-Dy-PZWN-.mjs";
import { n as useShell, t as ShellContext } from "./use-shell-Cq7UAbK1.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/WorkspaceShell-CgKj6TA4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Three-step welcome, shown once per account after the first sign-in.
*
* It is a tour, not a gate: nothing is stored on the server and skipping loses
* nothing. The seen flag is per account AND per device so a shared browser does
* not swallow the next person's welcome.
*/
var STEPS = [
	{
		icon: MessageSquare,
		title: "Ask OCADE anything",
		body: "OCADE is your assistant for text, documents and images. Start typing in the composer — conversations are saved so you can return to them later."
	},
	{
		icon: ShieldCheck,
		title: "You choose where data lives",
		body: "Each kind of data is either Browser Only, encrypted on this device, or Private Sync, stored against your account. Change it any time in Settings → Privacy."
	},
	{
		icon: Laptop,
		title: "Continue on any device",
		body: "Sign in on your phone or another computer and synced work follows you. Up to two desktops and two phones can be active at once."
	}
];
function storageKey(userId) {
	return `caera.welcome-tour.v1.${userId}`;
}
function WelcomeTour() {
	const { user, loading } = useSession();
	const [step, setStep] = (0, import_react.useState)(0);
	const [open, setOpen] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		if (loading || !user) return;
		try {
			if (window.localStorage.getItem(storageKey(user.id)) === "seen") return;
		} catch {}
		setOpen(true);
	}, [loading, user]);
	function close() {
		if (user) try {
			window.localStorage.setItem(storageKey(user.id), "seen");
		} catch {}
		setOpen(false);
	}
	if (!open) return null;
	const current = STEPS[step];
	const Icon = current.icon;
	const last = step === STEPS.length - 1;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center",
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "welcome-tour-title",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md rounded-xl border border-border/70 bg-background/95 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)]",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-white/[0.04]",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
						className: "h-4 w-4 text-primary",
						"aria-hidden": true
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "welcome-tour-title",
					className: "mt-4 text-lg font-semibold tracking-tight",
					children: current.title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-[13px] leading-6 text-muted-foreground",
					children: current.body
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 flex items-center justify-between gap-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex gap-1.5",
						"aria-hidden": true,
						children: STEPS.map((s, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-1.5 rounded-full transition-all ${index === step ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/40"}` }, s.title))
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: close,
							children: last ? "Close" : "Skip"
						}), last ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							asChild: true,
							onClick: close,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/ocade",
								children: "Start with OCADE"
							})
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							onClick: () => setStep((value) => value + 1),
							children: "Next"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "sr-only",
					children: `Step ${step + 1} of ${STEPS.length}`
				})
			]
		})
	});
}
var DEFAULT_REVEAL = {
	rootMargin: "0px 0px -12% 0px",
	threshold: .05,
	once: true
};
/**
* Whether motion should run at all on this device, for this user.
*
* The order is a policy: an explicit preference for less motion always wins
* over a capability check, because a user who asked for stillness on a fast
* machine still asked for stillness.
*/
function motionAllowed(input) {
	if (input.hasDom === false) return false;
	if (input.reducedMotion || input.osReducedMotion) return false;
	if (input.tier === "static") return false;
	return true;
}
/** True when this browser can actually drive the reveal. */
function canObserve(scope = globalThis) {
	return typeof scope.IntersectionObserver === "function";
}
/**
* The class names a revealable element carries.
*
* `revealHidden` is applied only by JavaScript, never by the stylesheet, which
* is what guarantees the content cannot be stranded invisible.
*/
var REVEAL_CLASS = "ocade-reveal";
var REVEAL_HIDDEN_CLASS = "ocade-reveal-hidden";
/**
* Staggered delay for a group of siblings, in milliseconds.
*
* Capped so a long list does not end with items waiting a second and a half to
* appear — past about five steps a stagger stops reading as choreography and
* starts reading as lag.
*/
function staggerDelay(index, step = 60, max = 5) {
	return Math.min(index, max) * step;
}
/**
* Build the controller that hides and later reveals elements.
*
* Returns a controller whose `observe` is a no-op when motion is off, so
* callers never branch on it and can never accidentally hide an element on a
* path that will not reveal it.
*/
function createRevealController(enabled, options = {}, scope = globalThis) {
	const settings = {
		...DEFAULT_REVEAL,
		...options
	};
	const tracked = /* @__PURE__ */ new Set();
	const show = (element) => {
		element.classList.remove(REVEAL_HIDDEN_CLASS);
	};
	if (!enabled || !canObserve(scope)) return {
		observe: () => {},
		revealAll: () => {},
		disconnect: () => {}
	};
	let observer;
	try {
		observer = new scope.IntersectionObserver((entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				show(entry.target);
				if (settings.once) {
					observer.unobserve(entry.target);
					tracked.delete(entry.target);
				}
			}
		}, {
			rootMargin: settings.rootMargin,
			threshold: settings.threshold
		});
	} catch {
		return {
			observe: () => {},
			revealAll: () => {},
			disconnect: () => {}
		};
	}
	return {
		observe(element) {
			if (!element || tracked.has(element)) return;
			try {
				observer.observe(element);
			} catch {
				return;
			}
			tracked.add(element);
			element.classList.add(REVEAL_HIDDEN_CLASS);
			const rect = element.getBoundingClientRect();
			const viewportHeight = scope.innerHeight || 0;
			if (rect.top < viewportHeight && rect.bottom > 0) {
				show(element);
				if (settings.once) {
					observer.unobserve(element);
					tracked.delete(element);
				}
			}
		},
		revealAll() {
			for (const element of tracked) show(element);
			tracked.clear();
			observer.disconnect();
		},
		disconnect() {
			for (const element of tracked) show(element);
			tracked.clear();
			observer.disconnect();
		}
	};
}
/**
* Scroll reveal for any part of the application.
*
* Usage is one ref on each element that should rise into view:
*
*   const reveal = useReveal();
*   <section {...reveal.props(0)}>…</section>
*   <section {...reveal.props(1)}>…</section>
*
* The index is the stagger position. Everything else — whether motion is
* allowed at all, whether this device can carry it, cleanup — is handled here,
* so no caller can produce the stranded-invisible-content failure by forgetting
* a branch. See `reveal.ts` for why that failure drives the whole design.
*/
function useReveal(options = {}) {
	const { reducedMotion, osReducedMotion } = useAppearance();
	const enabled = motionAllowed({
		reducedMotion,
		osReducedMotion,
		tier: (0, import_react.useMemo)(() => {
			if (typeof window === "undefined") return "static";
			const nav = navigator;
			return chooseRenderTier({
				reducedMotion: reducedMotion || osReducedMotion,
				cores: nav.hardwareConcurrency,
				memoryGb: nav.deviceMemory,
				viewportWidth: window.innerWidth
			});
		}, [reducedMotion, osReducedMotion]),
		hasDom: typeof window !== "undefined"
	});
	const controllerRef = (0, import_react.useRef)(null);
	const optionsKey = JSON.stringify(options);
	(0, import_react.useEffect)(() => {
		const controller = createRevealController(enabled, JSON.parse(optionsKey));
		controllerRef.current = controller;
		return () => {
			controller.disconnect();
			controllerRef.current = null;
		};
	}, [enabled, optionsKey]);
	const ref = (0, import_react.useCallback)((element) => {
		controllerRef.current?.observe(element);
	}, []);
	const props = (0, import_react.useCallback)((index = 0) => ({
		ref,
		className: REVEAL_CLASS,
		style: { "--reveal-delay": `${staggerDelay(index)}ms` }
	}), [ref]);
	return (0, import_react.useMemo)(() => ({
		ref,
		props,
		enabled
	}), [
		ref,
		props,
		enabled
	]);
}
/**
* Applies scroll reveal to the direct children of a region.
*
* WHY A SCOPE AND NOT A PROP ON EVERY SECTION. Motion should be a property of
* the application, not something each page opts into one element at a time.
* Threading a ref through every section of every route guarantees pages get
* missed, and a product where half the screens animate and half do not looks
* unfinished rather than restrained. One wrapper per shell covers every route
* that renders inside it, including routes written later.
*
* DIRECT CHILDREN ONLY, and deliberately. Revealing nested elements would
* animate the same content twice and stagger a paragraph away from its own
* heading. The unit of motion is the section a reader's eye arrives at.
*
* The wrapper renders no element of its own — `display: contents` — so
* inserting it cannot disturb a grid or flex layout the page already relies on.
*/
function MotionScope({ children }) {
	const reveal = useReveal();
	const hostRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		const host = hostRef.current;
		if (!host || !reveal.enabled) return;
		const scan = () => {
			let index = 0;
			for (const child of Array.from(host.children)) {
				if (!(child instanceof HTMLElement)) continue;
				child.classList.add("ocade-reveal");
				child.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 60}ms`);
				reveal.ref(child);
				index += 1;
			}
		};
		scan();
		const watcher = new MutationObserver(scan);
		watcher.observe(host, { childList: true });
		return () => watcher.disconnect();
	}, [reveal]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		ref: hostRef,
		style: { display: "contents" },
		children
	});
}
/**
* Permanent, always-visible label indicating the current view is Demo Mode.
* Never conditionally hidden — it is the contract with the visitor.
*/
function DemoBadge({ className, floating = false }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
		role: "status",
		"aria-label": "Demo mode active",
		className: cn("pointer-events-none inline-flex items-center gap-1.5 rounded-full border border-[color:var(--state-warning)]/40 bg-[color:var(--state-warning)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--state-warning)]", floating && "fixed bottom-3 right-3 z-50 shadow-lg shadow-[color:var(--state-warning)]/10 sm:bottom-4 sm:right-4", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "h-1.5 w-1.5 rounded-full bg-[color:var(--state-warning)]" }), "Demo"]
	});
}
/**
* "OCADE is still doing something, and it is not on this screen."
*
* A task the user is watching needs no badge — the panel in front of them is
* already the status. This appears only once they have navigated away from it,
* which is the moment "is that still running?" becomes a real question with no
* answer anywhere else in the product.
*
* It says how many and what kind, never which model, file or engine: the words
* come from the imported task label so the pill and the task list cannot drift
* into describing the same work two different ways.
*/
function RunningTasksPill({ className }) {
	const [runs, setRuns] = (0, import_react.useState)([]);
	(0, import_react.useEffect)(() => subscribeToRuns(setRuns), []);
	const { label, needsAttention } = describeRuns(runs);
	if (!label) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
		to: "/ocade/tasks",
		"aria-label": needsAttention ? `${label} — paused and waiting for you. Open tasks.` : `${label} running in the background. Open tasks.`,
		className: cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			"aria-hidden": true,
			className: cn("h-1.5 w-1.5 rounded-full", needsAttention ? "bg-[color:var(--state-warning)]" : "animate-pulse bg-primary motion-reduce:animate-none")
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "max-w-32 truncate",
			children: needsAttention ? `${label} paused` : label
		})]
	});
}
/**
* Provider for the workspace shell context.
*
* The context object, its type and `useShell` live in `./use-shell` — see the
* note there for why the split exists.
*/
function ShellProvider({ children }) {
	const [contextualNav, setContextualNav] = (0, import_react.useState)(null);
	const [copilotOpen, setCopilotOpen] = (0, import_react.useState)(false);
	const [copilotContent, setCopilotContent] = (0, import_react.useState)(null);
	const value = (0, import_react.useMemo)(() => ({
		contextualNav,
		setContextualNav,
		copilotOpen,
		setCopilotOpen,
		copilotContent,
		setCopilotContent
	}), [
		contextualNav,
		copilotOpen,
		copilotContent
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShellContext.Provider, {
		value,
		children
	});
}
/** Every destination below has a route file. */
var COMMAND_ENTRIES = [
	{
		to: "/ocade",
		label: "Chat",
		group: "Primary",
		keywords: "conversation ask"
	},
	{
		to: "/ocade/projects",
		label: "Projects",
		group: "Primary",
		keywords: "folders workspace"
	},
	{
		to: "/ocade/work",
		label: "Control + Work",
		group: "Primary",
		keywords: "pc computer control agent"
	},
	{
		to: "/ocade/code",
		label: "Code",
		group: "Primary",
		keywords: "terminal shell repository"
	},
	{
		to: "/ocade/automations",
		label: "Automations",
		group: "Tools",
		keywords: "schedule recurring"
	},
	{
		to: "/ocade/artifacts",
		label: "Files & artifacts",
		group: "Tools",
		keywords: "outputs exports files"
	},
	{
		to: "/ocade/tasks",
		label: "Tasks",
		group: "Tools",
		keywords: "runs queue pause stop"
	},
	{
		to: "/ocade/inbox",
		label: "Inbox",
		group: "Tools",
		keywords: "approvals outcomes notifications"
	},
	{
		to: "/ocade/search",
		label: "Search",
		group: "Tools",
		keywords: "messages projects outputs universal"
	},
	{
		to: "/ocade/monitors",
		label: "Monitors",
		group: "Tools",
		keywords: "watch alerts sources"
	},
	{
		to: "/ocade/studio",
		label: "Studio",
		group: "Tools",
		keywords: "creative documents reports apps"
	},
	{
		to: "/ocade/models",
		label: "Models",
		group: "System",
		keywords: "local intelligence engines providers"
	},
	{
		to: "/ocade/devices",
		label: "Devices",
		group: "System",
		keywords: "approved revoke machine phone"
	},
	{
		to: "/ocade/connectors",
		label: "Connectors",
		group: "System",
		keywords: "browser cloud sync integrations"
	},
	{
		to: "/ocade/permissions",
		label: "Permissions",
		group: "System",
		keywords: "approval privacy access"
	},
	{
		to: "/ocade/activity",
		label: "Activity",
		group: "System",
		keywords: "logs audit history"
	},
	{
		to: "/ocade/health",
		label: "Health",
		group: "System",
		keywords: "status capability diagnostics"
	},
	{
		to: "/ocade/lab",
		label: "Lab",
		group: "System",
		keywords: "engineering diagnostics research sandbox"
	},
	{
		to: "/settings",
		label: "Settings",
		group: "System",
		keywords: "preferences account"
	}
];
function filterCommands(entries, query) {
	const q = query.trim().toLowerCase();
	if (!q) return entries;
	return entries.filter((entry) => `${entry.label} ${entry.group} ${entry.keywords ?? ""} ${entry.to}`.toLowerCase().includes(q));
}
function tabbables(root) {
	if (!root) return [];
	return Array.from(root.querySelectorAll("button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])")).filter((node) => !node.hasAttribute("hidden") && node.getAttribute("aria-hidden") !== "true");
}
function CommandPalette({ open, onClose }) {
	const navigate = useNavigate();
	const [query, setQuery] = (0, import_react.useState)("");
	const [active, setActive] = (0, import_react.useState)(0);
	const inputRef = (0, import_react.useRef)(null);
	const dialogRef = (0, import_react.useRef)(null);
	const returnFocusRef = (0, import_react.useRef)(null);
	const results = (0, import_react.useMemo)(() => filterCommands(COMMAND_ENTRIES, query), [query]);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		returnFocusRef.current = document.activeElement;
		setQuery("");
		setActive(0);
		const id = requestAnimationFrame(() => inputRef.current?.focus());
		return () => {
			cancelAnimationFrame(id);
			requestAnimationFrame(() => returnFocusRef.current?.focus());
		};
	}, [open]);
	(0, import_react.useEffect)(() => setActive(0), [query]);
	if (!open) return null;
	const go = (entry) => {
		if (!entry) return;
		onClose();
		navigate({ to: entry.to });
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-[100] flex items-start justify-center bg-black/60 p-4 pt-[12vh]",
		onMouseDown: (event) => event.target === event.currentTarget && onClose(),
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			ref: dialogRef,
			role: "dialog",
			"aria-modal": "true",
			"aria-label": "Command palette",
			className: "w-full max-w-lg overflow-hidden rounded-xl border border-border/60 bg-popover shadow-2xl",
			onKeyDown: (event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					onClose();
				} else if (event.key === "ArrowDown") {
					event.preventDefault();
					setActive((index) => results.length ? (index + 1) % results.length : 0);
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					setActive((index) => results.length ? (index - 1 + results.length) % results.length : 0);
				} else if (event.key === "Enter") {
					event.preventDefault();
					go(results[active]);
				} else if (event.key === "Tab") {
					const nodes = tabbables(dialogRef.current);
					if (!nodes.length) return;
					const first = nodes[0];
					const last = nodes[nodes.length - 1];
					if (event.shiftKey && document.activeElement === first) {
						event.preventDefault();
						last.focus();
					} else if (!event.shiftKey && document.activeElement === last) {
						event.preventDefault();
						first.focus();
					}
				}
			},
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					ref: inputRef,
					value: query,
					onChange: (event) => setQuery(event.target.value),
					role: "combobox",
					"aria-expanded": "true",
					"aria-controls": "command-palette-list",
					"aria-autocomplete": "list",
					"aria-activedescendant": results[active] ? `command-option-${active}` : void 0,
					placeholder: "Go to…",
					"aria-label": "Search pages",
					className: "w-full border-b border-border/60 bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					id: "command-palette-list",
					role: "listbox",
					"aria-label": "Pages",
					className: "max-h-[50vh] overflow-y-auto py-1",
					children: results.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "px-4 py-6 text-center text-sm text-muted-foreground",
						children: [
							"Nothing here matches “",
							query,
							"”."
						]
					}) : results.map((entry, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						id: `command-option-${index}`,
						role: "option",
						"aria-selected": index === active,
						onMouseEnter: () => setActive(index),
						onMouseDown: (event) => {
							event.preventDefault();
							go(entry);
						},
						className: cn("flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm", index === active ? "bg-accent text-foreground" : "text-muted-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: entry.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-[11px] uppercase tracking-wide opacity-60",
							children: entry.group
						})]
					}, entry.to))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center justify-between border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "↑ ↓ navigate · Enter open · Esc close" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Ctrl/⌘ K" })]
				})
			]
		})
	});
}
function readHistoryReach(nav) {
	if (!nav || typeof nav.canGoBack !== "boolean" || typeof nav.canGoForward !== "boolean") return {
		canGoBack: true,
		canGoForward: true,
		measured: false
	};
	return {
		canGoBack: nav.canGoBack,
		canGoForward: nav.canGoForward,
		measured: true
	};
}
function useHistoryReach() {
	const [reach, setReach] = (0, import_react.useState)({
		canGoBack: true,
		canGoForward: true,
		measured: false
	});
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined") return;
		const nav = window.navigation;
		const sync = () => setReach(readHistoryReach(nav));
		sync();
		if (!nav?.addEventListener) return;
		nav.addEventListener("navigatesuccess", sync);
		nav.addEventListener("currententrychange", sync);
		window.addEventListener("popstate", sync);
		return () => {
			nav.removeEventListener?.("navigatesuccess", sync);
			nav.removeEventListener?.("currententrychange", sync);
			window.removeEventListener("popstate", sync);
		};
	}, []);
	return reach;
}
/** Single source of truth for workspace navigation. */
var MODULES = [
	{
		id: "ocade",
		label: "OCADE",
		to: "/ocade",
		icon: MessageSquare,
		match: ["/ocade", "/home"]
	},
	{
		id: "ficia",
		label: "FICIA",
		to: "/ficia",
		icon: Building2,
		match: ["/ficia"]
	},
	{
		id: "madee",
		label: "MADEE",
		to: "/madee",
		icon: Sparkles,
		match: ["/madee"]
	},
	{
		id: "cania",
		label: "CANIA",
		to: "/cania",
		icon: Earth,
		match: ["/cania"]
	}
];
var UTILITY = [{
	id: "devices",
	label: "Devices",
	to: "/ocade/devices",
	icon: Monitor,
	match: ["/ocade/devices", "/settings/devices"]
}, {
	id: "settings",
	label: "Settings",
	to: "/settings",
	icon: Settings,
	match: ["/settings"]
}];
function activeModule(pathname) {
	if (pathname.startsWith("/settings/devices")) return "devices";
	if (pathname.startsWith("/settings")) return "settings";
	for (const module of MODULES) if (module.match.some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"))) return module.id;
	return "ocade";
}
/**
* SEVEN DESTINATIONS, AND WHY IT IS SEVEN.
*
* The sidebar held twelve: Chat, Projects, Control + Work, Code, Automations,
* Files, Tasks, Inbox, Search, Monitors, Studio, System. Every one of them is a
* real screen, and together they read as a sitemap rather than a place to work
* — a person opening OCADE for the first time had to decide, before typing
* anything, which of twelve rooms their question belonged in. That is a
* decision the product should be making for them.
*
* What is left is the set somebody uses in a normal week, in the order they
* reach for it. Everything removed from the rail is still there, still routed,
* and reachable three ways: from More, from Cmd/Ctrl+K, and — increasingly —
* by asking for it in Chat, which now has the tools to do the thing rather than
* point at the screen that does it.
*
* Code, Studio, Monitors, Automations, Files and Inbox are the six that moved.
* None of them is minor; all six are places a person goes deliberately, having
* already decided. The rail is for the ones you reach for without deciding.
*/
var MODULE_CONTEXT = {
	ocade: [
		{
			to: "/ocade",
			label: "Chat",
			icon: MessageSquare,
			exact: true
		},
		{
			to: "/ocade/work",
			label: "Work",
			icon: MonitorCog
		},
		{
			to: "/ocade/projects",
			label: "Projects",
			icon: FolderOpen
		},
		{
			to: "/ocade/search",
			label: "Search",
			icon: Search
		},
		{
			to: "/ocade/tasks",
			label: "Tasks",
			icon: ListChecks
		},
		{
			to: "/ocade/devices",
			label: "Devices",
			icon: Monitor
		},
		{
			to: "/ocade/system",
			label: "More",
			icon: SlidersHorizontal
		}
	],
	ficia: [],
	madee: [],
	cania: [],
	devices: [{
		to: "/ocade/devices",
		label: "OCADE Devices",
		icon: Monitor,
		exact: true
	}, {
		to: "/settings/devices",
		label: "Device settings",
		icon: Settings
	}],
	settings: [
		{
			to: "/settings",
			label: "General",
			icon: Settings,
			exact: true
		},
		{
			to: "/settings/privacy",
			label: "Privacy",
			icon: Settings
		},
		{
			to: "/settings/vault",
			label: "Storage",
			icon: Settings
		},
		{
			to: "/settings/activity",
			label: "Activity",
			icon: Settings
		},
		{
			to: "/settings/appearance",
			label: "Appearance",
			icon: Settings
		}
	]
};
var DEMO_MODULES = [{
	id: "ocade",
	label: "OCADE",
	to: "/demo/ocade",
	icon: MessageSquare,
	match: ["/demo"]
}];
var COLLAPSE_KEY = "caera:shell:collapsed";
/**
* The one OCADE workspace shell (Plan §37).
*
* Structure: compact module rail → contextual navigation → spacious workspace →
* adaptive Copilot panel. Chrome is deliberately neutral — graphite ground,
* silver text, black structural lines, no coloured accent — so content leads.
* Below `md` the sidebar becomes a drawer; the workspace never crowds.
*/
function WorkspaceShell(props) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShellProvider, { children: props.variant === "demo" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkspaceShellInner, {
		...props,
		user: null
	}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AccountWorkspaceShell, { ...props }) });
}
function AccountWorkspaceShell(props) {
	const { user } = useSession();
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WorkspaceShellInner, {
		...props,
		user
	});
}
function WorkspaceShellInner({ children, variant = "app", onDemoReset, onDemoExit, user }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const navigate = useNavigate();
	const { theme, update } = useAppearance();
	const shell = useShell();
	const isDemo = variant === "demo";
	const reach = useHistoryReach();
	const [collapsed, setCollapsed] = (0, import_react.useState)(() => {
		if (typeof window === "undefined") return false;
		return window.localStorage.getItem(COLLAPSE_KEY) === "1";
	});
	const [drawerOpen, setDrawerOpen] = (0, import_react.useState)(false);
	const [mobileNavigation, setMobileNavigation] = (0, import_react.useState)(() => typeof window === "undefined" ? false : window.matchMedia("(max-width: 767px)").matches);
	const [accountOpen, setAccountOpen] = (0, import_react.useState)(false);
	const [paletteOpen, setPaletteOpen] = (0, import_react.useState)(false);
	const [accountError, setAccountError] = (0, import_react.useState)(null);
	const accountRef = (0, import_react.useRef)(null);
	const navigationRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (typeof window === "undefined") return;
		window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
	}, [collapsed]);
	(0, import_react.useEffect)(() => {
		const query = window.matchMedia("(max-width: 767px)");
		const sync = () => setMobileNavigation(query.matches);
		sync();
		query.addEventListener?.("change", sync);
		return () => query.removeEventListener?.("change", sync);
	}, []);
	(0, import_react.useEffect)(() => {
		setDrawerOpen(false);
		setAccountOpen(false);
	}, [pathname]);
	(0, import_react.useEffect)(() => {
		function closeTransientUi(event) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setPaletteOpen((v) => !v);
				return;
			}
			if (event.key !== "Escape") return;
			setDrawerOpen(false);
			setAccountOpen(false);
			shell?.setCopilotOpen(false);
		}
		function closeAccountOnOutsidePointer(event) {
			if (accountRef.current?.contains(event.target)) return;
			setAccountOpen(false);
		}
		window.addEventListener("keydown", closeTransientUi);
		window.addEventListener("pointerdown", closeAccountOnOutsidePointer);
		return () => {
			window.removeEventListener("keydown", closeTransientUi);
			window.removeEventListener("pointerdown", closeAccountOnOutsidePointer);
		};
	}, [shell]);
	(0, import_react.useEffect)(() => {
		if (drawerOpen) navigationRef.current?.focus();
	}, [drawerOpen]);
	const modules = isDemo ? DEMO_MODULES : MODULES;
	const current = activeModule(pathname);
	const contextItems = isDemo ? [] : MODULE_CONTEXT[current] ?? [];
	function cycleTheme() {
		update({ theme: theme === "dark" ? "light" : theme === "light" ? "real" : "dark" });
	}
	/**
	* Send the top-bar search where a search actually exists.
	*
	* It used to open CANIA's search page — a different product, and now not a
	* product at all. What OCADE really has is the conversation filter in its own
	* sidebar, so this navigates there and puts the cursor in it. The label says
	* "Search chats" rather than "Search workspace" because chats are what it
	* searches; the wider label promised documents and projects too.
	*/
	function openChatSearch() {
		navigate({ to: "/ocade" }).then(() => {
			requestAnimationFrame(() => {
				document.getElementById("ocade-chat-search")?.focus();
			});
		});
	}
	const ThemeIcon = theme === "light" ? Sun : theme === "real" ? Waves : Moon;
	const initials = user?.user_metadata?.preferred_name ?? user?.user_metadata?.full_name ?? user?.email ?? "Account";
	const accountInitials = initials.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "CC";
	async function signOut() {
		setAccountError(null);
		recordAction({ actionId: "auth.sign_out" });
		try {
			await closeActiveCompanionSession();
		} catch (error) {
			setAccountError(error instanceof Error ? `The local companion session could not confirm closure: ${error.message}` : "The local companion session could not confirm closure.");
		}
		try {
			const { error } = await supabase.auth.signOut();
			if (error) throw error;
			await navigate({
				to: "/auth",
				replace: true
			});
		} catch (error) {
			setAccountError(error instanceof Error ? error.message : "Sign out failed.");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-screen flex-col bg-background text-foreground",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", {
				href: "#main-content",
				className: "skip-link",
				children: "Skip to content"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "sticky top-0 z-40 flex h-12 items-center gap-1 border-b border-border/70 bg-background/95 px-2 backdrop-blur",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => {
							if (mobileNavigation) setDrawerOpen((v) => !v);
							else setCollapsed((v) => !v);
						},
						"aria-label": "Toggle navigation",
						"aria-controls": "workspace-navigation",
						"aria-expanded": mobileNavigation ? drawerOpen : !collapsed,
						className: "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelLeft, {
							className: "h-4 w-4",
							"aria-hidden": true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-1 hidden h-4 w-px bg-border/70 md:block" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => typeof window !== "undefined" && window.history.back(),
						disabled: !reach.canGoBack,
						"aria-label": "Back",
						title: reach.canGoBack ? "Back" : "Nothing to go back to",
						className: "hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 md:inline-flex",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, {
							className: "h-4 w-4",
							"aria-hidden": true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						onClick: () => typeof window !== "undefined" && window.history.forward(),
						disabled: !reach.canGoForward,
						"aria-label": "Forward",
						title: reach.canGoForward ? "Forward" : "Nothing to go forward to",
						className: "hidden h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40 md:inline-flex",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowRight, {
							className: "h-4 w-4",
							"aria-hidden": true
						})
					}),
					isDemo || !user ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-2 hidden h-8 max-w-md flex-1 items-center gap-2 rounded-md border border-border/70 bg-secondary/40 px-2.5 text-xs text-muted-foreground md:inline-flex",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Search — available after sign-in" })]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: openChatSearch,
						className: "ml-2 hidden h-8 max-w-md flex-1 items-center gap-2 rounded-md border border-border/70 bg-secondary/40 px-2.5 text-xs text-muted-foreground hover:bg-secondary md:inline-flex",
						"aria-label": "Search chats",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
							className: "h-3.5 w-3.5",
							"aria-hidden": true
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Search chats" })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "ml-auto flex items-center gap-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RunningTasksPill, {}),
							isDemo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DemoBadge, {}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: cycleTheme,
								"aria-label": `Theme: ${theme}. Change theme.`,
								className: "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ThemeIcon, {
									className: "h-4 w-4",
									"aria-hidden": true
								})
							}),
							isDemo ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
								to: "/auth",
								className: "inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogIn, {
									className: "h-3.5 w-3.5",
									"aria-hidden": true
								}), " Sign in"]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/settings/activity",
								"aria-label": "Activity and notifications",
								className: "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, {
									className: "h-4 w-4",
									"aria-hidden": true
								})
							}), shell?.copilotContent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								onClick: () => shell.setCopilotOpen(!shell.copilotOpen),
								"aria-label": "Toggle Copilot panel",
								"aria-expanded": shell.copilotOpen,
								"aria-controls": "copilot-desktop-panel copilot-mobile-panel",
								className: cn("inline-flex h-8 w-8 items-center justify-center rounded-md", shell.copilotOpen ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PanelRight, {
									className: "h-4 w-4",
									"aria-hidden": true
								})
							}) : null] })
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-h-0 flex-1",
				children: [
					drawerOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						"aria-label": "Close navigation",
						className: "fixed inset-0 z-30 bg-background/70 backdrop-blur-sm md:hidden",
						onClick: () => setDrawerOpen(false)
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
						ref: navigationRef,
						id: "workspace-navigation",
						tabIndex: -1,
						"aria-label": "Workspace navigation",
						className: cn("z-40 flex shrink-0 flex-col border-r border-border/70 bg-sidebar transition-[width] duration-150", "fixed inset-y-0 left-0 top-12 md:sticky md:top-12 md:h-[calc(100vh-3rem)]", collapsed ? "w-[68px]" : "w-[264px]", drawerOpen ? "flex" : "hidden md:flex"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: cn("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4"),
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
									to: isDemo ? "/" : "/home",
									"aria-label": "CARCC CADANE home",
									className: "inline-flex",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(BrandMark, { className: collapsed ? "[&_.flex-col]:hidden" : "" })
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
								className: "flex-1 overflow-y-auto px-2 py-3",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavList, {
										items: modules,
										pathname,
										collapsed
									}),
									!collapsed && contextItems.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-5 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70",
										children: modules.find((m) => m.id === current)?.label ?? "Section"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ContextList, {
										items: contextItems,
										pathname
									})] }) : null,
									!collapsed && shell?.contextualNav ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "mt-3",
										children: shell.contextualNav
									}) : null,
									!isDemo ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "my-4 border-t border-sidebar-border/70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NavList, {
										items: UTILITY,
										pathname,
										collapsed
									})] }) : null
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								ref: accountRef,
								className: cn("relative border-t border-sidebar-border p-2", collapsed && "flex justify-center"),
								children: isDemo ? collapsed ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex gap-1",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: onDemoReset,
										className: "flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RotateCcw, {
											className: "h-3.5 w-3.5",
											"aria-hidden": true
										}), " Reset"]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
										onClick: onDemoExit,
										className: "flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border/60 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
											className: "h-3.5 w-3.5",
											"aria-hidden": true
										}), " Exit"]
									})]
								}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [accountOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									role: "menu",
									"aria-label": "Account menu",
									className: cn("absolute bottom-[calc(100%+0.25rem)] z-50 w-56 rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl", collapsed ? "left-2" : "left-2 right-2"),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
											className: "border-b border-border/60 px-2 py-2",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "truncate text-xs font-medium",
												children: initials
											}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
												className: "truncate text-[10px] text-muted-foreground",
												children: user?.email ?? user?.phone ?? "Signed-in account"
											})]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
											role: "menuitem",
											to: "/settings",
											className: "mt-1 flex h-8 items-center gap-2 rounded-md px-2 text-xs hover:bg-accent",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, {
												className: "h-3.5 w-3.5",
												"aria-hidden": true
											}), " Settings"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
											role: "menuitem",
											to: "/settings/devices",
											className: "flex h-8 items-center gap-2 rounded-md px-2 text-xs hover:bg-accent",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Monitor, {
												className: "h-3.5 w-3.5",
												"aria-hidden": true
											}), " Devices"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
											role: "menuitem",
											to: "/settings/activity",
											className: "flex h-8 items-center gap-2 rounded-md px-2 text-xs hover:bg-accent",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ScrollText, {
												className: "h-3.5 w-3.5",
												"aria-hidden": true
											}), " Activity"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
											role: "menuitem",
											type: "button",
											onClick: () => void signOut(),
											className: "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs hover:bg-accent",
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogOut, {
												className: "h-3.5 w-3.5",
												"aria-hidden": true
											}), " Sign out"]
										}),
										accountError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
											role: "alert",
											className: "px-2 py-1 text-[10px] text-destructive",
											children: accountError
										}) : null
									]
								}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									title: "Account menu",
									"aria-label": "Account menu",
									"aria-haspopup": "menu",
									"aria-expanded": accountOpen,
									onClick: () => setAccountOpen((open) => !open),
									className: cn("flex items-center gap-2.5 rounded-md text-[13px] text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground", collapsed ? "h-9 w-9 justify-center" : "h-10 w-full px-3"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border/70 text-[10px] font-medium",
										children: accountInitials
									}), !collapsed ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "min-w-0 flex-1 truncate text-left",
										children: "Account"
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronUp, {
										className: "h-3.5 w-3.5",
										"aria-hidden": true
									})] }) : null]
								})] })
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
						id: "main-content",
						tabIndex: -1,
						className: "min-w-0 flex-1 focus:outline-none",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "ocade-scene mx-auto w-full max-w-6xl px-6 py-8 sm:px-10",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MotionScope, { children })
						}), isDemo ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(WelcomeTour, {})]
					}),
					shell?.copilotOpen && shell.copilotContent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("aside", {
						id: "copilot-desktop-panel",
						"aria-label": "Desktop Copilot",
						className: "hidden w-[340px] shrink-0 border-l border-border/70 bg-sidebar/60 lg:block",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto p-4",
							children: shell.copilotContent
						})
					}) : null,
					shell?.copilotOpen && shell.copilotContent ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						role: "dialog",
						"aria-modal": "true",
						"aria-label": "Desktop Copilot",
						className: "fixed inset-0 z-50 lg:hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": "Close Copilot panel",
							tabIndex: -1,
							onClick: () => shell.setCopilotOpen(false),
							className: "absolute inset-0 bg-background/70 backdrop-blur-sm"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
							id: "copilot-mobile-panel",
							className: "absolute inset-y-0 right-0 flex w-[min(92vw,380px)] flex-col border-l border-border bg-sidebar shadow-2xl",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex h-12 items-center justify-between border-b border-border px-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs font-semibold uppercase tracking-[0.12em]",
									children: "Desktop Copilot"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"aria-label": "Close Copilot panel",
									autoFocus: true,
									onClick: () => shell.setCopilotOpen(false),
									className: "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
										className: "h-4 w-4",
										"aria-hidden": true
									})
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "min-h-0 flex-1 overflow-y-auto p-4",
								children: shell.copilotContent
							})]
						})]
					}) : null
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CommandPalette, {
				open: paletteOpen,
				onClose: () => setPaletteOpen(false)
			})
		]
	});
}
function NavList({ items, pathname, collapsed }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-1",
		children: items.map((m) => {
			const active = m.match.some((p) => pathname === p || pathname.startsWith(p + "/"));
			const Icon = m.icon;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: m.to,
				title: m.label,
				className: cn("flex items-center gap-3 rounded-md text-[13px] transition-colors", collapsed ? "h-10 w-10 justify-center mx-auto" : "h-10 px-3", active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: "h-[18px] w-[18px] shrink-0",
					"aria-hidden": true
				}), !collapsed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: m.label
				})]
			}) }, m.id);
		})
	});
}
function ContextList({ items, pathname }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "space-y-0.5",
		children: items.map((n, i) => {
			const Icon = n.icon;
			if (n.planned) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				disabled: true,
				title: n.reason ?? `${n.label} — planned`,
				className: "flex h-9 w-full cursor-not-allowed items-center gap-3 rounded-md px-3 text-[13px] text-muted-foreground/50",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
						className: "h-4 w-4 shrink-0",
						"aria-hidden": true
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate",
						children: n.label
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "ml-auto text-[9px] uppercase tracking-wide",
						children: "Planned"
					})
				]
			}) }, `${n.label}-${i}`);
			const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
			return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: n.to,
				className: cn("flex h-9 items-center gap-3 rounded-md px-3 text-[13px] transition-colors", active ? "bg-sidebar-accent/70 text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
					className: "h-4 w-4 shrink-0",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "truncate",
					children: n.label
				})]
			}) }, `${n.label}-${i}`);
		})
	});
}
//#endregion
export { WorkspaceShell as t };

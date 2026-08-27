import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link, p as Outlet, u as useRouterState, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Search, Tn as ExternalLink, t as X, tr as ChevronRight, wr as ArrowLeft } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-DcG40EU5.mjs";
import { n as useSettingsAccess } from "./use-settings-access-CqrFa1Nj.mjs";
import { t as SETTINGS_GROUPS } from "./settings-sections-4Ej-Ef13.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings-CTvXwmfl.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/** Where the opt-in for the Advanced group is remembered. */
var ADVANCED_KEY = "ocade.settings.advanced.v1";
function slugToPath(slug) {
	return slug ? `/settings/${slug}` : "/settings";
}
function currentSlug(pathname) {
	if (pathname === "/settings" || pathname === "/settings/") return "";
	const m = pathname.match(/^\/settings\/([^/]+)/);
	return m ? m[1] : "";
}
function SettingsShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const navigate = useNavigate();
	const active = currentSlug(pathname);
	const [query, setQuery] = (0, import_react.useState)("");
	const { canEdit: signedIn } = useSettingsAccess();
	const [showAdvanced, setShowAdvanced] = (0, import_react.useState)(() => {
		if (typeof window === "undefined") return false;
		try {
			return window.localStorage.getItem(ADVANCED_KEY) === "1";
		} catch {
			return false;
		}
	});
	const toggleAdvanced = () => {
		setShowAdvanced((current) => {
			const next = !current;
			try {
				window.localStorage.setItem(ADVANCED_KEY, next ? "1" : "0");
			} catch {}
			return next;
		});
	};
	const filteredGroups = (0, import_react.useMemo)(() => {
		const q = query.trim().toLowerCase();
		const groups = SETTINGS_GROUPS.filter((g) => !g.advanced || showAdvanced || q.length > 0);
		if (!q) return groups;
		return groups.map((g) => ({
			...g,
			items: g.items.filter((i) => {
				return [
					i.label,
					i.description,
					...i.keywords ?? []
				].join(" ").toLowerCase().includes(q);
			})
		})).filter((g) => g.items.length > 0);
	}, [query, showAdvanced]);
	const onList = active === "" && (pathname === "/settings" || pathname === "/settings/");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-[calc(100vh-3rem)] flex-col md:flex-row md:gap-0",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: cn("ocade-depth depth-floating flex w-full flex-col border-b border-border/60 bg-sidebar/40 md:sticky md:top-12 md:h-[calc(100vh-3rem)] md:w-[260px] md:shrink-0 md:border-b-0 md:border-r", !onList ? "hidden md:flex" : "flex"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "border-b border-border/50 px-3 pb-3 pt-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground",
							children: "Account"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-0.5 text-[15px] font-semibold text-foreground",
							children: "Settings"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "relative mt-3",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
									className: "pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground",
									"aria-hidden": true
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
									type: "search",
									value: query,
									onChange: (e) => setQuery(e.target.value),
									placeholder: "Search settings",
									"aria-label": "Search settings",
									className: "h-8 w-full rounded-md border border-border/60 bg-background/70 pl-7 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
								}),
								query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									onClick: () => setQuery(""),
									"aria-label": "Clear search",
									className: "absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
										className: "h-3 w-3",
										"aria-hidden": true
									})
								}) : null
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
					className: "flex-1 overflow-y-auto px-2 py-2 ocade-scroll",
					children: [filteredGroups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "px-2 py-6 text-center text-xs text-muted-foreground",
						children: [
							"No settings match “",
							query,
							"”."
						]
					}) : filteredGroups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80",
							children: group.label
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "space-y-0.5",
							children: group.items.map((item) => {
								const isActive = item.slug === active;
								const Icon = item.icon;
								return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: slugToPath(item.slug),
									className: cn("ocade-depth ocade-depth-lift depth-base", "group flex h-8 items-center gap-2 rounded-md px-2 text-[13px] transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"),
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
											className: "h-3.5 w-3.5 shrink-0",
											"aria-hidden": true
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "min-w-0 flex-1 truncate",
											children: item.label
										}),
										item.status === "external" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ExternalLink, {
											className: "h-3 w-3 opacity-60",
											"aria-hidden": true
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
											className: cn("h-3 w-3 opacity-0 transition-opacity", isActive ? "opacity-70" : "group-hover:opacity-40"),
											"aria-hidden": true
										})
									]
								}) }, item.slug || "__general__");
							})
						})]
					}, group.id)), !query ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: toggleAdvanced,
						"aria-pressed": showAdvanced,
						className: "mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11.5px] text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
							className: cn("h-3 w-3 transition-transform", showAdvanced && "rotate-90"),
							"aria-hidden": true
						}), showAdvanced ? "Hide advanced" : "Show advanced"]
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "border-t border-border/50 px-3 py-2",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => navigate({ to: signedIn ? "/home" : "/" }),
						className: "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
							className: "h-3 w-3",
							"aria-hidden": true
						}), " Close settings"]
					})
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			"aria-label": "Settings content",
			className: cn("ocade-depth depth-raised min-w-0 flex-1", onList ? "hidden md:block" : "block"),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto w-full max-w-3xl px-5 py-6 sm:px-8",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mb-3 md:hidden",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/settings",
						className: "inline-flex min-h-[24px] items-center gap-1 px-1 py-1 text-xs text-muted-foreground hover:text-foreground",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowLeft, {
							className: "h-3 w-3",
							"aria-hidden": true
						}), " All settings"]
					})
				}), children]
			})
		})]
	});
}
function SettingsLayout() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShellNoPad, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Outlet, {}) }) });
}
function AppShellNoPad({ children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "-mx-6 -my-8 sm:-mx-10",
		children
	}) });
}
//#endregion
export { SettingsLayout as component };

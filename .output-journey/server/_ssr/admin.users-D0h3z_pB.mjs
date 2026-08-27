import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-YIOAnk22.mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Search, Jt as LifeBuoy, Wt as LoaderCircle, l as Users } from "../_libs/lucide-react.mjs";
import { t as AppShell } from "./AppShell-DcG40EU5.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as useQuery } from "../_libs/tanstack__react-query.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.users-D0h3z_pB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function formatDate(value) {
	if (!value) return "—";
	return new Date(value).toLocaleDateString(void 0, {
		year: "numeric",
		month: "short",
		day: "numeric"
	});
}
function AdminUsersPage() {
	const [query, setQuery] = (0, import_react.useState)("");
	const accounts = useQuery({
		queryKey: ["admin", "accounts"],
		queryFn: async () => {
			const [profiles, roles] = await Promise.all([supabase.from("profiles").select("id, display_name, email, phone, country, onboarding_completed, created_at").order("created_at", { ascending: false }).limit(500), supabase.from("user_roles").select("user_id, role")]);
			if (profiles.error) throw profiles.error;
			if (roles.error) throw roles.error;
			const roleMap = /* @__PURE__ */ new Map();
			for (const r of roles.data ?? []) roleMap.set(r.user_id, [...roleMap.get(r.user_id) ?? [], r.role]);
			return (profiles.data ?? []).map((p) => ({
				...p,
				roles: roleMap.get(p.id) ?? ["user"]
			}));
		}
	});
	const tickets = useQuery({
		queryKey: ["admin", "open-tickets"],
		queryFn: async () => {
			const { data, error } = await supabase.from("ocade_support_tickets").select("id, user_id, subject, status, priority, last_message_at").not("status", "in", "(resolved,closed)").order("last_message_at", { ascending: false }).limit(100);
			if (error) throw error;
			return data ?? [];
		}
	});
	const filtered = (0, import_react.useMemo)(() => {
		const q = query.trim().toLowerCase();
		const rows = accounts.data ?? [];
		if (!q) return rows;
		return rows.filter((r) => [
			r.display_name,
			r.email,
			r.phone,
			r.country
		].filter(Boolean).some((v) => String(v).toLowerCase().includes(q)));
	}, [accounts.data, query]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Accounts & support",
		description: "Every registered CARCC CADANE profile and the support tickets that are still open."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mb-3 flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "flex items-center gap-2 text-sm font-medium text-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Users, {
							className: "h-4 w-4 text-muted-foreground",
							"aria-hidden": true
						}),
						"Registered accounts",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground",
							children: [
								"(",
								filtered.length,
								")"
							]
						})
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 rounded-md border border-border/70 bg-background/50 px-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
						className: "h-3.5 w-3.5 text-muted-foreground",
						"aria-hidden": true
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: query,
						onChange: (e) => setQuery(e.target.value),
						placeholder: "Search name, email, phone",
						"aria-label": "Search accounts",
						className: "w-52 bg-transparent py-1.5 text-xs text-foreground outline-none placeholder:text-muted-foreground"
					})]
				})]
			}), accounts.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-2 py-8 text-sm text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Loading accounts…"]
			}) : accounts.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				role: "alert",
				className: "rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive",
				children: "Accounts could not be loaded. Your admin role may have changed."
			}) : filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "py-8 text-sm text-muted-foreground",
				children: "No accounts match that search."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full text-left text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-muted-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-border/60",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Person"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Contact"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Roles"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 pr-3 font-medium",
									children: "Onboarded"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "py-2 font-medium",
									children: "Joined"
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: filtered.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-border/30 last:border-0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pr-3 text-foreground",
								children: row.display_name ?? "—"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
								className: "py-2 pr-3 text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: row.email ?? "—" }), row.phone ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: row.phone }) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pr-3 text-muted-foreground",
								children: row.roles.join(", ")
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pr-3 text-muted-foreground",
								children: row.onboarding_completed ? "Yes" : "No"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 text-muted-foreground",
								children: formatDate(row.created_at)
							})
						]
					}, row.id)) })]
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "mb-3 flex items-center gap-2 text-sm font-medium text-foreground",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LifeBuoy, {
							className: "h-4 w-4 text-muted-foreground",
							"aria-hidden": true
						}),
						"Open support tickets",
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "text-xs text-muted-foreground",
							children: [
								"(",
								tickets.data?.length ?? 0,
								")"
							]
						})
					]
				}),
				tickets.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 py-6 text-sm text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }), " Loading tickets…"]
				}) : tickets.error ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-destructive",
					children: "Tickets could not be loaded."
				}) : (tickets.data ?? []).length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "py-6 text-sm text-muted-foreground",
					children: "No open tickets right now."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-col gap-2",
					children: (tickets.data ?? []).map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "rounded-md border border-border/50 bg-background/40 p-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium text-foreground",
							children: t.subject
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-[11px] uppercase tracking-wide text-muted-foreground",
							children: [
								t.status,
								" · ",
								t.priority,
								" · ",
								formatDate(t.last_message_at)
							]
						})]
					}, t.id))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/admin/support",
					className: "mt-3 inline-flex text-xs text-primary underline underline-offset-4",
					children: "Open the support queue to reply →"
				})
			]
		})]
	})] });
}
//#endregion
export { AdminUsersPage as component };

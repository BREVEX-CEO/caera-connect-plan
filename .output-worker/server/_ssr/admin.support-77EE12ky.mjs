import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-BvyzyYvI.mjs";
import { Wt as LoaderCircle, tn as Inbox, z as Send } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as AppShell } from "./AppShell-DYEjrpCe.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/admin.support-77EE12ky.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AdminSupportPage() {
	const qc = useQueryClient();
	const [filter, setFilter] = (0, import_react.useState)("active");
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const [reply, setReply] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const tickets = useQuery({
		queryKey: ["support-tickets", "admin"],
		queryFn: async () => {
			const { data, error } = await supabase.from("ocade_support_tickets").select("id, user_id, subject, category, priority, status, last_message_at").order("priority", { ascending: false }).order("last_message_at", { ascending: true });
			if (error) throw error;
			return data ?? [];
		}
	});
	const visible = (0, import_react.useMemo)(() => {
		const all = tickets.data ?? [];
		if (filter === "all") return all;
		if (filter === "active") return all.filter((ticket) => !["resolved", "closed"].includes(ticket.status));
		return all.filter((ticket) => ticket.status === filter);
	}, [filter, tickets.data]);
	const selected = tickets.data?.find((ticket) => ticket.id === selectedId) ?? null;
	const messages = useQuery({
		queryKey: ["support-messages", selectedId],
		enabled: Boolean(selectedId),
		queryFn: async () => {
			const { data, error } = await supabase.from("ocade_support_messages").select("id, author_role, body, created_at").eq("ticket_id", selectedId).order("created_at", { ascending: true });
			if (error) throw error;
			return data ?? [];
		}
	});
	async function setStatus(status) {
		if (!selectedId) return;
		setBusy(true);
		const { error } = await supabase.from("ocade_support_tickets").update({
			status,
			updated_at: (/* @__PURE__ */ new Date()).toISOString()
		}).eq("id", selectedId);
		setBusy(false);
		if (error) return toast.error(error.message);
		await qc.invalidateQueries({ queryKey: ["support-tickets", "admin"] });
	}
	async function sendReply() {
		if (!selectedId || reply.trim().length < 2) return;
		setBusy(true);
		try {
			const { data } = await supabase.auth.getUser();
			if (!data.user) throw new Error("Sign in again before replying.");
			const { error } = await supabase.from("ocade_support_messages").insert({
				ticket_id: selectedId,
				author_id: data.user.id,
				author_role: "support",
				body: reply.trim()
			});
			if (error) throw error;
			setReply("");
			await Promise.all([qc.invalidateQueries({ queryKey: ["support-messages", selectedId] }), qc.invalidateQueries({ queryKey: ["support-tickets", "admin"] })]);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Reply could not be sent.");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		title: "Customer support queue",
		description: "Sort cases, review the complete history, ask for safe details and close resolved work."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-4 xl:grid-cols-[0.85fr_1.4fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
					className: "flex items-center gap-2 text-sm font-semibold",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Inbox, { className: "h-4 w-4" }),
						" Queue (",
						visible.length,
						")"
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
					value: filter,
					onChange: (event) => setFilter(event.target.value),
					className: "rounded-lg border border-border bg-background px-2 py-1 text-xs",
					"aria-label": "Filter support queue",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "active",
							children: "Active"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "open",
							children: "Open"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "in_progress",
							children: "In progress"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "needs_customer",
							children: "Needs customer"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "resolved",
							children: "Resolved"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "closed",
							children: "Closed"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
							value: "all",
							children: "All"
						})
					]
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 space-y-2",
				children: visible.map((ticket) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-pressed": selectedId === ticket.id,
					onClick: () => setSelectedId(ticket.id),
					className: cn("w-full rounded-xl border p-3 text-left", selectedId === ticket.id ? "border-primary/45 bg-primary/[0.06]" : "border-border/60"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "block text-sm font-medium",
						children: ticket.subject
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-1 block text-[11px] text-muted-foreground",
						children: [
							ticket.priority,
							" · ",
							ticket.category,
							" · ",
							ticket.status.replace(/_/g, " ")
						]
					})]
				}, ticket.id))
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
			className: "flex min-h-[34rem] flex-col p-4",
			children: selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-sm font-semibold",
						children: selected.subject
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-[11px] text-muted-foreground",
						children: [
							selected.id.slice(0, 8).toUpperCase(),
							" · user ",
							selected.user_id.slice(0, 8)
						]
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: selected.status,
						disabled: busy,
						onChange: (event) => void setStatus(event.target.value),
						className: "rounded-lg border border-border bg-background px-2 py-1 text-xs",
						"aria-label": "Case status",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "open",
								children: "Open"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "in_progress",
								children: "In progress"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "needs_customer",
								children: "Needs customer"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "resolved",
								children: "Resolved"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "closed",
								children: "Closed"
							})
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex-1 space-y-3 overflow-y-auto py-4",
					children: [messages.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : null, messages.data?.map((message) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: cn("max-w-[90%] rounded-xl border px-3 py-2 text-sm", message.author_role === "support" ? "ml-auto border-primary/30 bg-primary/[0.05]" : "border-border/60"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: message.body }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-[10px] text-muted-foreground",
							children: [
								message.author_role,
								" · ",
								new Date(message.created_at).toLocaleString()
							]
						})]
					}, message.id))]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2 border-t border-border/60 pt-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
						value: reply,
						onChange: (event) => setReply(event.target.value),
						maxLength: 5e3,
						rows: 3,
						placeholder: "Ask for the minimum safe details needed to resolve this case",
						className: "min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm",
						"aria-label": "Support response"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "icon",
						disabled: busy,
						onClick: () => void sendReply(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "sr-only",
							children: "Send support response"
						})]
					})]
				})
			] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "m-auto text-center text-sm text-muted-foreground",
				children: "Select a case."
			})
		})]
	})] });
}
//#endregion
export { AdminSupportPage as component };

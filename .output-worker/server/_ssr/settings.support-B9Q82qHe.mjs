import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as supabase } from "./client-BvyzyYvI.mjs";
import { Ft as MessageSquarePlus, Jt as LifeBuoy, N as ShieldAlert, Wt as LoaderCircle, z as Send } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { i as useQueryClient, n as useQuery } from "../_libs/tanstack__react-query.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as preflight } from "./preflight-BxhjuTtu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.support-B9Q82qHe.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function unsafeSupportDetail(text) {
	const sensitive = preflight(text).find((finding) => finding.severity !== "medium");
	return sensitive ? `Remove the ${sensitive.kind.replace(/_/g, " ")} before sending. Support never needs credentials or payment secrets.` : null;
}
function SupportPage() {
	const qc = useQueryClient();
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const [creating, setCreating] = (0, import_react.useState)(false);
	const [subject, setSubject] = (0, import_react.useState)("");
	const [category, setCategory] = (0, import_react.useState)("technical");
	const [detail, setDetail] = (0, import_react.useState)("");
	const [reply, setReply] = (0, import_react.useState)("");
	const [busy, setBusy] = (0, import_react.useState)(false);
	const tickets = useQuery({
		queryKey: ["support-tickets", "mine"],
		queryFn: async () => {
			const { data, error } = await supabase.from("ocade_support_tickets").select("id, subject, category, priority, status, last_message_at").order("last_message_at", { ascending: false });
			if (error) throw error;
			return data ?? [];
		}
	});
	const messages = useQuery({
		queryKey: ["support-messages", selectedId],
		enabled: Boolean(selectedId),
		queryFn: async () => {
			const { data, error } = await supabase.from("ocade_support_messages").select("id, author_role, body, created_at").eq("ticket_id", selectedId).order("created_at", { ascending: true });
			if (error) throw error;
			return data ?? [];
		}
	});
	const selected = (0, import_react.useMemo)(() => tickets.data?.find((ticket) => ticket.id === selectedId) ?? null, [selectedId, tickets.data]);
	async function createTicket() {
		const warning = unsafeSupportDetail(`${subject}\n${detail}`);
		if (warning) return toast.error(warning);
		if (subject.trim().length < 5 || detail.trim().length < 2) return toast.error("Add a short subject and describe what happened.");
		setBusy(true);
		try {
			const { data, error } = await supabase.rpc("ocade_create_support_ticket", {
				p_subject: subject.trim(),
				p_category: category,
				p_body: detail.trim()
			});
			if (error) throw error;
			setSubject("");
			setDetail("");
			setCreating(false);
			setSelectedId(data);
			await qc.invalidateQueries({ queryKey: ["support-tickets", "mine"] });
			toast.success("Support request created. Its history stays here.");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Support request could not be created.");
		} finally {
			setBusy(false);
		}
	}
	async function sendReply() {
		if (!selectedId) return;
		const warning = unsafeSupportDetail(reply);
		if (warning) return toast.error(warning);
		if (reply.trim().length < 2) return toast.error("Write a reply first.");
		setBusy(true);
		try {
			const { data: auth } = await supabase.auth.getUser();
			if (!auth.user) throw new Error("Sign in again before replying.");
			const { error } = await supabase.from("ocade_support_messages").insert({
				ticket_id: selectedId,
				author_id: auth.user.id,
				author_role: "customer",
				body: reply.trim()
			});
			if (error) throw error;
			setReply("");
			await Promise.all([qc.invalidateQueries({ queryKey: ["support-messages", selectedId] }), qc.invalidateQueries({ queryKey: ["support-tickets", "mine"] })]);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Reply could not be sent.");
		} finally {
			setBusy(false);
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			title: "Customer support",
			description: "Create a case, answer follow-up questions and keep the complete history with your account."
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-4 xl:grid-cols-[0.85fr_1.35fr]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h2", {
							className: "flex items-center gap-2 text-sm font-semibold",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LifeBuoy, {
								className: "h-4 w-4",
								"aria-hidden": true
							}), " Your cases"]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "sm",
							onClick: () => setCreating((value) => !value),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquarePlus, {
								className: "mr-1.5 h-3.5 w-3.5",
								"aria-hidden": true
							}), " New case"]
						})]
					}),
					creating ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 space-y-3 rounded-xl border border-primary/25 bg-primary/[0.04] p-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								value: subject,
								onChange: (event) => setSubject(event.target.value),
								maxLength: 120,
								placeholder: "Short subject",
								"aria-label": "Support subject",
								className: "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								value: category,
								onChange: (event) => setCategory(event.target.value),
								"aria-label": "Support category",
								className: "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "account",
										children: "Account"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "billing",
										children: "Billing"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "technical",
										children: "Technical"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "privacy",
										children: "Privacy"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "security",
										children: "Security"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "feedback",
										children: "Feedback"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "legal",
										children: "Legal"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "investor",
										children: "Investor"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
										value: "partnership",
										children: "Partnership"
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: detail,
								onChange: (event) => setDetail(event.target.value),
								maxLength: 5e3,
								rows: 5,
								placeholder: "What happened, what you expected, and the exact safe-to-share details",
								"aria-label": "Support details",
								className: "w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								disabled: busy,
								onClick: () => void createTicket(),
								children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-3.5 w-3.5 animate-spin" }) : null, "Create case"]
							})
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 space-y-2",
						children: [
							tickets.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : null,
							tickets.data?.map((ticket) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								"aria-pressed": selectedId === ticket.id,
								onClick: () => setSelectedId(ticket.id),
								className: cn("w-full rounded-xl border p-3 text-left transition-colors", selectedId === ticket.id ? "border-primary/45 bg-primary/[0.07]" : "border-border/60 hover:bg-white/[0.03]"),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "block text-sm font-medium",
									children: ticket.subject
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "mt-1 block text-[11px] text-muted-foreground",
									children: [
										ticket.category,
										" · ",
										ticket.status.replace(/_/g, " "),
										" · ",
										ticket.priority
									]
								})]
							}, ticket.id)),
							!tickets.isLoading && tickets.data?.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "py-6 text-center text-xs text-muted-foreground",
								children: "No support cases yet."
							}) : null
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GlassPanel, {
				className: "flex min-h-[28rem] flex-col p-4",
				children: selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "border-b border-border/60 pb-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-semibold",
							children: selected.subject
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-1 text-xs text-muted-foreground",
							children: [
								"Case ",
								selected.id.slice(0, 8).toUpperCase(),
								" ·",
								" ",
								selected.status.replace(/_/g, " ")
							]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "flex-1 space-y-3 overflow-y-auto py-4",
						children: messages.data?.map((message) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: cn("max-w-[88%] rounded-xl border px-3 py-2 text-sm", message.author_role === "support" ? "border-primary/30 bg-primary/[0.05]" : "ml-auto border-border/60 bg-white/[0.025]"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: message.body }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-2 text-[10px] text-muted-foreground",
								children: [
									message.author_role === "support" ? "OCADE Support" : "You",
									" ·",
									` `,
									new Date(message.created_at).toLocaleString()
								]
							})]
						}, message.id))
					}),
					selected.status !== "closed" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2 border-t border-border/60 pt-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
							value: reply,
							onChange: (event) => setReply(event.target.value),
							maxLength: 5e3,
							rows: 2,
							placeholder: "Reply with safe-to-share details",
							"aria-label": "Support reply",
							className: "min-w-0 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							size: "icon",
							disabled: busy,
							onClick: () => void sendReply(),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, {
								className: "h-4 w-4",
								"aria-hidden": true
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "sr-only",
								children: "Send reply"
							})]
						})]
					}) : null
				] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "m-auto max-w-sm text-center",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LifeBuoy, {
							className: "mx-auto h-8 w-8 text-primary",
							"aria-hidden": true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "mt-3 font-semibold",
							children: "Select a support case"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-2 text-xs leading-5 text-muted-foreground",
							children: "Replies and status changes appear here. The complete thread remains available as your copy."
						})
					]
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "mt-4 flex items-start gap-2 rounded-xl border border-[color:var(--state-warning)]/30 bg-[color:var(--state-warning)]/[0.06] p-3 text-xs text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]" }), "Never send passwords, one-time codes, Aadhaar or PAN images, full card numbers, UPI PINs, recovery codes or API secrets. The composer blocks common credential formats locally before submission."]
		})
	] });
}
//#endregion
export { SupportPage as component };

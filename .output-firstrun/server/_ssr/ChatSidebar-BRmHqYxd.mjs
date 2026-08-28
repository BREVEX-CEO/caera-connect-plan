import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { B as Search, Nt as MessageSquare, ct as Pin, it as Plus, t as X } from "../_libs/lucide-react.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ChatSidebar-BRmHqYxd.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var DAY = 1440 * 60 * 1e3;
function groupConversations(conversations, now = Date.now()) {
	const pinned = [];
	const today = [];
	const yesterday = [];
	const week = [];
	const older = [];
	for (const c of conversations) {
		if (c.pinned) {
			pinned.push(c);
			continue;
		}
		const at = Date.parse(c.updatedAt);
		const age = Number.isFinite(at) ? now - at : Number.POSITIVE_INFINITY;
		if (age < DAY) today.push(c);
		else if (age < 2 * DAY) yesterday.push(c);
		else if (age < 7 * DAY) week.push(c);
		else older.push(c);
	}
	return [
		{
			label: "Pinned",
			items: pinned
		},
		{
			label: "Today",
			items: today
		},
		{
			label: "Yesterday",
			items: yesterday
		},
		{
			label: "Previous 7 days",
			items: week
		},
		{
			label: "Older",
			items: older
		}
	].filter((b) => b.items.length > 0);
}
function ChatSidebar({ conversations, activeId, onSelect, onNewChat, renderRowMenu, footer, primaryAction, emptyLabel = "No conversations yet." }) {
	const [query, setQuery] = (0, import_react.useState)("");
	const filtered = (0, import_react.useMemo)(() => {
		const q = query.trim().toLowerCase();
		if (!q) return conversations;
		return conversations.filter((c) => c.title.toLowerCase().includes(q) || (c.projectName ?? "").toLowerCase().includes(q));
	}, [conversations, query]);
	const buckets = (0, import_react.useMemo)(() => groupConversations(filtered), [filtered]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-0 flex-col",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-2 p-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: onNewChat,
					className: "inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[13px] font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
						className: "h-4 w-4",
						"aria-hidden": true
					}), "New chat"]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
							className: "pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground",
							"aria-hidden": true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							htmlFor: "ocade-chat-search",
							className: "sr-only",
							children: "Search conversations"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							id: "ocade-chat-search",
							type: "search",
							value: query,
							onChange: (e) => setQuery(e.target.value),
							placeholder: "Search chats",
							className: "h-8 w-full rounded-lg border border-border/60 bg-background/50 pl-8 pr-7 text-[13px] text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-[color:var(--accent-ocade)]/50"
						}),
						query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setQuery(""),
							"aria-label": "Clear search",
							className: "absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "h-3 w-3" })
						}) : null
					]
				})]
			}),
			primaryAction ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-3 pb-3",
				children: primaryAction
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				"aria-label": "Conversations",
				className: "min-h-0 flex-1 overflow-y-auto px-2 pb-2",
				children: buckets.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-2 py-6 text-center text-[13px] text-muted-foreground",
					children: query ? `No chats match “${query}”.` : emptyLabel
				}) : buckets.map((bucket) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "mb-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground",
						children: bucket.label
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "space-y-0.5",
						children: bucket.items.map((c) => {
							const active = c.id === activeId;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "group relative",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
									type: "button",
									onClick: onSelect ? () => onSelect(c.id) : void 0,
									"aria-current": active ? "page" : void 0,
									className: cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"),
									children: [c.pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Pin, {
										className: "h-3 w-3 shrink-0 text-[color:var(--accent-ocade)]",
										"aria-hidden": true
									}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, {
										className: "h-3.5 w-3.5 shrink-0 opacity-60",
										"aria-hidden": true
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "min-w-0 flex-1 truncate",
										children: c.title || "New chat"
									})]
								}), renderRowMenu ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "absolute right-1 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
									children: renderRowMenu(c)
								}) : null]
							}, c.id);
						})
					})]
				}, bucket.label))
			}),
			footer ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "border-t border-border/60 p-2",
				children: footer
			}) : null
		]
	});
}
//#endregion
export { ChatSidebar as t };

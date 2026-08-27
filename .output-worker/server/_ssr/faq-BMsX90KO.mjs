import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Search, rr as ChevronDown, t as X } from "../_libs/lucide-react.mjs";
import { n as PublicPage } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/faq-BMsX90KO.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var FAQ_GROUPS = [
	{
		title: "Account and sign-in",
		items: [
			{
				q: "How do I sign in?",
				a: "OCADE supports Google, phone or email one-time codes, and email with password when the production identity service is connected. If that service is unavailable or misconfigured, sign-in fails closed and says which configuration is missing."
			},
			{
				q: "I forgot my password. What now?",
				a: "Use “Forgot password?” on the sign-in screen. When production email delivery is configured, the identity service sends a reset link. OCADE never claims that a message was delivered unless the provider accepts the request."
			},
			{
				q: "Google sign-in failed or I cancelled it. Is something broken?",
				a: "Cancelling the Google window returns you to sign-in without creating a session. A failure can also mean a blocked pop-up, rate limit or incomplete production configuration; OCADE shows the available cause instead of silently treating it as success."
			}
		]
	},
	{
		title: "Sync across devices",
		items: [
			{
				q: "Do my chats appear on my phone and my computer?",
				a: "Private Sync is designed to carry conversations across signed-in devices, but only when the verified production data service is connected. Browser Only and PC Vault remain device-local. OCADE does not present an unverified or wrong backend as successful sync."
			},
			{
				q: "What is Browser Only mode?",
				a: "Browser Only keeps that data class in encrypted storage on the current device and never sends it to the cloud. It is genuinely private, and the trade-off is real: that data does not follow you to another device, and clearing browser storage removes it."
			},
			{
				q: "How many devices can I use?",
				a: "The current product policy allows two desktop and two mobile device records per account. You can name, approve and revoke them in Settings → Devices when Private Sync is connected; device-local modes do not pretend to update another device."
			},
			{
				q: "Something is missing on my second device.",
				a: "Check the privacy mode for that data class in Settings → Privacy. Anything marked Browser Only stays on the device that created it, by design."
			}
		]
	},
	{
		title: "Billing and plans",
		items: [
			{
				q: "Which payment methods can I use?",
				a: "None are active during free launch. The pricing page shows the planned card, UPI and PayPal pathways for transparency, but checkout remains locked until provider, legal and production-account verification is complete."
			},
			{
				q: "How do I change or cancel my plan?",
				a: "There is no paid plan to change or cancel during free launch. Settings → Billing shows readiness and planned plan controls, but it cannot create, renew or cancel a paid entitlement while payment authority is locked."
			},
			{
				q: "My payment succeeded but the plan has not changed yet.",
				a: "OCADE cannot accept a live payment during free launch. If you are seeing a payment claim now, do not retry or send credentials; contact support with the provider receipt. Future entitlement changes must wait for a verified signed provider event rather than trusting the browser redirect."
			}
		]
	},
	{
		title: "Technical and privacy",
		items: [
			{
				q: "Who is OCADE?",
				a: "OCADE is the assistant built by CARCC CADANE. It answers as OCADE by CARCC CADANE. If you ask directly which engine is running a request, it tells you truthfully, and the technical detail lives in the model settings."
			},
			{
				q: "Can OCADE control my computer?",
				a: "Only what you permit, and only what the current environment genuinely allows. In the browser it can act through the OCADE extension you approve. Operating-system control requires the native companion; until that is connected, the app says so rather than pretending an action happened."
			},
			{
				q: "Can I delete my account and data?",
				a: "Settings → Account provides the deletion control. It removes device-local OCADE data directly and asks the connected production service to delete account-held records and the sign-in identity. OCADE reports completion only after that service returns a verified result; otherwise it tells you what remains."
			}
		]
	}
];
function filterFaqGroups(groups, query) {
	const needle = query.trim().toLocaleLowerCase();
	if (!needle) return groups;
	return groups.map((group) => ({
		...group,
		items: group.items.filter((item) => `${group.title} ${item.q} ${item.a}`.toLocaleLowerCase().includes(needle))
	})).filter((group) => group.items.length > 0);
}
/**
* Public FAQ.
*
* Answers only describe behaviour that exists today. Where a capability is
* still provider- or platform-dependent, the answer says so rather than
* implying it already works.
*/
function FaqPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Help centre",
		title: "Frequently asked questions",
		summary: "Short answers about accounts, syncing between devices, billing and how your data is handled. If something here does not cover your case, the support form reaches a person.",
		structuredData: {
			"@context": "https://schema.org",
			"@type": "FAQPage",
			mainEntity: FAQ_GROUPS.flatMap((group) => group.items.map((item) => ({
				"@type": "Question",
				name: item.q,
				acceptedAnswer: {
					"@type": "Answer",
					text: item.a
				}
			})))
		},
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FaqDirectory, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-2xl border border-white/7 bg-white/[0.018] p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-lg font-semibold tracking-tight",
					children: "Still stuck?"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-muted-foreground",
					children: "Use the contact form. It reports whether your message was accepted instead of promising delivery before the support service confirms it."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
					to: "/support",
					className: "mt-4 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90",
					children: "Contact support"
				})
			]
		})]
	});
}
function topicId(title) {
	return `faq-${title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}
function FaqDirectory() {
	const [query, setQuery] = (0, import_react.useState)("");
	const groups = (0, import_react.useMemo)(() => filterFaqGroups(FAQ_GROUPS, query), [query]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-8",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "rounded-2xl border border-white/7 bg-white/[0.018] p-4 sm:p-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
					htmlFor: "faq-search",
					className: "text-sm font-medium text-foreground",
					children: "Search questions and answers"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "relative mt-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
							className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground",
							"aria-hidden": true
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
							id: "faq-search",
							type: "search",
							value: query,
							onChange: (event) => setQuery(event.target.value),
							placeholder: "Try “offline”, “sign in” or “payment”",
							className: "h-11 w-full rounded-xl border border-white/10 bg-black/20 pl-10 pr-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
						}),
						query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setQuery(""),
							"aria-label": "Clear FAQ search",
							className: "absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
								className: "h-4 w-4",
								"aria-hidden": true
							})
						}) : null
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
					"aria-label": "FAQ topics",
					className: "mt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground",
						children: "Browse by topic"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-2 flex flex-wrap gap-2",
						children: groups.map((group) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: `#${topicId(group.title)}`,
							className: "rounded-full border border-white/10 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
							children: [
								group.title,
								" (",
								group.items.length,
								")"
							]
						}, group.title))
					})]
				})
			]
		}), groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			role: "status",
			className: "rounded-2xl border border-white/7 p-6 text-center",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "font-semibold text-foreground",
					children: "No matching questions"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-sm text-muted-foreground",
					children: "Try a shorter term or clear the search to browse every topic."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setQuery(""),
					className: "mt-4 rounded-md border border-white/10 px-3 py-2 text-sm text-foreground hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: "Show all questions"
				})
			]
		}) : groups.map((group) => {
			const id = topicId(group.title);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				id,
				className: "scroll-mt-24",
				"aria-labelledby": `${id}-title`,
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: `${id}-title`,
					className: "text-xl font-semibold tracking-tight",
					children: group.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 divide-y divide-white/7 overflow-hidden rounded-2xl border border-white/7 bg-white/[0.018]",
					children: group.items.map((item, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FaqRow, {
						item,
						id: `${id}-question-${index + 1}`
					}, item.q))
				})]
			}, group.title);
		})]
	});
}
function FaqRow({ item, id }) {
	const [open, setOpen] = (0, import_react.useState)(false);
	const answerId = `${id}-answer`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		id,
		className: "scroll-mt-24",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			"aria-expanded": open,
			"aria-controls": answerId,
			onClick: () => setOpen((v) => !v),
			className: "flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-[14px] font-medium text-foreground transition-colors hover:bg-white/[0.03]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.q }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, {
				"aria-hidden": true,
				className: `h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`
			})]
		}) }), open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			id: answerId,
			className: "px-4 pb-4 text-muted-foreground",
			children: item.a
		}) : null]
	});
}
//#endregion
export { FaqDirectory, FaqPage as component };

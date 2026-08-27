import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { B as Search, t as X } from "../_libs/lucide-react.mjs";
import { n as PublicPage } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/search-Bu76N_lu.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var PUBLIC_SEARCH_INDEX = [
	{
		id: "company",
		title: "CARCC CADANE company information",
		summary: "Verified pre-launch facts about the Bengaluru venture behind OCADE, its current legal status and planned launch.",
		category: "Company",
		href: "/company",
		keywords: [
			"company",
			"brand",
			"Bengaluru",
			"launch",
			"incorporation"
		]
	},
	{
		id: "founder",
		title: "Haans Antoni — founder profile",
		summary: "The official founder record for HAANS ANTONI, CEO, Chairman and Founder of the CARCC CADANE venture.",
		category: "Company",
		href: "/founder/haans-antoni",
		keywords: [
			"founder",
			"leadership",
			"CEO",
			"chairman",
			"Haans Antoni"
		]
	},
	{
		id: "ocade",
		title: "OCADE product overview",
		summary: "How OCADE combines local inference, optional private synchronization and permissioned computer work.",
		category: "Product",
		href: "/products/ocade",
		keywords: [
			"OCADE",
			"local AI",
			"private",
			"offline",
			"computer control"
		],
		priority: 3
	},
	{
		id: "pricing",
		title: "OCADE pricing",
		summary: "Founder-approved reference prices and planned payment methods. Checkout remains locked during free launch.",
		category: "Product",
		href: "/pricing",
		keywords: [
			"price",
			"pricing",
			"plans",
			"free launch",
			"payment"
		]
	},
	{
		id: "blog",
		title: "OCADE journal",
		summary: "Original product and engineering notes about local intelligence, Cowork, privacy and safety.",
		category: "Company",
		href: "/blog",
		keywords: [
			"blog",
			"journal",
			"engineering",
			"product",
			"articles"
		]
	},
	{
		id: "careers",
		title: "Careers at CARCC CADANE",
		summary: "Current pre-launch workstreams, location and an honest statement of hiring and benefits status.",
		category: "Company",
		href: "/careers",
		keywords: [
			"careers",
			"jobs",
			"roles",
			"Bengaluru",
			"benefits"
		]
	},
	{
		id: "compare",
		title: "Compare OCADE",
		summary: "A factual category comparison of OCADE, typical cloud AI workspaces and standalone local runners.",
		category: "Product",
		href: "/compare",
		keywords: [
			"compare",
			"features",
			"differences",
			"local",
			"cloud"
		]
	},
	{
		id: "team",
		title: "CARCC CADANE team",
		summary: "The current non-fictional team record and work areas behind OCADE.",
		category: "Company",
		href: "/team",
		keywords: [
			"team",
			"people",
			"founder",
			"work"
		]
	},
	{
		id: "press",
		title: "CARCC CADANE press kit",
		summary: "Official company facts, OCADE brand assets, key statistics and press-release status.",
		category: "Company",
		href: "/press",
		keywords: [
			"press",
			"media",
			"brand assets",
			"logo",
			"statistics"
		]
	},
	{
		id: "status",
		title: "OCADE status",
		summary: "Current-browser health observations and known pre-launch service dependencies.",
		category: "Help",
		href: "/status",
		keywords: [
			"status",
			"health",
			"incident",
			"uptime",
			"maintenance"
		]
	},
	{
		id: "faq",
		title: "Frequently asked questions",
		summary: "Answers about sign-in, device sync, billing, privacy, browser control and deleting account data.",
		category: "Help",
		href: "/faq",
		keywords: [
			"help",
			"account",
			"sync",
			"billing",
			"privacy",
			"delete"
		]
	},
	{
		id: "support",
		title: "Contact support",
		summary: "Open the support form. It reports whether the service accepted a request instead of promising unverified delivery.",
		category: "Help",
		href: "/settings/support",
		keywords: [
			"support",
			"contact",
			"problem",
			"request",
			"help"
		]
	},
	{
		id: "privacy",
		title: "Privacy Notice",
		summary: "Read the current pre-launch privacy notice, data modes, device permissions and data-rights process.",
		category: "Legal",
		href: "/privacy",
		keywords: [
			"privacy",
			"data",
			"permissions",
			"device only",
			"private sync"
		]
	},
	{
		id: "terms",
		title: "Terms of Service",
		summary: "Read the current pre-launch terms, free-launch boundary and product-use conditions.",
		category: "Legal",
		href: "/terms",
		keywords: [
			"terms",
			"legal",
			"conditions",
			"free launch"
		]
	}
];
function searchPublicPages(query, category, sort) {
	const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
	const scored = PUBLIC_SEARCH_INDEX.filter((entry) => category === "All" || entry.category === category).map((entry) => {
		const title = entry.title.toLocaleLowerCase();
		const haystack = `${entry.title} ${entry.summary} ${entry.keywords.join(" ")}`.toLocaleLowerCase();
		if (terms.some((term) => !haystack.includes(term))) return null;
		return {
			entry,
			score: (entry.priority ?? 0) + terms.reduce((total, term) => total + (title.includes(term) ? 4 : 0) + countOccurrences(haystack, term), 0)
		};
	}).filter((value) => value !== null);
	scored.sort((a, b) => sort === "title" ? a.entry.title.localeCompare(b.entry.title) : b.score - a.score || a.entry.title.localeCompare(b.entry.title));
	return scored.map(({ entry }) => entry);
}
function countOccurrences(text, term) {
	if (!term) return 0;
	let count = 0;
	let position = 0;
	while ((position = text.indexOf(term, position)) >= 0) {
		count += 1;
		position += term.length;
	}
	return count;
}
var CATEGORIES = [
	"All",
	"Company",
	"Product",
	"Help",
	"Legal"
];
var SUGGESTIONS = [
	"local AI",
	"pricing",
	"privacy",
	"founder",
	"account"
];
function PublicSearchPage() {
	const [query, setQuery] = (0, import_react.useState)("");
	const [category, setCategory] = (0, import_react.useState)("All");
	const [sort, setSort] = (0, import_react.useState)("relevance");
	const deferredQuery = (0, import_react.useDeferredValue)(query);
	const searching = query !== deferredQuery;
	const results = (0, import_react.useMemo)(() => searchPublicPages(deferredQuery, category, sort), [
		deferredQuery,
		category,
		sort
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Official directory",
		title: "Search CARCC CADANE",
		summary: "Search the current public product, company, help and legal pages. Results come from this verified site index; OCADE does not send these searches to a third party.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-white/7 bg-white/[0.018] p-4 sm:p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
						htmlFor: "public-search",
						className: "text-sm font-medium text-foreground",
						children: "Search official pages"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative mt-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, {
								"aria-hidden": true,
								className: "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								id: "public-search",
								type: "search",
								value: query,
								onChange: (event) => setQuery(event.target.value),
								placeholder: "Try privacy, pricing or local AI",
								className: "min-h-11 w-full rounded-lg border border-border/70 bg-background/70 py-2 pl-10 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25"
							}),
							query ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-label": "Clear public search",
								onClick: () => setQuery(""),
								className: "absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-white/5 hover:text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
									className: "h-4 w-4",
									"aria-hidden": true
								})
							}) : null
						]
					}),
					!query ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4",
						"aria-label": "Suggested searches",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground",
							children: "Suggested searches"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 flex flex-wrap gap-2",
							children: SUGGESTIONS.map((suggestion) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => setQuery(suggestion),
								className: "min-h-9 rounded-full border border-border/70 px-3 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground",
								children: suggestion
							}, suggestion))
						})]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-5 grid gap-3 sm:grid-cols-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs font-medium text-muted-foreground",
							children: ["Category", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("select", {
								"aria-label": "Search category",
								value: category,
								onChange: (event) => setCategory(event.target.value),
								className: "mt-1 min-h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground",
								children: CATEGORIES.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value,
									children: value
								}, value))
							})]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs font-medium text-muted-foreground",
							children: ["Order", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
								"aria-label": "Search result order",
								value: sort,
								onChange: (event) => setSort(event.target.value),
								className: "mt-1 min-h-10 w-full rounded-lg border border-border/70 bg-background px-3 text-sm text-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "relevance",
									children: "Most relevant"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
									value: "title",
									children: "Title A–Z"
								})]
							})]
						})]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-labelledby": "search-results-heading",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-end justify-between gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "search-results-heading",
						className: "text-xl font-semibold tracking-tight",
						children: "Results"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						role: "status",
						"aria-live": "polite",
						className: "text-xs text-muted-foreground",
						children: searching ? "Searching official pages…" : `${results.length} ${results.length === 1 ? "result" : "results"}`
					})]
				}), results.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
					className: "mt-4 space-y-3",
					children: results.map((result) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: result.href,
						className: "block rounded-2xl border border-white/7 bg-white/[0.018] p-5 transition hover:border-primary/35 hover:bg-white/[0.035]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-primary",
								children: result.category
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mt-1 text-base font-semibold text-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Highlighted, {
									text: result.title,
									query: deferredQuery
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm leading-6 text-muted-foreground",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Highlighted, {
									text: result.summary,
									query: deferredQuery
								})
							})
						]
					}) }, result.id))
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4 rounded-2xl border border-dashed border-border/70 p-6 text-center",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-medium text-foreground",
						children: "No official page matches that search."
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: "Clear the category, try fewer words, or contact support if the information should be public."
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "text-xs text-muted-foreground",
				children: [
					"Directory coverage: ",
					PUBLIC_SEARCH_INDEX.length,
					" verified public pages. Search text stays in this browser."
				]
			})
		]
	});
}
function Highlighted({ text, query }) {
	const terms = query.trim().split(/\s+/).filter(Boolean);
	if (!terms.length) return text;
	const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
	return text.split(pattern).map((part, index) => terms.some((term) => part.localeCompare(term, void 0, { sensitivity: "accent" }) === 0) ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("mark", {
		className: "rounded bg-primary/20 px-0.5 text-foreground",
		children: part
	}, `${part}-${index}`) : part);
}
function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
//#endregion
export { PublicSearchPage as component };

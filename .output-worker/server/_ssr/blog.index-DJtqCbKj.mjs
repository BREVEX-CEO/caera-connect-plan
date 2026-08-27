import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as PublicPage } from "./PublicPage-CTc9xZld.mjs";
import { n as PrelaunchSubscription, r as filterPublicArticles, t as PUBLIC_ARTICLES } from "./public-content-CiFqf64f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/blog.index-DJtqCbKj.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var TAGS = ["All", ...new Set(PUBLIC_ARTICLES.flatMap((article) => article.tags))];
function BlogPage() {
	const [query, setQuery] = (0, import_react.useState)("");
	const [tag, setTag] = (0, import_react.useState)("All");
	const articles = (0, import_react.useMemo)(() => filterPublicArticles(query, tag), [query, tag]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "OCADE journal",
		title: "How OCADE is being built",
		summary: "Original pre-launch notes about local intelligence, supervised computer work, privacy and the evidence required before a production claim is made.",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
			"aria-label": "Journal topics",
			className: "flex flex-wrap gap-2",
			children: TAGS.map((value) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				"aria-pressed": tag === value,
				onClick: () => setTag(value),
				className: `min-h-9 rounded-full border px-3 text-xs ${tag === value ? "border-primary bg-primary/15 text-foreground" : "border-border/70 text-muted-foreground"}`,
				children: value
			}, value))
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-5 lg:grid-cols-[1fr_16rem]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-labelledby": "posts-title",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-end justify-between gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							id: "posts-title",
							className: "text-xl font-semibold",
							children: "Latest posts"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
							className: "text-xs text-muted-foreground",
							children: ["Search posts", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
								type: "search",
								value: query,
								onChange: (event) => setQuery(event.target.value),
								className: "ml-2 min-h-9 rounded-md border border-border/70 bg-background px-3 text-sm text-foreground"
							})]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-4 space-y-4",
						children: [articles.map((article) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
							className: "overflow-hidden rounded-2xl border border-white/7 bg-white/[0.018]",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
								src: article.thumbnail,
								alt: "",
								width: 2172,
								height: 724,
								className: "aspect-[3/1] w-full object-cover"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "p-5",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "flex flex-wrap gap-2 text-[11px] text-primary",
										children: article.tags.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item }, item))
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "mt-2 text-lg font-semibold",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/blog/$slug",
											params: { slug: article.slug },
											className: "inline-flex min-h-6 items-center py-0.5 hover:underline",
											children: article.title
										})
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-sm text-muted-foreground",
										children: article.description
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-3 text-xs text-muted-foreground",
										children: [
											article.author,
											" ·",
											" ",
											new Intl.DateTimeFormat("en-IN", {
												dateStyle: "long",
												timeZone: "UTC"
											}).format(/* @__PURE__ */ new Date(`${article.published}T00:00:00Z`))
										]
									})
								]
							})]
						}, article.slug)), !articles.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "rounded-xl border border-dashed border-border/70 p-5 text-sm text-muted-foreground",
							children: "No published post matches those filters."
						}) : null]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						"aria-label": "Journal pages",
						className: "mt-5 flex justify-between",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: true,
								"aria-label": "Previous page unavailable; there is only one page",
								className: "min-h-9 rounded-md border border-border/70 px-3 text-xs disabled:opacity-40",
								children: "Previous"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-muted-foreground",
								children: "Page 1 of 1"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: true,
								"aria-label": "Next page unavailable; there is only one page",
								className: "min-h-9 rounded-md border border-border/70 px-3 text-xs disabled:opacity-40",
								children: "Next"
							})
						]
					})
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrelaunchSubscription, {})]
		})]
	});
}
//#endregion
export { BlogPage as component };

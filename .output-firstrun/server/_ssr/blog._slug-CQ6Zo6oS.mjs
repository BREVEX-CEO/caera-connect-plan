import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { n as PublicPage } from "./PublicPage-CTc9xZld.mjs";
import { t as Route } from "./blog._slug-rgKjX30A.mjs";
import { i as findPublicArticle, n as PrelaunchSubscription, t as PUBLIC_ARTICLES } from "./public-content-CiFqf64f.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/blog._slug-CQ6Zo6oS.js
var import_jsx_runtime = require_jsx_runtime();
function ArticlePage() {
	const { slug } = Route.useParams();
	const article = findPublicArticle(slug);
	if (!article) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicPage, {
		eyebrow: "Journal",
		title: "Post not found",
		summary: "That OCADE journal entry is not published.",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
			to: "/blog",
			className: "underline",
			children: "Return to the journal"
		})
	});
	const related = PUBLIC_ARTICLES.filter((item) => item.slug !== article.slug);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "OCADE journal",
		title: article.title,
		summary: article.subtitle,
		structuredData: {
			"@context": "https://schema.org",
			"@type": "BlogPosting",
			headline: article.title,
			description: article.description,
			author: {
				"@type": "Person",
				name: article.author
			},
			datePublished: article.published,
			image: article.thumbnail
		},
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("img", {
				src: article.thumbnail,
				alt: "OCADE by CARCC CADANE",
				width: 2172,
				height: 724,
				className: "aspect-[3/1] w-full rounded-2xl object-cover"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-3 text-xs text-muted-foreground",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["By ", article.author] }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("time", {
						dateTime: article.published,
						children: new Intl.DateTimeFormat("en-IN", {
							dateStyle: "long",
							timeZone: "UTC"
						}).format(/* @__PURE__ */ new Date(`${article.published}T00:00:00Z`))
					}),
					article.tags.map((tag) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "rounded-full border border-border/70 px-2 py-0.5",
						children: tag
					}, tag))
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("article", {
				className: "space-y-7",
				children: article.sections.map((section) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-xl font-semibold",
					children: section.heading
				}), section.paragraphs.map((paragraph) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-muted-foreground",
					children: paragraph
				}, paragraph))] }, section.heading))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-labelledby": "share-title",
				className: "rounded-2xl border border-white/7 p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						id: "share-title",
						className: "font-semibold",
						children: "Share this article"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted-foreground",
						children: "Use your browser share menu or copy this page address. OCADE does not post to a social account for you."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => void navigator.clipboard?.writeText(window.location.href),
						className: "mt-3 min-h-9 rounded-md border border-border/70 px-3 text-xs",
						children: "Copy article link"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "rounded-2xl border border-primary/20 bg-primary/[0.06] p-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "text-lg font-semibold",
						children: "Try the product boundary yourself"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted-foreground",
						children: "The no-account demo uses a real local engine when this browser can run one and names the failure when it cannot."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/demo/ocade",
						className: "mt-3 inline-flex min-h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground",
						children: "Open the OCADE demo"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-labelledby": "related-title",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "related-title",
					className: "text-xl font-semibold",
					children: "Related articles"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-3 grid gap-3",
					children: related.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: "/blog/$slug",
						params: { slug: item.slug },
						className: "rounded-xl border border-white/7 p-4 hover:border-primary/35",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium",
							children: item.title
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-1 block text-xs text-muted-foreground",
							children: item.description
						})]
					}, item.slug))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PrelaunchSubscription, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				"aria-labelledby": "comments-title",
				className: "rounded-2xl border border-dashed border-border/70 p-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					id: "comments-title",
					className: "text-lg font-semibold",
					children: "Comments"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-muted-foreground",
					children: "Public comments are closed during pre-launch because account identity, moderation and the correct production data project are not yet verified. No comment count is claimed."
				})]
			})
		]
	});
}
//#endregion
export { ArticlePage as component };

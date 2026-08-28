import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/public-content-CiFqf64f.js
var import_jsx_runtime = require_jsx_runtime();
function PrelaunchSubscription() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		className: "rounded-2xl border border-primary/20 bg-primary/[0.06] p-5",
		"aria-labelledby": "updates-title",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
				id: "updates-title",
				className: "text-lg font-semibold text-foreground",
				children: "Product updates"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				id: "subscription-unavailable-reason",
				className: "mt-2 text-sm text-muted-foreground",
				children: "Email subscription is not accepting addresses yet because the correct production data project and delivery provider are not verified. No address entered here would be stored or sent."
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "mt-4 block text-xs text-muted-foreground",
				children: ["Email address", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "email",
					disabled: true,
					"aria-describedby": "subscription-unavailable-reason",
					placeholder: "Subscriptions open after verification",
					className: "mt-1 min-h-10 w-full rounded-lg border border-border/70 bg-background/50 px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				disabled: true,
				"aria-describedby": "subscription-unavailable-reason",
				className: "mt-3 min-h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-55",
				children: "Subscribe when available"
			})
		]
	});
}
var PUBLIC_ARTICLES = [{
	slug: "why-ocade-starts-local",
	title: "Why OCADE starts local",
	subtitle: "A product boundary, not a privacy slogan",
	description: "How OCADE chooses on-device inference, reports unavailable hardware honestly and keeps public-cloud AI out of the fallback chain.",
	author: "Haans Antoni",
	published: "2026-08-23",
	tags: [
		"Local AI",
		"Privacy",
		"Engineering"
	],
	thumbnail: "/brand/ocade-carcc-wordmark.png",
	sections: [{
		heading: "Local is the default route",
		paragraphs: ["OCADE is designed to generate Chat replies on hardware the user controls. A desktop companion, browser WebGPU engine or processor-compatible browser engine may serve a request when it is genuinely available.", "If none can run, OCADE must explain that state. It does not redirect the conversation to a public AI provider to preserve the appearance of availability."]
	}, {
		heading: "Network use stays specific",
		paragraphs: ["Sign-in, Private Sync, live web retrieval and future payment services still need a network. Those are named network paths with separate permissions and failure states; they are not a hidden inference route."]
	}]
}, {
	slug: "building-stop-into-cowork",
	title: "Building STOP into Cowork",
	subtitle: "Control is only useful when a person can interrupt it",
	description: "Why OCADE treats STOP, PAUSE, TAKE OVER, previews and readback receipts as part of computer work rather than extra controls.",
	author: "Haans Antoni",
	published: "2026-08-23",
	tags: [
		"Cowork",
		"Safety",
		"Product"
	],
	thumbnail: "/brand/ocade-carcc-wordmark.png",
	sections: [{
		heading: "Interruption is a first-class path",
		paragraphs: ["A task that can start but cannot be stopped is not supervised automation. OCADE keeps visible interruption controls beside work and propagates cancellation to the active engine and native worker."]
	}, {
		heading: "Proof comes after action",
		paragraphs: ["A click or command is only an attempted action. OCADE distinguishes that from independent readback, and records a specific failure when the target cannot be verified."]
	}]
}];
function findPublicArticle(slug) {
	return PUBLIC_ARTICLES.find((article) => article.slug === slug);
}
function filterPublicArticles(query, tag) {
	const term = query.trim().toLocaleLowerCase();
	return PUBLIC_ARTICLES.filter((article) => {
		const tagMatches = tag === "All" || article.tags.includes(tag);
		const text = `${article.title} ${article.subtitle} ${article.description} ${article.tags.join(" ")}`.toLocaleLowerCase();
		return tagMatches && (!term || text.includes(term));
	});
}
//#endregion
export { findPublicArticle as i, PrelaunchSubscription as n, filterPublicArticles as r, PUBLIC_ARTICLES as t };

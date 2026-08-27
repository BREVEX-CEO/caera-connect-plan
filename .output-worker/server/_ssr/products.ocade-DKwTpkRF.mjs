import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { n as OCADE_STRUCTURED_DATA, r as PUBLIC_IDENTITY } from "./ssr.mjs";
import { nr as ChevronLeft, tr as ChevronRight } from "../_libs/lucide-react.mjs";
import { n as PublicPage, r as PublicSection } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/products.ocade-DKwTpkRF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var CAPABILITIES = [
	{
		title: "Private local Chat",
		detail: "OCADE routes to an available on-device engine and names an honest unavailable state when this hardware cannot serve the request."
	},
	{
		title: "Permissioned computer work",
		detail: "Control and Cowork paths preview actions, preserve STOP and require a supported signed companion before claiming computer control."
	},
	{
		title: "Device Only or Private Sync",
		detail: "Workspace data can remain local or use the verified private service when it is configured; the product fails closed when that service is missing."
	}
];
function wrapCarouselIndex(index, length) {
	if (length <= 0) return 0;
	return (index % length + length) % length;
}
function CapabilityCarousel() {
	const [index, setIndex] = (0, import_react.useState)(0);
	const active = CAPABILITIES[index];
	const move = (delta) => setIndex((current) => wrapCarouselIndex(current + delta, CAPABILITIES.length));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		"aria-label": "OCADE capability highlights",
		"aria-roledescription": "carousel",
		className: "rounded-2xl border border-white/7 bg-white/[0.018] p-5",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between gap-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-[11px] font-semibold uppercase tracking-[0.16em] text-primary",
					children: [
						"Capability ",
						index + 1,
						" of ",
						CAPABILITIES.length
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-1 text-xl font-semibold tracking-tight",
					children: "Explore OCADE"
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Previous capability",
						onClick: () => move(-1),
						className: "grid h-10 w-10 place-items-center rounded-full border border-border/70 text-muted-foreground transition hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {
							className: "h-4 w-4",
							"aria-hidden": true
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Next capability",
						onClick: () => move(1),
						className: "grid h-10 w-10 place-items-center rounded-full border border-border/70 text-muted-foreground transition hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
							className: "h-4 w-4",
							"aria-hidden": true
						})
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "group",
				"aria-roledescription": "slide",
				"aria-label": `${index + 1} of ${CAPABILITIES.length}: ${active.title}`,
				className: "mt-5 min-h-40 rounded-xl border border-primary/20 bg-background/55 p-5 transition-[opacity,transform] duration-300 motion-reduce:transition-none",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "text-lg font-semibold text-foreground",
					children: active.title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 text-sm leading-7 text-muted-foreground",
					children: active.detail
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4 flex items-center justify-center gap-2",
				"aria-label": "Choose a capability",
				children: CAPABILITIES.map((capability, itemIndex) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": `Show ${capability.title}`,
					"aria-current": itemIndex === index ? "true" : void 0,
					onClick: () => setIndex(itemIndex),
					className: "flex h-6 min-w-6 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `h-2.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${itemIndex === index ? "w-8 bg-primary" : "w-2.5 bg-muted-foreground/35 hover:bg-muted-foreground/60"}` })
				}, capability.title))
			})
		]
	});
}
function OcadePage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Official OCADE product information",
		title: PUBLIC_IDENTITY.product,
		summary: "OCADE is a cross-platform, local-inference AI workspace with optional Private Sync, user-authorized network services and permissioned computer-control features. CARCC CADANE records 28 August 2026 as OCADE's formal public-launch date.",
		structuredData: OCADE_STRUCTURED_DATA,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CapabilityCarousel, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Private intelligence, permissioned action",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "OCADE is designed for AI chat, research, work, creation and permissioned computer-control tasks. Supported AI generation is designed around local inference on the user's device rather than a public-cloud AI inference fallback." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Optional authentication, Private Sync, current-information retrieval, support, payment and user-authorized network features are separate from the normal local AI path." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "What exists across the product",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "The repository contains the web application and offline shell, Supabase-backed account and private-sync paths, on-device model routing, Capacitor Android and iOS projects, desktop components, browser-control components and release infrastructure. Source presence and passing tests do not by themselves prove that every installer, app-store build or external production service is available at the same moment." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Name and meaning",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "OCADE is pronounced “OH-kayd.” Its creator, Haans Antoni, defines OCADE as “Orbital-scale command and autonomous decision engine.” This is the intended brand meaning and not a promise that every autonomous capability is enabled in every production release." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Offline and network behavior",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Supported OCADE Chat generation is designed to run locally; public-cloud AI inference is not a fallback. Local capability depends on device support and installed models. Sign-in, Private Sync, live web requests, payments and other requested online services require a network." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "An offline web shell can preserve supported interface access after a successful visit, but it does not make every connector, search source or online account feature available offline." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "AI and computer-control limitations",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "AI can be inaccurate, incomplete or wrong. Permissioned computer-control features can also select the wrong control or perform an unintended action. Important output and important actions must be reviewed. OCADE should not be relied on alone for medical, legal, tax, accounting, investment, cybersecurity, emergency or other high-impact decisions." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Launch access, plans and devices",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "OCADE may initially be available without charge while final product and payment work is completed. Paid plans may be introduced later only with purchase-specific pricing, renewal, cancellation and refund information shown before checkout." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Device limits, plan entitlements and platform availability can change as OCADE moves from launch into later releases. Current production rules, not screenshots or old roadmaps, determine what is available to an account." })]
			})
		]
	});
}
//#endregion
export { OcadePage as component };

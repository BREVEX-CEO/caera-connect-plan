import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { r as PUBLIC_IDENTITY, t as FOUNDER_STRUCTURED_DATA } from "./ssr.mjs";
import { n as PublicPage, r as PublicSection } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/founder.haans-antoni-Ti2992xj.js
var import_jsx_runtime = require_jsx_runtime();
function FounderPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Official founder profile",
		title: PUBLIC_IDENTITY.founderAlternateName,
		summary: "HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE.",
		structuredData: FOUNDER_STRUCTURED_DATA,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-4 rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					role: "img",
					"aria-label": "HAANS ANTONI initials",
					className: "grid h-16 w-16 shrink-0 place-items-center rounded-full border border-primary/35 bg-primary/10 text-lg font-semibold shadow-[0_12px_35px_rgba(0,0,0,0.25)]",
					children: "HA"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-semibold",
						children: "HAANS ANTONI"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "Founder, CEO and Chairman"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-xs text-muted-foreground",
						children: "Founding record · 28 August 2026"
					})
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Role",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Haans Antoni leads CARCC CADANE and directs the product vision for OCADE, the local-first AI workspace whose formal public-launch date is recorded as 28 August 2026. Product access remains controlled by the production launch gate until final readiness approval is given." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Contribution record",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "list-disc space-y-2 pl-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Created and directs OCADE's local-first product vision." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Established the CARCC CADANE and OCADE brand concepts." }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Leads product, safety, launch and evidence requirements." })
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Public profile scope",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "This profile contains only the founder identity and work record intentionally published by CARCC CADANE. It does not expose private OCADE account activity, personal contact details, private communications or user-profile data, and it does not imply an unannounced funding round, public listing, shareholder structure or securities offering." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Creation and brand record",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Haans Antoni created the CARCC CADANE and OCADE brand concepts and directs OCADE's product vision. OCADE is pronounced “OH-kayd.” Brand, intellectual-property, registration and ownership claims remain subject to the rights, licences and legal records that actually apply to each asset." })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Official references",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					"Read the ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/company",
						className: "text-foreground underline",
						children: "CARCC CADANE profile"
					}),
					", the",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/about",
						className: "text-foreground underline",
						children: "About page"
					}),
					" and the",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/products/ocade",
						className: "text-foreground underline",
						children: "OCADE product profile"
					}),
					". Search engines decide independently how and when this information appears."
				] })
			})
		]
	});
}
//#endregion
export { FounderPage as component };

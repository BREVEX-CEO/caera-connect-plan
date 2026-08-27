import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as organizationStructuredData, r as PUBLIC_IDENTITY } from "./ssr.mjs";
import { n as PublicPage, r as PublicSection } from "./PublicPage-CTc9xZld.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/company-BP2E3chh.js
var import_jsx_runtime = require_jsx_runtime();
function CompanyPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Official CARCC CADANE information",
		title: PUBLIC_IDENTITY.brand,
		summary: "CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE. It records 28 August 2026 as its formal founding date and OCADE's public-launch date.",
		structuredData: organizationStructuredData(),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "What CARCC CADANE is",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "CARCC CADANE is the technology enterprise, product venture and brand identity behind OCADE. It develops software, AI systems and related technology under the CARCC CADANE name. The official tagline is “Command the Next Era.”" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Public references use the CARCC CADANE enterprise and brand identity. A specific corporate form, securities status, trademark status, funding claim or other registration claim is published only when it is separately established and appropriate to disclose." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Formal founding and OCADE launch",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					"CARCC CADANE records ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "text-foreground",
						children: "28 August 2026"
					}),
					" as its formal founding date and the public-launch date for OCADE. Legal, privacy, support, identity and verification pages can be public earlier so users and external services can review them."
				] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Authenticated product access remains controlled by the production launch gate until both the launch date and final readiness approval are satisfied. This prevents an unfinished build from opening merely because the date has arrived." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Leadership",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					"HAANS ANTONI is Founder, CEO and Chairman of CARCC CADANE and creator of OCADE. Read the",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/founder/haans-antoni",
						className: "text-foreground underline",
						children: "official founder profile"
					}),
					"."
				] })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "OCADE",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "OCADE is CARCC CADANE's active local-first AI workspace. Supported AI generation is designed around on-device inference, with optional authentication, Private Sync, current-information retrieval, support, payments and other user-authorized online services separated from the local AI path." }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
					"Read the",
					" ",
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/products/ocade",
						className: "text-foreground underline",
						children: "OCADE product page"
					}),
					" ",
					"for the current product boundary."
				] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Investors, strategic partners and future ownership discussions",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "CARCC CADANE welcomes serious enquiries from prospective investors and strategic partners who want to discuss product strategy, commercial collaboration, future investment or a possible future ownership or equity transaction." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "No outside shareholder or investor is publicly announced on this page today. Nothing on this website is an offer to sell securities, an investment prospectus, a solicitation to invest, a promise of allocation, valuation, dividend, return or a guarantee that equity or shareholding will be offered." }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
						"Use the ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/about",
							className: "text-foreground underline",
							children: "About page"
						}),
						" and",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/support",
							className: "text-foreground underline",
							children: "Support page"
						}),
						" for the current investor-enquiry process."
					] })
				]
			})
		]
	});
}
//#endregion
export { CompanyPage as component };

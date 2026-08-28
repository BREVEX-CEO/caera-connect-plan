import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { An as CreditCard, E as Smartphone, M as ShieldCheck } from "../_libs/lucide-react.mjs";
import { n as PublicPage, r as PublicSection, t as Notice } from "./PublicPage-CTc9xZld.mjs";
import { t as Route } from "./pricing-CwijGzXu.mjs";
import { t as PAYMENT_METHODS } from "./methods-Bgfx_DTi.mjs";
import { t as PlanComparison } from "./PlanComparison-CfZawcla.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/pricing-C77qMGlW.js
var import_jsx_runtime = require_jsx_runtime();
function billingHandoffMessage(source) {
	if (source === "desktop") return "You came from the OCADE desktop app. Complete payment only on the provider-hosted page, then return to the app and refresh Billing. Access changes only after the server verifies the payment.";
	if (source === "mobile") return "You came from the OCADE mobile app. Complete payment in this browser, then return to the app and refresh Billing after verification.";
	return null;
}
function PricingPage() {
	const handoff = billingHandoffMessage(Route.useSearch().source);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicPage, {
		eyebrow: "Pre-launch pricing",
		title: "Choose the time you need",
		summary: "Three fixed-duration OCADE plans. Your local data, exports and supported on-device features remain available when a paid term ends. Live checkout is not enabled yet.",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Notice, { children: "OCADE is free while it launches, and these plans are here so you can see what is coming. Checkout is not open — nothing on this page can charge you." }),
			handoff ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				role: "status",
				className: "rounded-xl border border-primary/30 bg-primary/8 p-4 text-sm leading-relaxed text-foreground/85",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", {
						className: "text-foreground",
						children: "Secure browser handoff."
					}),
					" ",
					handoff
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PlanComparison, { deploymentDetails: false }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(PublicSection, {
				title: "Planned payment methods",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "grid gap-3 sm:grid-cols-3",
					children: PAYMENT_METHODS.map((method) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
						className: "rounded-xl border border-border/60 bg-black/15 p-4",
						children: [
							method.id === "upi" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, {
								className: "h-5 w-5 text-primary",
								"aria-hidden": true
							}) : method.id === "card" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CreditCard, {
								className: "h-5 w-5 text-primary",
								"aria-hidden": true
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, {
								className: "h-5 w-5 text-primary",
								"aria-hidden": true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
								className: "mt-3 font-semibold text-foreground",
								children: method.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs",
								children: method.markets
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-xs",
								children: method.disclosure
							})
						]
					}, method.id))
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Payment approval always stays on the provider's hosted surface. OCADE will retain the minimum billing record needed for entitlement, invoices, refunds and support—not full card details, UPI credentials, PayPal passwords or one-time codes." })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PublicSection, {
				title: "Purchase rules",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "Each purchase grants 8 days, 30 days or 1 year of access. It is non-recurring unless a future checkout clearly offers renewal and the customer separately chooses it. The exact currency, taxes, total, provider, cancellation and refund terms must be visible before the final payment confirmation." })
			})
		]
	});
}
//#endregion
export { PricingPage as component };

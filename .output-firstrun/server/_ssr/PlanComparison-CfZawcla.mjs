import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { Tt as Monitor, en as Infinity$1 } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { c as priceFor, i as describePrice, o as detectRegion, r as currencyForRegion, s as missingProductIds, t as PLANS } from "./paddle-plans-Pm8sU42X.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/PlanComparison-CfZawcla.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* What OCADE costs, from the one configuration that owns the numbers.
*
* THREE PLAN LISTS USED TO EXIST — one in `ocade-allowance` with durations and
* device limits, one in `BillingPanel` with labels, and none with prices. They
* agreed by coincidence. `payments/pricing.ts` is now the single source and
* both of the others derive from it, so a plan cannot have one duration here
* and another where it is charged.
*
* THE PRICES ARE VALIDATED AT RENDER. `describePrice` throws on an amount that
* breaks the pricing rule rather than falling back to showing it, so an invalid
* price fails loudly in development instead of quietly in front of a customer.
*
* WHAT THIS DOES NOT DO: take money.
*
* OCADE is free while it launches, and `FREE_LAUNCH_MODE` is checked HERE as
* well as inside the checkout hook. Two gates rather than one is deliberate:
* the hook's gate stops a purchase, and this one stops the button from ever
* being offered. A disabled-looking control that would have worked if clicked
* is the shape of a bug that charges someone by accident, and the cost of the
* duplicate check is one boolean.
*
* Plans stay fully visible and fully priced. Hiding them would answer "what
* will this cost?" with silence, which is the question the page exists for.
*/
function PlanComparison({ currentPlan, onChoose, deploymentDetails = true }) {
	const [currency, setCurrency] = (0, import_react.useState)("USD");
	(0, import_react.useEffect)(() => {
		setCurrency(currencyForRegion(detectRegion()));
	}, []);
	(0, import_react.useMemo)(() => missingProductIds({
		"BASE_URL": "/",
		"DEV": false,
		"MODE": "production",
		"PROD": true,
		"SSR": true,
		"TSS_DEV_SERVER": "false",
		"TSS_DEV_SSR_STYLES_BASEPATH": "/",
		"TSS_DEV_SSR_STYLES_ENABLED": "true",
		"TSS_DISABLE_CSRF_MIDDLEWARE_WARNING": "false",
		"TSS_INLINE_CSS_ENABLED": "false",
		"TSS_ROUTER_BASEPATH": "",
		"TSS_SERVER_FN_BASE": "/_serverFn/",
		"VITE_SUPABASE_PUBLISHABLE_KEY": "sb_publishable_ocade_local_audit_key",
		"VITE_SUPABASE_URL": "http://127.0.0.1:54321"
	}), []);
	const paid = PLANS.filter((plan) => plan.publiclyAvailable);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex flex-col gap-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex flex-wrap items-end justify-between gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-base font-semibold text-foreground",
					children: "Plans"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 max-w-prose text-[13px] text-muted-foreground",
					children: "OCADE is free during launch, and everything it does runs on your own device. Your hardware is not something OCADE meters, so there is nothing here to use up. Plans below are shown for reference only; nothing is charged today."
				})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
					className: "flex items-center gap-2 text-[12px] text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Currency" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
						value: currency,
						onChange: (event) => setCurrency(event.target.value),
						className: "rounded-md border border-border/60 bg-background px-2 py-1 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "USD",
								children: "USD"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "EUR",
								children: "EUR"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "GBP",
								children: "GBP"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
								value: "INR",
								children: "INR"
							})
						]
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 md:grid-cols-3",
				children: paid.map((plan) => {
					const price = priceFor(plan, currency);
					const isCurrent = currentPlan === plan.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: cn("flex flex-col gap-3 p-4 transition-transform hover:-translate-y-0.5", isCurrent && "ring-1 ring-primary/50"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex items-baseline justify-between gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
									className: "text-[15px] font-semibold text-foreground",
									children: plan.name
								}), isCurrent ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary",
									children: "Current"
								}) : null]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-2xl font-semibold tracking-tight text-foreground tabular-nums",
								children: describePrice(price)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "min-h-[2.5rem] text-[12.5px] leading-relaxed text-muted-foreground",
								children: plan.summary
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "flex flex-col gap-1.5 text-[12px] text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									icon: Infinity$1,
									children: "Unlimited on-device processing"
								}), plan.benefits.map((benefit) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Feature, {
									icon: Monitor,
									children: benefit
								}, benefit))]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								variant: "outline",
								className: "mt-auto w-full cursor-default border-primary/25 bg-primary/[0.06] text-foreground/70 hover:bg-primary/[0.06]",
								disabled: true,
								"aria-disabled": "true",
								tabIndex: -1,
								title: `${plan.name} is not on sale yet. OCADE is free while it launches, so nothing here can charge you.`,
								"aria-label": `${plan.name} — coming soon. OCADE is free while it launches.`,
								children: "Coming soon"
							})
						]
					}, plan.id);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "rounded-lg border border-primary/25 bg-primary/[0.06] px-3 py-2 text-[12px] leading-relaxed text-foreground/80",
				children: "OCADE is free while it launches. These plans are here so you can see what is coming — nothing on this page can charge you, and no card details are collected anywhere in the product today."
			}),
			null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-[12px] text-muted-foreground",
				children: "Work that runs on your device never counts against anything and never stops when a plan ends. Taxes and any provider-supported currency conversion would be shown before payment."
			})
		]
	});
}
function Feature({ icon: Icon, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "flex items-start gap-1.5",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
			className: "mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70",
			"aria-hidden": true
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children })]
	});
}
//#endregion
export { PlanComparison as t };

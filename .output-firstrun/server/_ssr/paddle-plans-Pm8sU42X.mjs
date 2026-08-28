//#region node_modules/.nitro/vite/services/ssr/assets/paddle-plans-Pm8sU42X.js
var DAY = 1440 * 60 * 1e3;
var PLANS = [
	{
		id: "demo",
		name: "Demo",
		durationMs: 1680 * 1e3,
		summary: "28 minutes of the real product, in your browser, with no account.",
		publiclyAvailable: false,
		benefits: [
			"No account",
			"On-device demo",
			"No payment details"
		],
		desktopDevices: 0,
		mobileDevices: 0,
		prices: [
			{
				currency: "USD",
				amountMinor: 0
			},
			{
				currency: "EUR",
				amountMinor: 0
			},
			{
				currency: "GBP",
				amountMinor: 0
			},
			{
				currency: "INR",
				amountMinor: 0
			}
		],
		productIdEnv: null
	},
	{
		id: "trial_2d",
		name: "2 days",
		durationMs: 2 * DAY,
		summary: "Try OCADE properly on your own documents before committing.",
		publiclyAvailable: false,
		benefits: [
			"Legacy entitlement",
			"Unlimited local work",
			"2 computers + 2 phones"
		],
		desktopDevices: 2,
		mobileDevices: 2,
		prices: [
			{
				currency: "USD",
				amountMinor: 228
			},
			{
				currency: "EUR",
				amountMinor: 228
			},
			{
				currency: "GBP",
				amountMinor: 228
			},
			{
				currency: "INR",
				amountMinor: 12800
			}
		],
		productIdEnv: "OCADE_PRODUCT_ID_TRIAL_2D"
	},
	{
		id: "std_8d",
		name: "8 days",
		durationMs: 8 * DAY,
		summary: "A focused eight-day pass. Everything runs on your own device.",
		publiclyAvailable: true,
		benefits: [
			"Unlimited on-device work",
			"2 computers + 2 phones",
			"Standard support"
		],
		desktopDevices: 2,
		mobileDevices: 2,
		prices: [
			{
				currency: "USD",
				amountMinor: 428
			},
			{
				currency: "EUR",
				amountMinor: 428
			},
			{
				currency: "GBP",
				amountMinor: 428
			},
			{
				currency: "INR",
				amountMinor: 28800
			}
		],
		productIdEnv: "OCADE_PRODUCT_ID_STD_8D"
	},
	{
		id: "month_1m",
		name: "1 month",
		durationMs: 30 * DAY,
		summary: "A flexible monthly licence for unlimited on-device processing.",
		publiclyAvailable: true,
		benefits: [
			"Unlimited on-device work",
			"2 computers + 2 phones",
			"Priority support"
		],
		desktopDevices: 2,
		mobileDevices: 2,
		prices: [
			{
				currency: "USD",
				amountMinor: 2800
			},
			{
				currency: "EUR",
				amountMinor: 2800
			},
			{
				currency: "GBP",
				amountMinor: 2800
			},
			{
				currency: "INR",
				amountMinor: 48800
			}
		],
		productIdEnv: "OCADE_PRODUCT_ID_MONTH_1M"
	},
	{
		id: "year_1y",
		name: "1 year",
		durationMs: 365 * DAY,
		summary: "A full year of unlimited on-device processing.",
		publiclyAvailable: true,
		benefits: [
			"Unlimited on-device work",
			"2 computers + 2 phones",
			"Priority support"
		],
		desktopDevices: 2,
		mobileDevices: 2,
		prices: [
			{
				currency: "USD",
				amountMinor: 12800
			},
			{
				currency: "EUR",
				amountMinor: 12800
			},
			{
				currency: "GBP",
				amountMinor: 12800
			},
			{
				currency: "INR",
				amountMinor: 588800
			}
		],
		productIdEnv: "OCADE_PRODUCT_ID_YEAR_1Y"
	}
];
/**
* Does this amount satisfy the pricing rule?
*
* Free is valid by definition — the demo costs nothing and a numeric signature
* on zero would be meaningless.
*/
function checkPrice(amountMinor, currency = "USD") {
	if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) return {
		valid: false,
		reason: "A price must use whole, non-negative minor units."
	};
	if (amountMinor === 0) return {
		valid: true,
		reason: "Free."
	};
	const amount = amountMinor / 100;
	const text = new Intl.NumberFormat("en-US", {
		useGrouping: false,
		minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
		maximumFractionDigits: 2
	}).format(amount);
	if (text.endsWith("28")) return {
		valid: true,
		reason: "Displayed price ends in 28."
	};
	if (text.endsWith("8")) return {
		valid: true,
		reason: "Displayed price ends in 8."
	};
	return {
		valid: false,
		reason: `Displayed ${currency} price ${text} must end in 8 or 28.`
	};
}
/**
* Format a price for display, refusing to render one that breaks the rule.
*
* Throwing is the point. A silent fallback to an unvalidated number would put
* exactly the price this module exists to prevent in front of a customer, and
* it would do it quietly.
*/
function describePrice(price) {
	const check = checkPrice(price.amountMinor, price.currency);
	if (!check.valid) throw new Error(`Refusing to display an invalid price: ${check.reason}`);
	if (price.amountMinor === 0) return "Free";
	const amount = price.amountMinor / 100;
	return new Intl.NumberFormat(price.currency === "INR" ? "en-IN" : "en-US", {
		style: "currency",
		currency: price.currency,
		minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
		maximumFractionDigits: 2
	}).format(amount);
}
/**
* Pick the currency for a region.
*
* Falls back to USD rather than guessing: showing a European price to someone
* whose region we could not read is worse than showing a familiar dollar figure
* they can convert.
*/
function currencyForRegion(regionCode) {
	const region = (regionCode ?? "").toUpperCase();
	if (region === "IN") return "INR";
	if (region === "GB" || region === "UK") return "GBP";
	if ((/* @__PURE__ */ new Set([
		"AT",
		"BE",
		"CY",
		"DE",
		"EE",
		"ES",
		"FI",
		"FR",
		"GR",
		"HR",
		"IE",
		"IT",
		"LT",
		"LU",
		"LV",
		"MT",
		"NL",
		"PT",
		"SI",
		"SK"
	])).has(region)) return "EUR";
	return "USD";
}
/** Read the region from the browser, or null when it cannot be determined. */
function detectRegion() {
	if (typeof Intl === "undefined") return null;
	try {
		const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? "";
		const match = /-([A-Z]{2})\b/.exec(locale.toUpperCase());
		return match ? match[1] : null;
	} catch {
		return null;
	}
}
function priceFor(plan, currency) {
	return plan.prices.find((p) => p.currency === currency) ?? plan.prices.find((p) => p.currency === "USD");
}
/**
* Which payment product ids are configured, and which are missing.
*
* Reported rather than thrown: a missing product id is a deployment fact, not a
* code defect, and the subscription screen must be able to say "checkout is not
* configured yet" instead of failing to render.
*/
function missingProductIds(env) {
	return PLANS.filter((p) => p.publiclyAvailable && p.productIdEnv !== null).map((p) => p.productIdEnv).filter((key) => !env[key]?.trim());
}
/**
* The three plans OCADE actually sells, and the provider ids they map to.
*
* These are the human-readable ids created in the provider catalogue. They are
* stable across the test and live environments, which is exactly why they, and
* not the provider's internal ids, are the thing source code is allowed to
* know. Anything not listed here cannot be bought — the checkout refuses an
* unknown plan rather than opening a window for an amount nobody approved.
*/
var SELLABLE_PLANS = [
	{
		planId: "std_8d",
		productId: "ocade_std_8d",
		priceId: "ocade_std_8d_once",
		cadence: "one-time",
		cadenceNote: "Charged once. Access ends after 8 days unless you buy again."
	},
	{
		planId: "month_1m",
		productId: "ocade_month_1m",
		priceId: "ocade_month_1m_monthly",
		cadence: "monthly",
		cadenceNote: "Renews every month until you cancel. Cancel any time."
	},
	{
		planId: "year_1y",
		productId: "ocade_year_1y",
		priceId: "ocade_year_1y_yearly",
		cadence: "yearly",
		cadenceNote: "Renews every year until you cancel. Cancel any time."
	}
];
function sellablePlanByPriceId(priceId) {
	return SELLABLE_PLANS.find((p) => p.priceId === priceId);
}
function sellablePlanByProductId(productId) {
	return SELLABLE_PLANS.find((p) => p.productId === productId);
}
/** Name, summary, benefits and formatted price for a sellable plan. */
function describeSellablePlan(plan, currency) {
	const configured = PLANS.find((p) => p.id === plan.planId);
	return {
		...plan,
		name: configured.name,
		summary: configured.summary,
		benefits: configured.benefits,
		price: describePrice(priceFor(configured, currency))
	};
}
//#endregion
export { describeSellablePlan as a, priceFor as c, describePrice as i, sellablePlanByPriceId as l, SELLABLE_PLANS as n, detectRegion as o, currencyForRegion as r, missingProductIds as s, PLANS as t, sellablePlanByProductId as u };

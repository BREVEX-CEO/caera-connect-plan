import { a as describeSellablePlan, n as SELLABLE_PLANS } from "./paddle-plans-Pm8sU42X.mjs";
import { t as gatewayFetch } from "./paddle.server-Dss6Gr3S.mjs";
import { r as deriveUpiState } from "./upi-readiness-qtJ_WsAa.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/upi-readiness.server-Cg8WMzgl.js
/**
* Ask the payment provider what is actually true about UPI eligibility.
*
* Everything here is a real read against the provider through the connector
* gateway. Where the provider does not expose a fact — the UPI toggle in their
* checkout settings — this module reports it as unverifiable rather than
* inventing a status.
*/
/** Does this price charge an Indian buyer in rupees? */
function inrDetail(price) {
	if (!price) return {
		hasInrPrice: false,
		detail: "No such price exists in the provider catalogue."
	};
	const base = price.unit_price?.currency_code;
	const override = price.unit_price_overrides?.find((o) => o.country_codes?.includes("IN") && o.unit_price?.currency_code === "INR");
	if (override) return {
		hasInrPrice: true,
		detail: `India override present: ${override.unit_price?.amount ?? "?"} INR minor units.`
	};
	if (base === "INR") return {
		hasInrPrice: true,
		detail: "Base price is already in INR."
	};
	return {
		hasInrPrice: false,
		detail: `Base price is ${base ?? "unknown"} and there is no India override in INR.`
	};
}
async function fetchPrice(env, externalId) {
	const response = await gatewayFetch(env, `/prices?external_id=${encodeURIComponent(externalId)}`);
	if (response.status === 401 || response.status === 403) {
		const error = /* @__PURE__ */ new Error("provider_rejected_credentials");
		error.name = "ProviderAuthError";
		throw error;
	}
	if (!response.ok) throw new Error(`Provider returned ${response.status} for ${externalId}.`);
	return (await response.json()).data?.[0];
}
/**
* Which of the checkable UPI preconditions hold right now.
*
* `currency` is the currency the buyer will be charged in, detected in the
* browser. It is a buyer fact, not a provider fact, which is why it is passed
* in instead of guessed here.
*/
async function probeUpiReadiness(environment, currency) {
	const reasons = [];
	const catalogue = [];
	if (currency !== "INR") reasons.push("region_not_eligible");
	try {
		for (const plan of SELLABLE_PLANS) {
			const { hasInrPrice, detail } = inrDetail(await fetchPrice(environment, plan.priceId));
			catalogue.push({
				priceId: plan.priceId,
				planName: describeSellablePlan(plan, "INR").name,
				hasInrPrice,
				detail
			});
		}
		if (catalogue.some((c) => !c.hasInrPrice)) reasons.push("catalogue_missing_inr_price");
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		reasons.push(e instanceof Error && e.name === "ProviderAuthError" ? "provider_account_not_approved" : message.includes("is not configured") ? "checkout_not_configured" : "provider_account_not_approved");
	}
	return {
		environment,
		currency,
		state: deriveUpiState(reasons),
		reasons,
		catalogue,
		checkedAt: (/* @__PURE__ */ new Date()).toISOString()
	};
}
//#endregion
export { probeUpiReadiness };

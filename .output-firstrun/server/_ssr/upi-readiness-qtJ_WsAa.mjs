//#region node_modules/.nitro/vite/services/ssr/assets/upi-readiness-qtJ_WsAa.js
/**
* The one thing this system cannot prove from code.
*
* Whether UPI is switched on in the provider's checkout settings is not
* exposed by their API. Guessing would be worse than saying so: a green tick
* we cannot substantiate is exactly the kind of fake state the product forbids.
*/
var UPI_TOGGLE_IS_NOT_MACHINE_VERIFIABLE = "One thing cannot be checked from here: whether UPI is switched on in the payment provider's own checkout settings. That switch is not readable through their API, so confirm it in the provider dashboard and prove it with one test payment.";
var UPI_REASON_COPY = {
	checkout_not_configured: {
		title: "Payments are not connected on this deployment",
		body: "No payment provider token is configured here, so no method can be offered — UPI included. Connect payments, then re-check this page.",
		audience: "operator"
	},
	provider_account_not_approved: {
		title: "The payment account is not approved yet",
		body: "The provider refused our credentials for this environment. Accounts must finish verification and be approved before real payments — including UPI — can be taken. Nothing in the app can shorten that review.",
		audience: "operator"
	},
	catalogue_missing_inr_price: {
		title: "Some plans have no rupee price",
		body: "UPI is only offered when the buyer is charged in Indian rupees. Any plan without an INR price will silently fall back to another currency and lose UPI at checkout.",
		audience: "operator"
	},
	region_not_eligible: {
		title: "UPI is an India-only method",
		body: "UPI works for buyers in India paying in rupees. You will be charged in your own currency, so the checkout will show cards and the other methods available where you are.",
		audience: "customer"
	}
};
/** One sentence for the top of the billing page, or null when nothing is wrong. */
function summariseUpiReadiness(readiness) {
	if (readiness.state === "available") return null;
	if (readiness.state === "region_not_eligible") return `UPI is not shown for this account because your prices are charged in ${readiness.currency}, and UPI is only offered to buyers in India paying in rupees.`;
	const first = readiness.reasons.find((r) => r !== "region_not_eligible");
	return first ? `${UPI_REASON_COPY[first].title}. ${UPI_REASON_COPY[first].body}` : "UPI needs setup before it can appear at checkout.";
}
/**
* Derive the overall state from the reasons found.
*
* Operator problems outrank the buyer's region: if the catalogue is broken,
* telling an Indian buyer "not your region" would be a lie, and telling the
* operator nothing would leave the real fault invisible.
*/
function deriveUpiState(reasons) {
	if (reasons.some((r) => r !== "region_not_eligible")) return "setup_required";
	if (reasons.includes("region_not_eligible")) return "region_not_eligible";
	return "available";
}
//#endregion
export { summariseUpiReadiness as i, UPI_TOGGLE_IS_NOT_MACHINE_VERIFIABLE as n, deriveUpiState as r, UPI_REASON_COPY as t };

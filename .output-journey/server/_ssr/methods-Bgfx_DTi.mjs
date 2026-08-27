//#region node_modules/.nitro/vite/services/ssr/assets/methods-Bgfx_DTi.js
/**
* The methods a customer can pay with, and what each one means for their data.
*
* There is one checkout, not one integration per method: the merchant of
* record decides which of these to offer based on the customer's country, and
* OCADE never loads a payment SDK or a secret in the browser. The disclosures
* are here rather than in page copy so every surface says the same thing about
* what OCADE can and cannot see.
*/
var PAYMENT_METHODS = [
	{
		id: "upi",
		label: "UPI intent, QR and AutoPay",
		provider: "Merchant of record checkout",
		markets: "India, charged in rupees",
		status: "ready",
		disclosure: "Your UPI app approves the payment, and renewals use UPI AutoPay mandates you can revoke there. OCADE never asks for a UPI PIN."
	},
	{
		id: "card",
		label: "Credit or debit card",
		provider: "Merchant of record checkout",
		markets: "Worldwide, subject to issuer support",
		status: "ready",
		disclosure: "Card details are entered on the provider's hosted checkout. OCADE stores only a provider reference."
	},
	{
		id: "paypal",
		label: "PayPal",
		provider: "Merchant of record checkout",
		markets: "Eligible international payments",
		status: "ready",
		disclosure: "PayPal sign-in and approval happen on PayPal's own checkout."
	}
];
//#endregion
export { PAYMENT_METHODS as t };

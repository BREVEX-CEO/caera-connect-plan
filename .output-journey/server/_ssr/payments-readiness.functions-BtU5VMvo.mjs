import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { o as objectType, r as enumType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CySYIv4d.mjs";
import { n as billingEnabled } from "./launch-mode-5950-vrz.mjs";
import { a as getPaddlePriceId, o as initializePaddle, s as isCheckoutConfigured } from "./paddle-B2RPBTmL.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/payments-readiness.functions-BtU5VMvo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* Payment methods the checkout may offer, UPI included.
*
* The list is explicit rather than left to the default so UPI is requested on
* every checkout. The provider still decides what is actually shown: UPI only
* appears for a buyer in India paying in rupees, which is why the catalogue
* carries an INR price override for India. Listing a method here can never
* conjure it for a buyer who cannot use it — it only stops one being dropped.
*/
var ALLOWED_PAYMENT_METHODS = [
	"upi",
	"card",
	"paypal",
	"google_pay",
	"apple_pay"
];
/**
* Opens the provider's hosted checkout.
*
* Card details, UPI approval and PayPal sign-in all happen on the provider's
* surface — OCADE never sees them. The account id travels as custom data so
* the signed webhook can attribute the purchase; a checkout without it would
* take money that nothing could later connect to a person.
*
* Free-launch mode is checked before any provider bootstrap. This is a second
* user-facing guard on top of the lower-level checks in `lib/paddle.ts`.
*/
function usePaddleCheckout() {
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [error, setError] = (0, import_react.useState)(null);
	return {
		openCheckout: (0, import_react.useCallback)(async (options) => {
			setError(null);
			if (!billingEnabled()) {
				setError("OCADE is free during launch. Checkout is disabled and no payment was started.");
				return;
			}
			if (!isCheckoutConfigured()) {
				setError("Checkout is not configured on this deployment yet.");
				return;
			}
			if (!options.userId) {
				setError("Sign in before buying, so the purchase can be added to your account.");
				return;
			}
			setLoading(true);
			try {
				await initializePaddle();
				const providerPriceId = await getPaddlePriceId(options.priceId);
				window.Paddle.Checkout.open({
					items: [{
						priceId: providerPriceId,
						quantity: 1
					}],
					customer: options.customerEmail ? { email: options.customerEmail } : void 0,
					customData: { userId: options.userId },
					settings: {
						displayMode: "overlay",
						variant: "one-page",
						allowLogout: false,
						allowedPaymentMethods: [...ALLOWED_PAYMENT_METHODS],
						successUrl: options.successUrl ?? `${window.location.origin}/checkout/success`
					}
				});
			} catch (e) {
				setError(e instanceof Error ? e.message : "The checkout could not be opened.");
			} finally {
				setLoading(false);
			}
		}, []),
		loading,
		error
	};
}
/**
* Server entry points for UPI readiness and the internal payments checklist.
*
* Thin on purpose: every runtime helper lives in the `.server` modules so the
* client bundle never pulls provider credentials or the admin check.
*/
var environment = enumType(["sandbox", "live"]);
var currency = enumType([
	"USD",
	"EUR",
	"GBP",
	"INR"
]);
/** What the signed-in buyer would see, and why. */
var getUpiReadiness = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((data) => objectType({
	environment,
	currency
}).parse(data)).handler(createSsrRpc("3093a4d4be21703bb1214bccf824a02371eca174502f6006d13c1438914fdddb"));
/** Admin only: run every automatable end-to-end payment verification. */
var runPaymentsChecklist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((data) => objectType({ environment }).parse(data)).handler(createSsrRpc("9089b73f80875ca6a4b9f363578a2de334dfa7a8579d0f211210d59a01f1bb9d"));
/** Admin only, test environment only: trigger a renewal within the hour. */
var fastForwardTestRenewal = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((data) => objectType({ environment }).parse(data)).handler(createSsrRpc("4e5532331a4e0da2f9d73fd3129ea83d08f0828288a7ff9e5a5d1505351edc02"));
//#endregion
export { usePaddleCheckout as i, getUpiReadiness as n, runPaymentsChecklist as r, fastForwardTestRenewal as t };

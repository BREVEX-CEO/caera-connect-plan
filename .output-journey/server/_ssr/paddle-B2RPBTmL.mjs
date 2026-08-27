import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CySYIv4d.mjs";
import { n as billingEnabled } from "./launch-mode-5950-vrz.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/paddle-B2RPBTmL.js
/**
* Every billing operation the browser is allowed to ask for.
*
* Reads are scoped to the signed-in user by RLS; nothing here can write a
* subscription row. The only writer is the signature-verified webhook, which
* is what makes "verified purchase state" mean something: the app believes the
* provider, not the browser that came back from checkout.
*/
var isEnv = (v) => v === "sandbox" || v === "live";
/**
* Resolve a human-readable price id to the provider's internal id.
*
* Public on purpose: it exposes only catalogue information that the pricing
* page already shows, and checkout cannot open without it.
*/
var resolvePaddlePrice = createServerFn({ method: "GET" }).validator((data) => {
	if (!data?.priceId || !isEnv(data.environment)) throw new Error("A price id and environment are required.");
	return data;
}).handler(createSsrRpc("b490e6e908853166dcdd10af124667ba47bdadb70ce754576eba8d0ab04e8e1d"));
/** The signed-in account's most recent subscription in the given environment. */
var getMySubscription = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((data) => {
	if (!isEnv(data?.environment)) throw new Error("An environment is required.");
	return data;
}).handler(createSsrRpc("e5952db56086d017546bda0a745a0d9799160c5094072313c0ed90b56e730d52"));
/**
* A one-time link into the provider's hosted billing portal.
*
* Payment method changes, invoices and cancellation happen there rather than
* in OCADE, because that keeps card details and identity checks on the
* provider's surface where they belong.
*/
var createBillingPortalSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("40948446646d4804ede583641238132f52de2d5ed6757b63973949dbc188d04c"));
/**
* Cancel at the end of the paid period.
*
* Cancelling does not take away time already paid for — access continues until
* `current_period_end`, and the webhook writes the resulting state. Immediate
* revocation would be taking back something the customer already bought.
*/
var cancelMySubscription = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("9dd122c6b291778f7710ad8979fbe11fae6aed49284553aa523689a6bb720c91"));
/**
* Browser-side checkout bootstrap.
*
* The client token is public by design: it can open a checkout, never read or
* change an account. Which environment the app is in is derived from the token
* prefix rather than a separate flag, so the preview cannot claim to be live
* and a published build cannot silently stay in test.
*
* FREE_LAUNCH_MODE is enforced here, below every checkout UI. That makes stale
* links, admin surfaces and accidental callers fail closed rather than merely
* hiding their buttons.
*/
var clientToken = {
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
	"VITE_SUPABASE_URL": "http://127.0.0.1:54399"
}["VITE_PAYMENTS_CLIENT_TOKEN"];
function getPaddleEnvironment() {
	return clientToken?.startsWith("test_") ? "sandbox" : "live";
}
/**
* True only when billing is intentionally enabled AND a provider token exists.
* During free launch a token left in deployment configuration must not make
* checkout reachable.
*/
function isCheckoutConfigured() {
	return billingEnabled() && Boolean(clientToken);
}
var paddleInitialized = false;
async function initializePaddle() {
	if (!billingEnabled()) throw new Error("Checkout is disabled while OCADE is in free launch mode.");
	if (paddleInitialized) return;
	if (!clientToken) throw new Error("Checkout is not configured on this deployment.");
	await new Promise((resolve, reject) => {
		if (document.querySelector("script[data-paddle]") && window.Paddle) {
			resolve();
			return;
		}
		const script = document.createElement("script");
		script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
		script.dataset["paddle"] = "1";
		script.onload = () => resolve();
		script.onerror = () => reject(/* @__PURE__ */ new Error("The checkout script could not be loaded."));
		document.head.appendChild(script);
	});
	window.Paddle.Environment.set(getPaddleEnvironment() === "sandbox" ? "sandbox" : "production");
	window.Paddle.Initialize({ token: clientToken });
	paddleInitialized = true;
}
/**
* Turn a stable, human-readable price id into the provider's internal id.
*
* The internal ids differ between test and live, so committing one to source
* would make a test purchase indistinguishable from a real one.
*/
async function getPaddlePriceId(priceId) {
	if (!billingEnabled()) throw new Error("Price resolution is disabled while OCADE is in free launch mode.");
	return resolvePaddlePrice({ data: {
		priceId,
		environment: getPaddleEnvironment()
	} });
}
//#endregion
export { getPaddlePriceId as a, getPaddleEnvironment as i, createBillingPortalSession as n, initializePaddle as o, getMySubscription as r, isCheckoutConfigured as s, cancelMySubscription as t };

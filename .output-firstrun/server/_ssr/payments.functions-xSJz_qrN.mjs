import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { a as limitError, r as checkServerLimit } from "./server-D2G3TBGg.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/payments.functions-xSJz_qrN.js
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
var resolvePaddlePrice_createServerFn_handler = createServerRpc({
	id: "b490e6e908853166dcdd10af124667ba47bdadb70ce754576eba8d0ab04e8e1d",
	name: "resolvePaddlePrice",
	filename: "src/utils/payments.functions.ts"
}, (opts) => resolvePaddlePrice.__executeServer(opts));
var resolvePaddlePrice = createServerFn({ method: "GET" }).validator((data) => {
	if (!data?.priceId || !isEnv(data.environment)) throw new Error("A price id and environment are required.");
	return data;
}).handler(resolvePaddlePrice_createServerFn_handler, async ({ data }) => {
	const { billingEnabled } = await import("./launch-mode-5950-vrz.mjs").then((n) => n.r).then((n) => n.r);
	if (!billingEnabled()) throw new Error("Price resolution is disabled while OCADE is in free launch mode.");
	const { gatewayFetch } = await import("./paddle.server-Dss6Gr3S.mjs").then((n) => n.i);
	const result = await (await gatewayFetch(data.environment, `/prices?external_id=${encodeURIComponent(data.priceId)}`)).json();
	if (!result.data?.length) throw new Error(`That plan is not available for purchase yet (${data.priceId}).`);
	return result.data[0].id;
});
var getMySubscription_createServerFn_handler = createServerRpc({
	id: "e5952db56086d017546bda0a745a0d9799160c5094072313c0ed90b56e730d52",
	name: "getMySubscription",
	filename: "src/utils/payments.functions.ts"
}, (opts) => getMySubscription.__executeServer(opts));
var getMySubscription = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((data) => {
	if (!isEnv(data?.environment)) throw new Error("An environment is required.");
	return data;
}).handler(getMySubscription_createServerFn_handler, async ({ data, context }) => {
	const allowance = checkServerLimit("billing_read", context.userId);
	if (!allowance.allowed) throw limitError(allowance);
	const { data: row, error } = await context.supabase.from("subscriptions").select("*").eq("user_id", context.userId).eq("environment", data.environment).order("created_at", { ascending: false }).limit(1).maybeSingle();
	if (error) throw new Error(error.message);
	if (!row) return null;
	return {
		id: row.id,
		paddleSubscriptionId: row.paddle_subscription_id,
		productId: row.product_id,
		priceId: row.price_id,
		status: row.status,
		currentPeriodStart: row.current_period_start,
		currentPeriodEnd: row.current_period_end,
		cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
		environment: row.environment,
		createdAt: row.created_at
	};
});
var createBillingPortalSession_createServerFn_handler = createServerRpc({
	id: "40948446646d4804ede583641238132f52de2d5ed6757b63973949dbc188d04c",
	name: "createBillingPortalSession",
	filename: "src/utils/payments.functions.ts"
}, (opts) => createBillingPortalSession.__executeServer(opts));
var createBillingPortalSession = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(createBillingPortalSession_createServerFn_handler, async ({ context }) => {
	const allowance = checkServerLimit("billing_write", context.userId);
	if (!allowance.allowed) throw limitError(allowance);
	const { data: row, error } = await context.supabase.from("subscriptions").select("paddle_customer_id, paddle_subscription_id, environment").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
	if (error) throw new Error(error.message);
	if (!row) throw new Error("There is no purchase on this account to manage yet.");
	const { getPaddleClient } = await import("./paddle.server-Dss6Gr3S.mjs").then((n) => n.i);
	const session = await getPaddleClient(row.environment === "live" ? "live" : "sandbox").customerPortalSessions.create(row.paddle_customer_id, [row.paddle_subscription_id]);
	const url = session.urls?.subscriptions?.[0]?.cancelSubscription ?? session.urls?.general?.overview;
	if (!url) throw new Error("The billing portal could not be opened. Try again shortly.");
	return { url };
});
var cancelMySubscription_createServerFn_handler = createServerRpc({
	id: "9dd122c6b291778f7710ad8979fbe11fae6aed49284553aa523689a6bb720c91",
	name: "cancelMySubscription",
	filename: "src/utils/payments.functions.ts"
}, (opts) => cancelMySubscription.__executeServer(opts));
var cancelMySubscription = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(cancelMySubscription_createServerFn_handler, async ({ context }) => {
	const allowance = checkServerLimit("billing_write", context.userId);
	if (!allowance.allowed) throw limitError(allowance);
	const { data: row, error } = await context.supabase.from("subscriptions").select("paddle_subscription_id, environment, status, current_period_end").eq("user_id", context.userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
	if (error) throw new Error(error.message);
	if (!row) throw new Error("There is no subscription on this account to cancel.");
	if (row.status === "canceled") return {
		ok: true,
		effectiveAt: row.current_period_end
	};
	const { getPaddleClient } = await import("./paddle.server-Dss6Gr3S.mjs").then((n) => n.i);
	await getPaddleClient(row.environment === "live" ? "live" : "sandbox").subscriptions.cancel(row.paddle_subscription_id, { effectiveFrom: "next_billing_period" });
	return {
		ok: true,
		effectiveAt: row.current_period_end
	};
});
//#endregion
export { cancelMySubscription_createServerFn_handler, createBillingPortalSession_createServerFn_handler, getMySubscription_createServerFn_handler, resolvePaddlePrice_createServerFn_handler };

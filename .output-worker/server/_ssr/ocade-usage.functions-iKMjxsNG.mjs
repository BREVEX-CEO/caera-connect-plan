import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade-usage.functions-iKMjxsNG.js
/** Account entitlement readback. Chat inference is local and has no usage meter. */
var getEntitlement_createServerFn_handler = createServerRpc({
	id: "1d03547fcf93634f0edcf90fe58d3b374a85ffb4ce8fed857d1d642e0e6fd632",
	name: "getEntitlement",
	filename: "src/lib/ocade-usage.functions.ts"
}, (opts) => getEntitlement.__executeServer(opts));
var getEntitlement = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getEntitlement_createServerFn_handler, async ({ context }) => {
	const { data } = await context.supabase.from("ocade_subscriptions").select("plan_id, started_at, expires_at, status").eq("user_id", context.userId).order("expires_at", { ascending: false }).limit(1).maybeSingle();
	if (!data) return null;
	return {
		planId: data.plan_id,
		startedAt: data.started_at,
		expiresAt: data.expires_at,
		status: data.status
	};
});
//#endregion
export { getEntitlement_createServerFn_handler };

import { o as objectType, r as enumType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/payments-readiness.functions-D_rQ3OvO.js
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
var getUpiReadiness_createServerFn_handler = createServerRpc({
	id: "3093a4d4be21703bb1214bccf824a02371eca174502f6006d13c1438914fdddb",
	name: "getUpiReadiness",
	filename: "src/utils/payments-readiness.functions.ts"
}, (opts) => getUpiReadiness.__executeServer(opts));
var getUpiReadiness = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((data) => objectType({
	environment,
	currency
}).parse(data)).handler(getUpiReadiness_createServerFn_handler, async ({ data }) => {
	const { probeUpiReadiness } = await import("./upi-readiness.server-Cg8WMzgl.mjs");
	return probeUpiReadiness(data.environment, data.currency);
});
var runPaymentsChecklist_createServerFn_handler = createServerRpc({
	id: "9089b73f80875ca6a4b9f363578a2de334dfa7a8579d0f211210d59a01f1bb9d",
	name: "runPaymentsChecklist",
	filename: "src/utils/payments-readiness.functions.ts"
}, (opts) => runPaymentsChecklist.__executeServer(opts));
var runPaymentsChecklist = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((data) => objectType({ environment }).parse(data)).handler(runPaymentsChecklist_createServerFn_handler, async ({ data, context }) => {
	const { assertAdmin, runChecklist } = await import("./checklist.server-BA88rI_E.mjs");
	await assertAdmin(context.supabase, context.userId);
	return runChecklist(context.supabase, context.userId, data.environment);
});
var fastForwardTestRenewal_createServerFn_handler = createServerRpc({
	id: "4e5532331a4e0da2f9d73fd3129ea83d08f0828288a7ff9e5a5d1505351edc02",
	name: "fastForwardTestRenewal",
	filename: "src/utils/payments-readiness.functions.ts"
}, (opts) => fastForwardTestRenewal.__executeServer(opts));
var fastForwardTestRenewal = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((data) => objectType({ environment }).parse(data)).handler(fastForwardTestRenewal_createServerFn_handler, async ({ data, context }) => {
	const { assertAdmin, fastForwardRenewal } = await import("./checklist.server-BA88rI_E.mjs");
	await assertAdmin(context.supabase, context.userId);
	return fastForwardRenewal(context.supabase, context.userId, data.environment);
});
//#endregion
export { fastForwardTestRenewal_createServerFn_handler, getUpiReadiness_createServerFn_handler, runPaymentsChecklist_createServerFn_handler };

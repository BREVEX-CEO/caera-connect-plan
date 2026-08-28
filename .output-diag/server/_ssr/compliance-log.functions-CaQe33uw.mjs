import { c as stringType, o as objectType, r as enumType, s as recordType, u as unknownType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CA8BQOW2.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/compliance-log.functions-CaQe33uw.js
/**
* Protected server-side writer for the immutable compliance_audit_log.
*
* Plan §10 + §15: users must never directly insert, edit, or delete
* compliance records. RLS revokes INSERT for authenticated/anon; this
* server function uses supabaseAdmin *after* verifying the caller.
*/
var inputSchema = objectType({
	action: stringType().min(1).max(200),
	featureId: stringType().min(1).max(200),
	category: enumType([
		"finance",
		"payment",
		"filing",
		"signature",
		"approval",
		"role_change",
		"sensitive_export",
		"deletion",
		"other"
	]),
	tenantId: stringType().uuid().nullable().optional(),
	preview: recordType(stringType(), unknownType()).optional()
});
var writeComplianceLog = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => inputSchema.parse(input)).handler(createSsrRpc("55893207ac96e264df7065d1ac9d876b96101e5f05cabbe7dbe52e13808ee8cd"));
//#endregion
export { writeComplianceLog };

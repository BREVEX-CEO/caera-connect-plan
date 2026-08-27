import { c as stringType, o as objectType, r as enumType, s as recordType, u as unknownType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/compliance-log.functions-ChJsYE7z.js
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
var writeComplianceLog_createServerFn_handler = createServerRpc({
	id: "55893207ac96e264df7065d1ac9d876b96101e5f05cabbe7dbe52e13808ee8cd",
	name: "writeComplianceLog",
	filename: "src/lib/compliance-log.functions.ts"
}, (opts) => writeComplianceLog.__executeServer(opts));
var writeComplianceLog = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((input) => inputSchema.parse(input)).handler(writeComplianceLog_createServerFn_handler, async ({ data, context }) => {
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.mjs");
	if (data.tenantId) {
		const { data: member } = await context.supabase.from("tenant_members").select("tenant_id").eq("tenant_id", data.tenantId).eq("user_id", context.userId).maybeSingle();
		if (!member) throw new Response("Forbidden: not a member of tenant", { status: 403 });
	}
	const { error } = await supabaseAdmin.from("compliance_audit_log").insert({
		user_id: context.userId,
		tenant_id: data.tenantId ?? null,
		action: data.action,
		feature_id: data.featureId,
		category: data.category,
		preview: data.preview ?? {}
	});
	if (error) throw new Response(`Compliance log write failed: ${error.message}`, { status: 500 });
	return { ok: true };
});
//#endregion
export { writeComplianceLog_createServerFn_handler };

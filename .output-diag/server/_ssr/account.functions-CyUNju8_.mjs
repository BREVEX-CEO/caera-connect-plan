import { c as stringType, o as objectType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/account.functions-CyUNju8_.js
/**
* Account self-service — irreversible deletion.
*
* Deletion is a privileged operation: the caller is authenticated with
* `requireSupabaseAuth`, the target is ALWAYS `context.userId` (never an input
* parameter, so no request can aim this at another account), and the service
* client is imported inside the handler so it never reaches a client bundle.
*
* Order matters. Rows that hang off the account are scrubbed first, then the
* sign-in identity itself; deleting the identity first would leave orphaned
* rows behind on any table without a cascade.
*/
/**
* The user must type this exactly. A typed phrase is the second confirmation
* required for destructive actions — a button alone is not consent.
*/
var DELETE_CONFIRMATION = "DELETE MY ACCOUNT";
var deleteAccountInput = objectType({ confirmation: stringType() });
var deleteMyAccount_createServerFn_handler = createServerRpc({
	id: "27301031363e284184ead21ac910c33ebfbe9159435c975f26319c6a65fade88",
	name: "deleteMyAccount",
	filename: "src/lib/account.functions.ts"
}, (opts) => deleteMyAccount.__executeServer(opts));
var deleteMyAccount = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((data) => deleteAccountInput.parse(data)).handler(deleteMyAccount_createServerFn_handler, async ({ data, context }) => {
	if (data.confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION) throw new Error("Confirmation phrase did not match.");
	const userId = context.userId;
	const { supabaseAdmin } = await import("./client.server-Bw6iWMJ-.mjs");
	await supabaseAdmin.from("ocade_support_tickets").delete().eq("user_id", userId);
	await supabaseAdmin.from("ocade_support_messages").delete().eq("author_id", userId);
	await supabaseAdmin.from("ocade_conversations").delete().eq("user_id", userId);
	await supabaseAdmin.from("user_settings").delete().eq("user_id", userId);
	await supabaseAdmin.from("user_private_records").delete().eq("user_id", userId);
	await supabaseAdmin.from("devices").delete().eq("user_id", userId);
	await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
	await supabaseAdmin.from("profiles").delete().eq("id", userId);
	const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
	if (error) throw new Error(`Account records were removed but sign-in deletion failed: ${error.message}`);
	return { deleted: true };
});
//#endregion
export { deleteMyAccount_createServerFn_handler };

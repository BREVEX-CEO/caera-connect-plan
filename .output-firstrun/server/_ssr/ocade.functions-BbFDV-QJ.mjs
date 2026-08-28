import { a as numberType, c as stringType, n as booleanType, o as objectType, r as enumType, t as arrayType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as readAllPages } from "./read-all-DoE60cXT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.functions-BbFDV-QJ.js
/**
* OCADE server functions — conversations, messages, prompt improvement.
* All routes use requireSupabaseAuth so RLS applies as the caller.
*/
var uuid = stringType().uuid();
var listConversations_createServerFn_handler = createServerRpc({
	id: "facabc33099e3901f41fae202286394326002b98bfec49db880fef6824434be8",
	name: "listConversations",
	filename: "src/lib/ocade.functions.ts"
}, (opts) => listConversations.__executeServer(opts));
var listConversations = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(listConversations_createServerFn_handler, async ({ context }) => {
	const { data, error } = await context.supabase.from("ocade_conversations").select("id, title, pinned, archived, model_id, privacy_mode, project_id, updated_at, created_at").order("pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(500);
	if (error) throw new Response(error.message, { status: 500 });
	return data ?? [];
});
var createConversation_createServerFn_handler = createServerRpc({
	id: "ff6097911ef31a9159bef60fa059b869110d7b36a653fc40e3c4bd3a8c8a84e5",
	name: "createConversation",
	filename: "src/lib/ocade.functions.ts"
}, (opts) => createConversation.__executeServer(opts));
var createConversation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	title: stringType().max(200).optional(),
	modelId: stringType().max(200).optional()
}).parse(i)).handler(createConversation_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("ocade_conversations").insert({
		user_id: context.userId,
		title: data.title ?? "New chat",
		model_id: data.modelId ?? null
	}).select("id, title, pinned, archived, model_id, privacy_mode, project_id, updated_at, created_at").single();
	if (error) throw new Response(error.message, { status: 500 });
	return row;
});
var updateInput = objectType({
	id: uuid,
	title: stringType().min(1).max(200).optional(),
	pinned: booleanType().optional(),
	archived: booleanType().optional(),
	modelId: stringType().max(200).nullable().optional()
});
var updateConversation_createServerFn_handler = createServerRpc({
	id: "7cec09546c8f6fc16f88e0ce189121c57cc6576efb6e9dc2827fe34ad2620f3a",
	name: "updateConversation",
	filename: "src/lib/ocade.functions.ts"
}, (opts) => updateConversation.__executeServer(opts));
var updateConversation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => updateInput.parse(i)).handler(updateConversation_createServerFn_handler, async ({ data, context }) => {
	const patch = {};
	if (data.title !== void 0) patch.title = data.title;
	if (data.pinned !== void 0) patch.pinned = data.pinned;
	if (data.archived !== void 0) patch.archived = data.archived;
	if (data.modelId !== void 0) patch.model_id = data.modelId;
	const { error } = await context.supabase.from("ocade_conversations").update(patch).eq("id", data.id);
	if (error) throw new Response(error.message, { status: 500 });
	return { ok: true };
});
var deleteConversation_createServerFn_handler = createServerRpc({
	id: "d73ea9d3f2cc2a8f5a3b0e9ea749723429a3a8868213289b0fd83a828a3c679a",
	name: "deleteConversation",
	filename: "src/lib/ocade.functions.ts"
}, (opts) => deleteConversation.__executeServer(opts));
var deleteConversation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(deleteConversation_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("ocade_conversations").delete().eq("id", data.id);
	if (error) throw new Response(error.message, { status: 500 });
	return { ok: true };
});
var listMessages_createServerFn_handler = createServerRpc({
	id: "4906f69e6dbfa24b83e194311c3709d2bb1ef497f75df14d536446a55e909c67",
	name: "listMessages",
	filename: "src/lib/ocade.functions.ts"
}, (opts) => listMessages.__executeServer(opts));
var listMessages = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ conversationId: uuid }).parse(i)).handler(listMessages_createServerFn_handler, async ({ data, context }) => {
	return await readAllPages((from, to) => context.supabase.from("ocade_messages").select("id, role, content, attachments, model_id, provider_id, created_at").eq("conversation_id", data.conversationId).order("created_at", { ascending: true }).range(from, to)).catch((cause) => {
		throw new Response(cause.message, { status: 500 });
	});
});
var deleteMessage_createServerFn_handler = createServerRpc({
	id: "8ff22350b100b35ecaf7f695759edb87a448d28f846b9a6fdf227d3c17d3fc13",
	name: "deleteMessage",
	filename: "src/lib/ocade.functions.ts"
}, (opts) => deleteMessage.__executeServer(opts));
var deleteMessage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(deleteMessage_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("ocade_messages").delete().eq("id", data.id);
	if (error) throw new Response(error.message, { status: 500 });
	return { ok: true };
});
var appendOcadeMessage_createServerFn_handler = createServerRpc({
	id: "6b736651a8580a4afefb04158fd29f811933b6a998eec442e59b285ac241e893",
	name: "appendOcadeMessage",
	filename: "src/lib/ocade.functions.ts"
}, (opts) => appendOcadeMessage.__executeServer(opts));
var appendOcadeMessage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	conversationId: uuid,
	role: enumType(["user", "assistant"]),
	content: stringType().max(2e5),
	modelId: stringType().max(200).nullable().optional(),
	providerId: stringType().max(100).nullable().optional(),
	attachments: arrayType(objectType({
		kind: enumType(["image", "file"]),
		name: stringType().max(500),
		mime: stringType().max(200),
		sizeBytes: numberType().int().nonnegative()
	})).max(10).optional()
}).parse(i)).handler(appendOcadeMessage_createServerFn_handler, async ({ data, context }) => {
	const { data: conv } = await context.supabase.from("ocade_conversations").select("id, title").eq("id", data.conversationId).maybeSingle();
	if (!conv) throw new Response("Conversation not found", { status: 404 });
	const { data: row, error } = await context.supabase.from("ocade_messages").insert({
		conversation_id: data.conversationId,
		user_id: context.userId,
		role: data.role,
		content: data.content,
		model_id: data.modelId ?? null,
		provider_id: data.providerId ?? null,
		attachments: data.attachments ?? []
	}).select("id, role, content, attachments, model_id, provider_id, created_at").single();
	if (error) throw new Response(error.message, { status: 500 });
	if (data.role === "user" && (conv.title ?? "").toLowerCase() === "new chat" && data.content.trim()) await context.supabase.from("ocade_conversations").update({ title: data.content.trim().slice(0, 60) }).eq("id", data.conversationId);
	return row;
});
var exportConversation_createServerFn_handler = createServerRpc({
	id: "c56bc1eb78fdd958203aaeb01b576724c0d61397aa2a8097613a1d514305e9fe",
	name: "exportConversation",
	filename: "src/lib/ocade.functions.ts"
}, (opts) => exportConversation.__executeServer(opts));
var exportConversation = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ conversationId: uuid }).parse(i)).handler(exportConversation_createServerFn_handler, async ({ data, context }) => {
	const [{ data: conv }, { data: msgs }] = await Promise.all([context.supabase.from("ocade_conversations").select("id, title, model_id, created_at, updated_at").eq("id", data.conversationId).maybeSingle(), readAllPages((from, to) => context.supabase.from("ocade_messages").select("role, content, attachments, model_id, provider_id, created_at").eq("conversation_id", data.conversationId).order("created_at", { ascending: true }).range(from, to)).then((rows) => ({ data: rows }))]);
	if (!conv) throw new Response("Conversation not found", { status: 404 });
	return {
		conversation: conv,
		messages: msgs ?? [],
		exported_at: (/* @__PURE__ */ new Date()).toISOString(),
		exported_by: "OCADE by CARCC CADANE"
	};
});
//#endregion
export { appendOcadeMessage_createServerFn_handler, createConversation_createServerFn_handler, deleteConversation_createServerFn_handler, deleteMessage_createServerFn_handler, exportConversation_createServerFn_handler, listConversations_createServerFn_handler, listMessages_createServerFn_handler, updateConversation_createServerFn_handler };

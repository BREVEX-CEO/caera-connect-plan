import { a as numberType, c as stringType, n as booleanType, o as objectType, r as enumType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade-projects.functions-CbXsKph-.js
/**
* OCADE projects, outputs and opt-in memory — server functions (Plan §17/§19/§20).
*
* The backing tables ship in `20260722090000_ocade_projects_outputs_memory.sql`
* and are declared in the generated `Database` type, so every query here is
* checked against the real schema. `scripts/check-supabase-types.mjs` keeps the
* two in step; the `pendingFrom(): any` bridge that used to stand in for the
* missing declarations is gone, along with the type checking it disabled.
*
* Access control: every table is RLS own-row scoped to auth.uid(); these
* handlers additionally scope by context.userId so a bug can't widen access.
*/
var uuid = stringType().uuid();
var projectNameSchema = stringType().trim().min(1).max(200);
var instructionsSchema = stringType().max(2e4).nullable().optional();
var createProjectInput = objectType({
	name: projectNameSchema,
	instructions: instructionsSchema
});
var updateProjectInput = objectType({
	id: uuid,
	name: projectNameSchema.optional(),
	instructions: instructionsSchema,
	archived: booleanType().optional()
});
var setConversationProjectInput = objectType({
	conversationId: uuid,
	/** null means "unfile" — an explicit, supported operation. */
	projectId: uuid.nullable()
});
var branchConversationInput = objectType({
	conversationId: uuid,
	fromMessageId: uuid,
	title: stringType().max(200).optional()
});
var forkConversationBeforeInput = objectType({
	conversationId: uuid,
	fromMessageId: uuid,
	title: stringType().max(200).optional()
});
var listProjects_createServerFn_handler = createServerRpc({
	id: "8e901fb50baa17d07c258ac16352a1ad0fe54e5c976012fe4df86c73c242864e",
	name: "listProjects",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => listProjects.__executeServer(opts));
var listProjects = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ includeArchived: booleanType().optional() }).parse(i ?? {})).handler(listProjects_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("ocade_projects").select("id, name, instructions, archived, created_at, updated_at").eq("user_id", context.userId);
	if (!data.includeArchived) q = q.eq("archived", false);
	const { data: rows, error } = await q.order("updated_at", { ascending: false });
	if (error) throw new Response(error.message, { status: 500 });
	return rows ?? [];
});
var getProject_createServerFn_handler = createServerRpc({
	id: "07998a22af7ef0322973b73bad7bcef2a7fc538341a6188360864fd53b075d98",
	name: "getProject",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => getProject.__executeServer(opts));
var getProject = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((input) => objectType({ id: uuid }).parse(input)).handler(getProject_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("ocade_projects").select("id, name, instructions, archived, created_at, updated_at").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
	if (error) throw new Response(error.message, { status: 500 });
	if (!row) throw new Response("Project not found", { status: 404 });
	return row;
});
var createProject_createServerFn_handler = createServerRpc({
	id: "8808c4b21f3516637ab1043f8f4277208aba9e90ce56414e058b79fb8ebb6e99",
	name: "createProject",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => createProject.__executeServer(opts));
var createProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => createProjectInput.parse(i)).handler(createProject_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("ocade_projects").insert({
		user_id: context.userId,
		name: data.name,
		instructions: data.instructions ?? null
	}).select("id, name, instructions, archived, created_at, updated_at").single();
	if (error) throw new Response(error.message, { status: 500 });
	return row;
});
var updateProject_createServerFn_handler = createServerRpc({
	id: "7285a3abf4bf3c4ab70731b46bd3a13ae206e0a3fac1020803cec212cfa57120",
	name: "updateProject",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => updateProject.__executeServer(opts));
var updateProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => updateProjectInput.parse(i)).handler(updateProject_createServerFn_handler, async ({ data, context }) => {
	const patch = {};
	if (data.name !== void 0) patch.name = data.name;
	if (data.instructions !== void 0) patch.instructions = data.instructions;
	if (data.archived !== void 0) patch.archived = data.archived;
	const { data: row, error } = Object.keys(patch).length > 0 ? await context.supabase.from("ocade_projects").update(patch).eq("id", data.id).eq("user_id", context.userId).select("id").maybeSingle() : await context.supabase.from("ocade_projects").select("id").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
	if (error) throw new Response(error.message, { status: 500 });
	if (!row) throw new Response("Project not found", { status: 404 });
	return { ok: true };
});
var deleteProject_createServerFn_handler = createServerRpc({
	id: "2309e9d940fe51de8e3e661bd14a42c268a0197b17d5bd52c81654b73c380709",
	name: "deleteProject",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => deleteProject.__executeServer(opts));
var deleteProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(deleteProject_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("ocade_projects").delete().eq("id", data.id).eq("user_id", context.userId).select("id").maybeSingle();
	if (error) throw new Response(error.message, { status: 500 });
	if (!row) throw new Response("Project not found", { status: 404 });
	return { ok: true };
});
var createOutputInput = objectType({
	projectId: uuid.nullable().optional(),
	conversationId: uuid.nullable().optional(),
	parentOutputId: uuid.nullable().optional(),
	kind: enumType([
		"document",
		"export",
		"visual",
		"transcript",
		"other"
	]),
	title: stringType().trim().min(1).max(300),
	content: stringType().max(1e6).nullable().optional(),
	mime: stringType().max(200).nullable().optional(),
	retentionDays: numberType().int().min(1).max(3650).nullable().optional()
});
async function sha256Text(content) {
	const subtle = globalThis.crypto?.subtle;
	if (!subtle) throw new Response("SHA-256 is unavailable; output was not saved", { status: 503 });
	const digest = await subtle.digest("SHA-256", new TextEncoder().encode(content));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
var listOutputs_createServerFn_handler = createServerRpc({
	id: "7aa2cb718131cdf179c3480f772ba3d004b9f01924bfd18c29b4645aaaf73576",
	name: "listOutputs",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => listOutputs.__executeServer(opts));
var listOutputs = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ projectId: uuid.nullable().optional() }).parse(i ?? {})).handler(listOutputs_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("ocade_outputs").select("id, project_id, conversation_id, kind, title, mime, size_bytes, lineage_id, version, content_sha256, expires_at, created_at").eq("user_id", context.userId);
	if (data.projectId) q = q.eq("project_id", data.projectId);
	const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(200);
	if (error) throw new Response(error.message, { status: 500 });
	return rows ?? [];
});
var createOutput_createServerFn_handler = createServerRpc({
	id: "6ea4b07ef729e43b17291966b268162e50284bc6b23a9f1d3e5a835c7a2af8cf",
	name: "createOutput",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => createOutput.__executeServer(opts));
var createOutput = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => createOutputInput.parse(i)).handler(createOutput_createServerFn_handler, async ({ data, context }) => {
	let lineageId;
	let version = 1;
	let projectId = data.projectId ?? null;
	let conversationId = data.conversationId ?? null;
	if (data.parentOutputId) {
		const { data: parent, error: parentError } = await context.supabase.from("ocade_outputs").select("id, lineage_id, project_id, conversation_id, kind, title").eq("id", data.parentOutputId).eq("user_id", context.userId).maybeSingle();
		if (parentError) throw new Response(parentError.message, { status: 500 });
		if (!parent) throw new Response("Parent output not found", { status: 404 });
		if (data.projectId !== void 0 && data.projectId !== parent.project_id || data.conversationId !== void 0 && data.conversationId !== parent.conversation_id || data.kind !== parent.kind || data.title !== parent.title) throw new Response("A new version must keep its parent output's project, conversation, kind and title.", { status: 409 });
		projectId = parent.project_id;
		conversationId = parent.conversation_id;
		lineageId = parent.lineage_id;
		const { data: latest, error: versionError } = await context.supabase.from("ocade_outputs").select("version").eq("user_id", context.userId).eq("lineage_id", lineageId).order("version", { ascending: false }).limit(1).maybeSingle();
		if (versionError) throw new Response(versionError.message, { status: 500 });
		version = Number(latest?.version ?? 0) + 1;
	}
	const content = data.content ?? null;
	const contentSha256 = content === null ? null : await sha256Text(content);
	const expiresAt = data.retentionDays == null ? null : new Date(Date.now() + data.retentionDays * 24 * 60 * 60 * 1e3).toISOString();
	const { data: row, error } = await context.supabase.from("ocade_outputs").insert({
		user_id: context.userId,
		project_id: projectId,
		conversation_id: conversationId,
		kind: data.kind,
		title: data.title,
		content,
		mime: data.mime ?? null,
		size_bytes: content ? new TextEncoder().encode(content).length : 0,
		...lineageId ? { lineage_id: lineageId } : {},
		version,
		parent_output_id: data.parentOutputId ?? null,
		content_sha256: contentSha256,
		expires_at: expiresAt
	}).select("id, kind, title, lineage_id, version, content_sha256, expires_at, created_at").single();
	if (error) throw new Response(error.message, { status: 500 });
	return row;
});
var listProjectConversations_createServerFn_handler = createServerRpc({
	id: "fca3ed0854aac3cec96f7aa1c60003f4398b842fbafca5363c85ee574ba7341f",
	name: "listProjectConversations",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => listProjectConversations.__executeServer(opts));
var listProjectConversations = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ projectId: uuid.nullable() }).parse(i)).handler(listProjectConversations_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("ocade_conversations").select("id, title, pinned, archived, project_id, updated_at").eq("user_id", context.userId);
	q = data.projectId === null ? q.is("project_id", null) : q.eq("project_id", data.projectId);
	const { data: rows, error } = await q.order("updated_at", { ascending: false }).limit(500);
	if (error) throw new Response(error.message, { status: 500 });
	return rows ?? [];
});
var setConversationProject_createServerFn_handler = createServerRpc({
	id: "b14c146e61cd097d28547ce91506a07807d964a6f72b3841ca9c44c177ba85a6",
	name: "setConversationProject",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => setConversationProject.__executeServer(opts));
var setConversationProject = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => setConversationProjectInput.parse(i)).handler(setConversationProject_createServerFn_handler, async ({ data, context }) => {
	if (data.projectId !== null) {
		const { data: project } = await context.supabase.from("ocade_projects").select("id").eq("id", data.projectId).eq("user_id", context.userId).maybeSingle();
		if (!project) throw new Response("Project not found", { status: 404 });
	}
	const { data: row, error } = await context.supabase.from("ocade_conversations").update({ project_id: data.projectId }).eq("id", data.conversationId).eq("user_id", context.userId).select("id").maybeSingle();
	if (error) throw new Response(error.message, { status: 500 });
	if (!row) throw new Response("Conversation not found", { status: 404 });
	return { ok: true };
});
var branchConversation_createServerFn_handler = createServerRpc({
	id: "a505543a81269df00d25a9bc7b6a7940b13b733521a7ae14a26ffa3def8bb4c0",
	name: "branchConversation",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => branchConversation.__executeServer(opts));
var branchConversation = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => branchConversationInput.parse(i)).handler(branchConversation_createServerFn_handler, async ({ data, context }) => {
	const { data: source } = await context.supabase.from("ocade_conversations").select("id, title, project_id, model_id, provider_id, privacy_mode").eq("id", data.conversationId).eq("user_id", context.userId).maybeSingle();
	if (!source) throw new Response("Conversation not found", { status: 404 });
	const { data: pivot } = await context.supabase.from("ocade_messages").select("created_at").eq("id", data.fromMessageId).eq("conversation_id", data.conversationId).maybeSingle();
	if (!pivot) throw new Response("Message not found", { status: 404 });
	const { data: msgs } = await context.supabase.from("ocade_messages").select("role, content, attachments, model_id, provider_id, created_at").eq("conversation_id", data.conversationId).lte("created_at", pivot.created_at).order("created_at", { ascending: true });
	const { data: created, error: cErr } = await context.supabase.from("ocade_conversations").insert({
		user_id: context.userId,
		title: data.title ?? `${source.title} (branch)`,
		project_id: source.project_id ?? null,
		model_id: source.model_id ?? null,
		provider_id: source.provider_id ?? null,
		privacy_mode: source.privacy_mode ?? "private_sync"
	}).select("id, title").single();
	if (cErr) throw new Response(cErr.message, { status: 500 });
	if ((msgs ?? []).length > 0) {
		const rows = (msgs ?? []).map((m) => ({
			conversation_id: created.id,
			user_id: context.userId,
			role: m.role,
			content: m.content,
			attachments: m.attachments,
			model_id: m.model_id,
			provider_id: m.provider_id
		}));
		const { error: mErr } = await context.supabase.from("ocade_messages").insert(rows);
		if (mErr) throw new Response(mErr.message, { status: 500 });
	}
	return created;
});
var forkConversationBeforeMessage_createServerFn_handler = createServerRpc({
	id: "7dffa02e02bdadae43f7d625e73e6de602a2256fa28450292677fcd5c102be54",
	name: "forkConversationBeforeMessage",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => forkConversationBeforeMessage.__executeServer(opts));
var forkConversationBeforeMessage = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => forkConversationBeforeInput.parse(i)).handler(forkConversationBeforeMessage_createServerFn_handler, async ({ data, context }) => {
	const { data: source } = await context.supabase.from("ocade_conversations").select("id, title, project_id, model_id, provider_id, privacy_mode").eq("id", data.conversationId).eq("user_id", context.userId).maybeSingle();
	if (!source) throw new Response("Conversation not found", { status: 404 });
	const { data: messages, error: messagesError } = await context.supabase.from("ocade_messages").select("id, role, content, attachments, model_id, provider_id, created_at").eq("conversation_id", data.conversationId).order("created_at", { ascending: true });
	if (messagesError) throw new Response(messagesError.message, { status: 500 });
	const pivot = (messages ?? []).findIndex((message) => message.id === data.fromMessageId);
	if (pivot < 0) throw new Response("Message not found", { status: 404 });
	if (messages[pivot].role !== "user") throw new Response("Edit and retry must begin from a user message", { status: 409 });
	const { data: created, error: conversationError } = await context.supabase.from("ocade_conversations").insert({
		user_id: context.userId,
		title: data.title ?? `${source.title} (branch)`,
		project_id: source.project_id ?? null,
		model_id: source.model_id ?? null,
		provider_id: source.provider_id ?? null,
		privacy_mode: source.privacy_mode ?? "private_sync"
	}).select("id, title").single();
	if (conversationError) throw new Response(conversationError.message, { status: 500 });
	const preceding = (messages ?? []).slice(0, pivot);
	if (preceding.length > 0) {
		const rows = preceding.map((message) => ({
			conversation_id: created.id,
			user_id: context.userId,
			role: message.role,
			content: message.content,
			attachments: message.attachments,
			model_id: message.model_id,
			provider_id: message.provider_id
		}));
		const { error } = await context.supabase.from("ocade_messages").insert(rows);
		if (error) throw new Response(error.message, { status: 500 });
	}
	return created;
});
var getOutput_createServerFn_handler = createServerRpc({
	id: "9884c21c97c91dbfde365d52cb8f91fda7aa87d5b88e4a485eaa6746e6ff302c",
	name: "getOutput",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => getOutput.__executeServer(opts));
var getOutput = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(getOutput_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("ocade_outputs").select("id, project_id, conversation_id, kind, title, content, mime, size_bytes, lineage_id, version, parent_output_id, content_sha256, expires_at, created_at").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
	if (error) throw new Response(error.message, { status: 500 });
	if (!row) throw new Response("Output not found", { status: 404 });
	return row;
});
var deleteOutput_createServerFn_handler = createServerRpc({
	id: "e55b0a6617210dc74969a8fc6cf8160785f54ec3b1922747262f6531672bcbbf",
	name: "deleteOutput",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => deleteOutput.__executeServer(opts));
var deleteOutput = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(deleteOutput_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("ocade_outputs").delete().eq("id", data.id).eq("user_id", context.userId).select("id").maybeSingle();
	if (error) throw new Response(error.message, { status: 500 });
	if (!row) throw new Response("Output not found", { status: 404 });
	return { ok: true };
});
var purgeExpiredOutputs_createServerFn_handler = createServerRpc({
	id: "3c95462e22d11ffdf31e031e8c616d9f837cdd3bee33d5c558bbc0e489ae2426",
	name: "purgeExpiredOutputs",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => purgeExpiredOutputs.__executeServer(opts));
var purgeExpiredOutputs = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(purgeExpiredOutputs_createServerFn_handler, async ({ context }) => {
	const { data, error } = await context.supabase.from("ocade_outputs").delete().eq("user_id", context.userId).lt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).select("id");
	if (error) throw new Response(error.message, { status: 500 });
	return { removed: (data ?? []).length };
});
var getMemoryEnabled_createServerFn_handler = createServerRpc({
	id: "b6d8613930e7725226a1fd30dce3be0dce0d5607ce7ac7da02e8505673324f28",
	name: "getMemoryEnabled",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => getMemoryEnabled.__executeServer(opts));
var getMemoryEnabled = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(getMemoryEnabled_createServerFn_handler, async ({ context }) => {
	const { data, error } = await context.supabase.from("user_settings").select("ocade_memory_enabled").eq("user_id", context.userId).maybeSingle();
	if (error) throw new Response(error.message, { status: 500 });
	return { enabled: Boolean(data?.ocade_memory_enabled) };
});
var setMemoryEnabled_createServerFn_handler = createServerRpc({
	id: "8fff4f94fc75cadd11024a0a609b866d1c26c3361b4be95dcef418e5acf8d704",
	name: "setMemoryEnabled",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => setMemoryEnabled.__executeServer(opts));
var setMemoryEnabled = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ enabled: booleanType() }).parse(i)).handler(setMemoryEnabled_createServerFn_handler, async ({ data, context }) => {
	const { error } = await context.supabase.from("user_settings").upsert({
		user_id: context.userId,
		ocade_memory_enabled: data.enabled
	}, { onConflict: "user_id" });
	if (error) throw new Response(error.message, { status: 500 });
	return { enabled: data.enabled };
});
var listMemory_createServerFn_handler = createServerRpc({
	id: "084efe89f8b9d2b06b80eacd907452bf2e046a8ce1dbf60249bc42d366970a2c",
	name: "listMemory",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => listMemory.__executeServer(opts));
var listMemory = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ projectId: uuid.nullable().optional() }).parse(i ?? {})).handler(listMemory_createServerFn_handler, async ({ data, context }) => {
	let q = context.supabase.from("ocade_memory").select("id, scope, project_id, content, source, pinned, expires_at, updated_at").eq("user_id", context.userId);
	if (data.projectId) q = q.eq("project_id", data.projectId);
	const { data: rows, error } = await q.order("updated_at", { ascending: false }).limit(500);
	if (error) throw new Response(error.message, { status: 500 });
	return rows ?? [];
});
var addMemory_createServerFn_handler = createServerRpc({
	id: "584068699dd8ed1bdc13da5a5d1430f04600042b947a88d9c46b9d506aca6a02",
	name: "addMemory",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => addMemory.__executeServer(opts));
var addMemory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	content: stringType().trim().min(1).max(8e3),
	scope: enumType(["user", "project"]).default("user"),
	projectId: uuid.nullable().optional(),
	source: enumType([
		"user",
		"inferred",
		"imported"
	]).default("user"),
	expiresAt: stringType().datetime().nullable().optional()
}).parse(i)).handler(addMemory_createServerFn_handler, async ({ data, context }) => {
	const { data: settings, error: settingsError } = await context.supabase.from("user_settings").select("ocade_memory_enabled").eq("user_id", context.userId).maybeSingle();
	if (settingsError) throw new Response(settingsError.message, { status: 500 });
	if (!settings?.ocade_memory_enabled) throw new Response("Memory is turned off. Enable it in Settings to let OCADE remember.", { status: 409 });
	const { data: row, error } = await context.supabase.from("ocade_memory").insert({
		user_id: context.userId,
		scope: data.scope,
		project_id: data.scope === "project" ? data.projectId ?? null : null,
		content: data.content,
		source: data.source,
		expires_at: data.expiresAt ?? null
	}).select("id, scope, project_id, content, source, pinned, expires_at, updated_at").single();
	if (error) throw new Response(error.message, { status: 500 });
	return row;
});
var updateMemory_createServerFn_handler = createServerRpc({
	id: "6b828d77e83041ce525333b91bcee234c1168c3d9034f55e126424bc85962ced",
	name: "updateMemory",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => updateMemory.__executeServer(opts));
var updateMemory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({
	id: uuid,
	content: stringType().trim().min(1).max(8e3).optional(),
	pinned: booleanType().optional(),
	expiresAt: stringType().datetime().nullable().optional()
}).parse(i)).handler(updateMemory_createServerFn_handler, async ({ data, context }) => {
	const patch = {};
	if (data.content !== void 0) patch.content = data.content;
	if (data.pinned !== void 0) patch.pinned = data.pinned;
	if (data.expiresAt !== void 0) patch.expires_at = data.expiresAt;
	const { data: row, error } = Object.keys(patch).length > 0 ? await context.supabase.from("ocade_memory").update(patch).eq("id", data.id).eq("user_id", context.userId).select("id").maybeSingle() : await context.supabase.from("ocade_memory").select("id").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
	if (error) throw new Response(error.message, { status: 500 });
	if (!row) throw new Response("Memory not found", { status: 404 });
	return { ok: true };
});
var deleteMemory_createServerFn_handler = createServerRpc({
	id: "5990dc5009767e92d07751f9b883e3fcf452a7b0c950444a7cef361cd27a1046",
	name: "deleteMemory",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => deleteMemory.__executeServer(opts));
var deleteMemory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator((i) => objectType({ id: uuid }).parse(i)).handler(deleteMemory_createServerFn_handler, async ({ data, context }) => {
	const { data: row, error } = await context.supabase.from("ocade_memory").delete().eq("id", data.id).eq("user_id", context.userId).select("id").maybeSingle();
	if (error) throw new Response(error.message, { status: 500 });
	if (!row) throw new Response("Memory not found", { status: 404 });
	return { ok: true };
});
var clearAllMemory_createServerFn_handler = createServerRpc({
	id: "9ad38e84f6c6f2a5290ad91d4b6e75c5db0c9cd1ec4461461172a445c1788c74",
	name: "clearAllMemory",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => clearAllMemory.__executeServer(opts));
var clearAllMemory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(clearAllMemory_createServerFn_handler, async ({ context }) => {
	const { error } = await context.supabase.from("ocade_memory").delete().eq("user_id", context.userId);
	if (error) throw new Response(error.message, { status: 500 });
	return { ok: true };
});
var purgeExpiredMemory_createServerFn_handler = createServerRpc({
	id: "fa02f91c2dbafca45390b1581fde2f9af46b42c31897dffa4af2a6b21dade765",
	name: "purgeExpiredMemory",
	filename: "src/lib/ocade-projects.functions.ts"
}, (opts) => purgeExpiredMemory.__executeServer(opts));
var purgeExpiredMemory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(purgeExpiredMemory_createServerFn_handler, async ({ context }) => {
	const { data, error } = await context.supabase.from("ocade_memory").delete().eq("user_id", context.userId).lt("expires_at", (/* @__PURE__ */ new Date()).toISOString()).select("id");
	if (error) throw new Response(error.message, { status: 500 });
	return { removed: (data ?? []).length };
});
//#endregion
export { addMemory_createServerFn_handler, branchConversation_createServerFn_handler, clearAllMemory_createServerFn_handler, createOutput_createServerFn_handler, createProject_createServerFn_handler, deleteMemory_createServerFn_handler, deleteOutput_createServerFn_handler, deleteProject_createServerFn_handler, forkConversationBeforeMessage_createServerFn_handler, getMemoryEnabled_createServerFn_handler, getOutput_createServerFn_handler, getProject_createServerFn_handler, listMemory_createServerFn_handler, listOutputs_createServerFn_handler, listProjectConversations_createServerFn_handler, listProjects_createServerFn_handler, purgeExpiredMemory_createServerFn_handler, purgeExpiredOutputs_createServerFn_handler, setConversationProject_createServerFn_handler, setMemoryEnabled_createServerFn_handler, updateMemory_createServerFn_handler, updateProject_createServerFn_handler };

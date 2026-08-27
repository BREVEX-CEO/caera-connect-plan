import { c as sha256 } from "./store-DGu3SiHe.mjs";
import { n as enqueue, t as drainNow } from "./sync-queue-Cda0l5N0.mjs";
import { i as resolveAdapter } from "./resolver-gEbqMemW.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/local-projects-CvPOi7AN.js
/**
* Conversations that exist on this device before they exist anywhere else.
*
* WHAT WAS WRONG. `createConversation` was a server function: it INSERTed into
* `ocade_conversations` and returned the row, and the id came back from
* Postgres. So the id of a conversation could not exist until a round trip
* succeeded, which means starting a brand-new chat required the network — in
* every privacy mode, including the two whose entire promise is that they do
* not need one. And `loadChatMessages` for `private_sync` called `listMessages`
* and nothing else, so opening an existing synchronised chat offline returned
* an empty transcript rather than the messages sitting in the vault.
*
* Local-first has to hold in BOTH directions or it is not local-first: writing
* to the device and then reading back from the server is just a slower way of
* depending on the server.
*
* So ids are made here, the record is written here, and the server is told
* afterwards. Every read prefers this device.
*/
/**
* A time-ordered unique id, generated here.
*
* UUIDv7-shaped: 48 bits of millisecond timestamp then randomness. Sorting by
* id therefore sorts by creation time, which is what lets a merge of two
* devices' conversations come out in a sensible order without a clock
* negotiation. `crypto.randomUUID` would have been simpler and sorts randomly.
*
* The server column is a uuid, so this must remain a syntactically valid uuid:
* version nibble 7 and the variant bits are set explicitly rather than left to
* chance, because an id Postgres rejects would fail only on the sync path,
* long after the conversation looked fine on the device.
*/
function newConversationId(now = Date.now()) {
	const bytes = /* @__PURE__ */ new Uint8Array(16);
	crypto.getRandomValues(bytes);
	const ts = BigInt(now);
	for (let i = 0; i < 6; i += 1) bytes[i] = Number(ts >> BigInt(8 * (5 - i)) & 255n);
	bytes[6] = bytes[6] & 15 | 112;
	bytes[8] = bytes[8] & 63 | 128;
	const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
/**
* Conversation metadata lives in the `chats` data class alongside messages,
* under a key prefix that cannot collide with a message key.
*
* Message keys are `${conversationId}::${createdAt}::${suffix}`; this prefix
* contains no `::` before the id, so the two are separable by inspection and a
* conversation can never be mistaken for a message when listing.
*/
var CONVERSATION_PREFIX = "conv:";
function keyFor(id) {
	return `${CONVERSATION_PREFIX}${id}`;
}
function isConversationKey(id) {
	return id.startsWith(CONVERSATION_PREFIX);
}
/**
* Create a conversation on this device.
*
* Returns immediately with a usable record. Nothing here awaits the network:
* the server copy is queued and drained in the background, so this works with
* the connection down and the conversation is real either way.
*/
async function createConversationLocally(userId, input) {
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const record = {
		id: newConversationId(),
		title: input.title ?? "New chat",
		pinned: false,
		archived: false,
		model_id: input.modelId ?? null,
		privacy_mode: input.privacyMode,
		updated_at: now,
		created_at: now,
		project_id: input.projectId ?? null,
		deleted_at: null
	};
	await (await resolveAdapter(userId, "chats")).put("chats", keyFor(record.id), record);
	if (input.privacyMode === "private_sync") {
		await enqueue({
			dataClass: "chats",
			id: keyFor(record.id),
			value: record
		});
		drainNow();
	}
	return record;
}
/** Every conversation this device knows about, newest first, deletes hidden. */
async function listConversationsLocally(userId) {
	return (await (await resolveAdapter(userId, "chats")).list("chats")).filter((r) => isConversationKey(r.id)).map((r) => r.value).filter((c) => Boolean(c?.id) && !c.deleted_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
async function getConversationLocally(userId, id) {
	return (await (await resolveAdapter(userId, "chats")).get("chats", keyFor(id)))?.value ?? null;
}
/**
* Change a conversation on this device — rename, pin, archive, project, model.
*
* Reads, merges and writes rather than taking a whole record, so a caller
* changing one field cannot blank the others by omission.
*/
async function updateConversationLocally(userId, id, patch) {
	const existing = await getConversationLocally(userId, id);
	if (!existing) return null;
	const next = {
		...existing,
		...patch,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	};
	await (await resolveAdapter(userId, "chats")).put("chats", keyFor(id), next);
	if (next.privacy_mode === "private_sync") {
		await enqueue({
			dataClass: "chats",
			id: keyFor(id),
			value: next
		});
		drainNow();
	}
	return next;
}
/**
* Delete as a TOMBSTONE, not a removal.
*
* A row simply removed from this device comes back on the next merge from a
* device that was offline when the delete happened — the classic "I deleted
* that yesterday" bug. Keeping a marker with `deleted_at` means the deletion
* is a fact that travels, and `mergeRemoteConversations` below refuses to
* resurrect anything carrying one.
*/
async function deleteConversationLocally(userId, id) {
	const existing = await getConversationLocally(userId, id);
	if (!existing) return;
	const tombstone = {
		...existing,
		deleted_at: (/* @__PURE__ */ new Date()).toISOString(),
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	};
	await (await resolveAdapter(userId, "chats")).put("chats", keyFor(id), tombstone);
	if (existing.privacy_mode === "private_sync") {
		await enqueue({
			dataClass: "chats",
			id: keyFor(id),
			value: tombstone
		});
		drainNow();
	}
}
/**
* Fold conversations from another device into this one.
*
* The rules, in order, and each exists because of a specific way this goes
* wrong:
*
*  - A local tombstone always wins. Otherwise a second device that never saw
*    the delete keeps handing the row back and it reappears forever.
*  - Otherwise the newer `updated_at` wins. Both sides are the same user's
*    edits to the same immutable-id record, so last-write-wins is right here
*    and a merge dialog would be theatre.
*  - An unseen remote row is added. That is the whole point of syncing.
*
* Pure, so every branch is testable without a database.
*/
function mergeRemoteConversations(local, remote) {
	const byId = new Map(local.map((c) => [c.id, c]));
	for (const incoming of remote) {
		const mine = byId.get(incoming.id);
		if (!mine) {
			byId.set(incoming.id, incoming);
			continue;
		}
		if (mine.deleted_at) continue;
		if (incoming.deleted_at) {
			byId.set(incoming.id, incoming);
			continue;
		}
		if (incoming.updated_at > mine.updated_at) byId.set(incoming.id, incoming);
	}
	return [...byId.values()].filter((c) => !c.deleted_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
/**
* Device-authoritative Projects and Outputs.
*
* Records use the existing encrypted `files` storage class. Browser Only never
* leaves the device; Private Sync writes the same encrypted local record first
* and lets the storage outbox copy it to the user's RLS-scoped private records.
*/
var PROJECT_PREFIX = "project:";
var OUTPUT_PREFIX = "output:";
function projectKey(id) {
	return `${PROJECT_PREFIX}${id}`;
}
function outputKey(id) {
	return `${OUTPUT_PREFIX}${id}`;
}
function isLocalProjectKey(id) {
	return id.startsWith(PROJECT_PREFIX);
}
function isLocalOutputKey(id) {
	return id.startsWith(OUTPUT_PREFIX);
}
function validName(name, limit, label) {
	const value = name.trim();
	if (!value) throw new Error(`${label} is required.`);
	if (value.length > limit) throw new Error(`${label} must be ${limit} characters or fewer.`);
	return value;
}
async function records(userId) {
	const adapter = await resolveAdapter(userId, "files");
	return {
		adapter,
		rows: await adapter.list("files")
	};
}
async function listLocalProjects(userId, includeArchived = false) {
	const { rows } = await records(userId);
	return rows.filter((row) => isLocalProjectKey(row.id)).map((row) => row.value).filter((project) => project?.record_type === "project" && !project.deleted_at && (includeArchived || !project.archived)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}
async function createLocalProject(userId, input) {
	const name = validName(input.name, 200, "Project name");
	const instructions = input.instructions ?? null;
	if (instructions && instructions.length > 2e4) throw new Error("Project instructions must be 20,000 characters or fewer.");
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const project = {
		record_type: "project",
		id: newConversationId(),
		name,
		instructions,
		archived: false,
		created_at: now,
		updated_at: now,
		deleted_at: null
	};
	await (await resolveAdapter(userId, "files")).put("files", projectKey(project.id), project);
	return project;
}
async function getLocalProject(userId, id) {
	const row = await (await resolveAdapter(userId, "files")).get("files", projectKey(id));
	if (!row?.value || row.value.deleted_at) throw new Error("Project not found.");
	return row.value;
}
async function updateLocalProject(userId, id, patch) {
	const adapter = await resolveAdapter(userId, "files");
	const current = await adapter.get("files", projectKey(id));
	if (!current?.value || current.value.deleted_at) throw new Error("Project not found.");
	const name = patch.name === void 0 ? current.value.name : validName(patch.name, 200, "Project name");
	if (patch.instructions && patch.instructions.length > 2e4) throw new Error("Project instructions must be 20,000 characters or fewer.");
	const next = {
		...current.value,
		name,
		instructions: patch.instructions === void 0 ? current.value.instructions : patch.instructions,
		archived: patch.archived ?? current.value.archived,
		updated_at: (/* @__PURE__ */ new Date()).toISOString()
	};
	await adapter.put("files", projectKey(id), next);
	return next;
}
async function deleteLocalProject(userId, id) {
	const adapter = await resolveAdapter(userId, "files");
	const current = await adapter.get("files", projectKey(id));
	if (!current?.value || current.value.deleted_at) throw new Error("Project not found.");
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const conversations = await listConversationsLocally(userId);
	for (const conversation of conversations) if (conversation.project_id === id) await updateConversationLocally(userId, conversation.id, { project_id: null });
	await adapter.put("files", projectKey(id), {
		...current.value,
		deleted_at: now,
		updated_at: now
	});
	const rows = await adapter.list("files");
	await Promise.all(rows.filter((row) => isLocalOutputKey(row.id) && row.value?.project_id === id && !row.value.deleted_at).map((row) => adapter.put("files", row.id, {
		...row.value,
		deleted_at: now,
		updated_at: now
	})));
}
async function listLocalOutputs(userId, projectId) {
	const { rows } = await records(userId);
	return rows.filter((row) => isLocalOutputKey(row.id)).map((row) => row.value).filter((output) => output?.record_type === "output" && !output.deleted_at && (projectId === void 0 || output.project_id === projectId)).sort((a, b) => b.created_at.localeCompare(a.created_at));
}
async function getLocalOutput(userId, id) {
	const row = await (await resolveAdapter(userId, "files")).get("files", outputKey(id));
	if (!row?.value || row.value.deleted_at) throw new Error("Output not found.");
	return row.value;
}
async function createLocalOutput(userId, input) {
	const title = validName(input.title, 300, "Output title");
	const content = input.content ?? null;
	if (content && content.length > 1e6) throw new Error("Output content must be 1,000,000 characters or fewer.");
	if (input.mime && input.mime.length > 200) throw new Error("Output MIME type is too long.");
	if (input.retentionDays != null && (!Number.isInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 3650)) throw new Error("Output retention must be between 1 and 3,650 days.");
	const adapter = await resolveAdapter(userId, "files");
	let parent = null;
	if (input.parentOutputId) parent = await getLocalOutput(userId, input.parentOutputId);
	if (parent && (input.projectId !== void 0 && input.projectId !== parent.project_id || input.conversationId !== void 0 && input.conversationId !== parent.conversation_id || input.kind !== parent.kind || title !== parent.title)) throw new Error("A new version must keep its parent output's project, conversation, kind and title.");
	const all = await listLocalOutputs(userId);
	const lineageId = parent?.lineage_id ?? newConversationId();
	const version = parent ? Math.max(0, ...all.filter((row) => row.lineage_id === lineageId).map((row) => row.version)) + 1 : 1;
	const digest = content === null ? null : await sha256(content);
	if (digest && !digest.ok) throw new Error(digest.reason);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const output = {
		record_type: "output",
		id: newConversationId(),
		project_id: parent?.project_id ?? input.projectId ?? null,
		conversation_id: parent?.conversation_id ?? input.conversationId ?? null,
		parent_output_id: parent?.id ?? null,
		kind: input.kind,
		title,
		content,
		mime: input.mime ?? null,
		size_bytes: content ? new TextEncoder().encode(content).length : 0,
		lineage_id: lineageId,
		version,
		content_sha256: digest?.ok ? digest.data : null,
		expires_at: input.retentionDays == null ? null : new Date(Date.now() + input.retentionDays * 864e5).toISOString(),
		created_at: now,
		updated_at: now,
		deleted_at: null
	};
	await adapter.put("files", outputKey(output.id), output);
	return output;
}
async function deleteLocalOutput(userId, id) {
	const adapter = await resolveAdapter(userId, "files");
	const current = await getLocalOutput(userId, id);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	await adapter.put("files", outputKey(id), {
		...current,
		deleted_at: now,
		updated_at: now
	});
}
async function purgeExpiredLocalOutputs(userId, now = /* @__PURE__ */ new Date()) {
	const expired = (await listLocalOutputs(userId)).filter((output) => output.expires_at !== null && Date.parse(output.expires_at) <= now.getTime());
	await Promise.all(expired.map((output) => deleteLocalOutput(userId, output.id)));
	return { removed: expired.length };
}
//#endregion
export { updateConversationLocally as _, deleteLocalOutput as a, getLocalProject as c, isLocalProjectKey as d, listConversationsLocally as f, purgeExpiredLocalOutputs as g, mergeRemoteConversations as h, deleteConversationLocally as i, isConversationKey as l, listLocalProjects as m, createLocalOutput as n, deleteLocalProject as o, listLocalOutputs as p, createLocalProject as r, getLocalOutput as s, createConversationLocally as t, isLocalOutputKey as u, updateLocalProject as v };

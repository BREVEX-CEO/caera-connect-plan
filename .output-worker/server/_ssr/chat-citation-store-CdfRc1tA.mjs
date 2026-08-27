import { c as sha256 } from "./store-DGu3SiHe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/chat-citation-store-CdfRc1tA.js
var STORAGE_KEY$1 = "ocade.project-files.v1";
var MAX_FILE_BYTES = 20 * 1024 * 1024;
var MAX_TEXT_CHARS = 25e4;
var MAX_FILES = 200;
function validFile(value) {
	if (!value || typeof value !== "object") return false;
	const file = value;
	return typeof file.id === "string" && typeof file.projectId === "string" && (file.folder === void 0 || typeof file.folder === "string") && typeof file.name === "string" && typeof file.mime === "string" && typeof file.sizeBytes === "number" && typeof file.text === "string" && typeof file.sha256 === "string" && /^[0-9a-f]{64}$/.test(file.sha256) && typeof file.createdAt === "string";
}
function read$1() {
	const storage = globalThis.localStorage;
	if (!storage) return {
		ok: false,
		reason: "Browser storage is unavailable for project files."
	};
	try {
		const raw = storage.getItem(STORAGE_KEY$1);
		if (!raw) return {
			ok: true,
			data: [],
			evidence: "No project files stored."
		};
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length > MAX_FILES || !parsed.every(validFile)) return {
			ok: false,
			reason: "Project file storage is corrupt; nothing was changed."
		};
		const files = parsed.map((file) => ({
			...file,
			folder: file.folder ?? ""
		}));
		return {
			ok: true,
			data: files,
			evidence: `${files.length} project files read.`
		};
	} catch {
		return {
			ok: false,
			reason: "Project file storage is corrupt; nothing was changed."
		};
	}
}
function write$1(files) {
	const storage = globalThis.localStorage;
	if (!storage) return {
		ok: false,
		reason: "Browser storage is unavailable for project files."
	};
	try {
		storage.setItem(STORAGE_KEY$1, JSON.stringify(files));
		return {
			ok: true,
			data: files.length,
			evidence: `${files.length} project files stored.`
		};
	} catch (error) {
		return {
			ok: false,
			reason: `Project file could not be saved: ${error instanceof Error ? error.message : "storage refused it"}.`
		};
	}
}
function listProjectFiles(projectId) {
	const stored = read$1();
	if (!stored.ok) return stored;
	const files = stored.data.filter((file) => file.projectId === projectId);
	return {
		ok: true,
		data: files,
		evidence: `${files.length} files in this project.`
	};
}
async function saveProjectFile(input) {
	if (!input.projectId.trim()) return {
		ok: false,
		reason: "A project is required."
	};
	if (!input.name.trim()) return {
		ok: false,
		reason: "A file name is required."
	};
	if (input.sizeBytes < 0 || input.sizeBytes > MAX_FILE_BYTES) return {
		ok: false,
		reason: "Project files must be 20 MB or smaller."
	};
	if (!input.text.trim()) return {
		ok: false,
		reason: "No readable text was extracted from this file."
	};
	if (input.text.length > MAX_TEXT_CHARS) return {
		ok: false,
		reason: "Extracted project-file text exceeds the 250,000 character limit."
	};
	const stored = read$1();
	if (!stored.ok) return stored;
	if (stored.data.length >= MAX_FILES) return {
		ok: false,
		reason: `Project file storage is full (${MAX_FILES} files).`
	};
	const folder = normalizeProjectFolder(input.folder ?? "");
	if (folder === null) return {
		ok: false,
		reason: "Project folder paths cannot contain . or .. segments."
	};
	const digest = await sha256(input.text);
	if (!digest.ok) return digest;
	if (stored.data.some((existing) => existing.projectId === input.projectId && existing.folder === folder && existing.name === input.name.trim() && existing.sha256 === digest.data)) return {
		ok: false,
		reason: "That exact project file is already saved in this folder."
	};
	const file = {
		id: input.id ?? `project-file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		projectId: input.projectId,
		folder,
		name: input.name.trim(),
		mime: input.mime,
		sizeBytes: input.sizeBytes,
		text: input.text,
		sha256: digest.data,
		createdAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString()
	};
	const saved = write$1([file, ...stored.data]);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: file,
		evidence: `Saved and fingerprinted “${file.name}” on this device.`
	};
}
function normalizeProjectFolder(path) {
	const normalized = path.replaceAll("\\", "/").split("/").map((segment) => segment.trim()).filter(Boolean);
	if (normalized.some((segment) => segment === "." || segment === "..")) return null;
	return normalized.join("/");
}
function removeProjectFile(id) {
	const stored = read$1();
	if (!stored.ok) return stored;
	const next = stored.data.filter((file) => file.id !== id);
	if (next.length === stored.data.length) return {
		ok: false,
		reason: "That project file is not here; nothing was deleted."
	};
	const saved = write$1(next);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: { removed: true },
		evidence: "Project file deleted from this device."
	};
}
function removeProjectFilesForProject(projectId) {
	const stored = read$1();
	if (!stored.ok) return stored;
	const next = stored.data.filter((file) => file.projectId !== projectId);
	const removed = stored.data.length - next.length;
	if (removed === 0) return {
		ok: true,
		data: { removed: 0 },
		evidence: "No on-device project files to delete."
	};
	const saved = write$1(next);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: { removed },
		evidence: `${removed} on-device project ${removed === 1 ? "file" : "files"} deleted.`
	};
}
var STORAGE_KEY = "ocade.chat-citations.v1";
var MAX_RECORDS = 5e3;
function validLocator(value) {
	if (!value || typeof value !== "object") return false;
	const locator = value;
	return (locator.line === void 0 || Number.isInteger(locator.line) && locator.line > 0) && (locator.page === void 0 || Number.isInteger(locator.page) && locator.page > 0) && (locator.sheet === void 0 || typeof locator.sheet === "string") && (locator.section === void 0 || typeof locator.section === "string");
}
function validCitation(value) {
	if (!value || typeof value !== "object") return false;
	const citation = value;
	return typeof citation.sourceId === "string" && /^(?:S|W)\d+$/.test(citation.sourceId) && typeof citation.name === "string" && typeof citation.kind === "string" && validLocator(citation.locator) && (citation.snippet === null || typeof citation.snippet === "string") && (citation.provenance === void 0 || citation.provenance === "attached_document" || citation.provenance === "project_context" || citation.provenance === "internet_evidence") && (citation.url === void 0 || typeof citation.url === "string") && (citation.domain === void 0 || typeof citation.domain === "string") && (citation.publishedAt === void 0 || citation.publishedAt === null || typeof citation.publishedAt === "string") && (citation.retrievedAt === void 0 || typeof citation.retrievedAt === "string");
}
function validRecord(value) {
	if (!value || typeof value !== "object") return false;
	const record = value;
	return typeof record.conversationId === "string" && typeof record.messageId === "string" && Array.isArray(record.citations) && record.citations.length <= 10 && record.citations.every(validCitation) && typeof record.savedAt === "string";
}
function read() {
	const storage = globalThis.localStorage;
	if (!storage) return {
		ok: false,
		reason: "Browser storage is unavailable for citation history."
	};
	try {
		const raw = storage.getItem(STORAGE_KEY);
		if (!raw) return {
			ok: true,
			data: [],
			evidence: "No citation history stored."
		};
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length > MAX_RECORDS || !parsed.every(validRecord)) return {
			ok: false,
			reason: "Citation history is corrupt; nothing was changed."
		};
		return {
			ok: true,
			data: parsed,
			evidence: `${parsed.length} citation records read.`
		};
	} catch {
		return {
			ok: false,
			reason: "Citation history is corrupt; nothing was changed."
		};
	}
}
function write(records) {
	const storage = globalThis.localStorage;
	if (!storage) return {
		ok: false,
		reason: "Browser storage is unavailable for citation history."
	};
	try {
		storage.setItem(STORAGE_KEY, JSON.stringify(records));
		return {
			ok: true,
			data: records.length,
			evidence: `${records.length} citation records stored.`
		};
	} catch (error) {
		return {
			ok: false,
			reason: `Citation history could not be saved: ${error instanceof Error ? error.message : "storage refused it"}.`
		};
	}
}
function saveChatCitations(input) {
	if (!input.conversationId || !input.messageId) return {
		ok: false,
		reason: "A conversation and exact assistant message are required."
	};
	if (input.citations.length === 0 || input.citations.length > 10) return {
		ok: false,
		reason: "Citation history requires 1 to 10 verified citations."
	};
	if (!input.citations.every(validCitation)) return {
		ok: false,
		reason: "Citation history contains invalid source evidence."
	};
	const current = read();
	if (!current.ok) return current;
	const record = {
		conversationId: input.conversationId,
		messageId: input.messageId,
		citations: input.citations,
		savedAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString()
	};
	const saved = write([record, ...current.data.filter((row) => row.conversationId !== input.conversationId || row.messageId !== input.messageId)].slice(0, MAX_RECORDS));
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: record,
		evidence: "Citation evidence saved for this response."
	};
}
function getChatCitations(conversationId, messageId) {
	const current = read();
	if (!current.ok) return current;
	const record = current.data.find((row) => row.conversationId === conversationId && row.messageId === messageId);
	return {
		ok: true,
		data: record?.citations ?? null,
		evidence: record ? "Citation evidence restored." : "No citation evidence stored for this response."
	};
}
/**
* Remove every citation that quotes one source, across all conversations.
*
* WHY THIS EXISTS. A citation carries a `snippet` — a verbatim excerpt of the
* document it cites. Deleting the file while leaving its citations behind means
* the user asked for a document to be gone and its text is still on disk, still
* rendered under old assistant replies. The excerpt is small, which is exactly
* why it gets forgotten, and it is still their content.
*
* Matched on `name`, because that is the only identifier a Citation carries.
* Records that end up with no citations left are dropped entirely rather than
* kept as empty shells — an empty record still names the conversation.
*/
function removeCitationsForSource(name) {
	const target = name.trim();
	if (!target) return {
		ok: false,
		reason: "A source name is required."
	};
	const current = read();
	if (!current.ok) return current;
	let removed = 0;
	const next = [];
	for (const row of current.data) {
		const kept = row.citations.filter((citation) => citation.name !== target);
		removed += row.citations.length - kept.length;
		if (kept.length > 0) next.push({
			...row,
			citations: kept
		});
	}
	if (removed === 0) return {
		ok: true,
		data: { removed: 0 },
		evidence: "No stored citations quote that source."
	};
	const saved = write(next);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: { removed },
		evidence: `${removed} stored ${removed === 1 ? "excerpt" : "excerpts"} of “${target}” deleted.`
	};
}
function removeConversationCitations(conversationId) {
	const current = read();
	if (!current.ok) return current;
	const next = current.data.filter((row) => row.conversationId !== conversationId);
	const removed = current.data.length - next.length;
	if (removed === 0) return {
		ok: true,
		data: { removed: 0 },
		evidence: "No local citation evidence to delete."
	};
	const saved = write(next);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: { removed },
		evidence: `${removed} citation records deleted.`
	};
}
//#endregion
export { removeConversationCitations as a, saveChatCitations as c, removeCitationsForSource as i, saveProjectFile as l, listProjectFiles as n, removeProjectFile as o, normalizeProjectFolder as r, removeProjectFilesForProject as s, getChatCitations as t };

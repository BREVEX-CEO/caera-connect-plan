import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { _ as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { Dr as ArchiveRestore, Er as Archive, Nt as MessageSquare, On as Download, W as Save, Wt as LoaderCircle, fn as FolderPlus, h as Trash2, it as Plus, mt as Paperclip, pn as FolderOpen, t as X, yn as FileOutput } from "../_libs/lucide-react.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as useSession } from "./session-Bq1TXK1R.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as DialogHeader, i as DialogFooter, n as DialogContent, o as DialogTitle, t as Dialog } from "./dialog-CCT-3-fg.mjs";
import { t as EmptyState } from "./EmptyState-Bm7ErAtz.mjs";
import { t as SetupRequiredState } from "./SetupRequiredState-CYfm-mjI.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as Textarea } from "./textarea-kko37XEX.mjs";
import { t as getModeFor } from "./resolver-gEbqMemW.mjs";
import { _ as updateConversationLocally, a as deleteLocalOutput, f as listConversationsLocally, g as purgeExpiredLocalOutputs, m as listLocalProjects, n as createLocalOutput, o as deleteLocalProject, p as listLocalOutputs, r as createLocalProject, s as getLocalOutput, v as updateLocalProject } from "./local-projects-CvPOi7AN.mjs";
import { i as removeCitationsForSource, l as saveProjectFile, n as listProjectFiles, o as removeProjectFile, r as normalizeProjectFolder, s as removeProjectFilesForProject } from "./chat-citation-store-CdfRc1tA.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade.projects-8M4HnZbP.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Deleting an attachment, everywhere it left a trace.
*
* THE PROBLEM THIS SOLVES. An uploaded file does not live in one place. By the
* time it has been used in a conversation it has scattered:
*
*   - the extracted text, in the project-file store
*   - verbatim excerpts, in saved citations under old assistant replies
*   - the encrypted payload, in the browser vault
*   - cached copies, in Cache Storage
*   - the metadata, embedded in chat message records
*   - and when synced: a database row plus the bytes in a storage bucket
*
* "Delete" implemented as one `DELETE FROM` removes the most visible copy and
* leaves the rest. The user is told the document is gone while its text is
* still readable in a citation snippet and its bytes are still in a bucket.
*
* TWO RULES MAKE THIS CORRECT, AND THEY PULL IN OPPOSITE DIRECTIONS.
*
* 1. REMOTE ORDER IS FIXED: bytes before row. The database row holds
*    `storage_path`, which is the only record of where the bytes are. Delete
*    the row first, fail on the object, and the bytes are unreachable forever.
*    The reverse leaves a row pointing at a missing object, which is visible,
*    reportable and fixable. (The database also writes a tombstone on delete,
*    so a cascade cannot orphan an object either — see
*    `20260806120000_ocade_attachment_deletion.sql`.)
*
* 2. LOCAL SITES ARE ALL ATTEMPTED, EVEN AFTER ONE FAILS. Aborting at the
*    first failure is the intuitive choice and the wrong one: it leaves a
*    partial deletion, reports failure, and the user retries into the same
*    wall while the sites after the failure have never once been tried. Every
*    site is attempted; the receipt says precisely which ones still hold data.
*
* WHAT IS NOT LISTED HERE. Retrieval passages and the BM25 index are computed
* from the extracted text at query time and never persisted, so they cease to
* exist when the project-file record does. They get no deletion step because
* inventing one would imply a store that does not exist — and a deletion
* receipt that lists imaginary work is exactly the reassurance this module is
* built to avoid.
*/
/** Remove any cached response whose URL mentions this attachment. */
async function clearCached(name, store) {
	if (!store) return {
		site: "cached_copies",
		cleared: true,
		detail: "No cache store on this device."
	};
	try {
		let removed = 0;
		const needle = encodeURIComponent(name);
		for (const cacheName of await store.keys()) {
			const cache = await store.open(cacheName);
			for (const request of await cache.keys()) if (request.url.includes(needle) || request.url.includes(name)) {
				if (await cache.delete(request)) removed += 1;
			}
		}
		return {
			site: "cached_copies",
			cleared: true,
			detail: removed === 0 ? "No cached copies were held." : `${removed} cached ${removed === 1 ? "copy" : "copies"} deleted.`
		};
	} catch (error) {
		return {
			site: "cached_copies",
			cleared: false,
			detail: `Cached copies could not be reached: ${error instanceof Error ? error.message : "the browser refused"}.`
		};
	}
}
/**
* Delete one attachment from every site it occupies.
*
* Never throws. A deletion routine that throws halfway is the partial-deletion
* failure mode with a stack trace attached; the caller needs the receipt more
* than it needs the exception.
*/
async function deleteAttachment(ref, ports = {}) {
	const outcomes = [];
	if (ref.fileId) {
		const result = removeProjectFile(ref.fileId);
		outcomes.push({
			site: "extracted_text",
			cleared: result.ok || /not here/i.test(result.reason ?? ""),
			detail: result.ok ? "Extracted text and its fingerprint deleted. Retrieval passages and the search index were derived from it and no longer exist." : result.reason ?? "Extracted text could not be deleted."
		});
	}
	const citations = removeCitationsForSource(ref.name);
	outcomes.push({
		site: "citation_excerpts",
		cleared: citations.ok,
		detail: citations.ok ? citations.evidence ?? "Stored excerpts deleted." : citations.reason ?? "Stored excerpts could not be deleted."
	});
	if (ref.vaultId && ref.vaultClass) try {
		await ports.adapter?.delete(ref.vaultClass, ref.vaultId);
		outcomes.push({
			site: "vault_payload",
			cleared: true,
			detail: "Encrypted copy deleted from this device's vault."
		});
	} catch (error) {
		outcomes.push({
			site: "vault_payload",
			cleared: false,
			detail: `Vault copy not deleted: ${error instanceof Error ? error.message : "the vault refused"}.`
		});
	}
	outcomes.push(await clearCached(ref.name, ports.caches ?? (typeof caches !== "undefined" ? caches : void 0)));
	if (ref.remote) {
		const bucket = ref.remote.bucket ?? "message-attachments";
		let objectGone = false;
		try {
			objectGone = await ports.deleteRemoteObject?.(bucket, ref.remote.storagePath) ?? false;
		} catch {
			objectGone = false;
		}
		outcomes.push({
			site: "remote_object",
			cleared: objectGone,
			detail: objectGone ? "The stored file was deleted from the server." : "The stored file could not be deleted from the server yet."
		});
		if (objectGone) {
			let rowGone = false;
			try {
				rowGone = await ports.deleteRemoteRow?.(ref.remote.rowId) ?? false;
			} catch {
				rowGone = false;
			}
			outcomes.push({
				site: "remote_row",
				cleared: rowGone,
				detail: rowGone ? "The server record was deleted." : "The server record remains and still points at the deleted file."
			});
		} else outcomes.push({
			site: "remote_row",
			cleared: false,
			detail: "The server record was kept on purpose: it is the only record of where the file is stored, and deleting it would leave the file on the server with nothing able to find it. Deleting again will retry."
		});
	}
	const remaining = outcomes.filter((o) => !o.cleared).map((o) => o.site);
	const complete = remaining.length === 0;
	return {
		complete,
		outcomes,
		remaining,
		summary: complete ? `“${ref.name}” was deleted from every place it was stored.` : `“${ref.name}” was partly deleted. ${remaining.length} ${remaining.length === 1 ? "place" : "places"} still hold data — deleting again retries only those.`
	};
}
/** Plain-language name for a site, for the deletion receipt UI. */
function describeSite(site) {
	switch (site) {
		case "extracted_text": return "Text read from the file";
		case "citation_excerpts": return "Quoted excerpts in past replies";
		case "vault_payload": return "Encrypted copy on this device";
		case "cached_copies": return "Cached copies";
		case "remote_object": return "The file on the server";
		case "remote_row": return "The server record";
	}
}
var STORAGE_KEY = "ocade.project-folders.v1";
var MAX_FOLDERS = 500;
function validFolder(value) {
	if (!value || typeof value !== "object") return false;
	const folder = value;
	return typeof folder.id === "string" && typeof folder.projectId === "string" && typeof folder.path === "string" && folder.path.length > 0 && normalizeProjectFolder(folder.path) === folder.path && typeof folder.createdAt === "string";
}
function read() {
	const storage = globalThis.localStorage;
	if (!storage) return {
		ok: false,
		reason: "Browser storage is unavailable for project folders."
	};
	try {
		const raw = storage.getItem(STORAGE_KEY);
		if (!raw) return {
			ok: true,
			data: [],
			evidence: "No project folders stored."
		};
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length > MAX_FOLDERS || !parsed.every(validFolder)) return {
			ok: false,
			reason: "Project folder storage is corrupt; nothing was changed."
		};
		return {
			ok: true,
			data: parsed,
			evidence: `${parsed.length} project folders read.`
		};
	} catch {
		return {
			ok: false,
			reason: "Project folder storage is corrupt; nothing was changed."
		};
	}
}
function write(folders) {
	const storage = globalThis.localStorage;
	if (!storage) return {
		ok: false,
		reason: "Browser storage is unavailable for project folders."
	};
	try {
		storage.setItem(STORAGE_KEY, JSON.stringify(folders));
		return {
			ok: true,
			data: folders.length,
			evidence: `${folders.length} project folders stored.`
		};
	} catch (error) {
		return {
			ok: false,
			reason: `Project folders could not be saved: ${error instanceof Error ? error.message : "storage refused it"}.`
		};
	}
}
function listProjectFolders(projectId) {
	const current = read();
	if (!current.ok) return current;
	const folders = current.data.filter((folder) => folder.projectId === projectId).sort((a, b) => a.path.localeCompare(b.path));
	return {
		ok: true,
		data: folders,
		evidence: `${folders.length} folders in this project.`
	};
}
function createProjectFolder(input) {
	const path = normalizeProjectFolder(input.path);
	if (!input.projectId.trim()) return {
		ok: false,
		reason: "A project is required."
	};
	if (!path) return {
		ok: false,
		reason: "Enter a non-root folder without . or .. segments."
	};
	if (path.length > 500) return {
		ok: false,
		reason: "Project folder paths are limited to 500 characters."
	};
	const current = read();
	if (!current.ok) return current;
	if (current.data.length >= MAX_FOLDERS) return {
		ok: false,
		reason: `Project folder storage is full (${MAX_FOLDERS} folders).`
	};
	if (current.data.some((folder) => folder.projectId === input.projectId && folder.path === path)) return {
		ok: false,
		reason: "That project folder already exists."
	};
	const folder = {
		id: input.id ?? `project-folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		projectId: input.projectId,
		path,
		createdAt: (input.now ?? /* @__PURE__ */ new Date()).toISOString()
	};
	const saved = write([folder, ...current.data]);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: folder,
		evidence: `Created project folder “${path}”.`
	};
}
function removeProjectFolder(projectId, path) {
	const normalized = normalizeProjectFolder(path);
	if (!normalized) return {
		ok: false,
		reason: "That project folder path is invalid."
	};
	const files = listProjectFiles(projectId);
	if (!files.ok) return files;
	if (files.data.some((file) => file.folder === normalized || file.folder.startsWith(`${normalized}/`))) return {
		ok: false,
		reason: "Move or delete files in this folder before deleting it."
	};
	const current = read();
	if (!current.ok) return current;
	if (current.data.some((folder) => folder.projectId === projectId && folder.path !== normalized && folder.path.startsWith(`${normalized}/`))) return {
		ok: false,
		reason: "Delete nested folders before deleting this folder."
	};
	const next = current.data.filter((folder) => folder.projectId !== projectId || folder.path !== normalized);
	if (next.length === current.data.length) return {
		ok: false,
		reason: "That project folder is not here; nothing was deleted."
	};
	const saved = write(next);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: { removed: true },
		evidence: `Deleted project folder “${normalized}”.`
	};
}
function removeProjectFoldersForProject(projectId) {
	const current = read();
	if (!current.ok) return current;
	const next = current.data.filter((folder) => folder.projectId !== projectId);
	const removed = current.data.length - next.length;
	const saved = write(next);
	if (!saved.ok) return saved;
	return {
		ok: true,
		data: { removed },
		evidence: `${removed} project folders deleted.`
	};
}
function ProjectsPage() {
	const { user } = useSession();
	const userId = user?.id ?? "";
	const [projects, setProjects] = (0, import_react.useState)(null);
	const [unavailable, setUnavailable] = (0, import_react.useState)(null);
	const [showArchived, setShowArchived] = (0, import_react.useState)(false);
	const [selectedId, setSelectedId] = (0, import_react.useState)(null);
	const [busy, setBusy] = (0, import_react.useState)(false);
	const [newName, setNewName] = (0, import_react.useState)("");
	const [creating, setCreating] = (0, import_react.useState)(false);
	const [instructions, setInstructions] = (0, import_react.useState)("");
	const [nameDraft, setNameDraft] = (0, import_react.useState)("");
	const [conversations, setConversations] = (0, import_react.useState)(null);
	const [unfiled, setUnfiled] = (0, import_react.useState)(null);
	const [outputs, setOutputs] = (0, import_react.useState)(null);
	const [projectFiles, setProjectFiles] = (0, import_react.useState)(null);
	const [projectFolders, setProjectFolders] = (0, import_react.useState)(null);
	const [projectFileError, setProjectFileError] = (0, import_react.useState)(null);
	const [folderDraft, setFolderDraft] = (0, import_react.useState)("");
	const [uploadFolder, setUploadFolder] = (0, import_react.useState)("");
	const [projectSearch, setProjectSearch] = (0, import_react.useState)("");
	const [fileSearch, setFileSearch] = (0, import_react.useState)("");
	const [confirmDelete, setConfirmDelete] = (0, import_react.useState)(null);
	const [preview, setPreview] = (0, import_react.useState)(null);
	const [previewDraft, setPreviewDraft] = (0, import_react.useState)("");
	const [outputRetention, setOutputRetention] = (0, import_react.useState)("keep");
	const [savingVersion, setSavingVersion] = (0, import_react.useState)(false);
	const [projectsStayLocal, setProjectsStayLocal] = (0, import_react.useState)(null);
	const selected = projects?.find((p) => p.id === selectedId) ?? null;
	const visibleProjects = projects?.filter((project) => project.name.toLowerCase().includes(projectSearch.trim().toLowerCase())) ?? [];
	const visibleProjectFiles = (projectFiles ?? []).filter((file) => {
		const query = fileSearch.trim().toLowerCase();
		return !query || `${file.folder}/${file.name}`.toLowerCase().includes(query);
	});
	const refreshProjects = (0, import_react.useCallback)(async () => {
		if (!userId) return;
		setUnavailable(null);
		try {
			if (!userId) throw new Error("Sign in to open your on-device projects.");
			const [rows, mode] = await Promise.all([listLocalProjects(userId, showArchived), getModeFor(userId, "files")]);
			setProjectsStayLocal(mode !== "private_sync");
			setProjects(rows);
			setSelectedId((cur) => cur && rows.some((r) => r.id === cur) ? cur : rows[0]?.id ?? null);
		} catch (e) {
			setProjects(null);
			setUnavailable(e instanceof Error ? e.message : "Projects aren't available in this browser vault.");
		}
	}, [showArchived, userId]);
	(0, import_react.useEffect)(() => {
		refreshProjects();
	}, [refreshProjects]);
	(0, import_react.useEffect)(() => {
		if (!selected) {
			setConversations(null);
			setOutputs(null);
			setProjectFiles(null);
			setProjectFolders(null);
			return;
		}
		setNameDraft(selected.name);
		setInstructions(selected.instructions ?? "");
		setUploadFolder("");
		setFolderDraft("");
		setFileSearch("");
		const localFiles = listProjectFiles(selected.id);
		const localFolders = listProjectFolders(selected.id);
		if (localFiles.ok) {
			setProjectFiles(localFiles.data);
			setProjectFileError(null);
		} else {
			setProjectFiles(null);
			setProjectFileError(localFiles.reason);
		}
		if (localFolders.ok) setProjectFolders(localFolders.data);
		else {
			setProjectFolders(null);
			setProjectFileError((current) => current ? `${current} ${localFolders.reason}` : localFolders.reason);
		}
		let live = true;
		(async () => {
			try {
				const [allConversations, o] = await Promise.all([listConversationsLocally(userId), listLocalOutputs(userId, selected.id)]);
				const c = allConversations.filter((row) => row.project_id === selected.id);
				const u = allConversations.filter((row) => !row.project_id);
				if (!live) return;
				setConversations(c);
				setOutputs(o);
				setUnfiled(u);
			} catch {
				if (!live) return;
				setConversations([]);
				setOutputs([]);
				setUnfiled([]);
			}
		})();
		return () => {
			live = false;
		};
	}, [selected, userId]);
	async function addProjectFiles(files) {
		if (!selected || !files) return;
		for (const file of [...files]) {
			if (!(file.type.startsWith("text/") || /\.(txt|md|csv|json|xml|yaml|yml|log)$/i.test(file.name))) {
				toast.error(`${file.name}: add this through Chat first so OCADE can extract it safely.`);
				continue;
			}
			const result = await saveProjectFile({
				projectId: selected.id,
				name: file.name,
				mime: file.type || "text/plain",
				sizeBytes: file.size,
				text: await file.text(),
				folder: uploadFolder
			});
			if (!result.ok) toast.error(`${file.name}: ${result.reason}`);
			else toast.success(result.evidence);
		}
		refreshLocalProjectItems(selected.id);
	}
	function refreshLocalProjectItems(projectId) {
		const files = listProjectFiles(projectId);
		const folders = listProjectFolders(projectId);
		if (!files.ok || !folders.ok) {
			setProjectFileError(!files.ok ? files.reason : !folders.ok ? folders.reason : null);
			return;
		}
		setProjectFiles(files.data);
		setProjectFolders(folders.data);
		setProjectFileError(null);
	}
	function addProjectFolder() {
		if (!selected) return;
		const created = createProjectFolder({
			projectId: selected.id,
			path: folderDraft
		});
		if (!created.ok) {
			toast.error(created.reason);
			return;
		}
		setFolderDraft("");
		setUploadFolder(created.data.path);
		refreshLocalProjectItems(selected.id);
		toast.success(created.evidence);
	}
	function deleteProjectFolder(path) {
		if (!selected) return;
		const removed = removeProjectFolder(selected.id, path);
		if (!removed.ok) {
			toast.error(removed.reason);
			return;
		}
		if (uploadFolder === path) setUploadFolder("");
		refreshLocalProjectItems(selected.id);
		toast.success(removed.evidence);
	}
	/**
	* Delete a project file from EVERY place it left a trace.
	*
	* This used to call `removeProjectFile` alone, which deletes the extracted
	* text and nothing else. Verbatim excerpts of the same document stayed in
	* saved citations under old assistant replies, and cached copies stayed in
	* Cache Storage — so a user who deleted a document to make it go away was
	* shown a success toast while its text was still readable in the app.
	*/
	async function deleteProjectFile(id, name) {
		const receipt = await deleteAttachment({
			fileId: id,
			name
		});
		if (selected) refreshLocalProjectItems(selected.id);
		if (receipt.complete) {
			toast.success(receipt.summary);
			return;
		}
		toast.error(receipt.summary, { description: receipt.remaining.map(describeSite).join(", ") });
	}
	async function handleCreate() {
		const name = newName.trim();
		if (!name) return;
		setCreating(true);
		try {
			const p = await createLocalProject(userId, { name });
			toast.success(`Project “${p.name}” created.`);
			setNewName("");
			await refreshProjects();
			setSelectedId(p.id);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not create the project.");
		} finally {
			setCreating(false);
		}
	}
	async function saveDetails() {
		if (!selected) return;
		setBusy(true);
		try {
			await updateLocalProject(userId, selected.id, {
				name: nameDraft.trim() || selected.name,
				instructions: instructions.trim() ? instructions : null
			});
			toast.success("Project saved.");
			await refreshProjects();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not save the project.");
		} finally {
			setBusy(false);
		}
	}
	async function toggleArchive(p) {
		setBusy(true);
		try {
			await updateLocalProject(userId, p.id, { archived: !p.archived });
			toast.success(p.archived ? "Project restored." : "Project archived.");
			await refreshProjects();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not update the project.");
		} finally {
			setBusy(false);
		}
	}
	async function reallyDelete(p) {
		setBusy(true);
		try {
			const doomed = listProjectFiles(p.id);
			await deleteLocalProject(userId, p.id);
			if (doomed.ok) for (const file of doomed.data) await deleteAttachment({ name: file.name });
			const localRemoval = removeProjectFilesForProject(p.id);
			const folderRemoval = removeProjectFoldersForProject(p.id);
			setConfirmDelete(null);
			await refreshProjects();
			if (!localRemoval.ok || !folderRemoval.ok) toast.error(`Project deleted and its conversations were kept, but on-device project data could not be fully removed: ${!localRemoval.ok ? localRemoval.reason : !folderRemoval.ok ? folderRemoval.reason : ""}`);
			else toast.success(localRemoval.data.removed > 0 ? `Project deleted, conversations unfiled, and ${localRemoval.data.removed} on-device ${localRemoval.data.removed === 1 ? "file" : "files"} removed.` : "Project deleted. Its conversations were kept and unfiled.");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not delete the project.");
		} finally {
			setBusy(false);
		}
	}
	async function moveConversation(conversationId, projectId) {
		try {
			if (!await updateConversationLocally(userId, conversationId, { project_id: projectId })) throw new Error("Conversation not found on this device.");
			toast.success(projectId ? "Conversation moved into the project." : "Conversation unfiled.");
			if (selected) {
				const all = await listConversationsLocally(userId);
				setConversations(all.filter((row) => row.project_id === selected.id));
				setUnfiled(all.filter((row) => !row.project_id));
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not move the conversation.");
		}
	}
	async function openPreview(id) {
		try {
			const row = await getLocalOutput(userId, id);
			setPreview({
				id: row.id,
				title: row.title,
				content: row.content ?? null,
				mime: row.mime ?? null,
				kind: row.kind
			});
			setPreviewDraft(row.content ?? "");
			setOutputRetention("keep");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not open this output.");
		}
	}
	function exportPreview() {
		if (!preview || !previewDraft) return;
		const blob = new Blob([previewDraft], { type: preview.mime || "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${preview.title.replace(/[^\w.-]+/g, "_") || "ocade-output"}.txt`;
		a.click();
		URL.revokeObjectURL(url);
	}
	async function saveNewOutputVersion() {
		if (!preview || !selected || !previewDraft.trim()) return;
		setSavingVersion(true);
		try {
			const created = await createLocalOutput(userId, {
				projectId: selected.id,
				parentOutputId: preview.id,
				kind: preview.kind,
				title: preview.title,
				content: previewDraft,
				mime: preview.mime,
				retentionDays: outputRetention === "keep" ? null : Number(outputRetention)
			});
			toast.success(`Saved ${preview.title} as version ${created.version}.`);
			setOutputs(await listLocalOutputs(userId, selected.id));
			setPreview(null);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not save the new output version.");
		} finally {
			setSavingVersion(false);
		}
	}
	async function removeOutput(id) {
		try {
			await deleteLocalOutput(userId, id);
			toast.success("Output deleted.");
			if (selected) setOutputs(await listLocalOutputs(userId, selected.id));
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not delete the output.");
		}
	}
	async function removeExpiredOutputs() {
		try {
			const result = await purgeExpiredLocalOutputs(userId);
			toast.success(result.removed > 0 ? `${result.removed} expired ${result.removed === 1 ? "output" : "outputs"} deleted.` : "No expired outputs to delete.");
			if (selected) setOutputs(await listLocalOutputs(userId, selected.id));
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not remove expired outputs.");
		}
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
			eyebrow: "OCADE",
			title: "Projects",
			description: "Group conversations, instructions and generated outputs. Project instructions are applied to every chat in the project.",
			actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex min-h-[24px] items-center gap-2 py-1 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
					type: "checkbox",
					checked: showArchived,
					onChange: (e) => setShowArchived(e.target.checked),
					className: "h-3.5 w-3.5 accent-[color:var(--foreground)]"
				}), "Show archived"]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-2 text-xs text-muted-foreground",
			children: projectsStayLocal === null ? "Checking this browser's project storage mode…" : projectsStayLocal ? "Projects and saved outputs stay in this browser. Nothing here is uploaded." : "Projects and saved outputs are synchronised to your private account storage."
		}),
		unavailable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SetupRequiredState, {
			title: "Projects couldn't open the browser vault",
			description: "Projects and outputs are written to this device first. Unlock the vault or retry; a database connection is not required.",
			detail: unavailable,
			status: "failed",
			action: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: () => void refreshProjects(),
				className: "rounded-md border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-accent/30",
				children: "Try again"
			})
		}) : projects === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
			className: "flex items-center gap-2 p-6 text-sm text-muted-foreground",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
				className: "h-4 w-4 animate-spin",
				"aria-hidden": true
			}), " Loading projects…"]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "p-3",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: newName,
							onChange: (e) => setNewName(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") handleCreate();
							},
							placeholder: "New project name",
							"aria-label": "New project name",
							className: "h-9 text-sm"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							onClick: () => void handleCreate(),
							disabled: creating || !newName.trim(),
							size: "sm",
							className: "h-9 shrink-0",
							children: [creating ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, { className: "h-4 w-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "sr-only",
								children: "Create project"
							})]
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						value: projectSearch,
						onChange: (event) => setProjectSearch(event.target.value),
						placeholder: "Search projects",
						"aria-label": "Search projects",
						className: "mt-2 h-8 text-xs"
					})]
				}), projects === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
					className: "flex items-center gap-2 p-4 text-xs text-muted-foreground",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, {
						className: "h-4 w-4 animate-spin",
						"aria-hidden": true
					}), " Loading projects…"]
				}) : projects.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
					icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, {
						className: "h-6 w-6",
						"aria-hidden": true
					}),
					title: "No projects yet",
					description: "Create a project to group related conversations, files and outputs."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
					"aria-label": "Projects",
					className: "flex flex-col gap-1",
					children: [visibleProjects.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						onClick: () => setSelectedId(p.id),
						"aria-current": p.id === selectedId ? "true" : void 0,
						className: cn("flex items-center gap-2 rounded-md px-3 py-2 text-left text-[13px] transition-colors", p.id === selectedId ? "bg-sidebar-accent text-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, {
								className: "h-4 w-4 shrink-0",
								"aria-hidden": true
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate",
								children: p.name
							}),
							p.archived ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "ml-auto text-[9px] uppercase tracking-wide",
								children: "Archived"
							}) : null
						]
					}, p.id)), visibleProjects.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "px-3 py-2 text-xs text-muted-foreground",
						children: [
							"No project matches “",
							projectSearch,
							"”."
						]
					}) : null]
				})]
			}), selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-col gap-5",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "flex flex-col gap-3 p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: nameDraft,
									onChange: (e) => setNameDraft(e.target.value),
									"aria-label": "Project name",
									className: "h-9 max-w-sm text-sm"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "ml-auto flex gap-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										variant: "ghost",
										size: "sm",
										onClick: () => void toggleArchive(selected),
										disabled: busy,
										children: selected.archived ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArchiveRestore, { className: "mr-1.5 h-4 w-4" }), " Restore"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Archive, { className: "mr-1.5 h-4 w-4" }), " Archive"] })
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
										variant: "ghost",
										size: "sm",
										onClick: () => setConfirmDelete(selected),
										disabled: busy,
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "mr-1.5 h-4 w-4" }), " Delete"]
									})]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								className: "text-xs font-medium text-muted-foreground",
								htmlFor: "project-instructions",
								children: "Project instructions — applied to every conversation in this project"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
								id: "project-instructions",
								value: instructions,
								onChange: (e) => setInstructions(e.target.value),
								rows: 4,
								placeholder: "e.g. Always answer in British English and cite the source file.",
								className: "text-sm"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								size: "sm",
								onClick: () => void saveDetails(),
								disabled: busy,
								children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "mr-1.5 h-4 w-4" }), "Save"]
							}) })
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "mb-2 flex items-center gap-2 text-sm font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, {
									className: "h-4 w-4",
									"aria-hidden": true
								}), " Conversations"]
							}),
							conversations === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Loading…"
							}) : conversations.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "No conversations filed here yet. Move one from the list below."
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "flex flex-col gap-1",
								children: conversations.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-sidebar-accent/40",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
											to: "/ocade",
											className: "truncate text-foreground hover:underline",
											children: c.title
										}),
										c.pinned ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-[9px] uppercase text-muted-foreground",
											children: "Pinned"
										}) : null,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => void moveConversation(c.id, null),
											className: "ml-auto text-[11px] text-muted-foreground hover:text-foreground",
											children: "Unfile"
										})
									]
								}, c.id))
							}),
							unfiled && unfiled.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-4 border-t border-border/60 pt-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
									children: "Unfiled conversations"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
									className: "flex flex-col gap-1",
									children: unfiled.slice(0, 8).map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
										className: "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "truncate text-muted-foreground",
											children: c.title
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => void moveConversation(c.id, selected.id),
											className: "ml-auto text-[11px] text-muted-foreground hover:text-foreground",
											children: "Move here"
										})]
									}, c.id))
								})]
							}) : null
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "p-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-2 flex items-center gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Paperclip, {
										className: "h-4 w-4",
										"aria-hidden": true
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
										className: "text-sm font-semibold",
										children: "Project files"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
										className: "ml-auto cursor-pointer rounded-md border border-border/60 px-2 py-1 text-[11px] hover:bg-accent",
										children: ["Add text files", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
											type: "file",
											multiple: true,
											accept: ".txt,.md,.csv,.json,.xml,.yaml,.yml,.log,text/*",
											className: "hidden",
											onChange: (event) => {
												addProjectFiles(event.currentTarget.files);
												event.currentTarget.value = "";
											}
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-2 text-[11px] text-muted-foreground",
								children: "Stored on this device with SHA-256 fingerprints. These files are added to Chat context when the conversation is filed in this project."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-2 flex flex-wrap gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: folderDraft,
									onChange: (event) => setFolderDraft(event.target.value),
									onKeyDown: (event) => {
										if (event.key === "Enter") addProjectFolder();
									},
									placeholder: "New folder, e.g. Research/Notes",
									"aria-label": "New project folder",
									className: "h-8 min-w-[220px] flex-1 text-xs"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "ghost",
									className: "h-8",
									onClick: addProjectFolder,
									disabled: !folderDraft.trim(),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderPlus, {
										className: "mr-1.5 h-3.5 w-3.5",
										"aria-hidden": true
									}), " Create folder"]
								})]
							}),
							projectFolders && projectFolders.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-2 flex flex-wrap gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									"aria-pressed": uploadFolder === "",
									type: "button",
									onClick: () => setUploadFolder(""),
									className: cn("rounded border px-2 py-1 text-[10px]", uploadFolder === "" ? "border-foreground/40" : "border-border/60"),
									children: "Root"
								}), projectFolders.map((folder) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: cn("inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px]", uploadFolder === folder.path ? "border-foreground/40" : "border-border/60"),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setUploadFolder(folder.path),
										children: folder.path
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => deleteProjectFolder(folder.path),
										"aria-label": `Delete folder ${folder.path}`,
										className: "text-muted-foreground hover:text-destructive",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
											className: "h-3 w-3",
											"aria-hidden": true
										})
									})]
								}, folder.id))]
							}) : null,
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mb-2 flex items-center gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10px] text-muted-foreground",
									children: ["New files go to ", uploadFolder || "project root"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									value: fileSearch,
									onChange: (event) => setFileSearch(event.target.value),
									placeholder: "Search project files",
									"aria-label": "Search project files",
									className: "ml-auto h-7 max-w-[220px] text-[11px]"
								})]
							}),
							projectFileError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-destructive",
								children: projectFileError
							}) : projectFiles === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "Loading…"
							}) : projectFiles.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "No readable project files yet."
							}) : visibleProjectFiles.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-xs text-muted-foreground",
								children: "No project file matches this search."
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
								className: "space-y-1",
								children: visibleProjectFiles.map((file) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
									className: "flex items-center gap-2 rounded-md px-2 py-1 text-xs",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "truncate",
											children: [file.folder ? `${file.folder}/` : "", file.name]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "font-mono text-[9px] text-muted-foreground",
											children: [file.sha256.slice(0, 10), "…"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
											onClick: () => void deleteProjectFile(file.id, file.name),
											"aria-label": `Delete ${file.name}`,
											className: "ml-auto text-muted-foreground hover:text-destructive",
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, {
												className: "h-3.5 w-3.5",
												"aria-hidden": true
											})
										})
									]
								}, file.id))
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
						className: "p-4",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mb-2 flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
								className: "flex items-center gap-2 text-sm font-semibold",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FileOutput, {
									className: "h-4 w-4",
									"aria-hidden": true
								}), " Outputs"]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => void removeExpiredOutputs(),
								className: "text-[11px] text-muted-foreground hover:text-foreground",
								children: "Remove expired"
							})]
						}), outputs === null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "Loading…"
						}) : outputs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "text-xs text-muted-foreground",
							children: "Nothing generated yet. Documents and exports OCADE creates in this project appear here."
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
							className: "flex flex-col gap-1",
							children: outputs.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-sidebar-accent/40",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => void openPreview(o.id),
										className: "truncate text-left hover:underline",
										children: o.title
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[10px] uppercase text-muted-foreground",
										children: o.kind
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[10px] text-muted-foreground",
										children: ["v", o.version]
									}),
									o.content_sha256 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "hidden font-mono text-[9px] text-muted-foreground lg:inline",
										title: `SHA-256 ${o.content_sha256}`,
										children: [o.content_sha256.slice(0, 10), "…"]
									}) : null,
									o.expires_at ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "text-[9px] text-muted-foreground",
										children: ["expires ", new Date(o.expires_at).toLocaleDateString()]
									}) : null,
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										onClick: () => void removeOutput(o.id),
										"aria-label": `Delete ${o.title}`,
										className: "ml-auto text-muted-foreground hover:text-foreground",
										children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" })
									})
								]
							}, o.id))
						})]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
				icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FolderOpen, {
					className: "h-6 w-6",
					"aria-hidden": true
				}),
				title: "Select a project",
				description: "Choose a project on the left, or create one to get started."
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!confirmDelete,
			onOpenChange: (o) => !o && setConfirmDelete(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, { children: "Delete this project?" }) }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "text-sm text-muted-foreground",
					children: [
						"“",
						confirmDelete?.name,
						"” will be permanently deleted. Conversations inside it are",
						" ",
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-medium text-foreground",
							children: "kept"
						}),
						" and become unfiled. This cannot be undone."
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					onClick: () => setConfirmDelete(null),
					children: "Cancel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					onClick: () => confirmDelete && void reallyDelete(confirmDelete),
					disabled: busy,
					children: [busy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-4 w-4 animate-spin" }) : null, "Delete project"]
				})] })
			] })
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Dialog, {
			open: !!preview,
			onOpenChange: (o) => !o && setPreview(null),
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
				className: "max-w-2xl",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogHeader, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
						className: "truncate",
						children: preview?.title
					}) }),
					preview?.content !== null ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
							htmlFor: "output-version-content",
							className: "text-xs font-medium text-foreground",
							children: "Output content"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Textarea, {
							id: "output-version-content",
							value: previewDraft,
							onChange: (event) => setPreviewDraft(event.target.value),
							rows: 14,
							className: "max-h-[50vh] font-mono text-xs"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center justify-between gap-3 text-xs text-muted-foreground",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Editing does not overwrite this version. Save creates the next hashed version." }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
								className: "flex shrink-0 items-center gap-2",
								children: ["Retention", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("select", {
									value: outputRetention,
									onChange: (event) => setOutputRetention(event.target.value),
									className: "rounded border border-border/60 bg-background px-2 py-1 text-foreground",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "keep",
											children: "Keep"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "30",
											children: "30 days"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "90",
											children: "90 days"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", {
											value: "365",
											children: "1 year"
										})
									]
								})]
							})]
						})
					] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "text-sm text-muted-foreground",
						children: "This output has no inline preview. Export it to view the full file."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogFooter, { children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							onClick: () => setPreview(null),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "mr-1.5 h-4 w-4" }), " Close"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							variant: "ghost",
							onClick: exportPreview,
							disabled: !previewDraft,
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Download, { className: "mr-1.5 h-4 w-4" }), " Export"]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
							onClick: () => void saveNewOutputVersion(),
							disabled: !previewDraft.trim() || savingVersion,
							children: [savingVersion ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LoaderCircle, { className: "mr-1.5 h-4 w-4 animate-spin" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Save, { className: "mr-1.5 h-4 w-4" }), "Save new version"]
						})
					] })
				]
			})
		})
	] });
}
//#endregion
export { ProjectsPage as component };

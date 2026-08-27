//#region node_modules/.nitro/vite/services/ssr/assets/unified-task-BYmmu_RT.js
var STORAGE_KEY = "ocade:unified-tasks:v1";
var DB_NAME = "ocade-runtime";
var STORE_NAME = "tasks";
var DB_VERSION = 1;
var TERMINAL = /* @__PURE__ */ new Set([
	"COMPLETED",
	"FAILED",
	"CANCELLED"
]);
var TRANSITIONS = {
	CREATED: /* @__PURE__ */ new Set([
		"PLANNING",
		"WAITING_PERMISSION",
		"EXECUTING",
		"CANCELLED",
		"FAILED"
	]),
	PLANNING: /* @__PURE__ */ new Set([
		"WAITING_PERMISSION",
		"EXECUTING",
		"WAITING_USER",
		"FAILED",
		"CANCELLED"
	]),
	WAITING_PERMISSION: /* @__PURE__ */ new Set([
		"EXECUTING",
		"WAITING_USER",
		"FAILED",
		"CANCELLED"
	]),
	EXECUTING: /* @__PURE__ */ new Set([
		"WAITING_PERMISSION",
		"WAITING_USER",
		"VERIFYING",
		"COMPLETED",
		"FAILED",
		"CANCELLED"
	]),
	WAITING_USER: /* @__PURE__ */ new Set([
		"EXECUTING",
		"VERIFYING",
		"FAILED",
		"CANCELLED"
	]),
	VERIFYING: /* @__PURE__ */ new Set([
		"COMPLETED",
		"FAILED",
		"EXECUTING",
		"CANCELLED"
	]),
	COMPLETED: /* @__PURE__ */ new Set(),
	FAILED: /* @__PURE__ */ new Set([
		"PLANNING",
		"EXECUTING",
		"CANCELLED"
	]),
	CANCELLED: /* @__PURE__ */ new Set(["PLANNING"])
};
function nowIso() {
	return (/* @__PURE__ */ new Date()).toISOString();
}
function safeProgress(value) {
	if (value === void 0 || Number.isNaN(value)) return void 0;
	return Math.min(100, Math.max(0, value));
}
function canTransition(from, to) {
	return from === to || TRANSITIONS[from].has(to);
}
function transitionTask(task, status, patch = {}, at = nowIso()) {
	if (!canTransition(task.status, status)) throw new Error(`Invalid task transition: ${task.status} -> ${status}`);
	const startedAt = task.startedAt ?? (status === "EXECUTING" ? at : void 0);
	const finishedAt = TERMINAL.has(status) ? patch.finishedAt ?? at : patch.finishedAt ?? task.finishedAt;
	return {
		...task,
		...patch,
		status,
		progress: safeProgress(patch.progress ?? task.progress),
		startedAt,
		finishedAt,
		updatedAt: at
	};
}
function createUnifiedTask(input, at = nowIso()) {
	const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
	return {
		...input,
		id,
		source: input.source,
		title: input.title.trim() || "Untitled task",
		status: "CREATED",
		retryCount: 0,
		createdAt: at,
		updatedAt: at,
		progress: safeProgress(input.progress)
	};
}
function retryTask(task, at = nowIso()) {
	if (task.status !== "FAILED" && task.status !== "CANCELLED") throw new Error(`Only failed or cancelled tasks can retry; received ${task.status}`);
	return {
		...transitionTask(task, "PLANNING", {
			lastError: void 0,
			finishedAt: void 0
		}, at),
		retryCount: task.retryCount + 1
	};
}
/** Adapter for the existing durable automation runtime. */
function taskFromAutomationRun(run, title) {
	const status = {
		pending: "PLANNING",
		awaiting_approval: "WAITING_PERMISSION",
		running: "EXECUTING",
		paused: "WAITING_USER",
		succeeded: "COMPLETED",
		failed: "FAILED",
		blocked: "FAILED",
		cancelled: "CANCELLED"
	}[run.status] ?? "FAILED";
	const firstStep = run.plan?.steps?.[0]?.summary;
	const blockedError = run.status === "blocked" ? run.blocked_reason ?? "The automation plan was blocked." : void 0;
	return {
		id: `automation:${run.id}`,
		source: "automation",
		sourceRef: run.automation_id,
		title,
		currentStep: firstStep ?? run.blocked_reason ?? void 0,
		status,
		retryCount: Math.max(0, run.attempt - 1),
		createdAt: run.created_at,
		updatedAt: run.finished_at ?? run.created_at,
		startedAt: status === "EXECUTING" || TERMINAL.has(status) ? run.created_at : void 0,
		finishedAt: run.finished_at ?? (TERMINAL.has(status) ? run.created_at : void 0),
		lastError: run.error ?? blockedError
	};
}
function openDb() {
	if (typeof indexedDB === "undefined") return Promise.resolve(null);
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);
		request.onupgradeneeded = () => {
			const db = request.result;
			if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: "id" });
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error ?? /* @__PURE__ */ new Error("Could not open OCADE task database."));
	});
}
function readFallback() {
	if (typeof localStorage === "undefined") return [];
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}
function writeFallback(tasks) {
	if (typeof localStorage === "undefined") return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks.slice(0, 500)));
}
async function listLocalTasks() {
	try {
		const db = await openDb();
		if (!db) return readFallback();
		return await new Promise((resolve, reject) => {
			const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
			request.onsuccess = () => resolve(request.result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
			request.onerror = () => reject(request.error);
		});
	} catch {
		return readFallback();
	}
}
async function persistTask(task) {
	try {
		const db = await openDb();
		if (!db) {
			writeFallback([task, ...readFallback().filter((item) => item.id !== task.id)]);
			return task;
		}
		await new Promise((resolve, reject) => {
			const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(task);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
		return task;
	} catch {
		writeFallback([task, ...readFallback().filter((item) => item.id !== task.id)]);
		return task;
	}
}
async function removeLocalTask(id) {
	writeFallback(readFallback().filter((task) => task.id !== id));
	try {
		const db = await openDb();
		if (!db) return;
		await new Promise((resolve, reject) => {
			const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	} catch {}
}
//#endregion
export { retryTask as a, removeLocalTask as i, listLocalTasks as n, taskFromAutomationRun as o, persistTask as r, transitionTask as s, createUnifiedTask as t };

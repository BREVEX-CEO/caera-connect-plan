import { n as listLocalTasks, r as persistTask, s as transitionTask } from "./unified-task-BYmmu_RT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/runs-Dy-PZWN-.js
/**
* True when a run is finished and will not transition again. Guards eviction,
* message injection into dead runs, and orphan cleanup -- the donor's three
* uses, all of which OCADE has too.
*/
function isTerminalTaskStatus(status) {
	return status === "completed" || status === "failed" || status === "killed";
}
/** True when a run still holds resources: it can be paused, resumed or killed. */
function isActiveTaskStatus(status) {
	return status === "pending" || status === "running" || status === "paused";
}
var TASK_ID_PREFIXES = {
	mission: "k",
	shell: "b",
	agent: "a",
	automation: "w",
	monitor: "m"
};
var TASK_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
function randomBytes(length) {
	const bytes = new Uint8Array(length);
	const source = typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.getRandomValues === "function" ? globalThis.crypto : null;
	if (source) {
		source.getRandomValues(bytes);
		return bytes;
	}
	for (let i = 0; i < length; i++) bytes[i] = Math.floor(Math.random() * 256);
	return bytes;
}
function generateTaskId(kind) {
	const prefix = TASK_ID_PREFIXES[kind] ?? "x";
	const bytes = randomBytes(8);
	let id = prefix;
	for (let i = 0; i < 8; i++) id += TASK_ID_ALPHABET[bytes[i] % 36];
	return id;
}
function createTaskRun(input) {
	return {
		id: input.id ?? generateTaskId(input.kind),
		kind: input.kind,
		status: "pending",
		description: input.description,
		command: input.command,
		toolUseId: input.toolUseId,
		startTime: input.now ?? Date.now(),
		totalPausedMs: 0,
		isBackgrounded: input.isBackgrounded ?? false,
		notified: false
	};
}
/**
* Whether a run belongs in the background-tasks indicator.
*
* The donor's rule, unchanged: it must still be live, and it must have been
* backgrounded. A run the user is watching is not something to notify them
* about.
*/
function isBackgroundTask(task) {
	if (task.status !== "running" && task.status !== "pending" && task.status !== "paused") return false;
	return task.isBackgrounded !== false;
}
/**
* How long the run has actually been working, in milliseconds.
*
* Paused time is subtracted -- including the pause still open right now, which
* is why a paused run's elapsed time stops climbing on screen instead of
* quietly counting the minutes the user was away.
*/
function elapsedMs(task, now = Date.now()) {
	const end = task.endTime ?? now;
	const openPause = task.pausedAt === void 0 ? 0 : Math.max(0, now - task.pausedAt);
	return Math.max(0, end - task.startTime - task.totalPausedMs - openPause);
}
/** Begin a pause. A run that is not running is returned untouched. */
function beginPause(task, now = Date.now()) {
	if (task.status !== "running") return task;
	return {
		...task,
		status: "paused",
		pausedAt: now
	};
}
/** End a pause, banking the time it took. */
function endPause(task, now = Date.now()) {
	if (task.status !== "paused") return task;
	const banked = task.pausedAt === void 0 ? 0 : Math.max(0, now - task.pausedAt);
	return {
		...task,
		status: "running",
		pausedAt: void 0,
		totalPausedMs: task.totalPausedMs + banked
	};
}
/**
* Move a run to a terminal status, banking any open pause so the elapsed time
* of a run stopped while paused is still correct.
*/
function toTerminal(task, status, detail, now = Date.now()) {
	const banked = task.pausedAt === void 0 ? 0 : Math.max(0, now - task.pausedAt);
	return {
		...task,
		status,
		detail: detail ?? task.detail,
		pausedAt: void 0,
		totalPausedMs: task.totalPausedMs + banked,
		endTime: task.endTime ?? now
	};
}
/**
* The one sentence that describes everything currently running.
*
* Ported from the archive's `src/tasks/pillLabel.ts`, which existed for the
* same reason it exists here: two surfaces show "what is OCADE doing" -- the
* status pill and the task list -- and if they phrase it differently the user
* reasonably concludes they are looking at two different things.
*
* ADAPTED, AND WHY
* ----------------
* The donor's vocabulary was a terminal's: "1 shell", "ultraplan needs your
* input", "2 cloud sessions", and two box-drawing diamonds carrying state. All
* of that is internal terminology, and OCADE does not show internal terminology
* to the person using it. The grouping logic -- count by kind, name the kind
* only when every run shares it, fall back to a plain total -- is the donor's
* and is what makes the label readable at a glance.
*/
var SINGULAR = {
	mission: "task",
	shell: "command",
	agent: "task",
	automation: "automation",
	monitor: "watch"
};
var PLURAL = {
	mission: "tasks",
	shell: "commands",
	agent: "tasks",
	automation: "automations",
	monitor: "watches"
};
/** Runs worth showing in the indicator: live, and sent to the background. */
function backgroundTasks(tasks) {
	return tasks.filter(isBackgroundTask);
}
function getPillLabel(tasks) {
	const n = tasks.length;
	if (n === 0) return "";
	const first = tasks[0];
	if (tasks.every((t) => t.kind === first.kind)) return n === 1 ? `1 ${SINGULAR[first.kind]}` : `${n} ${PLURAL[first.kind]}`;
	return n === 1 ? "1 task running" : `${n} tasks running`;
}
/**
* True when the label should carry the "open to see" affordance.
*
* The donor showed the call to action only for the two states that were
* genuinely waiting on the user. Same rule: a run that is merely working needs
* no prompt, and a paused one does -- it stopped, and only the user restarts it.
*/
function pillNeedsAttention(tasks) {
	return tasks.some((t) => t.status === "paused");
}
/**
* Stopping a run, and saying precisely why it could not be stopped.
*
* Ported from the archive's `src/tasks/stopTask.ts`. The donor's version read
* one global `AppState` and dispatched through a task-type table; here the
* store and the killer are passed in, because OCADE stops runs from three
* places -- the Cowork panel, a tool call, and a companion disconnect -- and
* none of them should have to know how the other two hold their state.
*
* The part worth keeping verbatim is the error taxonomy. "It did not stop" is
* useless to a user; "there is no run by that name", "it had already finished"
* and "OCADE cannot stop that kind of run" are three different sentences and
* three different next steps.
*/
var StopTaskError = class extends Error {
	code;
	constructor(message, code) {
		super(message);
		this.code = code;
		this.name = "StopTaskError";
	}
};
/**
* Look up a run, check it is still live, kill it, and mark it stopped.
*
* Throws {@link StopTaskError}; callers read `error.code` to choose their
* sentence.
*/
async function stopTask(taskId, store, detail) {
	const task = store.get(taskId);
	if (!task) throw new StopTaskError(`No task found with ID: ${taskId}`, "not_found");
	if (!isActiveTaskStatus(task.status)) throw new StopTaskError(`Task ${taskId} is not running (status: ${task.status})`, "not_running");
	if (!await store.kill(task)) throw new StopTaskError(`OCADE cannot stop a ${task.kind} run from here.`, "unsupported_type");
	store.markKilled(taskId, detail);
	return {
		taskId,
		kind: task.kind,
		label: task.command ?? task.description
	};
}
/**
* The live task registry: one place that knows what OCADE is doing right now,
* and the only place that can stop it.
*
* WHY THIS EXISTS
* ---------------
* Before this, a Cowork mission was a set of React refs inside one hook. It
* worked while that hook was mounted and vanished when it was not: reloading
* the page mid-task lost the task, Chat could not see that Cowork was busy, the
* task list showed only manually typed to-dos, and "Stop" was reachable from
* exactly one button on one screen.
*
* The imported archive had already solved this shape. Its task layer is a
* registry of live runs, a per-kind killer, a status machine with a real
* terminal set, and a stop path with an error taxonomy. That logic is now in
* `src/primary-logic/tasks`, and this file is the adapter that gives it a
* store, a killer per kind, and somewhere durable to write.
*
* WHO OWNS WHAT
* -------------
* `primary-logic/tasks/lifecycle` owns the status machine for a RUN -- work
* OCADE is doing. `lib/tasks/unified-task` owns the status machine for a BOARD
* task -- something a person wrote down. They are not the same object and they
* are not two authorities over one object: every run projects into a board task
* so history and reload can see it, and the projection is one pure function
* (`project`) that runs in one direction only.
*/
var runs = /* @__PURE__ */ new Map();
var killers = /* @__PURE__ */ new Map();
var listeners = /* @__PURE__ */ new Set();
function snapshot() {
	return [...runs.values()].sort((a, b) => b.startTime - a.startTime);
}
function announce() {
	const tasks = snapshot();
	for (const listener of listeners) listener(tasks);
}
function subscribeToRuns(listener) {
	listeners.add(listener);
	listener(snapshot());
	return () => listeners.delete(listener);
}
function listRuns() {
	return snapshot();
}
/** The one-line "what is OCADE doing" summary, for the pill and for Buddy. */
function describeRuns(tasks = snapshot()) {
	const background = backgroundTasks(tasks);
	return {
		label: getPillLabel(background),
		needsAttention: pillNeedsAttention(background)
	};
}
var SOURCE_FOR_KIND = {
	mission: "work",
	shell: "system",
	agent: "work",
	automation: "automation",
	monitor: "monitor"
};
var BOARD_STATUS = {
	pending: "CREATED",
	running: "EXECUTING",
	paused: "WAITING_USER",
	completed: "COMPLETED",
	failed: "FAILED",
	killed: "CANCELLED"
};
/**
* A run, as the task board sees it.
*
* Pure and one-directional. Nothing reads a board task back into a run: a
* reloaded page rebuilds history from the board, but the live registry only
* ever holds runs this session actually started.
*/
function project(task, existing) {
	const now = new Date(task.endTime ?? Date.now()).toISOString();
	return {
		id: task.id,
		source: SOURCE_FOR_KIND[task.kind],
		sourceRef: task.toolUseId,
		title: task.description,
		request: task.command,
		currentStep: task.detail ?? existing?.currentStep,
		status: BOARD_STATUS[task.status],
		progress: task.progress,
		retryCount: existing?.retryCount ?? 0,
		createdAt: existing?.createdAt ?? new Date(task.startTime).toISOString(),
		updatedAt: now,
		startedAt: new Date(task.startTime).toISOString(),
		finishedAt: task.endTime === void 0 ? void 0 : new Date(task.endTime).toISOString(),
		lastError: task.status === "failed" ? task.detail : existing?.lastError
	};
}
var boardCache = /* @__PURE__ */ new Map();
function write(task) {
	runs.set(task.id, task);
	const projected = project(task, boardCache.get(task.id));
	boardCache.set(task.id, projected);
	persistTask(projected).catch(() => void 0);
	announce();
}
/**
* Start tracking a run.
*
* `kill` is what STOP will actually do. For a Cowork mission that is aborting
* the loop and telling the companion to let go of the keyboard; for a command
* on the paired computer it is terminating the child process.
*/
function startRun(input) {
	const task = {
		...createTaskRun(input),
		status: "running"
	};
	killers.set(task.id, input.kill);
	write(task);
	return task;
}
function mutate(id, change) {
	const current = runs.get(id);
	if (!current) return void 0;
	const next = change(current);
	if (next === current) return current;
	write(next);
	return next;
}
function updateRun(id, patch) {
	return mutate(id, (task) => isTerminalTaskStatus(task.status) ? task : {
		...task,
		...patch
	});
}
function pauseRun(id) {
	return mutate(id, (task) => beginPause(task));
}
function resumeRun(id) {
	return mutate(id, (task) => endPause(task));
}
/** Finish a run that ended on its own. */
function finishRun(id, status, detail) {
	const next = mutate(id, (task) => isTerminalTaskStatus(task.status) ? task : toTerminal(task, status, detail));
	killers.delete(id);
	return next;
}
/**
* Stop a run, for real.
*
* Throws `StopTaskError` with a code the caller turns into a sentence. The
* killer runs BEFORE the status changes: a run marked stopped whose process is
* still alive is worse than one that is still marked running.
*/
async function stopRun(id, detail) {
	return stopTask(id, {
		get: (taskId) => runs.get(taskId),
		kill: async (task) => {
			const killer = killers.get(task.id);
			if (!killer) return false;
			await killer(task);
			killers.delete(task.id);
			return true;
		},
		markKilled: (taskId, killDetail) => {
			mutate(taskId, (task) => toTerminal(task, "killed", killDetail));
		}
	}, detail);
}
/**
* Mark runs that a reload or crash interrupted.
*
* A board task left EXECUTING or WAITING_USER by a previous session cannot
* still be running: this registry is per-tab, and nothing survived. Saying so
* is what makes RESUME honest -- the user is picking up something OCADE has
* admitted it stopped doing, not re-attaching to a process that is gone.
*/
async function reconcileInterruptedRuns(now = /* @__PURE__ */ new Date()) {
	const stale = (await listLocalTasks().catch(() => [])).filter((task) => (task.status === "EXECUTING" || task.status === "WAITING_USER" || task.status === "WAITING_PERMISSION" || task.status === "PLANNING") && !runs.has(task.id));
	const repaired = [];
	for (const task of stale) {
		const next = transitionTask(task, "FAILED", { lastError: "Interrupted before it finished. You can pick it up again." }, now.toISOString());
		await persistTask(next).catch(() => void 0);
		repaired.push(next);
	}
	return repaired;
}
//#endregion
export { listRuns as a, resumeRun as c, subscribeToRuns as d, updateRun as f, finishRun as i, startRun as l, describeRuns as n, pauseRun as o, elapsedMs as r, reconcileInterruptedRuns as s, StopTaskError as t, stopRun as u };

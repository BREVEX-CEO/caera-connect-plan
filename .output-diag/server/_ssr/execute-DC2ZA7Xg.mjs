import { a as numberType, c as stringType, n as booleanType, o as objectType, s as recordType, u as unknownType } from "../_libs/zod.mjs";
import { n as listLocalTasks, r as persistTask, t as createUnifiedTask } from "./unified-task-BYmmu_RT.mjs";
import { a as listRuns, r as elapsedMs, t as StopTaskError, u as stopRun } from "./runs-Dy-PZWN-.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { i as ok, t as fail } from "./outcomes-wNfoXf5Q.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CA8BQOW2.mjs";
import { t as findTool } from "./tool-registry-BXQ-LCdE.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/execute-DC2ZA7Xg.js
/** Commands that change the page, and whose result must carry verification. */
var MUTATING_COMMANDS = /* @__PURE__ */ new Set([
	"media",
	"navigate",
	"reload",
	"click",
	"type",
	"scroll",
	"form.fill"
]);
/**
* Commands the WEBSITE may never send.
*
* Scope is granted by the person in the extension's own popup. The extension
* refuses these from an external sender, and the website refuses to send them,
* so neither a bug here nor a compromised page turns into a widened scope.
*/
var WEBSITE_FORBIDDEN_COMMANDS = /* @__PURE__ */ new Set(["scope.approve", "scope.revoke"]);
function describeOutcome(command, result) {
	if (!result.ok) {
		if (result.handover) return {
			kind: "blocked",
			reason: result.reason,
			handover: result.handover
		};
		if (result.unavailable) return {
			kind: "unavailable",
			reason: result.reason
		};
		if (result.blocked) return {
			kind: "blocked",
			reason: result.reason
		};
		return {
			kind: "failed",
			reason: result.reason
		};
	}
	if (MUTATING_COMMANDS.has(command)) {
		if (result.verified === true) return {
			kind: "done",
			evidence: result.evidence ?? `${command} changed the page.`
		};
		return {
			kind: "unverified",
			evidence: result.evidence ?? `${command} was performed but nothing measurable changed, so it is not reported as done.`
		};
	}
	return {
		kind: "done",
		evidence: result.evidence ?? `${command} completed.`
	};
}
/**
* The website's end of the Cowork channel.
*
* OCADE is a web page. It cannot open a tab, read a DOM it does not own, or
* click anything outside itself — and it should not be able to. The Cowork
* extension can, and this is how the page asks it to.
*
* TRANSPORT. `chrome.runtime.sendMessage(extensionId, …)`, which a page may
* only use when its own origin appears in the extension's
* `externally_connectable.matches`. The origin check is therefore Chrome's,
* performed before the message is delivered, rather than a comparison in our
* code that could be written wrongly once and be wrong everywhere.
*
* WHAT THIS DELIBERATELY CANNOT DO. It cannot grant itself scope.
* `scope.approve` and `scope.revoke` are refused here before they are sent, and
* refused again by the extension when they arrive. Approval happens in the
* extension's own popup, where the person is. A bug in this file, or a script
* injected into the page, still cannot widen where OCADE may act.
*/
function runtime() {
	const candidate = globalThis.chrome?.runtime;
	if (!candidate || typeof candidate.sendMessage !== "function") return null;
	return candidate;
}
/** True when this browser could talk to an extension at all (Chrome or Edge). */
function extensionChannelAvailable() {
	return runtime() !== null;
}
var NOT_INSTALLED = {
	ok: false,
	reason: "The OCADE Cowork extension is not installed in this browser, so OCADE cannot act in it. Install it and approve the sites you want OCADE to work on.",
	blocked: true
};
/**
* Send one command and get one result.
*
* Never throws. A missing extension, a dead service worker and a refusal are
* all ordinary answers a caller has to handle, and turning any of them into an
* exception only moves the handling somewhere less careful.
*/
async function sendToExtension(command, argument = {}, options = {}) {
	if (WEBSITE_FORBIDDEN_COMMANDS.has(command)) return {
		ok: false,
		reason: "OCADE cannot approve a site for itself. Open the OCADE Cowork popup and approve it there.",
		blocked: true
	};
	const channel = runtime();
	if (!channel) return NOT_INSTALLED;
	const extensionId = options.extensionId ?? "bkeedkfnbccjommjdgejlldbgibpghco";
	const timeoutMs = options.timeoutMs ?? 15e3;
	return new Promise((resolve) => {
		let settled = false;
		const finish = (result) => {
			if (settled) return;
			settled = true;
			resolve(result);
		};
		const timer = setTimeout(() => finish({
			ok: false,
			reason: "The OCADE Cowork extension did not answer in time.",
			blocked: true
		}), timeoutMs);
		try {
			channel.sendMessage(extensionId, {
				command,
				argument
			}, (response) => {
				clearTimeout(timer);
				if (channel.lastError?.message) return finish(NOT_INSTALLED);
				if (!response || typeof response !== "object") return finish({
					ok: false,
					reason: "The OCADE Cowork extension returned nothing."
				});
				finish(response);
			});
		} catch {
			clearTimeout(timer);
			finish(NOT_INSTALLED);
		}
	});
}
/**
* Ask what is on the other end before relying on it.
*
* A version mismatch is reported rather than worked around: an older extension
* answering a newer command with a shape this code does not expect is exactly
* how a "verified" flag goes missing and a mutation gets reported as done.
*/
async function handshakeWithExtension(options = {}) {
	const result = await sendToExtension("handshake", {}, {
		...options,
		timeoutMs: 4e3
	});
	if (!result.ok) return {
		installed: false,
		compatible: false,
		reason: result.reason
	};
	const protocolVersion = Number(result.protocolVersion ?? 0);
	return {
		installed: true,
		version: typeof result.extension === "string" ? result.extension : void 0,
		protocolVersion,
		compatible: protocolVersion === 1,
		status: result.status,
		reason: protocolVersion === 1 ? void 0 : `The installed OCADE Cowork extension speaks protocol ${protocolVersion}; this site speaks 1. Update the extension.`
	};
}
/**
* Run one step and report it the way it may honestly be shown.
*
* The result is deliberately not the extension's raw answer: `describeOutcome`
* is what decides whether a mutation may be called done, and every caller in
* the product goes through here so that decision is made in exactly one place.
*/
async function runExtensionStep(command, argument = {}, options = {}) {
	const result = await sendToExtension(command, argument, options);
	return {
		result,
		outcome: describeOutcome(command, result)
	};
}
/** The loop's browser tools, and nothing else, are handled here. */
var EXTENSION_TOOLS = /* @__PURE__ */ new Set([
	"browser_open",
	"browser_navigate",
	"browser_read",
	"browser_click",
	"browser_type",
	"browser_scroll",
	"browser_key",
	"browser_tabs",
	"browser_media",
	"browser_skip_ad"
]);
function isExtensionTool(name) {
	return EXTENSION_TOOLS.has(name);
}
/** One screen of scrolling, in CSS pixels. Matches what a PageDown does. */
var ONE_SCREEN = 700;
/**
* Tool call in, extension command out.
*
* `null` means this tool cannot be expressed as an extension command, which is
* a real answer and not a failure to handle: `browser_key` has no counterpart
* because the content script exposes no key dispatch, and pretending otherwise
* would produce a step that reports success while pressing nothing.
*/
function translate(call) {
	const a = call.arguments ?? {};
	switch (call.name) {
		case "browser_open": return {
			command: "tabs.list",
			argument: {}
		};
		case "browser_tabs": return {
			command: "tabs.list",
			argument: {}
		};
		case "browser_navigate": return {
			command: "navigate",
			argument: { url: String(a.url ?? "") }
		};
		case "browser_read": return {
			command: "observe",
			argument: {}
		};
		case "browser_click": return {
			command: "click",
			argument: { target: { text: String(a.text ?? "") } }
		};
		case "browser_type": return {
			command: "type",
			argument: {
				target: { selector: String(a.selector ?? "") },
				text: String(a.value ?? "")
			}
		};
		case "browser_scroll": return {
			command: "scroll",
			argument: { by: a.direction === "up" ? -700 : ONE_SCREEN }
		};
		case "browser_media": return {
			command: "media",
			argument: {
				action: String(a.action ?? "play"),
				seconds: Number(a.seconds ?? 10)
			}
		};
		case "browser_skip_ad": return { unsupported: "The Cowork extension cannot skip adverts. Skip it yourself, or ask OCADE to wait until it has finished." };
		case "browser_key": return { unsupported: "The Cowork extension cannot press keys on the page yet. Click the button you want instead, or ask the person to press the key." };
		default: return null;
	}
}
/**
* A StepOutcome is about a browser step; a ToolOutcome is about a tool call.
* They are close enough to look interchangeable and different enough that
* conflating them loses the one distinction that matters — `unverified`.
*
* `unverified` maps to `state_changed`, NOT to success and NOT to a retryable
* failure. Success would report a click that moved nothing as done. A retryable
* failure would send the model round again with the same arguments against a
* page that may well have changed underneath it. `state_changed` puts the
* evidence in front of the model and lets it decide, which is what a person
* would do.
*/
function toToolOutcome(step, observation) {
	switch (step.kind) {
		case "done": return ok(observation ?? null, step.evidence, {
			verified: true,
			observation
		});
		case "unverified": return {
			kind: "state_changed",
			detail: step.evidence,
			verified: false,
			observation
		};
		case "blocked": return {
			kind: step.handover ? "permission_required" : "blocked",
			detail: step.handover ? step.handover.message : step.reason
		};
		case "unavailable": return fail("unsupported", step.reason);
		case "failed": return fail("retryable_failure", step.reason);
	}
}
/**
* Run one browser tool call through the extension.
*
* Returns `null` when the call is not a browser tool, so a caller can fall
* through to whatever else it does. An unavailable extension is NOT null — it
* is an honest `unsupported` naming what to install, because silently falling
* back to a desktop sidecar is how a browser-first product grows a hidden
* dependency on one.
*/
async function runBrowserToolViaExtension(call, options = {}) {
	if (!isExtensionTool(call.name)) return null;
	if (!extensionChannelAvailable()) return fail("unsupported", "OCADE Cowork needs its browser extension to work in this browser. Open Cowork and follow the steps to add it, then try again.");
	const translated = translate(call);
	if (translated === null) return fail("unsupported", `${call.name} has no browser equivalent.`);
	if ("unsupported" in translated) return fail("unsupported", translated.unsupported);
	const { result, outcome } = await runExtensionStep(translated.command, translated.argument, options);
	return toToolOutcome(outcome, result.ok ? result.observation : void 0);
}
/**
* Control + Work's server side: one action per call, and a mission that lasts.
*
* WHY THIS IS NOT ONE "RUN THE TASK" FUNCTION
* --------------------------------------------
* It was, and the shape was wrong in a way that mattered. A single round trip
* means the whole task is authorised before it starts: the user agrees to
* "OCADE may act", and then finds out afterwards what it did. Every honest
* version of "ask before the risky step" needs the loop to be able to STOP
* between two tool calls and wait for an answer — and a server function that
* has already returned cannot ask anything.
*
* So the loop runs in the browser, where the user is, and the server exposes
* exactly three things: start a mission, run ONE tool call, stop the mission.
* Permission happens between calls two and two, which is the only place a
* person can actually be consulted.
*
* WHAT THE CLIENT STILL DOES NOT DECIDE
* --------------------------------------
* 1. **Which tools exist.** `runControlActionFn` looks the name up in the
*    registry and refuses anything not in it. A client asking for
*    `shell_execute` gets "no such tool", not an attempt.
* 2. **Where the sidecars are.** Resolved on the server, from the project root.
* 3. **Whether the caller may control this machine.** `authoriseControl` — an
*    account, or the local-demo rule, and nothing else.
* 4. **Whether a high-risk tool may run without a person.** The client sends
*    `confirmed`; the server checks the tool's own risk band against it and
*    refuses a `high` action that arrives unconfirmed. A compromised or buggy
*    client cannot skip the prompt by not showing it.
*/
/**
* Begin a mission: authorise, start the sidecars, and read the machine once.
*
* The first observation is taken here rather than left to the model's first
* step, because a screen that says "connected" before anything has been read is
* a screen that will say "connected" on a machine where the host is broken.
*/
var startMissionFn = createServerFn({ method: "POST" }).handler(createSsrRpc("74bf6e01a38d8e237b7fdde1016e4cdb562eae1ca7be85d7365441100443c2dd"));
var actionInput = objectType({
	missionId: stringType().min(1).max(64),
	tool: stringType().min(1).max(64),
	/** Bounded: these become real arguments to a real machine. */
	args: recordType(stringType(), unknownType()).default({}),
	/** True only when a person answered a prompt for THIS action. */
	confirmed: booleanType().default(false)
});
/**
* Run exactly one tool call inside a mission.
*
* THE SERVER RE-CHECKS THE RISK BAND. The client shows the prompt, but the
* client is also the part an attacker or a bug reaches first. A `high` action
* arriving with `confirmed: false` is refused here, so the prompt is not merely
* a UI convention — it is a condition of the action running at all.
*/
var runControlActionFn = createServerFn({ method: "POST" }).validator(actionInput).handler(createSsrRpc("722ca7d497a2e131ff1ba63c5e17cb5063949edd3af632a1ab1964268f879df2"));
/**
* End a mission and let go of the computer.
*
* Called on Stop, on Take over, when the panel unmounts, and when the demo
* clock runs out. All four are the same event as far as the machine is
* concerned: OCADE is finished, and nothing of its should still be held.
*/
var stopMissionFn = createServerFn({ method: "POST" }).validator(objectType({ missionId: stringType().min(1).max(64) })).handler(createSsrRpc("0b11926bf97dd2a2dce0fc743958402522fcf6521153f27d0150ab5272915b93"));
/**
* Stop everything and hand the machine back.
*
* The demo clock reaching zero is the case this exists for. A mission id may
* not be to hand — the panel may have already unmounted, or a second mission
* may have been started — and "stop whatever OCADE is doing on this computer"
* has to work without one. It is safe when nothing is running, and it releases
* held input before disposing anything.
*/
var stopAllLocalMissionsFn = createServerFn({ method: "POST" }).validator(objectType({ reason: stringType().max(200).default("Stopped.") })).handler(createSsrRpc("3b8e2278bb63ac1ad74d4e06b12183e4b917b8db1c974c5402ac619efdb4b9a4"));
/** Say one sentence aloud with this computer's own free voice. */
/**
* The microphones this machine can record from.
*
* A separate call from `missionMicFn` because the list is wanted BEFORE anyone
* decides to turn the microphone on — a settings panel showing "Bluetooth
* headset" should not have to open the audio stream to find out it exists.
*/
var missionAudioInputsFn = createServerFn({ method: "POST" }).validator(objectType({ missionId: stringType().min(1).max(64) })).handler(createSsrRpc("5996baae65accddfe160fa2af29e2a1eb4cd3065e4642d01492a2ae9f5fb0e2a"));
/**
* Turn the microphone on or off, or change which one is used.
*
* The returned `micEnabled` is what the engine REPORTS after the change, not
* what was requested, so a UI toggle can never show "off" over a microphone
* that is still open.
*/
var missionMicFn = createServerFn({ method: "POST" }).validator(objectType({
	missionId: stringType().min(1).max(64),
	enabled: booleanType().optional(),
	deviceId: numberType().int().min(0).max(512).nullable().optional()
})).handler(createSsrRpc("425d1b14490a9fe5d8d76e87a9e961e6445ec5b65e00a20ce3b87d2c0edf5687"));
var missionSpeakFn = createServerFn({ method: "POST" }).validator(objectType({
	missionId: stringType().min(1).max(64),
	text: stringType().min(1).max(1200),
	language: stringType().max(8).optional()
})).handler(createSsrRpc("7c9d48e580a74ea2bda34ce1a0d61fa715731edcf402b3f4dfab8fbdc99803c7"));
/**
* Re-read what OCADE remembers, mid-mission.
*
* WHY THIS IS NOT A TOOL. The memory context is how the mission builds its own
* system prompt; it is not an action the model chooses to take. Registering it
* as a tool would advertise it in the catalogue, where a model would eventually
* call it, spend a step, and learn nothing it was not already being told.
*
* It is called after a memory WRITE succeeds, so that "remember that I prefer
* short answers" is in front of the model on the very next turn rather than
* only in the next session — which is the difference between an assistant that
* remembers and one that keeps a diary.
*
* Reaches nothing but the memory file, and only inside a mission that already
* passed `authoriseControl` when it opened.
*/
var refreshMemoryFn = createServerFn({ method: "POST" }).validator(objectType({ missionId: stringType().min(1).max(64) })).handler(createSsrRpc("10b9787e08588fe9937f6a114b037459dcfae2f93dff336e695141f3ad91c6a4"));
/**
* Wait for `work`, but stop waiting when the signal says so.
*
* The work itself may carry on -- a request already sent to another process
* cannot be recalled -- and this does not pretend otherwise. What it changes is
* that the person who pressed stop is not made to watch a spinner until
* somebody else's timeout expires. `onAbandoned` is what the caller reports in
* that case, and it should say plainly that the action was left running.
*/
async function raceAbort(work, signal, onAbandoned) {
	if (!signal) return work;
	if (signal.aborted) return onAbandoned();
	return new Promise((resolve) => {
		let settled = false;
		const finish = (value) => {
			if (settled) return;
			settled = true;
			signal.removeEventListener("abort", abandon);
			resolve(value);
		};
		const abandon = () => finish(onAbandoned());
		signal.addEventListener("abort", abandon);
		work.then(finish, () => finish(onAbandoned()));
	});
}
/**
* The three task actions OCADE can take on its own behalf, from either room.
*
* WHY THESE RUN HERE AND NOT THROUGH THE COMPANION
* ------------------------------------------------
* Every other tool call ends up at the extension or at the paired computer,
* because every other tool acts on something outside OCADE. These three act on
* OCADE's own task state, which lives in this tab. Sending them to a companion
* would mean a user with no companion paired could not ask "what are you
* working on" — a question that has an answer whether or not a desktop is
* connected.
*
* They are still real tools: same registry, same permission layer, same
* outcome enum. `task_stop` is `mutating` and carries real risk, because it
* ends work in progress.
*
* Ported behaviour: the archive's TaskListTool / TaskStopTool / TaskCreateTool
* shapes — list returns live runs before finished ones, stop distinguishes
* "no such task" from "already finished", create records a task without
* starting one.
*/
/** Names this module owns. Kept here so the executor's check is one lookup. */
var TASK_TOOL_NAMES = [
	"task_list",
	"task_stop",
	"task_create"
];
function isTaskTool(name) {
	return TASK_TOOL_NAMES.includes(name);
}
function minutes(ms) {
	const mins = Math.round(ms / 6e4);
	if (mins < 1) return "under a minute";
	return mins === 1 ? "1 minute" : `${mins} minutes`;
}
async function listTasks() {
	const live = listRuns().filter((task) => task.status !== "completed");
	const openBoard = (await listLocalTasks().catch(() => [])).filter((task) => task.status !== "COMPLETED" && task.status !== "CANCELLED");
	const running = live.map((task) => ({
		id: task.id,
		what: task.description,
		state: task.status,
		workingFor: minutes(elapsedMs(task))
	}));
	if (running.length === 0 && openBoard.length === 0) return ok({
		running: [],
		waiting: []
	}, "Nothing is running and nothing is waiting.");
	const waiting = openBoard.filter((task) => !live.some((run) => run.id === task.id)).slice(0, 20).map((task) => ({
		id: task.id,
		what: task.title,
		state: task.status
	}));
	const parts = [];
	if (running.length > 0) parts.push(running.length === 1 ? "1 task is running" : `${running.length} tasks are running`);
	if (waiting.length > 0) parts.push(waiting.length === 1 ? "1 is waiting" : `${waiting.length} are waiting`);
	return ok({
		running,
		waiting
	}, `${parts.join(", ")}.`);
}
async function stopTaskTool(args) {
	const id = typeof args.id === "string" ? args.id.trim() : "";
	if (!id) return fail("blocked", "Which task? OCADE needs the task's id to stop it.");
	try {
		const stopped = await stopRun(id, "Stopped from a request.");
		return ok({ id: stopped.taskId }, `Stopped “${stopped.label}”.`, { verified: true });
	} catch (cause) {
		if (cause instanceof StopTaskError) {
			if (cause.code === "not_found") return fail("blocked", "There is no task with that id.");
			if (cause.code === "not_running") return fail("state_changed", "That task had already finished.");
			return fail("unsupported", "OCADE cannot stop that kind of task from here.");
		}
		return fail("retryable_failure", cause instanceof Error ? cause.message : "The task did not stop.");
	}
}
async function createTask(args) {
	const title = typeof args.title === "string" ? args.title.trim() : "";
	if (!title) return fail("blocked", "A task needs a short title.");
	const task = createUnifiedTask({
		source: "work",
		title: title.slice(0, 200),
		request: typeof args.detail === "string" ? args.detail.slice(0, 2e3) : void 0
	});
	await persistTask(task);
	return ok({ id: task.id }, `Added “${task.title}” to your tasks.`, { verified: true });
}
async function runTaskTool(name, args) {
	if (name === "task_list") return listTasks();
	if (name === "task_stop") return stopTaskTool(args);
	return createTask(args);
}
/**
* One executor for every tool call, whichever room asked for it.
*
* WHY THIS EXISTS SEPARATELY FROM THE ROOMS
* -----------------------------------------
* Cowork already routed browser work through the extension and machine work
* through the companion, and it did it inside a hook that also owns a timeline,
* a microphone, a voice and an approval card. Chat could not reach any of that
* without either importing Cowork wholesale or growing a second executor — and
* a second executor is how two rooms end up disagreeing about who runs a click.
*
* So the routing lives here, in a plain function with no React in it, and both
* rooms call it. The rule it encodes is the one Cowork already kept: the
* browser executes browser work, the companion executes machine work, and
* nothing else may reach either.
*
* WHAT THIS DELIBERATELY DOES NOT DO
* ----------------------------------
* It does not ask permission. Permission is decided before a call gets here, by
* `@/lib/runtime/permissions`, so that "was this allowed" and "did this work"
* stay two separable questions. An executor that also gated itself would let a
* caller skip the gate by calling the executor directly, which is exactly the
* hole the old split had.
*/
async function executeToolCall(call, context) {
	if (!findTool(call.name)) return {
		kind: "unsupported",
		detail: `OCADE has no action called ${call.name}.`
	};
	if (isTaskTool(call.name)) return runTaskTool(call.name, call.arguments ?? {});
	const viaExtension = await runBrowserToolViaExtension(call);
	if (viaExtension) return viaExtension;
	if (!context.missionId) return {
		kind: "blocked",
		detail: "That needs OCADE on this computer. Open Devices to connect the companion, and OCADE can do it from there."
	};
	const result = await raceAbort(runControlActionFn({ data: {
		missionId: context.missionId,
		tool: call.name,
		args: call.arguments ?? {},
		confirmed: context.confirmed === true
	} }), context.signal, () => ({
		ok: false,
		kind: "cancelled",
		detail: "You stopped this. If the action had already started on your computer it may have finished there.",
		verified: void 0,
		observation: null,
		elapsedMs: void 0
	}));
	return {
		kind: result.kind,
		detail: result.detail,
		...result.verified === void 0 ? {} : { verified: result.verified },
		...result.observation === null || result.observation === void 0 ? {} : { observation: result.observation },
		...result.elapsedMs === void 0 ? {} : { elapsedMs: result.elapsedMs }
	};
}
//#endregion
export { missionMicFn as a, startMissionFn as c, missionAudioInputsFn as i, stopAllLocalMissionsFn as l, extensionChannelAvailable as n, missionSpeakFn as o, handshakeWithExtension as r, refreshMemoryFn as s, executeToolCall as t, stopMissionFn as u };

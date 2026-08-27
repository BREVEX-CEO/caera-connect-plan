import { s as performance_default } from "../_libs/h3+rou3+srvx+unenv.mjs";
import { a as numberType, c as stringType, n as booleanType, o as objectType, s as recordType, u as unknownType } from "../_libs/zod.mjs";
import { n as listLocalTasks, r as persistTask, t as createUnifiedTask } from "./unified-task-BYmmu_RT.mjs";
import { a as listRuns, r as elapsedMs, t as StopTaskError, u as stopRun } from "./runs-Dy-PZWN-.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { i as ok, t as fail } from "./outcomes-wNfoXf5Q.mjs";
import { t as createSsrRpc } from "./createSsrRpc-7nZ60itO.mjs";
import { t as findTool } from "./tool-registry-BXQ-LCdE.mjs";
import { r as loadComputerUseSettings } from "./computer-use-settings-EFoxzXrd.mjs";
import processModule from "node:process";
//#region node_modules/.nitro/vite/services/ssr/assets/permission-settings-DpY0ceJj.js
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
var ESCAPED_STAR_PLACEHOLDER = "\0ESCAPED_STAR\0";
var ESCAPED_BACKSLASH_PLACEHOLDER = "\0ESCAPED_BACKSLASH\0";
var ESCAPED_STAR_PLACEHOLDER_RE = new RegExp(ESCAPED_STAR_PLACEHOLDER, "g");
var ESCAPED_BACKSLASH_PLACEHOLDER_RE = new RegExp(ESCAPED_BACKSLASH_PLACEHOLDER, "g");
/**
* Extract prefix from legacy :* syntax (e.g., "npm:*" -> "npm")
* This is maintained for backwards compatibility.
*/
function permissionRuleExtractPrefix(permissionRule) {
	return permissionRule.match(/^(.+):\*$/)?.[1] ?? null;
}
/**
* Check if a pattern contains unescaped wildcards (not legacy :* syntax).
* Returns true if the pattern contains * that are not escaped with \ or part of :* at the end.
*/
function hasWildcards(pattern) {
	if (pattern.endsWith(":*")) return false;
	for (let i = 0; i < pattern.length; i++) if (pattern[i] === "*") {
		let backslashCount = 0;
		let j = i - 1;
		while (j >= 0 && pattern[j] === "\\") {
			backslashCount++;
			j--;
		}
		if (backslashCount % 2 === 0) return true;
	}
	return false;
}
/**
* Match a command against a wildcard pattern.
* Wildcards (*) match any sequence of characters.
* Use \* to match a literal asterisk character.
* Use \\ to match a literal backslash.
*
* @param pattern - The permission rule pattern with wildcards
* @param command - The command to match against
* @returns true if the command matches the pattern
*/
function matchWildcardPattern(pattern, command, caseInsensitive = false) {
	const trimmedPattern = pattern.trim();
	let processed = "";
	let i = 0;
	while (i < trimmedPattern.length) {
		const char = trimmedPattern[i];
		if (char === "\\" && i + 1 < trimmedPattern.length) {
			const nextChar = trimmedPattern[i + 1];
			if (nextChar === "*") {
				processed += ESCAPED_STAR_PLACEHOLDER;
				i += 2;
				continue;
			} else if (nextChar === "\\") {
				processed += ESCAPED_BACKSLASH_PLACEHOLDER;
				i += 2;
				continue;
			}
		}
		processed += char;
		i++;
	}
	let regexPattern = processed.replace(/[.+?^${}()|[\]\\'"]/g, "\\$&").replace(/\*/g, ".*").replace(ESCAPED_STAR_PLACEHOLDER_RE, "\\*").replace(ESCAPED_BACKSLASH_PLACEHOLDER_RE, "\\\\");
	const unescapedStarCount = (processed.match(/\*/g) || []).length;
	if (regexPattern.endsWith(" .*") && unescapedStarCount === 1) regexPattern = regexPattern.slice(0, -3) + "( .*)?";
	const flags = "s" + (caseInsensitive ? "i" : "");
	return new RegExp(`^${regexPattern}$`, flags).test(command);
}
/**
* Parse a permission rule string into a structured rule object.
*/
function parsePermissionRule(permissionRule) {
	const prefix = permissionRuleExtractPrefix(permissionRule);
	if (prefix !== null) return {
		type: "prefix",
		prefix
	};
	if (hasWildcards(permissionRule)) return {
		type: "wildcard",
		pattern: permissionRule
	};
	return {
		type: "exact",
		command: permissionRule
	};
}
/**
* Which paths are too important to touch on a model's say-so.
*
* Ported from the archive's `src/utils/permissions/pathValidation.ts` --
* specifically `isDangerousRemovalPath`, `expandTilde` and
* `getGlobBaseDirectory`, which are the parts of that file that are rules
* rather than filesystem access.
*
* WHY THIS MATTERS IN A BROWSER
* -----------------------------
* OCADE's file tools take a path from the model and hand it to the companion.
* The companion checks its own approved folders, which is the right last line
* -- but it is the ONLY line, and it is on the other side of a network hop. A
* request to empty the home directory should not have to travel to another
* process before anything notices. The decision belongs where every other
* permission decision is made, which is in the browser, before the call leaves.
*
* ADAPTED, AND WHY
* ----------------
* - `homedir()` and `dirname()` from Node are gone. Home is passed in (the
*   companion reports it; when it has not, the tilde rules simply do not fire)
*   and the parent directory is computed on the normalised string, which is all
*   the donor's checks ever needed it for.
* - `process.platform` is gone. Both separator conventions are handled on every
*   platform, because the browser deciding this does not know -- and must not
*   guess -- what the machine at the other end is running.
* - The donor returned a boolean used to force a confirmation prompt. Here the
*   same boolean carries a reason, because OCADE has to SAY what it objected to
*   rather than silently asking again.
*/
var WINDOWS_DRIVE_ROOT_REGEX = /^[A-Za-z]:\/?$/;
var WINDOWS_DRIVE_CHILD_REGEX = /^[A-Za-z]:\/[^/]+$/;
var GLOB_PATTERN_REGEX = /[*?[\]{}]/;
/**
* Collapse separators so `C:\\Windows` -- valid in PowerShell -- cannot slip
* past a check written against single slashes. The donor's note, and its bug.
*/
function normalizePath(path) {
	const forwardSlashed = path.replace(/[\\/]+/g, "/");
	return forwardSlashed === "/" ? forwardSlashed : forwardSlashed.replace(/\/$/, "");
}
/**
* Expand a leading `~`. `~username` is deliberately NOT supported: resolving
* another account's home from a model-supplied string is a way to reach a
* directory nobody approved.
*/
function expandTilde(path, home) {
	if (!home) return path;
	if (path === "~" || path.startsWith("~/") || path.startsWith("~\\")) return home + path.slice(1);
	return path;
}
/** The directory a glob is rooted at, so a pattern is judged by where it looks. */
function globBaseDirectory(path) {
	const match = path.match(GLOB_PATTERN_REGEX);
	if (!match || match.index === void 0) return path;
	const beforeGlob = path.slice(0, match.index);
	const lastSeparator = Math.max(beforeGlob.lastIndexOf("/"), beforeGlob.lastIndexOf("\\"));
	if (lastSeparator === -1) return ".";
	return beforeGlob.slice(0, lastSeparator) || "/";
}
var SAFE = {
	dangerous: false,
	reason: null
};
/**
* Is this a place that must never be emptied, moved or deleted on a model's
* say-so?
*
* The donor's list, unchanged: everything, a filesystem root, a Windows drive
* root, the user's home directory, and any direct child of a root -- `/usr`,
* `/etc`, `C:/Program Files`. A direct child of root is included because those
* are system directories by convention on every platform, and losing one is
* indistinguishable from losing the machine.
*
* Deeper paths are NOT dangerous by this rule. `/usr/local/share/something` is
* ordinary work, and a rule that objected to it would be ignored within a day.
*/
function dangerousPath(path, home = null) {
	const raw = path.trim();
	if (!raw) return SAFE;
	if (normalizePath(globBaseDirectory(raw)) === "~") return {
		dangerous: true,
		reason: "that is the whole home folder"
	};
	const normalized = normalizePath(globBaseDirectory(expandTilde(raw, home)));
	if (normalized === "*" || normalized === "" || raw === "*" || raw.endsWith("/*")) return {
		dangerous: true,
		reason: "that would match everything"
	};
	if (normalized === "/") return {
		dangerous: true,
		reason: "that is the root of the filesystem"
	};
	if (WINDOWS_DRIVE_ROOT_REGEX.test(normalized)) return {
		dangerous: true,
		reason: "that is a whole drive"
	};
	if (home && normalized === normalizePath(home)) return {
		dangerous: true,
		reason: "that is the whole home folder"
	};
	if (normalized.lastIndexOf("/") === 0 && normalized.length > 1) return {
		dangerous: true,
		reason: "that is a system folder at the top of the disk"
	};
	if (WINDOWS_DRIVE_CHILD_REGEX.test(normalized)) return {
		dangerous: true,
		reason: "that is a system folder at the top of the drive"
	};
	return SAFE;
}
/**
* Does this path try to climb out of wherever it was rooted?
*
* The donor's `containsPathTraversal`, kept because the rule above is only
* meaningful if `approved/../..` cannot be used to reach past it.
*/
function containsPathTraversal(path) {
	return /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(path);
}
var LEGACY_TOOL_NAME_ALIASES = { control_work: "work" };
function normalizeLegacyToolName(name) {
	return LEGACY_TOOL_NAME_ALIASES[name] ?? name;
}
/**
* Unescapes special characters in rule content after parsing from permission rules.
* This reverses the escaping done by escapeRuleContent.
*
* Unescaping order matters (reverse of escaping):
* 1. Unescape parentheses first (\( -> (, \) -> ))
* 2. Then unescape backslashes (\\ -> \)
*
* @example
* unescapeRuleContent('psycopg2.connect\\(\\)') // => 'psycopg2.connect()'
* unescapeRuleContent('echo "test\\\\nvalue"') // => 'echo "test\\nvalue"'
*/
function unescapeRuleContent(content) {
	return content.replace(/\\\(/g, "(").replace(/\\\)/g, ")").replace(/\\\\/g, "\\");
}
/**
* Parses a permission rule string into its components.
* Handles escaped parentheses in the content portion.
*
* Format: "ToolName" or "ToolName(content)"
* Content may contain escaped parentheses: \( and \)
*
* @example
* permissionRuleValueFromString('Bash') // => { toolName: 'Bash' }
* permissionRuleValueFromString('Bash(npm install)') // => { toolName: 'Bash', ruleContent: 'npm install' }
* permissionRuleValueFromString('Bash(python -c "print\\(1\\)")') // => { toolName: 'Bash', ruleContent: 'python -c "print(1)"' }
*/
function permissionRuleValueFromString(ruleString) {
	const openParenIndex = findFirstUnescapedChar(ruleString, "(");
	if (openParenIndex === -1) return { toolName: normalizeLegacyToolName(ruleString) };
	const closeParenIndex = findLastUnescapedChar(ruleString, ")");
	if (closeParenIndex === -1 || closeParenIndex <= openParenIndex) return { toolName: normalizeLegacyToolName(ruleString) };
	if (closeParenIndex !== ruleString.length - 1) return { toolName: normalizeLegacyToolName(ruleString) };
	const toolName = ruleString.substring(0, openParenIndex);
	const rawContent = ruleString.substring(openParenIndex + 1, closeParenIndex);
	if (!toolName) return { toolName: normalizeLegacyToolName(ruleString) };
	if (rawContent === "" || rawContent === "*") return { toolName: normalizeLegacyToolName(toolName) };
	const ruleContent = unescapeRuleContent(rawContent);
	return {
		toolName: normalizeLegacyToolName(toolName),
		ruleContent
	};
}
/**
* Find the index of the first unescaped occurrence of a character.
* A character is escaped if preceded by an odd number of backslashes.
*/
function findFirstUnescapedChar(str, char) {
	for (let i = 0; i < str.length; i++) if (str[i] === char) {
		let backslashCount = 0;
		let j = i - 1;
		while (j >= 0 && str[j] === "\\") {
			backslashCount++;
			j--;
		}
		if (backslashCount % 2 === 0) return i;
	}
	return -1;
}
/**
* Find the index of the last unescaped occurrence of a character.
* A character is escaped if preceded by an odd number of backslashes.
*/
function findLastUnescapedChar(str, char) {
	for (let i = str.length - 1; i >= 0; i--) if (str[i] === char) {
		let backslashCount = 0;
		let j = i - 1;
		while (j >= 0 && str[j] === "\\") {
			backslashCount++;
			j--;
		}
		if (backslashCount % 2 === 0) return i;
	}
	return -1;
}
/**
* Pattern lists for dangerous shell-tool allow-rule prefixes.
*
* An allow rule like `Bash(python:*)` or `PowerShell(node:*)` lets the model
* run arbitrary code via that interpreter, bypassing the auto-mode classifier.
* These lists feed the isDangerous{Bash,PowerShell}Permission predicates in
* permissionSetup.ts, which strip such rules at auto-mode entry.
*
* The matcher in each predicate handles the rule-shape variants (exact, `:*`,
* trailing `*`, ` *`, ` -…*`). PS-specific cmdlet strings live in
* isDangerousPowerShellPermission (permissionSetup.ts).
*/
/**
* Cross-platform code-execution entry points present on both Unix and Windows.
* Shared to prevent the two lists drifting apart on interpreter additions.
*/
var CROSS_PLATFORM_CODE_EXEC = [
	"python",
	"python3",
	"python2",
	"node",
	"deno",
	"tsx",
	"ruby",
	"perl",
	"php",
	"lua",
	"npx",
	"bunx",
	"npm run",
	"yarn run",
	"pnpm run",
	"bun run",
	"bash",
	"sh",
	"ssh"
];
var DANGEROUS_BASH_PATTERNS = [
	...CROSS_PLATFORM_CODE_EXEC,
	"zsh",
	"fish",
	"eval",
	"exec",
	"env",
	"xargs",
	"sudo",
	...processModule.env.USER_TYPE === "carcc" ? [
		"fa run",
		"coo",
		"gh",
		"gh api",
		"curl",
		"wget",
		"git",
		"kubectl",
		"aws",
		"gcloud",
		"gsutil"
	] : []
];
var DESTRUCTIVE_PATTERNS$1 = [
	{
		pattern: /\bgit\s+reset\s+--hard\b/,
		warning: "Note: may discard uncommitted changes"
	},
	{
		pattern: /\bgit\s+push\b[^;&|\n]*[ \t](--force|--force-with-lease|-f)\b/,
		warning: "Note: may overwrite remote history"
	},
	{
		pattern: /\bgit\s+clean\b(?![^;&|\n]*(?:-[a-zA-Z]*n|--dry-run))[^;&|\n]*-[a-zA-Z]*f/,
		warning: "Note: may permanently delete untracked files"
	},
	{
		pattern: /\bgit\s+checkout\s+(--\s+)?\.[ \t]*($|[;&|\n])/,
		warning: "Note: may discard all working tree changes"
	},
	{
		pattern: /\bgit\s+restore\s+(--\s+)?\.[ \t]*($|[;&|\n])/,
		warning: "Note: may discard all working tree changes"
	},
	{
		pattern: /\bgit\s+stash[ \t]+(drop|clear)\b/,
		warning: "Note: may permanently remove stashed changes"
	},
	{
		pattern: /\bgit\s+branch\s+(-D[ \t]|--delete\s+--force|--force\s+--delete)\b/,
		warning: "Note: may force-delete a branch"
	},
	{
		pattern: /\bgit\s+(commit|push|merge)\b[^;&|\n]*--no-verify\b/,
		warning: "Note: may skip safety hooks"
	},
	{
		pattern: /\bgit\s+commit\b[^;&|\n]*--amend\b/,
		warning: "Note: may rewrite the last commit"
	},
	{
		pattern: /(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*[rR][a-zA-Z]*f|(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*f[a-zA-Z]*[rR]/,
		warning: "Note: may recursively force-remove files"
	},
	{
		pattern: /(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*[rR]/,
		warning: "Note: may recursively remove files"
	},
	{
		pattern: /(^|[;&|\n]\s*)rm\s+-[a-zA-Z]*f/,
		warning: "Note: may force-remove files"
	},
	{
		pattern: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i,
		warning: "Note: may drop or truncate database objects"
	},
	{
		pattern: /\bDELETE\s+FROM\s+\w+[ \t]*(;|"|'|\n|$)/i,
		warning: "Note: may delete all rows from a database table"
	},
	{
		pattern: /\bkubectl\s+delete\b/,
		warning: "Note: may delete Kubernetes resources"
	},
	{
		pattern: /\bterraform\s+destroy\b/,
		warning: "Note: may destroy Terraform infrastructure"
	}
];
/**
* Checks if a bash command matches known destructive patterns.
* Returns a human-readable warning string, or null if no destructive pattern is detected.
*/
function getDestructiveCommandWarning$1(command) {
	for (const { pattern, warning } of DESTRUCTIVE_PATTERNS$1) if (pattern.test(command)) return warning;
	return null;
}
var DESTRUCTIVE_PATTERNS = [
	{
		pattern: /(?:^|[|;&\n({])\s*(Remove-Item|rm|del|rd|rmdir|ri)\b[^|;&\n}]*-Recurse\b[^|;&\n}]*-Force\b/i,
		warning: "Note: may recursively force-remove files"
	},
	{
		pattern: /(?:^|[|;&\n({])\s*(Remove-Item|rm|del|rd|rmdir|ri)\b[^|;&\n}]*-Force\b[^|;&\n}]*-Recurse\b/i,
		warning: "Note: may recursively force-remove files"
	},
	{
		pattern: /(?:^|[|;&\n({])\s*(Remove-Item|rm|del|rd|rmdir|ri)\b[^|;&\n}]*-Recurse\b/i,
		warning: "Note: may recursively remove files"
	},
	{
		pattern: /(?:^|[|;&\n({])\s*(Remove-Item|rm|del|rd|rmdir|ri)\b[^|;&\n}]*-Force\b/i,
		warning: "Note: may force-remove files"
	},
	{
		pattern: /\bClear-Content\b[^|;&\n]*\*/i,
		warning: "Note: may clear content of multiple files"
	},
	{
		pattern: /\bFormat-Volume\b/i,
		warning: "Note: may format a disk volume"
	},
	{
		pattern: /\bClear-Disk\b/i,
		warning: "Note: may clear a disk"
	},
	{
		pattern: /\bgit\s+reset\s+--hard\b/i,
		warning: "Note: may discard uncommitted changes"
	},
	{
		pattern: /\bgit\s+push\b[^|;&\n]*\s+(--force|--force-with-lease|-f)\b/i,
		warning: "Note: may overwrite remote history"
	},
	{
		pattern: /\bgit\s+clean\b(?![^|;&\n]*(?:-[a-zA-Z]*n|--dry-run))[^|;&\n]*-[a-zA-Z]*f/i,
		warning: "Note: may permanently delete untracked files"
	},
	{
		pattern: /\bgit\s+stash\s+(drop|clear)\b/i,
		warning: "Note: may permanently remove stashed changes"
	},
	{
		pattern: /\b(DROP|TRUNCATE)\s+(TABLE|DATABASE|SCHEMA)\b/i,
		warning: "Note: may drop or truncate database objects"
	},
	{
		pattern: /\bStop-Computer\b/i,
		warning: "Note: will shut down the computer"
	},
	{
		pattern: /\bRestart-Computer\b/i,
		warning: "Note: will restart the computer"
	},
	{
		pattern: /\bClear-RecycleBin\b/i,
		warning: "Note: permanently deletes recycled files"
	}
];
/**
* Checks if a PowerShell command matches known destructive patterns.
* Returns a human-readable warning string, or null if no destructive pattern is detected.
*/
function getDestructiveCommandWarning(command) {
	for (const { pattern, warning } of DESTRUCTIVE_PATTERNS) if (pattern.test(command)) return warning;
	return null;
}
/**
* 50ms wall-clock cap — bails out on pathological/adversarial input.
* Pass `Infinity` via `parse(src, Infinity)` to disable (e.g. correctness
* tests, where CI jitter would otherwise cause spurious null returns).
*/
var PARSE_TIMEOUT_MS = 50;
/** Node budget cap — bails out before OOM on deeply nested input. */
var MAX_NODES = 5e4;
var MODULE = { parse: parseSource };
Promise.resolve();
/** Always succeeds — pure-TS needs no init. */
function getParserModule() {
	return MODULE;
}
var SPECIAL_VARS = /* @__PURE__ */ new Set([
	"?",
	"$",
	"@",
	"*",
	"#",
	"-",
	"!",
	"_"
]);
var DECL_KEYWORDS = /* @__PURE__ */ new Set([
	"export",
	"declare",
	"typeset",
	"readonly",
	"local"
]);
var SHELL_KEYWORDS = /* @__PURE__ */ new Set([
	"if",
	"then",
	"elif",
	"else",
	"fi",
	"while",
	"until",
	"for",
	"in",
	"do",
	"done",
	"case",
	"esac",
	"function",
	"select"
]);
function makeLexer(src) {
	return {
		src,
		len: src.length,
		i: 0,
		b: 0,
		heredocs: [],
		byteTable: null
	};
}
/** Advance one JS char, updating byte offset for UTF-8. */
function advance(L) {
	const c = L.src.charCodeAt(L.i);
	L.i++;
	if (c < 128) L.b++;
	else if (c < 2048) L.b += 2;
	else if (c >= 55296 && c <= 56319) {
		L.b += 4;
		L.i++;
	} else L.b += 3;
}
function peek(L, off = 0) {
	return L.i + off < L.len ? L.src[L.i + off] : "";
}
function byteAt(L, charIdx) {
	if (L.byteTable) return L.byteTable[charIdx];
	const t = new Uint32Array(L.len + 1);
	let b = 0;
	let i = 0;
	while (i < L.len) {
		t[i] = b;
		const c = L.src.charCodeAt(i);
		if (c < 128) {
			b++;
			i++;
		} else if (c < 2048) {
			b += 2;
			i++;
		} else if (c >= 55296 && c <= 56319) {
			t[i + 1] = b + 2;
			b += 4;
			i += 2;
		} else {
			b += 3;
			i++;
		}
	}
	t[L.len] = b;
	L.byteTable = t;
	return t[charIdx];
}
function isWordChar(c) {
	return c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c >= "0" && c <= "9" || c === "_" || c === "/" || c === "." || c === "-" || c === "+" || c === ":" || c === "@" || c === "%" || c === "," || c === "~" || c === "^" || c === "?" || c === "*" || c === "!" || c === "=" || c === "[" || c === "]";
}
function isWordStart(c) {
	return isWordChar(c) || c === "\\";
}
function isIdentStart(c) {
	return c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_";
}
function isIdentChar(c) {
	return isIdentStart(c) || c >= "0" && c <= "9";
}
function isDigit(c) {
	return c >= "0" && c <= "9";
}
function isHexDigit(c) {
	return isDigit(c) || c >= "a" && c <= "f" || c >= "A" && c <= "F";
}
function isBaseDigit(c) {
	return isIdentChar(c) || c === "@";
}
/**
* Unquoted heredoc delimiter chars. Bash accepts most non-metacharacters —
* not just identifiers. Stop at whitespace, redirects, pipe/list operators,
* and structural tokens. Allows !, -, ., +, etc. (e.g. <<!HEREDOC!).
*/
function isHeredocDelimChar(c) {
	return c !== "" && c !== " " && c !== "	" && c !== "\n" && c !== "<" && c !== ">" && c !== "|" && c !== "&" && c !== ";" && c !== "(" && c !== ")" && c !== "'" && c !== "\"" && c !== "`" && c !== "\\";
}
function skipBlanks(L) {
	while (L.i < L.len) {
		const c = L.src[L.i];
		if (c === " " || c === "	" || c === "\r") advance(L);
		else if (c === "\\") {
			const nx = L.src[L.i + 1];
			if (nx === "\n" || nx === "\r" && L.src[L.i + 2] === "\n") {
				advance(L);
				advance(L);
				if (nx === "\r") advance(L);
			} else if (nx === " " || nx === "	") {
				advance(L);
				advance(L);
			} else break;
		} else break;
	}
}
/**
* Scan next token. Context-sensitive: `cmd` mode treats [ as operator (test
* command start), `arg` mode treats [ as word char (glob/subscript).
*/
function nextToken(L, ctx = "arg") {
	skipBlanks(L);
	const start = L.b;
	if (L.i >= L.len) return {
		type: "EOF",
		value: "",
		start,
		end: start
	};
	const c = L.src[L.i];
	const c1 = peek(L, 1);
	const c2 = peek(L, 2);
	if (c === "\n") {
		advance(L);
		return {
			type: "NEWLINE",
			value: "\n",
			start,
			end: L.b
		};
	}
	if (c === "#") {
		const si = L.i;
		while (L.i < L.len && L.src[L.i] !== "\n") advance(L);
		return {
			type: "COMMENT",
			value: L.src.slice(si, L.i),
			start,
			end: L.b
		};
	}
	if (c === "&" && c1 === "&") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "&&",
			start,
			end: L.b
		};
	}
	if (c === "|" && c1 === "|") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "||",
			start,
			end: L.b
		};
	}
	if (c === "|" && c1 === "&") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "|&",
			start,
			end: L.b
		};
	}
	if (c === ";" && c1 === ";" && c2 === "&") {
		advance(L);
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: ";;&",
			start,
			end: L.b
		};
	}
	if (c === ";" && c1 === ";") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: ";;",
			start,
			end: L.b
		};
	}
	if (c === ";" && c1 === "&") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: ";&",
			start,
			end: L.b
		};
	}
	if (c === ">" && c1 === ">") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: ">>",
			start,
			end: L.b
		};
	}
	if (c === ">" && c1 === "&" && c2 === "-") {
		advance(L);
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: ">&-",
			start,
			end: L.b
		};
	}
	if (c === ">" && c1 === "&") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: ">&",
			start,
			end: L.b
		};
	}
	if (c === ">" && c1 === "|") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: ">|",
			start,
			end: L.b
		};
	}
	if (c === "&" && c1 === ">" && c2 === ">") {
		advance(L);
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "&>>",
			start,
			end: L.b
		};
	}
	if (c === "&" && c1 === ">") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "&>",
			start,
			end: L.b
		};
	}
	if (c === "<" && c1 === "<" && c2 === "<") {
		advance(L);
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "<<<",
			start,
			end: L.b
		};
	}
	if (c === "<" && c1 === "<" && c2 === "-") {
		advance(L);
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "<<-",
			start,
			end: L.b
		};
	}
	if (c === "<" && c1 === "<") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "<<",
			start,
			end: L.b
		};
	}
	if (c === "<" && c1 === "&" && c2 === "-") {
		advance(L);
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "<&-",
			start,
			end: L.b
		};
	}
	if (c === "<" && c1 === "&") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "<&",
			start,
			end: L.b
		};
	}
	if (c === "<" && c1 === "(") {
		advance(L);
		advance(L);
		return {
			type: "LT_PAREN",
			value: "<(",
			start,
			end: L.b
		};
	}
	if (c === ">" && c1 === "(") {
		advance(L);
		advance(L);
		return {
			type: "GT_PAREN",
			value: ">(",
			start,
			end: L.b
		};
	}
	if (c === "(" && c1 === "(") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "((",
			start,
			end: L.b
		};
	}
	if (c === ")" && c1 === ")") {
		advance(L);
		advance(L);
		return {
			type: "OP",
			value: "))",
			start,
			end: L.b
		};
	}
	if (c === "|" || c === "&" || c === ";" || c === ">" || c === "<") {
		advance(L);
		return {
			type: "OP",
			value: c,
			start,
			end: L.b
		};
	}
	if (c === "(" || c === ")") {
		advance(L);
		return {
			type: "OP",
			value: c,
			start,
			end: L.b
		};
	}
	if (ctx === "cmd") {
		if (c === "[" && c1 === "[") {
			advance(L);
			advance(L);
			return {
				type: "OP",
				value: "[[",
				start,
				end: L.b
			};
		}
		if (c === "[") {
			advance(L);
			return {
				type: "OP",
				value: "[",
				start,
				end: L.b
			};
		}
		if (c === "{" && (c1 === " " || c1 === "	" || c1 === "\n")) {
			advance(L);
			return {
				type: "OP",
				value: "{",
				start,
				end: L.b
			};
		}
		if (c === "}") {
			advance(L);
			return {
				type: "OP",
				value: "}",
				start,
				end: L.b
			};
		}
		if (c === "!" && (c1 === " " || c1 === "	")) {
			advance(L);
			return {
				type: "OP",
				value: "!",
				start,
				end: L.b
			};
		}
	}
	if (c === "\"") {
		advance(L);
		return {
			type: "DQUOTE",
			value: "\"",
			start,
			end: L.b
		};
	}
	if (c === "'") {
		const si = L.i;
		advance(L);
		while (L.i < L.len && L.src[L.i] !== "'") advance(L);
		if (L.i < L.len) advance(L);
		return {
			type: "SQUOTE",
			value: L.src.slice(si, L.i),
			start,
			end: L.b
		};
	}
	if (c === "$") {
		if (c1 === "(" && c2 === "(") {
			advance(L);
			advance(L);
			advance(L);
			return {
				type: "DOLLAR_DPAREN",
				value: "$((",
				start,
				end: L.b
			};
		}
		if (c1 === "(") {
			advance(L);
			advance(L);
			return {
				type: "DOLLAR_PAREN",
				value: "$(",
				start,
				end: L.b
			};
		}
		if (c1 === "{") {
			advance(L);
			advance(L);
			return {
				type: "DOLLAR_BRACE",
				value: "${",
				start,
				end: L.b
			};
		}
		if (c1 === "'") {
			const si = L.i;
			advance(L);
			advance(L);
			while (L.i < L.len && L.src[L.i] !== "'") {
				if (L.src[L.i] === "\\" && L.i + 1 < L.len) advance(L);
				advance(L);
			}
			if (L.i < L.len) advance(L);
			return {
				type: "ANSI_C",
				value: L.src.slice(si, L.i),
				start,
				end: L.b
			};
		}
		advance(L);
		return {
			type: "DOLLAR",
			value: "$",
			start,
			end: L.b
		};
	}
	if (c === "`") {
		advance(L);
		return {
			type: "BACKTICK",
			value: "`",
			start,
			end: L.b
		};
	}
	if (isDigit(c)) {
		let j = L.i;
		while (j < L.len && isDigit(L.src[j])) j++;
		const after = j < L.len ? L.src[j] : "";
		if (after === ">" || after === "<") {
			const si = L.i;
			while (L.i < j) advance(L);
			return {
				type: "WORD",
				value: L.src.slice(si, L.i),
				start,
				end: L.b
			};
		}
	}
	if (isWordStart(c) || c === "{" || c === "}") {
		const si = L.i;
		while (L.i < L.len) {
			const ch = L.src[L.i];
			if (ch === "\\") {
				if (L.i + 1 >= L.len) break;
				if (L.src[L.i + 1] === "\n") {
					advance(L);
					advance(L);
					continue;
				}
				advance(L);
				advance(L);
				continue;
			}
			if (!isWordChar(ch) && ch !== "{" && ch !== "}") break;
			advance(L);
		}
		if (L.i > si) {
			const v = L.src.slice(si, L.i);
			if (/^-?\d+$/.test(v)) return {
				type: "NUMBER",
				value: v,
				start,
				end: L.b
			};
			return {
				type: "WORD",
				value: v,
				start,
				end: L.b
			};
		}
	}
	advance(L);
	return {
		type: "WORD",
		value: c,
		start,
		end: L.b
	};
}
function parseSource(source, timeoutMs) {
	const L = makeLexer(source);
	const srcBytes = byteLengthUtf8(source);
	const P = {
		L,
		src: source,
		srcBytes,
		isAscii: srcBytes === source.length,
		nodeCount: 0,
		deadline: performance_default.now() + (timeoutMs ?? PARSE_TIMEOUT_MS),
		aborted: false,
		inBacktick: 0,
		stopToken: null
	};
	try {
		const program = parseProgram(P);
		if (P.aborted) return null;
		return program;
	} catch {
		return null;
	}
}
function byteLengthUtf8(s) {
	let b = 0;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		if (c < 128) b++;
		else if (c < 2048) b += 2;
		else if (c >= 55296 && c <= 56319) {
			b += 4;
			i++;
		} else b += 3;
	}
	return b;
}
function checkBudget(P) {
	P.nodeCount++;
	if (P.nodeCount > MAX_NODES) {
		P.aborted = true;
		throw new Error("budget");
	}
	if ((P.nodeCount & 127) === 0 && performance_default.now() > P.deadline) {
		P.aborted = true;
		throw new Error("timeout");
	}
}
/** Build a node. Slices text from source by byte range via char-index lookup. */
function mk(P, type, start, end, children) {
	checkBudget(P);
	return {
		type,
		text: sliceBytes(P, start, end),
		startIndex: start,
		endIndex: end,
		children
	};
}
function sliceBytes(P, startByte, endByte) {
	if (P.isAscii) return P.src.slice(startByte, endByte);
	const L = P.L;
	if (!L.byteTable) byteAt(L, 0);
	const t = L.byteTable;
	let lo = 0;
	let hi = P.src.length;
	while (lo < hi) {
		const m = lo + hi >>> 1;
		if (t[m] < startByte) lo = m + 1;
		else hi = m;
	}
	const sc = lo;
	lo = sc;
	hi = P.src.length;
	while (lo < hi) {
		const m = lo + hi >>> 1;
		if (t[m] < endByte) lo = m + 1;
		else hi = m;
	}
	return P.src.slice(sc, lo);
}
function leaf(P, type, tok) {
	return mk(P, type, tok.start, tok.end, []);
}
function parseProgram(P) {
	const children = [];
	skipBlanks(P.L);
	while (true) {
		const save = saveLex(P.L);
		if (nextToken(P.L, "cmd").type === "NEWLINE") {
			skipBlanks(P.L);
			continue;
		}
		restoreLex(P.L, save);
		break;
	}
	const progStart = P.L.b;
	while (P.L.i < P.L.len) {
		const save = saveLex(P.L);
		const t = nextToken(P.L, "cmd");
		if (t.type === "EOF") break;
		if (t.type === "NEWLINE") continue;
		if (t.type === "COMMENT") {
			children.push(leaf(P, "comment", t));
			continue;
		}
		restoreLex(P.L, save);
		const stmts = parseStatements(P, null);
		for (const s of stmts) children.push(s);
		if (stmts.length === 0) {
			const errTok = nextToken(P.L, "cmd");
			if (errTok.type === "EOF") break;
			if (errTok.type === "OP" && errTok.value === ";;" && children.length > 0) continue;
			children.push(mk(P, "ERROR", errTok.start, errTok.end, []));
		}
	}
	return mk(P, "program", progStart, children.length > 0 ? P.srcBytes : progStart, children);
}
function saveLex(L) {
	return L.b * 65536 + L.i;
}
function restoreLex(L, s) {
	L.i = s & 65535;
	L.b = s >>> 16;
}
/**
* Parse a sequence of statements separated by ; & newline. Returns a flat list
* where ; and & are sibling leaves (NOT wrapped in 'list' — only && || get
* that). Stops at terminator or EOF.
*/
function parseStatements(P, terminator) {
	const out = [];
	while (true) {
		skipBlanks(P.L);
		const save = saveLex(P.L);
		const t = nextToken(P.L, "cmd");
		if (t.type === "EOF") {
			restoreLex(P.L, save);
			break;
		}
		if (t.type === "NEWLINE") {
			if (P.L.heredocs.length > 0) scanHeredocBodies(P);
			continue;
		}
		if (t.type === "COMMENT") {
			out.push(leaf(P, "comment", t));
			continue;
		}
		if (terminator && t.type === "OP" && t.value === terminator) {
			restoreLex(P.L, save);
			break;
		}
		if (t.type === "OP" && (t.value === ")" || t.value === "}" || t.value === ";;" || t.value === ";&" || t.value === ";;&" || t.value === "))" || t.value === "]]" || t.value === "]")) {
			restoreLex(P.L, save);
			break;
		}
		if (t.type === "BACKTICK" && P.inBacktick > 0) {
			restoreLex(P.L, save);
			break;
		}
		if (t.type === "WORD" && (t.value === "then" || t.value === "elif" || t.value === "else" || t.value === "fi" || t.value === "do" || t.value === "done" || t.value === "esac")) {
			restoreLex(P.L, save);
			break;
		}
		restoreLex(P.L, save);
		const stmt = parseAndOr(P);
		if (!stmt) break;
		out.push(stmt);
		skipBlanks(P.L);
		const save2 = saveLex(P.L);
		const sep = nextToken(P.L, "cmd");
		if (sep.type === "OP" && (sep.value === ";" || sep.value === "&")) {
			const save3 = saveLex(P.L);
			const after = nextToken(P.L, "cmd");
			restoreLex(P.L, save3);
			out.push(leaf(P, sep.value, sep));
			if (after.type === "EOF" || after.type === "OP" && (after.value === ")" || after.value === "}" || after.value === ";;" || after.value === ";&" || after.value === ";;&") || after.type === "WORD" && (after.value === "then" || after.value === "elif" || after.value === "else" || after.value === "fi" || after.value === "do" || after.value === "done" || after.value === "esac")) continue;
		} else if (sep.type === "NEWLINE") {
			if (P.L.heredocs.length > 0) scanHeredocBodies(P);
			continue;
		} else restoreLex(P.L, save2);
	}
	return out;
}
/**
* Parse pipeline chains joined by && ||. Left-associative nesting.
* tree-sitter quirk: trailing redirect on the last pipeline wraps the ENTIRE
* list in a redirected_statement — `a > x && b > y` becomes
* redirected_statement(list(redirected_statement(a,>x), &&, b), >y).
*/
function parseAndOr(P) {
	let left = parsePipeline(P);
	if (!left) return null;
	while (true) {
		const save = saveLex(P.L);
		const t = nextToken(P.L, "cmd");
		if (t.type === "OP" && (t.value === "&&" || t.value === "||")) {
			const op = leaf(P, t.value, t);
			skipNewlines(P);
			const right = parsePipeline(P);
			if (!right) {
				left = mk(P, "list", left.startIndex, op.endIndex, [left, op]);
				break;
			}
			if (right.type === "redirected_statement" && right.children.length >= 2) {
				const inner = right.children[0];
				const redirs = right.children.slice(1);
				const listNode = mk(P, "list", left.startIndex, inner.endIndex, [
					left,
					op,
					inner
				]);
				const lastR = redirs[redirs.length - 1];
				left = mk(P, "redirected_statement", listNode.startIndex, lastR.endIndex, [listNode, ...redirs]);
			} else left = mk(P, "list", left.startIndex, right.endIndex, [
				left,
				op,
				right
			]);
		} else {
			restoreLex(P.L, save);
			break;
		}
	}
	return left;
}
function skipNewlines(P) {
	while (true) {
		const save = saveLex(P.L);
		if (nextToken(P.L, "cmd").type !== "NEWLINE") {
			restoreLex(P.L, save);
			break;
		}
	}
}
/**
* Parse commands joined by | or |&. Flat children with operator leaves.
* tree-sitter quirk: `a | b 2>nul | c` hoists the redirect on `b` to wrap
* the preceding pipeline fragment — pipeline(redirected_statement(
* pipeline(a,|,b), 2>nul), |, c).
*/
function parsePipeline(P) {
	let first = parseCommand(P);
	if (!first) return null;
	const parts = [first];
	while (true) {
		const save = saveLex(P.L);
		const t = nextToken(P.L, "cmd");
		if (t.type === "OP" && (t.value === "|" || t.value === "|&")) {
			const op = leaf(P, t.value, t);
			skipNewlines(P);
			const next = parseCommand(P);
			if (!next) {
				parts.push(op);
				break;
			}
			if (next.type === "redirected_statement" && next.children.length >= 2 && parts.length >= 1) {
				const inner = next.children[0];
				const redirs = next.children.slice(1);
				const pipeKids = [
					...parts,
					op,
					inner
				];
				const pipeNode = mk(P, "pipeline", pipeKids[0].startIndex, inner.endIndex, pipeKids);
				const lastR = redirs[redirs.length - 1];
				const wrapped = mk(P, "redirected_statement", pipeNode.startIndex, lastR.endIndex, [pipeNode, ...redirs]);
				parts.length = 0;
				parts.push(wrapped);
				first = wrapped;
				continue;
			}
			parts.push(op, next);
		} else {
			restoreLex(P.L, save);
			break;
		}
	}
	if (parts.length === 1) return parts[0];
	const last = parts[parts.length - 1];
	return mk(P, "pipeline", parts[0].startIndex, last.endIndex, parts);
}
/** Parse a single command: simple, compound, or control structure. */
function parseCommand(P) {
	skipBlanks(P.L);
	const save = saveLex(P.L);
	const t = nextToken(P.L, "cmd");
	if (t.type === "EOF") {
		restoreLex(P.L, save);
		return null;
	}
	if (t.type === "OP" && t.value === "!") {
		const bang = leaf(P, "!", t);
		const inner = parseCommand(P);
		if (!inner) {
			restoreLex(P.L, save);
			return null;
		}
		if (inner.type === "redirected_statement" && inner.children.length >= 2) {
			const cmd = inner.children[0];
			const redirs = inner.children.slice(1);
			const neg = mk(P, "negated_command", bang.startIndex, cmd.endIndex, [bang, cmd]);
			const lastR = redirs[redirs.length - 1];
			return mk(P, "redirected_statement", neg.startIndex, lastR.endIndex, [neg, ...redirs]);
		}
		return mk(P, "negated_command", bang.startIndex, inner.endIndex, [bang, inner]);
	}
	if (t.type === "OP" && t.value === "(") {
		const open = leaf(P, "(", t);
		const body = parseStatements(P, ")");
		const closeTok = nextToken(P.L, "cmd");
		const close = closeTok.type === "OP" && closeTok.value === ")" ? leaf(P, ")", closeTok) : mk(P, ")", open.endIndex, open.endIndex, []);
		return maybeRedirect(P, mk(P, "subshell", open.startIndex, close.endIndex, [
			open,
			...body,
			close
		]));
	}
	if (t.type === "OP" && t.value === "((") {
		const open = leaf(P, "((", t);
		const exprs = parseArithCommaList(P, "))", "var");
		const closeTok = nextToken(P.L, "cmd");
		const close = closeTok.value === "))" ? leaf(P, "))", closeTok) : mk(P, "))", open.endIndex, open.endIndex, []);
		return mk(P, "compound_statement", open.startIndex, close.endIndex, [
			open,
			...exprs,
			close
		]);
	}
	if (t.type === "OP" && t.value === "{") {
		const open = leaf(P, "{", t);
		const body = parseStatements(P, "}");
		const closeTok = nextToken(P.L, "cmd");
		const close = closeTok.type === "OP" && closeTok.value === "}" ? leaf(P, "}", closeTok) : mk(P, "}", open.endIndex, open.endIndex, []);
		return maybeRedirect(P, mk(P, "compound_statement", open.startIndex, close.endIndex, [
			open,
			...body,
			close
		]));
	}
	if (t.type === "OP" && (t.value === "[" || t.value === "[[")) {
		const open = leaf(P, t.value, t);
		const closer = t.value === "[" ? "]" : "]]";
		const exprSave = saveLex(P.L);
		let expr = parseTestExpr(P, closer);
		skipBlanks(P.L);
		if (t.value === "[" && peek(P.L) !== "]") {
			restoreLex(P.L, exprSave);
			const prevStop = P.stopToken;
			P.stopToken = "]";
			const rstmt = parseCommand(P);
			P.stopToken = prevStop;
			if (rstmt && rstmt.type === "redirected_statement") expr = rstmt;
			else {
				restoreLex(P.L, exprSave);
				expr = parseTestExpr(P, closer);
			}
			skipBlanks(P.L);
		}
		const closeTok = nextToken(P.L, "arg");
		let close;
		if (closeTok.value === closer) close = leaf(P, closer, closeTok);
		else close = mk(P, closer, open.endIndex, open.endIndex, []);
		const kids = expr ? [
			open,
			expr,
			close
		] : [open, close];
		return mk(P, "test_command", open.startIndex, close.endIndex, kids);
	}
	if (t.type === "WORD") {
		if (t.value === "if") return maybeRedirect(P, parseIf(P, t), true);
		if (t.value === "while" || t.value === "until") return maybeRedirect(P, parseWhile(P, t), true);
		if (t.value === "for") return maybeRedirect(P, parseFor(P, t), true);
		if (t.value === "select") return maybeRedirect(P, parseFor(P, t), true);
		if (t.value === "case") return maybeRedirect(P, parseCase(P, t), true);
		if (t.value === "function") return parseFunction(P, t);
		if (DECL_KEYWORDS.has(t.value)) return maybeRedirect(P, parseDeclaration(P, t));
		if (t.value === "unset" || t.value === "unsetenv") return maybeRedirect(P, parseUnset(P, t));
	}
	restoreLex(P.L, save);
	return parseSimpleCommand(P);
}
/**
* Parse a simple command: [assignment]* word [arg|redirect]*
* Returns variable_assignment if only one assignment and no command.
*/
function parseSimpleCommand(P) {
	const start = P.L.b;
	const assignments = [];
	const preRedirects = [];
	while (true) {
		skipBlanks(P.L);
		const a = tryParseAssignment(P);
		if (a) {
			assignments.push(a);
			continue;
		}
		const r = tryParseRedirect(P);
		if (r) {
			preRedirects.push(r);
			continue;
		}
		break;
	}
	skipBlanks(P.L);
	const save = saveLex(P.L);
	const nameTok = nextToken(P.L, "cmd");
	if (nameTok.type === "EOF" || nameTok.type === "NEWLINE" || nameTok.type === "COMMENT" || nameTok.type === "OP" && nameTok.value !== "{" && nameTok.value !== "[" && nameTok.value !== "[[" || nameTok.type === "WORD" && SHELL_KEYWORDS.has(nameTok.value) && nameTok.value !== "in") {
		restoreLex(P.L, save);
		if (assignments.length === 1 && preRedirects.length === 0) return assignments[0];
		if (preRedirects.length > 0 && assignments.length === 0) {
			const last = preRedirects[preRedirects.length - 1];
			return mk(P, "redirected_statement", preRedirects[0].startIndex, last.endIndex, preRedirects);
		}
		if (assignments.length > 1 && preRedirects.length === 0) {
			const last = assignments[assignments.length - 1];
			return mk(P, "variable_assignments", assignments[0].startIndex, last.endIndex, assignments);
		}
		if (assignments.length > 0 || preRedirects.length > 0) {
			const all = [...assignments, ...preRedirects];
			const last = all[all.length - 1];
			return mk(P, "command", start, last.endIndex, all);
		}
		return null;
	}
	restoreLex(P.L, save);
	const fnSave = saveLex(P.L);
	const nm = parseWord(P, "cmd");
	if (nm && nm.type === "word") {
		skipBlanks(P.L);
		if (peek(P.L) === "(" && peek(P.L, 1) === ")") {
			const oTok = nextToken(P.L, "cmd");
			const cTok = nextToken(P.L, "cmd");
			const oParen = leaf(P, "(", oTok);
			const cParen = leaf(P, ")", cTok);
			skipBlanks(P.L);
			skipNewlines(P);
			const body = parseCommand(P);
			if (body) {
				let bodyKids = [body];
				if (body.type === "redirected_statement" && body.children.length >= 2 && body.children[0].type === "compound_statement") bodyKids = body.children;
				const last = bodyKids[bodyKids.length - 1];
				return mk(P, "function_definition", nm.startIndex, last.endIndex, [
					nm,
					oParen,
					cParen,
					...bodyKids
				]);
			}
		}
	}
	restoreLex(P.L, fnSave);
	const nameArg = parseWord(P, "cmd");
	if (!nameArg) {
		if (assignments.length === 1) return assignments[0];
		return null;
	}
	const cmdName = mk(P, "command_name", nameArg.startIndex, nameArg.endIndex, [nameArg]);
	const args = [];
	const redirects = [];
	let heredocRedirect = null;
	while (true) {
		skipBlanks(P.L);
		const r = tryParseRedirect(P, true);
		if (r) {
			if (r.type === "heredoc_redirect") heredocRedirect = r;
			else if (r.type === "herestring_redirect") args.push(r);
			else redirects.push(r);
			continue;
		}
		if (redirects.length > 0) break;
		if (P.stopToken === "]" && peek(P.L) === "]") break;
		const save2 = saveLex(P.L);
		const pk = nextToken(P.L, "arg");
		if (pk.type === "EOF" || pk.type === "NEWLINE" || pk.type === "COMMENT" || pk.type === "OP" && (pk.value === "|" || pk.value === "|&" || pk.value === "&&" || pk.value === "||" || pk.value === ";" || pk.value === ";;" || pk.value === ";&" || pk.value === ";;&" || pk.value === "&" || pk.value === ")" || pk.value === "}" || pk.value === "))")) {
			restoreLex(P.L, save2);
			break;
		}
		restoreLex(P.L, save2);
		const arg = parseWord(P, "arg");
		if (!arg) {
			if (peek(P.L) === "(") {
				const open = leaf(P, "(", nextToken(P.L, "cmd"));
				const body = parseStatements(P, ")");
				const cTok = nextToken(P.L, "cmd");
				const close = cTok.type === "OP" && cTok.value === ")" ? leaf(P, ")", cTok) : mk(P, ")", open.endIndex, open.endIndex, []);
				args.push(mk(P, "subshell", open.startIndex, close.endIndex, [
					open,
					...body,
					close
				]));
				continue;
			}
			break;
		}
		if (arg.type === "word" && arg.text === "=") {
			args.push(mk(P, "ERROR", arg.startIndex, arg.endIndex, [arg]));
			continue;
		}
		if ((arg.type === "word" || arg.type === "concatenation") && peek(P.L) === "(" && P.L.b === arg.endIndex) {
			args.push(mk(P, "ERROR", arg.startIndex, arg.endIndex, [arg]));
			continue;
		}
		args.push(arg);
	}
	const cmdChildren = [
		...assignments,
		...preRedirects,
		cmdName,
		...args
	];
	const cmdEnd = cmdChildren.length > 0 ? cmdChildren[cmdChildren.length - 1].endIndex : cmdName.endIndex;
	const cmdStart = cmdChildren[0].startIndex;
	const cmd = mk(P, "command", cmdStart, cmdEnd, cmdChildren);
	if (heredocRedirect) {
		scanHeredocBodies(P);
		const hd = P.L.heredocs.shift();
		if (hd && heredocRedirect.children.length >= 2) {
			const bodyNode = mk(P, "heredoc_body", hd.bodyStart, hd.bodyEnd, hd.quoted ? [] : parseHeredocBodyContent(P, hd.bodyStart, hd.bodyEnd));
			const endNode = mk(P, "heredoc_end", hd.endStart, hd.endEnd, []);
			heredocRedirect.children.push(bodyNode, endNode);
			heredocRedirect.endIndex = hd.endEnd;
			heredocRedirect.text = sliceBytes(P, heredocRedirect.startIndex, hd.endEnd);
		}
		const allR = [
			...preRedirects,
			heredocRedirect,
			...redirects
		];
		return mk(P, "redirected_statement", preRedirects.length > 0 ? Math.min(cmd.startIndex, preRedirects[0].startIndex) : cmd.startIndex, heredocRedirect.endIndex, [cmd, ...allR]);
	}
	if (redirects.length > 0) {
		const last = redirects[redirects.length - 1];
		return mk(P, "redirected_statement", cmd.startIndex, last.endIndex, [cmd, ...redirects]);
	}
	return cmd;
}
function maybeRedirect(P, node, allowHerestring = false) {
	const redirects = [];
	while (true) {
		skipBlanks(P.L);
		const save = saveLex(P.L);
		const r = tryParseRedirect(P);
		if (!r) break;
		if (r.type === "herestring_redirect" && !allowHerestring) {
			restoreLex(P.L, save);
			break;
		}
		redirects.push(r);
	}
	if (redirects.length === 0) return node;
	const last = redirects[redirects.length - 1];
	return mk(P, "redirected_statement", node.startIndex, last.endIndex, [node, ...redirects]);
}
function tryParseAssignment(P) {
	const save = saveLex(P.L);
	skipBlanks(P.L);
	const startB = P.L.b;
	if (!isIdentStart(peek(P.L))) {
		restoreLex(P.L, save);
		return null;
	}
	while (isIdentChar(peek(P.L))) advance(P.L);
	const nameEnd = P.L.b;
	let subEnd = nameEnd;
	if (peek(P.L) === "[") {
		advance(P.L);
		let depth = 1;
		while (P.L.i < P.L.len && depth > 0) {
			const c = peek(P.L);
			if (c === "[") depth++;
			else if (c === "]") depth--;
			advance(P.L);
		}
		subEnd = P.L.b;
	}
	const c = peek(P.L);
	const c1 = peek(P.L, 1);
	let op;
	if (c === "=" && c1 !== "=") op = "=";
	else if (c === "+" && c1 === "=") op = "+=";
	else {
		restoreLex(P.L, save);
		return null;
	}
	const nameNode = mk(P, "variable_name", startB, nameEnd, []);
	let lhs = nameNode;
	if (subEnd > nameEnd) {
		const brOpen = mk(P, "[", nameEnd, nameEnd + 1, []);
		const idx = parseSubscriptIndex(P, nameEnd + 1, subEnd - 1);
		const brClose = mk(P, "]", subEnd - 1, subEnd, []);
		lhs = mk(P, "subscript", startB, subEnd, [
			nameNode,
			brOpen,
			idx,
			brClose
		]);
	}
	const opStart = P.L.b;
	advance(P.L);
	if (op === "+=") advance(P.L);
	const opEnd = P.L.b;
	const opNode = mk(P, op, opStart, opEnd, []);
	let val = null;
	if (peek(P.L) === "(") {
		const aOpen = leaf(P, "(", nextToken(P.L, "cmd"));
		const elems = [aOpen];
		while (true) {
			skipBlanks(P.L);
			if (peek(P.L) === ")") break;
			const e = parseWord(P, "arg");
			if (!e) break;
			elems.push(e);
		}
		const acTok = nextToken(P.L, "cmd");
		const aClose = acTok.value === ")" ? leaf(P, ")", acTok) : mk(P, ")", aOpen.endIndex, aOpen.endIndex, []);
		elems.push(aClose);
		val = mk(P, "array", aOpen.startIndex, aClose.endIndex, elems);
	} else {
		const c2 = peek(P.L);
		if (c2 && c2 !== " " && c2 !== "	" && c2 !== "\n" && c2 !== ";" && c2 !== "&" && c2 !== "|" && c2 !== ")" && c2 !== "}") val = parseWord(P, "arg");
	}
	const kids = val ? [
		lhs,
		opNode,
		val
	] : [lhs, opNode];
	return mk(P, "variable_assignment", startB, val ? val.endIndex : opEnd, kids);
}
/**
* Parse subscript index content. Parsed arithmetically per tree-sitter grammar:
* `${a[1+2]}` → binary_expression; `${a[++i]}` → unary_expression(word);
* `${a[(($n+1))]}` → compound_statement(binary_expression). Falls back to
* simple patterns (@, *) as word.
*/
function parseSubscriptIndexInline(P) {
	skipBlanks(P.L);
	const c = peek(P.L);
	if ((c === "@" || c === "*") && peek(P.L, 1) === "]") {
		const s = P.L.b;
		advance(P.L);
		return mk(P, "word", s, P.L.b, []);
	}
	if (c === "(" && peek(P.L, 1) === "(") {
		const oStart = P.L.b;
		advance(P.L);
		advance(P.L);
		const open = mk(P, "((", oStart, P.L.b, []);
		const inner = parseArithExpr(P, "))", "var");
		skipBlanks(P.L);
		let close;
		if (peek(P.L) === ")" && peek(P.L, 1) === ")") {
			const cs = P.L.b;
			advance(P.L);
			advance(P.L);
			close = mk(P, "))", cs, P.L.b, []);
		} else close = mk(P, "))", P.L.b, P.L.b, []);
		const kids = inner ? [
			open,
			inner,
			close
		] : [open, close];
		return mk(P, "compound_statement", open.startIndex, close.endIndex, kids);
	}
	return parseArithExpr(P, "]", "word");
}
/** Legacy byte-range subscript index parser — kept for callers that pre-scan. */
function parseSubscriptIndex(P, startB, endB) {
	const text = sliceBytes(P, startB, endB);
	if (/^\d+$/.test(text)) return mk(P, "number", startB, endB, []);
	if (/^\$([a-zA-Z_]\w*)$/.exec(text)) return mk(P, "simple_expansion", startB, endB, [mk(P, "$", startB, startB + 1, []), mk(P, "variable_name", startB + 1, endB, [])]);
	if (text.length === 2 && text[0] === "$" && SPECIAL_VARS.has(text[1])) return mk(P, "simple_expansion", startB, endB, [mk(P, "$", startB, startB + 1, []), mk(P, "special_variable_name", startB + 1, endB, [])]);
	return mk(P, "word", startB, endB, []);
}
/**
* Can the current position start a redirect destination literal?
* Returns false at redirect ops, terminators, or file-descriptor-prefixed ops
* so file_redirect's repeat1($._literal) stops at the right boundary.
*/
function isRedirectLiteralStart(P) {
	const c = peek(P.L);
	if (c === "" || c === "\n") return false;
	if (c === "|" || c === "&" || c === ";" || c === "(" || c === ")") return false;
	if (c === "<" || c === ">") return peek(P.L, 1) === "(";
	if (isDigit(c)) {
		let j = P.L.i;
		while (j < P.L.len && isDigit(P.L.src[j])) j++;
		const after = j < P.L.len ? P.L.src[j] : "";
		if (after === ">" || after === "<") return false;
	}
	if (c === "}") return false;
	if (P.stopToken === "]" && c === "]") return false;
	return true;
}
/**
* Parse a redirect operator + destination(s).
* @param greedy When true, file_redirect consumes repeat1($._literal) per
*   grammar's prec.left — `cmd >f a b c` attaches `a b c` to the redirect.
*   When false (preRedirect context), takes only 1 destination because
*   command's dynamic precedence beats redirected_statement's prec(-1).
*/
function tryParseRedirect(P, greedy = false) {
	const save = saveLex(P.L);
	skipBlanks(P.L);
	let fd = null;
	if (isDigit(peek(P.L))) {
		const startB = P.L.b;
		let j = P.L.i;
		while (j < P.L.len && isDigit(P.L.src[j])) j++;
		const after = j < P.L.len ? P.L.src[j] : "";
		if (after === ">" || after === "<") {
			while (P.L.i < j) advance(P.L);
			fd = mk(P, "file_descriptor", startB, P.L.b, []);
		}
	}
	const t = nextToken(P.L, "arg");
	if (t.type !== "OP") {
		restoreLex(P.L, save);
		return null;
	}
	const v = t.value;
	if (v === "<<<") {
		const op = leaf(P, "<<<", t);
		skipBlanks(P.L);
		const target = parseWord(P, "arg");
		const end = target ? target.endIndex : op.endIndex;
		const kids = target ? [op, target] : [op];
		return mk(P, "herestring_redirect", fd ? fd.startIndex : op.startIndex, end, fd ? [fd, ...kids] : kids);
	}
	if (v === "<<" || v === "<<-") {
		const op = leaf(P, v, t);
		skipBlanks(P.L);
		const dStart = P.L.b;
		let quoted = false;
		let delim = "";
		const dc = peek(P.L);
		if (dc === "'" || dc === "\"") {
			quoted = true;
			advance(P.L);
			while (P.L.i < P.L.len && peek(P.L) !== dc) {
				delim += peek(P.L);
				advance(P.L);
			}
			if (P.L.i < P.L.len) advance(P.L);
		} else if (dc === "\\") {
			quoted = true;
			advance(P.L);
			if (P.L.i < P.L.len && peek(P.L) !== "\n") {
				delim += peek(P.L);
				advance(P.L);
			}
			while (P.L.i < P.L.len && isIdentChar(peek(P.L))) {
				delim += peek(P.L);
				advance(P.L);
			}
		} else while (P.L.i < P.L.len && isHeredocDelimChar(peek(P.L))) {
			delim += peek(P.L);
			advance(P.L);
		}
		const dEnd = P.L.b;
		const startNode = mk(P, "heredoc_start", dStart, dEnd, []);
		P.L.heredocs.push({
			delim,
			stripTabs: v === "<<-",
			quoted,
			bodyStart: 0,
			bodyEnd: 0,
			endStart: 0,
			endEnd: 0
		});
		const kids = fd ? [
			fd,
			op,
			startNode
		] : [op, startNode];
		const startIdx = fd ? fd.startIndex : op.startIndex;
		while (true) {
			skipBlanks(P.L);
			const tc = peek(P.L);
			if (tc === "\n" || tc === "" || P.L.i >= P.L.len) break;
			if (tc === ">" || tc === "<" || isDigit(tc)) {
				const rSave = saveLex(P.L);
				const r = tryParseRedirect(P);
				if (r && r.type === "file_redirect") {
					kids.push(r);
					continue;
				}
				restoreLex(P.L, rSave);
			}
			if (tc === "|" && peek(P.L, 1) !== "|") {
				advance(P.L);
				skipBlanks(P.L);
				const pipeCmds = [];
				while (true) {
					const cmd = parseCommand(P);
					if (!cmd) break;
					pipeCmds.push(cmd);
					skipBlanks(P.L);
					if (peek(P.L) === "|" && peek(P.L, 1) !== "|") {
						const ps = P.L.b;
						advance(P.L);
						pipeCmds.push(mk(P, "|", ps, P.L.b, []));
						skipBlanks(P.L);
						continue;
					}
					break;
				}
				if (pipeCmds.length > 0) {
					const pl = pipeCmds[pipeCmds.length - 1];
					kids.push(mk(P, "pipeline", pipeCmds[0].startIndex, pl.endIndex, pipeCmds));
				}
				continue;
			}
			if (tc === "&" && peek(P.L, 1) === "&" || tc === "|" && peek(P.L, 1) === "|") {
				advance(P.L);
				advance(P.L);
				skipBlanks(P.L);
				const rhs = parseCommand(P);
				if (rhs) kids.push(rhs);
				continue;
			}
			if (tc === "&" || tc === ";" || tc === "(" || tc === ")") {
				const eStart = P.L.b;
				while (P.L.i < P.L.len && peek(P.L) !== "\n") advance(P.L);
				kids.push(mk(P, "ERROR", eStart, P.L.b, []));
				break;
			}
			const w = parseWord(P, "arg");
			if (w) {
				kids.push(w);
				continue;
			}
			const eStart = P.L.b;
			while (P.L.i < P.L.len && peek(P.L) !== "\n") advance(P.L);
			if (P.L.b > eStart) kids.push(mk(P, "ERROR", eStart, P.L.b, []));
			break;
		}
		return mk(P, "heredoc_redirect", startIdx, P.L.b, kids);
	}
	if (v === "<&-" || v === ">&-") {
		const op = leaf(P, v, t);
		const kids = [];
		if (fd) kids.push(fd);
		kids.push(op);
		skipBlanks(P.L);
		const dSave = saveLex(P.L);
		const dest = isRedirectLiteralStart(P) ? parseWord(P, "arg") : null;
		if (dest) kids.push(dest);
		else restoreLex(P.L, dSave);
		return mk(P, "file_redirect", fd ? fd.startIndex : op.startIndex, dest ? dest.endIndex : op.endIndex, kids);
	}
	if (v === ">" || v === ">>" || v === ">&" || v === ">|" || v === "&>" || v === "&>>" || v === "<" || v === "<&") {
		const op = leaf(P, v, t);
		const kids = [];
		if (fd) kids.push(fd);
		kids.push(op);
		let end = op.endIndex;
		let taken = 0;
		while (true) {
			skipBlanks(P.L);
			if (!isRedirectLiteralStart(P)) break;
			if (!greedy && taken >= 1) break;
			const tc = peek(P.L);
			const tc1 = peek(P.L, 1);
			let target = null;
			if ((tc === "<" || tc === ">") && tc1 === "(") target = parseProcessSub(P);
			else target = parseWord(P, "arg");
			if (!target) break;
			kids.push(target);
			end = target.endIndex;
			taken++;
		}
		return mk(P, "file_redirect", fd ? fd.startIndex : op.startIndex, end, kids);
	}
	restoreLex(P.L, save);
	return null;
}
function parseProcessSub(P) {
	const c = peek(P.L);
	if (c !== "<" && c !== ">" || peek(P.L, 1) !== "(") return null;
	const start = P.L.b;
	advance(P.L);
	advance(P.L);
	const open = mk(P, c + "(", start, P.L.b, []);
	const body = parseStatements(P, ")");
	skipBlanks(P.L);
	let close;
	if (peek(P.L) === ")") {
		const cs = P.L.b;
		advance(P.L);
		close = mk(P, ")", cs, P.L.b, []);
	} else close = mk(P, ")", P.L.b, P.L.b, []);
	return mk(P, "process_substitution", start, close.endIndex, [
		open,
		...body,
		close
	]);
}
function scanHeredocBodies(P) {
	while (P.L.i < P.L.len && P.L.src[P.L.i] !== "\n") advance(P.L);
	if (P.L.i < P.L.len) advance(P.L);
	for (const hd of P.L.heredocs) {
		hd.bodyStart = P.L.b;
		const delimLen = hd.delim.length;
		while (P.L.i < P.L.len) {
			const lineStart = P.L.i;
			const lineStartB = P.L.b;
			let checkI = lineStart;
			if (hd.stripTabs) while (checkI < P.L.len && P.L.src[checkI] === "	") checkI++;
			if (P.L.src.startsWith(hd.delim, checkI) && (checkI + delimLen >= P.L.len || P.L.src[checkI + delimLen] === "\n" || P.L.src[checkI + delimLen] === "\r")) {
				hd.bodyEnd = lineStartB;
				while (P.L.i < checkI) advance(P.L);
				hd.endStart = P.L.b;
				for (let k = 0; k < delimLen; k++) advance(P.L);
				hd.endEnd = P.L.b;
				if (P.L.i < P.L.len && P.L.src[P.L.i] === "\n") advance(P.L);
				return;
			}
			while (P.L.i < P.L.len && P.L.src[P.L.i] !== "\n") advance(P.L);
			if (P.L.i < P.L.len) advance(P.L);
		}
		hd.bodyEnd = P.L.b;
		hd.endStart = P.L.b;
		hd.endEnd = P.L.b;
	}
}
function parseHeredocBodyContent(P, start, end) {
	const saved = saveLex(P.L);
	restoreLexToByte(P, start);
	const out = [];
	let contentStart = P.L.b;
	let sawExpansion = false;
	while (P.L.b < end) {
		const c = peek(P.L);
		if (c === "\\") {
			const nxt = peek(P.L, 1);
			if (nxt === "$" || nxt === "`" || nxt === "\\") {
				advance(P.L);
				advance(P.L);
				continue;
			}
			advance(P.L);
			continue;
		}
		if (c === "$" || c === "`") {
			const preB = P.L.b;
			const exp = parseDollarLike(P);
			if (exp && (exp.type === "simple_expansion" || exp.type === "expansion" || exp.type === "command_substitution" || exp.type === "arithmetic_expansion")) {
				if (sawExpansion && preB > contentStart) out.push(mk(P, "heredoc_content", contentStart, preB, []));
				out.push(exp);
				contentStart = P.L.b;
				sawExpansion = true;
			}
			continue;
		}
		advance(P.L);
	}
	if (sawExpansion) out.push(mk(P, "heredoc_content", contentStart, end, []));
	restoreLex(P.L, saved);
	return out;
}
function restoreLexToByte(P, targetByte) {
	if (!P.L.byteTable) byteAt(P.L, 0);
	const t = P.L.byteTable;
	let lo = 0;
	let hi = P.src.length;
	while (lo < hi) {
		const m = lo + hi >>> 1;
		if (t[m] < targetByte) lo = m + 1;
		else hi = m;
	}
	P.L.i = lo;
	P.L.b = targetByte;
}
/**
* Parse a word-position element: bare word, string, expansion, or concatenation
* thereof. Returns a single node; if multiple adjacent fragments, wraps in
* concatenation.
*/
function parseWord(P, _ctx) {
	skipBlanks(P.L);
	const parts = [];
	while (P.L.i < P.L.len) {
		const c = peek(P.L);
		if (c === " " || c === "	" || c === "\n" || c === "\r" || c === "" || c === "|" || c === "&" || c === ";" || c === "(" || c === ")") break;
		if (c === "<" || c === ">") {
			if (peek(P.L, 1) === "(") {
				const ps = parseProcessSub(P);
				if (ps) parts.push(ps);
				continue;
			}
			break;
		}
		if (c === "\"") {
			parts.push(parseDoubleQuoted(P));
			continue;
		}
		if (c === "'") {
			const tok = nextToken(P.L, "arg");
			parts.push(leaf(P, "raw_string", tok));
			continue;
		}
		if (c === "$") {
			const c1 = peek(P.L, 1);
			if (c1 === "'") {
				const tok = nextToken(P.L, "arg");
				parts.push(leaf(P, "ansi_c_string", tok));
				continue;
			}
			if (c1 === "\"") {
				const dTok = {
					type: "DOLLAR",
					value: "$",
					start: P.L.b,
					end: P.L.b + 1
				};
				advance(P.L);
				parts.push(leaf(P, "$", dTok));
				parts.push(parseDoubleQuoted(P));
				continue;
			}
			if (c1 === "`") {
				advance(P.L);
				continue;
			}
			const exp = parseDollarLike(P);
			if (exp) parts.push(exp);
			continue;
		}
		if (c === "`") {
			if (P.inBacktick > 0) break;
			const bt = parseBacktick(P);
			if (bt) parts.push(bt);
			continue;
		}
		if (c === "{") {
			const be = tryParseBraceExpr(P);
			if (be) {
				parts.push(be);
				continue;
			}
			const nc = peek(P.L, 1);
			if (nc === ";" || nc === "|" || nc === "&" || nc === "\n" || nc === "" || nc === ")" || nc === " " || nc === "	") {
				const bStart = P.L.b;
				advance(P.L);
				parts.push(mk(P, "word", bStart, P.L.b, []));
				continue;
			}
			const cat = tryParseBraceLikeCat(P);
			if (cat) {
				for (const p of cat) parts.push(p);
				continue;
			}
		}
		if (c === "}") {
			const bStart = P.L.b;
			advance(P.L);
			parts.push(mk(P, "word", bStart, P.L.b, []));
			continue;
		}
		if (c === "[" || c === "]") {
			const bStart = P.L.b;
			advance(P.L);
			parts.push(mk(P, "word", bStart, P.L.b, []));
			continue;
		}
		const frag = parseBareWord(P);
		if (!frag) break;
		if (frag.type === "word" && /^-?(0x)?[0-9]+#$/.test(frag.text) && peek(P.L) === "$" && (peek(P.L, 1) === "{" || peek(P.L, 1) === "(")) {
			const exp = parseDollarLike(P);
			if (exp) {
				parts.push(mk(P, "number", frag.startIndex, exp.endIndex, [exp]));
				continue;
			}
		}
		parts.push(frag);
	}
	if (parts.length === 0) return null;
	if (parts.length === 1) return parts[0];
	const first = parts[0];
	const last = parts[parts.length - 1];
	return mk(P, "concatenation", first.startIndex, last.endIndex, parts);
}
function parseBareWord(P) {
	const start = P.L.b;
	const startI = P.L.i;
	while (P.L.i < P.L.len) {
		const c = peek(P.L);
		if (c === "\\") {
			if (P.L.i + 1 >= P.L.len) break;
			const nx = P.L.src[P.L.i + 1];
			if (nx === "\n" || nx === "\r" && P.L.src[P.L.i + 2] === "\n") break;
			advance(P.L);
			advance(P.L);
			continue;
		}
		if (c === " " || c === "	" || c === "\n" || c === "\r" || c === "" || c === "|" || c === "&" || c === ";" || c === "(" || c === ")" || c === "<" || c === ">" || c === "\"" || c === "'" || c === "$" || c === "`" || c === "{" || c === "}" || c === "[" || c === "]") break;
		advance(P.L);
	}
	if (P.L.b === start) return null;
	const text = P.src.slice(startI, P.L.i);
	return mk(P, /^-?\d+$/.test(text) ? "number" : "word", start, P.L.b, []);
}
function tryParseBraceExpr(P) {
	const save = saveLex(P.L);
	if (peek(P.L) !== "{") return null;
	const oStart = P.L.b;
	advance(P.L);
	const oEnd = P.L.b;
	const p1Start = P.L.b;
	while (isDigit(peek(P.L)) || isIdentStart(peek(P.L))) advance(P.L);
	const p1End = P.L.b;
	if (p1End === p1Start || peek(P.L) !== "." || peek(P.L, 1) !== ".") {
		restoreLex(P.L, save);
		return null;
	}
	const dotStart = P.L.b;
	advance(P.L);
	advance(P.L);
	const dotEnd = P.L.b;
	const p2Start = P.L.b;
	while (isDigit(peek(P.L)) || isIdentStart(peek(P.L))) advance(P.L);
	const p2End = P.L.b;
	if (p2End === p2Start || peek(P.L) !== "}") {
		restoreLex(P.L, save);
		return null;
	}
	const cStart = P.L.b;
	advance(P.L);
	const cEnd = P.L.b;
	const p1Text = sliceBytes(P, p1Start, p1End);
	const p2Text = sliceBytes(P, p2Start, p2End);
	const p1IsNum = /^\d+$/.test(p1Text);
	const p2IsNum = /^\d+$/.test(p2Text);
	if (p1IsNum !== p2IsNum) {
		restoreLex(P.L, save);
		return null;
	}
	if (!p1IsNum && (p1Text.length !== 1 || p2Text.length !== 1)) {
		restoreLex(P.L, save);
		return null;
	}
	const p1Type = p1IsNum ? "number" : "word";
	const p2Type = p2IsNum ? "number" : "word";
	return mk(P, "brace_expression", oStart, cEnd, [
		mk(P, "{", oStart, oEnd, []),
		mk(P, p1Type, p1Start, p1End, []),
		mk(P, "..", dotStart, dotEnd, []),
		mk(P, p2Type, p2Start, p2End, []),
		mk(P, "}", cStart, cEnd, [])
	]);
}
function tryParseBraceLikeCat(P) {
	if (peek(P.L) !== "{") return null;
	const oStart = P.L.b;
	advance(P.L);
	const oEnd = P.L.b;
	const inner = [mk(P, "word", oStart, oEnd, [])];
	while (P.L.i < P.L.len) {
		const bc = peek(P.L);
		if (bc === "}" || bc === "\n" || bc === ";" || bc === "|" || bc === "&" || bc === " " || bc === "	" || bc === "<" || bc === ">" || bc === "(" || bc === ")") break;
		if (bc === "[" || bc === "]") {
			const bStart = P.L.b;
			advance(P.L);
			inner.push(mk(P, "word", bStart, P.L.b, []));
			continue;
		}
		const midStart = P.L.b;
		while (P.L.i < P.L.len) {
			const mc = peek(P.L);
			if (mc === "}" || mc === "\n" || mc === ";" || mc === "|" || mc === "&" || mc === " " || mc === "	" || mc === "<" || mc === ">" || mc === "(" || mc === ")" || mc === "[" || mc === "]") break;
			advance(P.L);
		}
		const midEnd = P.L.b;
		if (midEnd > midStart) {
			const midText = sliceBytes(P, midStart, midEnd);
			const midType = /^-?\d+$/.test(midText) ? "number" : "word";
			inner.push(mk(P, midType, midStart, midEnd, []));
		} else break;
	}
	if (peek(P.L) === "}") {
		const cStart = P.L.b;
		advance(P.L);
		inner.push(mk(P, "word", cStart, P.L.b, []));
	}
	return inner;
}
function parseDoubleQuoted(P) {
	const qStart = P.L.b;
	advance(P.L);
	const qEnd = P.L.b;
	const parts = [mk(P, "\"", qStart, qEnd, [])];
	let contentStart = P.L.b;
	let contentStartI = P.L.i;
	const flushContent = () => {
		if (P.L.b > contentStart) {
			const txt = P.src.slice(contentStartI, P.L.i);
			if (!/^[ \t]+$/.test(txt)) parts.push(mk(P, "string_content", contentStart, P.L.b, []));
		}
	};
	while (P.L.i < P.L.len) {
		const c = peek(P.L);
		if (c === "\"") break;
		if (c === "\\" && P.L.i + 1 < P.L.len) {
			advance(P.L);
			advance(P.L);
			continue;
		}
		if (c === "\n") {
			flushContent();
			advance(P.L);
			contentStart = P.L.b;
			contentStartI = P.L.i;
			continue;
		}
		if (c === "$") {
			const c1 = peek(P.L, 1);
			if (c1 === "(" || c1 === "{" || isIdentStart(c1) || SPECIAL_VARS.has(c1) || isDigit(c1)) {
				flushContent();
				const exp = parseDollarLike(P);
				if (exp) parts.push(exp);
				contentStart = P.L.b;
				contentStartI = P.L.i;
				continue;
			}
			if (c1 !== "\"" && c1 !== "") {
				flushContent();
				const dS = P.L.b;
				advance(P.L);
				parts.push(mk(P, "$", dS, P.L.b, []));
				contentStart = P.L.b;
				contentStartI = P.L.i;
				continue;
			}
		}
		if (c === "`") {
			flushContent();
			const bt = parseBacktick(P);
			if (bt) parts.push(bt);
			contentStart = P.L.b;
			contentStartI = P.L.i;
			continue;
		}
		advance(P.L);
	}
	flushContent();
	let close;
	if (peek(P.L) === "\"") {
		const cStart = P.L.b;
		advance(P.L);
		close = mk(P, "\"", cStart, P.L.b, []);
	} else close = mk(P, "\"", P.L.b, P.L.b, []);
	parts.push(close);
	return mk(P, "string", qStart, close.endIndex, parts);
}
function parseDollarLike(P) {
	const c1 = peek(P.L, 1);
	const dStart = P.L.b;
	if (c1 === "(" && peek(P.L, 2) === "(") {
		advance(P.L);
		advance(P.L);
		advance(P.L);
		const open = mk(P, "$((", dStart, P.L.b, []);
		const exprs = parseArithCommaList(P, "))", "var");
		skipBlanks(P.L);
		let close;
		if (peek(P.L) === ")" && peek(P.L, 1) === ")") {
			const cStart = P.L.b;
			advance(P.L);
			advance(P.L);
			close = mk(P, "))", cStart, P.L.b, []);
		} else close = mk(P, "))", P.L.b, P.L.b, []);
		return mk(P, "arithmetic_expansion", dStart, close.endIndex, [
			open,
			...exprs,
			close
		]);
	}
	if (c1 === "[") {
		advance(P.L);
		advance(P.L);
		const open = mk(P, "$[", dStart, P.L.b, []);
		const exprs = parseArithCommaList(P, "]", "var");
		skipBlanks(P.L);
		let close;
		if (peek(P.L) === "]") {
			const cStart = P.L.b;
			advance(P.L);
			close = mk(P, "]", cStart, P.L.b, []);
		} else close = mk(P, "]", P.L.b, P.L.b, []);
		return mk(P, "arithmetic_expansion", dStart, close.endIndex, [
			open,
			...exprs,
			close
		]);
	}
	if (c1 === "(") {
		advance(P.L);
		advance(P.L);
		const open = mk(P, "$(", dStart, P.L.b, []);
		let body = parseStatements(P, ")");
		skipBlanks(P.L);
		let close;
		if (peek(P.L) === ")") {
			const cStart = P.L.b;
			advance(P.L);
			close = mk(P, ")", cStart, P.L.b, []);
		} else close = mk(P, ")", P.L.b, P.L.b, []);
		if (body.length === 1 && body[0].type === "redirected_statement" && body[0].children.length === 1 && body[0].children[0].type === "file_redirect") body = body[0].children;
		return mk(P, "command_substitution", dStart, close.endIndex, [
			open,
			...body,
			close
		]);
	}
	if (c1 === "{") {
		advance(P.L);
		advance(P.L);
		const open = mk(P, "${", dStart, P.L.b, []);
		const inner = parseExpansionBody(P);
		let close;
		if (peek(P.L) === "}") {
			const cStart = P.L.b;
			advance(P.L);
			close = mk(P, "}", cStart, P.L.b, []);
		} else close = mk(P, "}", P.L.b, P.L.b, []);
		return mk(P, "expansion", dStart, close.endIndex, [
			open,
			...inner,
			close
		]);
	}
	advance(P.L);
	const dEnd = P.L.b;
	const dollar = mk(P, "$", dStart, dEnd, []);
	const nc = peek(P.L);
	if (nc === "_" && !isIdentChar(peek(P.L, 1))) {
		const vStart = P.L.b;
		advance(P.L);
		const vn = mk(P, "special_variable_name", vStart, P.L.b, []);
		return mk(P, "simple_expansion", dStart, P.L.b, [dollar, vn]);
	}
	if (isIdentStart(nc)) {
		const vStart = P.L.b;
		while (isIdentChar(peek(P.L))) advance(P.L);
		const vn = mk(P, "variable_name", vStart, P.L.b, []);
		return mk(P, "simple_expansion", dStart, P.L.b, [dollar, vn]);
	}
	if (isDigit(nc)) {
		const vStart = P.L.b;
		advance(P.L);
		const vn = mk(P, "variable_name", vStart, P.L.b, []);
		return mk(P, "simple_expansion", dStart, P.L.b, [dollar, vn]);
	}
	if (SPECIAL_VARS.has(nc)) {
		const vStart = P.L.b;
		advance(P.L);
		const vn = mk(P, "special_variable_name", vStart, P.L.b, []);
		return mk(P, "simple_expansion", dStart, P.L.b, [dollar, vn]);
	}
	return dollar;
}
function parseExpansionBody(P) {
	const out = [];
	skipBlanks(P.L);
	{
		const c0 = peek(P.L);
		const c1 = peek(P.L, 1);
		if (c0 === "#" && c1 === "!" && peek(P.L, 2) === "}") {
			advance(P.L);
			advance(P.L);
			return out;
		}
		if (c0 === "!" && c1 === "#") {
			let j = 2;
			if (peek(P.L, j) === "#") j++;
			if (peek(P.L, j) === " ") j++;
			if (peek(P.L, j) === "}") {
				while (j-- > 0) advance(P.L);
				return out;
			}
		}
	}
	if (peek(P.L) === "#") {
		const s = P.L.b;
		advance(P.L);
		out.push(mk(P, "#", s, P.L.b, []));
	}
	const pc = peek(P.L);
	if ((pc === "!" || pc === "=" || pc === "~") && (isIdentStart(peek(P.L, 1)) || isDigit(peek(P.L, 1)))) {
		const s = P.L.b;
		advance(P.L);
		out.push(mk(P, pc, s, P.L.b, []));
	}
	skipBlanks(P.L);
	if (isIdentStart(peek(P.L))) {
		const s = P.L.b;
		while (isIdentChar(peek(P.L))) advance(P.L);
		out.push(mk(P, "variable_name", s, P.L.b, []));
	} else if (isDigit(peek(P.L))) {
		const s = P.L.b;
		while (isDigit(peek(P.L))) advance(P.L);
		out.push(mk(P, "variable_name", s, P.L.b, []));
	} else if (SPECIAL_VARS.has(peek(P.L))) {
		const s = P.L.b;
		advance(P.L);
		out.push(mk(P, "special_variable_name", s, P.L.b, []));
	}
	if (peek(P.L) === "[") {
		const varNode = out[out.length - 1];
		const brOpen = P.L.b;
		advance(P.L);
		const brOpenNode = mk(P, "[", brOpen, P.L.b, []);
		const idx = parseSubscriptIndexInline(P);
		skipBlanks(P.L);
		const brClose = P.L.b;
		if (peek(P.L) === "]") advance(P.L);
		const brCloseNode = mk(P, "]", brClose, P.L.b, []);
		if (varNode) {
			const kids = idx ? [
				varNode,
				brOpenNode,
				idx,
				brCloseNode
			] : [
				varNode,
				brOpenNode,
				brCloseNode
			];
			out[out.length - 1] = mk(P, "subscript", varNode.startIndex, P.L.b, kids);
		}
	}
	skipBlanks(P.L);
	const tc = peek(P.L);
	if ((tc === "*" || tc === "@") && peek(P.L, 1) === "}") {
		const s = P.L.b;
		advance(P.L);
		out.push(mk(P, tc, s, P.L.b, []));
		return out;
	}
	if (tc === "@" && isIdentStart(peek(P.L, 1))) {
		const s = P.L.b;
		advance(P.L);
		out.push(mk(P, "@", s, P.L.b, []));
		while (isIdentChar(peek(P.L))) advance(P.L);
		return out;
	}
	const c = peek(P.L);
	if (c === ":") {
		const c1 = peek(P.L, 1);
		if (c1 === "\n" || c1 === "}") {
			advance(P.L);
			while (peek(P.L) === "\n") advance(P.L);
			return out;
		}
		if (c1 !== "-" && c1 !== "=" && c1 !== "?" && c1 !== "+") {
			advance(P.L);
			skipBlanks(P.L);
			const offC = peek(P.L);
			let off;
			if (offC === "-" && isDigit(peek(P.L, 1))) {
				const ns = P.L.b;
				advance(P.L);
				while (isDigit(peek(P.L))) advance(P.L);
				off = mk(P, "number", ns, P.L.b, []);
			} else off = parseArithExpr(P, ":}", "var");
			if (off) out.push(off);
			skipBlanks(P.L);
			if (peek(P.L) === ":") {
				advance(P.L);
				skipBlanks(P.L);
				const lenC = peek(P.L);
				let len;
				if (lenC === "-" && isDigit(peek(P.L, 1))) {
					const ns = P.L.b;
					advance(P.L);
					while (isDigit(peek(P.L))) advance(P.L);
					len = mk(P, "number", ns, P.L.b, []);
				} else len = parseArithExpr(P, "}", "var");
				if (len) out.push(len);
			}
			return out;
		}
	}
	if (c === ":" || c === "#" || c === "%" || c === "/" || c === "^" || c === "," || c === "-" || c === "=" || c === "?" || c === "+") {
		const s = P.L.b;
		const c1 = peek(P.L, 1);
		let op = c;
		if (c === ":" && (c1 === "-" || c1 === "=" || c1 === "?" || c1 === "+")) {
			advance(P.L);
			advance(P.L);
			op = c + c1;
		} else if ((c === "#" || c === "%" || c === "/" || c === "^" || c === ",") && c1 === c) {
			advance(P.L);
			advance(P.L);
			op = c + c;
		} else advance(P.L);
		out.push(mk(P, op, s, P.L.b, []));
		const isPattern = op === "#" || op === "##" || op === "%" || op === "%%" || op === "/" || op === "//" || op === "^" || op === "^^" || op === "," || op === ",,";
		if (op === "/" || op === "//") {
			const ac = peek(P.L);
			if (ac === "#" || ac === "%") {
				const aStart = P.L.b;
				advance(P.L);
				out.push(mk(P, ac, aStart, P.L.b, []));
			}
			if (peek(P.L) === "\"") {
				out.push(parseDoubleQuoted(P));
				const tail = parseExpansionRest(P, "regex", true);
				if (tail) out.push(tail);
			} else {
				const regex = parseExpansionRest(P, "regex", true);
				if (regex) out.push(regex);
			}
			if (peek(P.L) === "/") {
				const sepStart = P.L.b;
				advance(P.L);
				out.push(mk(P, "/", sepStart, P.L.b, []));
				const repl = parseExpansionRest(P, "replword", false);
				if (repl) if (repl.type === "concatenation" && repl.children.length === 2 && repl.children[0].type === "command_substitution") {
					out.push(repl.children[0]);
					out.push(repl.children[1]);
				} else out.push(repl);
			}
		} else if (op === "#" || op === "##" || op === "%" || op === "%%") for (const p of parseExpansionRegexSegmented(P)) out.push(p);
		else {
			const rest = parseExpansionRest(P, isPattern ? "regex" : "word", false);
			if (rest) out.push(rest);
		}
	}
	return out;
}
function parseExpansionRest(P, nodeType, stopAtSlash) {
	const start = P.L.b;
	if (nodeType === "word" && peek(P.L) === "(") {
		advance(P.L);
		const elems = [mk(P, "(", start, P.L.b, [])];
		while (P.L.i < P.L.len) {
			skipBlanks(P.L);
			const c = peek(P.L);
			if (c === ")" || c === "}" || c === "\n" || c === "") break;
			const wStart = P.L.b;
			while (P.L.i < P.L.len) {
				const wc = peek(P.L);
				if (wc === ")" || wc === "}" || wc === " " || wc === "	" || wc === "\n" || wc === "") break;
				advance(P.L);
			}
			if (P.L.b > wStart) elems.push(mk(P, "word", wStart, P.L.b, []));
			else break;
		}
		if (peek(P.L) === ")") {
			const cStart = P.L.b;
			advance(P.L);
			elems.push(mk(P, ")", cStart, P.L.b, []));
		}
		while (peek(P.L) === "\n") advance(P.L);
		return mk(P, "array", start, P.L.b, elems);
	}
	if (nodeType === "regex") {
		let braceDepth = 0;
		while (P.L.i < P.L.len) {
			const c = peek(P.L);
			if (c === "\n") break;
			if (braceDepth === 0) {
				if (c === "}") break;
				if (stopAtSlash && c === "/") break;
			}
			if (c === "\\" && P.L.i + 1 < P.L.len) {
				advance(P.L);
				advance(P.L);
				continue;
			}
			if (c === "\"" || c === "'") {
				advance(P.L);
				while (P.L.i < P.L.len && peek(P.L) !== c) {
					if (peek(P.L) === "\\" && P.L.i + 1 < P.L.len) advance(P.L);
					advance(P.L);
				}
				if (peek(P.L) === c) advance(P.L);
				continue;
			}
			if (c === "$") {
				const c1 = peek(P.L, 1);
				if (c1 === "{") {
					let d = 0;
					advance(P.L);
					advance(P.L);
					d++;
					while (P.L.i < P.L.len && d > 0) {
						const nc = peek(P.L);
						if (nc === "{") d++;
						else if (nc === "}") d--;
						advance(P.L);
					}
					continue;
				}
				if (c1 === "(") {
					let d = 0;
					advance(P.L);
					advance(P.L);
					d++;
					while (P.L.i < P.L.len && d > 0) {
						const nc = peek(P.L);
						if (nc === "(") d++;
						else if (nc === ")") d--;
						advance(P.L);
					}
					continue;
				}
			}
			if (c === "{") braceDepth++;
			else if (c === "}" && braceDepth > 0) braceDepth--;
			advance(P.L);
		}
		const end = P.L.b;
		while (peek(P.L) === "\n") advance(P.L);
		if (end === start) return null;
		return mk(P, "regex", start, end, []);
	}
	const parts = [];
	let segStart = P.L.b;
	let braceDepth = 0;
	const flushSeg = () => {
		if (P.L.b > segStart) parts.push(mk(P, "word", segStart, P.L.b, []));
	};
	while (P.L.i < P.L.len) {
		const c = peek(P.L);
		if (c === "\n") break;
		if (braceDepth === 0) {
			if (c === "}") break;
			if (stopAtSlash && c === "/") break;
		}
		if (c === "\\" && P.L.i + 1 < P.L.len) {
			advance(P.L);
			advance(P.L);
			continue;
		}
		const c1 = peek(P.L, 1);
		if (c === "$") {
			if (c1 === "{" || c1 === "(" || c1 === "[") {
				flushSeg();
				const exp = parseDollarLike(P);
				if (exp) parts.push(exp);
				segStart = P.L.b;
				continue;
			}
			if (c1 === "'") {
				flushSeg();
				const aStart = P.L.b;
				advance(P.L);
				advance(P.L);
				while (P.L.i < P.L.len && peek(P.L) !== "'") {
					if (peek(P.L) === "\\" && P.L.i + 1 < P.L.len) advance(P.L);
					advance(P.L);
				}
				if (peek(P.L) === "'") advance(P.L);
				parts.push(mk(P, "ansi_c_string", aStart, P.L.b, []));
				segStart = P.L.b;
				continue;
			}
			if (isIdentStart(c1) || isDigit(c1) || SPECIAL_VARS.has(c1)) {
				flushSeg();
				const exp = parseDollarLike(P);
				if (exp) parts.push(exp);
				segStart = P.L.b;
				continue;
			}
		}
		if (c === "\"") {
			flushSeg();
			parts.push(parseDoubleQuoted(P));
			segStart = P.L.b;
			continue;
		}
		if (c === "'") {
			flushSeg();
			const rStart = P.L.b;
			advance(P.L);
			while (P.L.i < P.L.len && peek(P.L) !== "'") advance(P.L);
			if (peek(P.L) === "'") advance(P.L);
			parts.push(mk(P, "raw_string", rStart, P.L.b, []));
			segStart = P.L.b;
			continue;
		}
		if ((c === "<" || c === ">") && c1 === "(") {
			flushSeg();
			const ps = parseProcessSub(P);
			if (ps) parts.push(ps);
			segStart = P.L.b;
			continue;
		}
		if (c === "`") {
			flushSeg();
			const bt = parseBacktick(P);
			if (bt) parts.push(bt);
			segStart = P.L.b;
			continue;
		}
		if (c === "{") braceDepth++;
		else if (c === "}" && braceDepth > 0) braceDepth--;
		advance(P.L);
	}
	flushSeg();
	while (peek(P.L) === "\n") advance(P.L);
	if (parts.length > 1 && parts[0].type === "word" && /^[ \t]+$/.test(parts[0].text)) parts.shift();
	if (parts.length === 0) return null;
	if (parts.length === 1) return parts[0];
	const last = parts[parts.length - 1];
	return mk(P, "concatenation", parts[0].startIndex, last.endIndex, parts);
}
function parseExpansionRegexSegmented(P) {
	const out = [];
	let segStart = P.L.b;
	const flushRegex = () => {
		if (P.L.b > segStart) out.push(mk(P, "regex", segStart, P.L.b, []));
	};
	while (P.L.i < P.L.len) {
		const c = peek(P.L);
		if (c === "}" || c === "\n") break;
		if (c === "\\" && P.L.i + 1 < P.L.len) {
			advance(P.L);
			advance(P.L);
			continue;
		}
		if (c === "\"") {
			flushRegex();
			out.push(parseDoubleQuoted(P));
			segStart = P.L.b;
			continue;
		}
		if (c === "'") {
			flushRegex();
			const rStart = P.L.b;
			advance(P.L);
			while (P.L.i < P.L.len && peek(P.L) !== "'") advance(P.L);
			if (peek(P.L) === "'") advance(P.L);
			out.push(mk(P, "raw_string", rStart, P.L.b, []));
			segStart = P.L.b;
			continue;
		}
		if (c === "$") {
			const c1 = peek(P.L, 1);
			if (c1 === "{") {
				let d = 1;
				advance(P.L);
				advance(P.L);
				while (P.L.i < P.L.len && d > 0) {
					const nc = peek(P.L);
					if (nc === "{") d++;
					else if (nc === "}") d--;
					advance(P.L);
				}
				continue;
			}
			if (c1 === "(") {
				let d = 1;
				advance(P.L);
				advance(P.L);
				while (P.L.i < P.L.len && d > 0) {
					const nc = peek(P.L);
					if (nc === "(") d++;
					else if (nc === ")") d--;
					advance(P.L);
				}
				continue;
			}
		}
		advance(P.L);
	}
	flushRegex();
	while (peek(P.L) === "\n") advance(P.L);
	return out;
}
function parseBacktick(P) {
	const start = P.L.b;
	advance(P.L);
	const open = mk(P, "`", start, P.L.b, []);
	P.inBacktick++;
	const body = [];
	while (true) {
		skipBlanks(P.L);
		if (peek(P.L) === "`" || peek(P.L) === "") break;
		const save = saveLex(P.L);
		const t = nextToken(P.L, "cmd");
		if (t.type === "EOF" || t.type === "BACKTICK") {
			restoreLex(P.L, save);
			break;
		}
		if (t.type === "NEWLINE") continue;
		restoreLex(P.L, save);
		const stmt = parseAndOr(P);
		if (!stmt) break;
		body.push(stmt);
		skipBlanks(P.L);
		if (peek(P.L) === "`") break;
		const save2 = saveLex(P.L);
		const sep = nextToken(P.L, "cmd");
		if (sep.type === "OP" && (sep.value === ";" || sep.value === "&")) body.push(leaf(P, sep.value, sep));
		else if (sep.type !== "NEWLINE") restoreLex(P.L, save2);
	}
	P.inBacktick--;
	let close;
	if (peek(P.L) === "`") {
		const cStart = P.L.b;
		advance(P.L);
		close = mk(P, "`", cStart, P.L.b, []);
	} else close = mk(P, "`", P.L.b, P.L.b, []);
	if (body.length === 0) return null;
	return mk(P, "command_substitution", start, close.endIndex, [
		open,
		...body,
		close
	]);
}
function parseIf(P, ifTok) {
	const ifKw = leaf(P, "if", ifTok);
	const kids = [ifKw];
	const cond = parseStatements(P, null);
	kids.push(...cond);
	consumeKeyword(P, "then", kids);
	const body = parseStatements(P, null);
	kids.push(...body);
	while (true) {
		const save = saveLex(P.L);
		const t = nextToken(P.L, "cmd");
		if (t.type === "WORD" && t.value === "elif") {
			const eKw = leaf(P, "elif", t);
			const eKids = [eKw, ...parseStatements(P, null)];
			consumeKeyword(P, "then", eKids);
			const eBody = parseStatements(P, null);
			eKids.push(...eBody);
			const last = eKids[eKids.length - 1];
			kids.push(mk(P, "elif_clause", eKw.startIndex, last.endIndex, eKids));
		} else if (t.type === "WORD" && t.value === "else") {
			const elKw = leaf(P, "else", t);
			const elBody = parseStatements(P, null);
			const last = elBody.length > 0 ? elBody[elBody.length - 1] : elKw;
			kids.push(mk(P, "else_clause", elKw.startIndex, last.endIndex, [elKw, ...elBody]));
		} else {
			restoreLex(P.L, save);
			break;
		}
	}
	consumeKeyword(P, "fi", kids);
	const last = kids[kids.length - 1];
	return mk(P, "if_statement", ifKw.startIndex, last.endIndex, kids);
}
function parseWhile(P, kwTok) {
	const kw = leaf(P, kwTok.value, kwTok);
	const kids = [kw];
	const cond = parseStatements(P, null);
	kids.push(...cond);
	const dg = parseDoGroup(P);
	if (dg) kids.push(dg);
	const last = kids[kids.length - 1];
	return mk(P, "while_statement", kw.startIndex, last.endIndex, kids);
}
function parseFor(P, forTok) {
	const forKw = leaf(P, forTok.value, forTok);
	skipBlanks(P.L);
	if (forTok.value === "for" && peek(P.L) === "(" && peek(P.L, 1) === "(") {
		const oStart = P.L.b;
		advance(P.L);
		advance(P.L);
		const kids = [forKw, mk(P, "((", oStart, P.L.b, [])];
		for (let k = 0; k < 3; k++) {
			skipBlanks(P.L);
			const es = parseArithCommaList(P, k < 2 ? ";" : "))", "assign");
			kids.push(...es);
			if (k < 2) {
				if (peek(P.L) === ";") {
					const s = P.L.b;
					advance(P.L);
					kids.push(mk(P, ";", s, P.L.b, []));
				}
			}
		}
		skipBlanks(P.L);
		if (peek(P.L) === ")" && peek(P.L, 1) === ")") {
			const cStart = P.L.b;
			advance(P.L);
			advance(P.L);
			kids.push(mk(P, "))", cStart, P.L.b, []));
		}
		const save = saveLex(P.L);
		const sep = nextToken(P.L, "cmd");
		if (sep.type === "OP" && sep.value === ";") kids.push(leaf(P, ";", sep));
		else if (sep.type !== "NEWLINE") restoreLex(P.L, save);
		const dg = parseDoGroup(P);
		if (dg) kids.push(dg);
		else {
			skipNewlines(P);
			skipBlanks(P.L);
			if (peek(P.L) === "{") {
				const bOpen = P.L.b;
				advance(P.L);
				const brace = mk(P, "{", bOpen, P.L.b, []);
				const body = parseStatements(P, "}");
				let bClose;
				if (peek(P.L) === "}") {
					const cs = P.L.b;
					advance(P.L);
					bClose = mk(P, "}", cs, P.L.b, []);
				} else bClose = mk(P, "}", P.L.b, P.L.b, []);
				kids.push(mk(P, "compound_statement", brace.startIndex, bClose.endIndex, [
					brace,
					...body,
					bClose
				]));
			}
		}
		const last = kids[kids.length - 1];
		return mk(P, "c_style_for_statement", forKw.startIndex, last.endIndex, kids);
	}
	const kids = [forKw];
	const varTok = nextToken(P.L, "arg");
	kids.push(mk(P, "variable_name", varTok.start, varTok.end, []));
	skipBlanks(P.L);
	const save = saveLex(P.L);
	const inTok = nextToken(P.L, "arg");
	if (inTok.type === "WORD" && inTok.value === "in") {
		kids.push(leaf(P, "in", inTok));
		while (true) {
			skipBlanks(P.L);
			const c = peek(P.L);
			if (c === ";" || c === "\n" || c === "") break;
			const w = parseWord(P, "arg");
			if (!w) break;
			kids.push(w);
		}
	} else restoreLex(P.L, save);
	const save2 = saveLex(P.L);
	const sep = nextToken(P.L, "cmd");
	if (sep.type === "OP" && sep.value === ";") kids.push(leaf(P, ";", sep));
	else if (sep.type !== "NEWLINE") restoreLex(P.L, save2);
	const dg = parseDoGroup(P);
	if (dg) kids.push(dg);
	const last = kids[kids.length - 1];
	return mk(P, "for_statement", forKw.startIndex, last.endIndex, kids);
}
function parseDoGroup(P) {
	skipNewlines(P);
	const save = saveLex(P.L);
	const doTok = nextToken(P.L, "cmd");
	if (doTok.type !== "WORD" || doTok.value !== "do") {
		restoreLex(P.L, save);
		return null;
	}
	const doKw = leaf(P, "do", doTok);
	const kids = [doKw, ...parseStatements(P, null)];
	consumeKeyword(P, "done", kids);
	const last = kids[kids.length - 1];
	return mk(P, "do_group", doKw.startIndex, last.endIndex, kids);
}
function parseCase(P, caseTok) {
	const caseKw = leaf(P, "case", caseTok);
	const kids = [caseKw];
	skipBlanks(P.L);
	const word = parseWord(P, "arg");
	if (word) kids.push(word);
	skipBlanks(P.L);
	consumeKeyword(P, "in", kids);
	skipNewlines(P);
	while (true) {
		skipBlanks(P.L);
		skipNewlines(P);
		const save = saveLex(P.L);
		const t = nextToken(P.L, "arg");
		if (t.type === "WORD" && t.value === "esac") {
			kids.push(leaf(P, "esac", t));
			break;
		}
		if (t.type === "EOF") break;
		restoreLex(P.L, save);
		const item = parseCaseItem(P);
		if (!item) break;
		kids.push(item);
	}
	const last = kids[kids.length - 1];
	return mk(P, "case_statement", caseKw.startIndex, last.endIndex, kids);
}
function parseCaseItem(P) {
	skipBlanks(P.L);
	const start = P.L.b;
	const kids = [];
	if (peek(P.L) === "(") {
		const s = P.L.b;
		advance(P.L);
		kids.push(mk(P, "(", s, P.L.b, []));
	}
	let isFirstAlt = true;
	while (true) {
		skipBlanks(P.L);
		const c = peek(P.L);
		if (c === ")" || c === "") break;
		const pats = parseCasePattern(P);
		if (pats.length === 0) break;
		if (!isFirstAlt && pats.length > 1) {
			const rewritten = pats.map((p) => p.type === "extglob_pattern" ? mk(P, "word", p.startIndex, p.endIndex, []) : p);
			const first = rewritten[0];
			const last = rewritten[rewritten.length - 1];
			kids.push(mk(P, "concatenation", first.startIndex, last.endIndex, rewritten));
		} else kids.push(...pats);
		isFirstAlt = false;
		skipBlanks(P.L);
		if (peek(P.L) === "\\" && peek(P.L, 1) === "\n") {
			advance(P.L);
			advance(P.L);
			skipBlanks(P.L);
		}
		if (peek(P.L) === "|") {
			const s = P.L.b;
			advance(P.L);
			kids.push(mk(P, "|", s, P.L.b, []));
			if (peek(P.L) === "\\" && peek(P.L, 1) === "\n") {
				advance(P.L);
				advance(P.L);
			}
		} else break;
	}
	if (peek(P.L) === ")") {
		const s = P.L.b;
		advance(P.L);
		kids.push(mk(P, ")", s, P.L.b, []));
	}
	const body = parseStatements(P, null);
	kids.push(...body);
	const save = saveLex(P.L);
	const term = nextToken(P.L, "cmd");
	if (term.type === "OP" && (term.value === ";;" || term.value === ";&" || term.value === ";;&")) kids.push(leaf(P, term.value, term));
	else restoreLex(P.L, save);
	if (kids.length === 0) return null;
	if (body.length === 0) for (let i = 0; i < kids.length; i++) {
		const k = kids[i];
		if (k.type !== "extglob_pattern") continue;
		const text = sliceBytes(P, k.startIndex, k.endIndex);
		if (/^[-+?*@!][a-zA-Z]/.test(text) && !/[*?(]/.test(text)) kids[i] = mk(P, "word", k.startIndex, k.endIndex, []);
	}
	const last = kids[kids.length - 1];
	return mk(P, "case_item", start, last.endIndex, kids);
}
function parseCasePattern(P) {
	skipBlanks(P.L);
	const save = saveLex(P.L);
	const start = P.L.b;
	const startI = P.L.i;
	let parenDepth = 0;
	let hasDollar = false;
	let hasBracketOutsideParen = false;
	let hasQuote = false;
	while (P.L.i < P.L.len) {
		const c = peek(P.L);
		if (c === "\\" && P.L.i + 1 < P.L.len) {
			advance(P.L);
			advance(P.L);
			continue;
		}
		if (c === "\"" || c === "'") {
			hasQuote = true;
			advance(P.L);
			while (P.L.i < P.L.len && peek(P.L) !== c) {
				if (peek(P.L) === "\\" && P.L.i + 1 < P.L.len) advance(P.L);
				advance(P.L);
			}
			if (peek(P.L) === c) advance(P.L);
			continue;
		}
		if (c === "(") {
			parenDepth++;
			advance(P.L);
			continue;
		}
		if (parenDepth > 0) {
			if (c === ")") {
				parenDepth--;
				advance(P.L);
				continue;
			}
			if (c === "\n") break;
			advance(P.L);
			continue;
		}
		if (c === ")" || c === "|" || c === " " || c === "	" || c === "\n") break;
		if (c === "$") hasDollar = true;
		if (c === "[") hasBracketOutsideParen = true;
		advance(P.L);
	}
	if (P.L.b === start) return [];
	const text = P.src.slice(startI, P.L.i);
	const hasExtglobParen = /[*?+@!]\(/.test(text);
	if (hasQuote && !hasExtglobParen) {
		restoreLex(P.L, save);
		return parseCasePatternSegmented(P);
	}
	if (!hasExtglobParen && (hasDollar || hasBracketOutsideParen)) {
		restoreLex(P.L, save);
		const w = parseWord(P, "arg");
		return w ? [w] : [];
	}
	return [mk(P, hasExtglobParen || /[*?]/.test(text) || /^[-+?*@!][a-zA-Z]/.test(text) ? "extglob_pattern" : "word", start, P.L.b, [])];
}
function parseCasePatternSegmented(P) {
	const parts = [];
	let segStart = P.L.b;
	let segStartI = P.L.i;
	const flushSeg = () => {
		if (P.L.i > segStartI) {
			const t = P.src.slice(segStartI, P.L.i);
			const type = /[*?]/.test(t) ? "extglob_pattern" : "word";
			parts.push(mk(P, type, segStart, P.L.b, []));
		}
	};
	while (P.L.i < P.L.len) {
		const c = peek(P.L);
		if (c === "\\" && P.L.i + 1 < P.L.len) {
			advance(P.L);
			advance(P.L);
			continue;
		}
		if (c === "\"") {
			flushSeg();
			parts.push(parseDoubleQuoted(P));
			segStart = P.L.b;
			segStartI = P.L.i;
			continue;
		}
		if (c === "'") {
			flushSeg();
			const tok = nextToken(P.L, "arg");
			parts.push(leaf(P, "raw_string", tok));
			segStart = P.L.b;
			segStartI = P.L.i;
			continue;
		}
		if (c === ")" || c === "|" || c === " " || c === "	" || c === "\n") break;
		advance(P.L);
	}
	flushSeg();
	return parts;
}
function parseFunction(P, fnTok) {
	const fnKw = leaf(P, "function", fnTok);
	skipBlanks(P.L);
	const nameTok = nextToken(P.L, "arg");
	const kids = [fnKw, mk(P, "word", nameTok.start, nameTok.end, [])];
	skipBlanks(P.L);
	if (peek(P.L) === "(" && peek(P.L, 1) === ")") {
		const o = nextToken(P.L, "cmd");
		const c = nextToken(P.L, "cmd");
		kids.push(leaf(P, "(", o));
		kids.push(leaf(P, ")", c));
	}
	skipBlanks(P.L);
	skipNewlines(P);
	const body = parseCommand(P);
	if (body) if (body.type === "redirected_statement" && body.children.length >= 2 && body.children[0].type === "compound_statement") kids.push(...body.children);
	else kids.push(body);
	const last = kids[kids.length - 1];
	return mk(P, "function_definition", fnKw.startIndex, last.endIndex, kids);
}
function parseDeclaration(P, kwTok) {
	const kw = leaf(P, kwTok.value, kwTok);
	const kids = [kw];
	while (true) {
		skipBlanks(P.L);
		const c = peek(P.L);
		if (c === "" || c === "\n" || c === ";" || c === "&" || c === "|" || c === ")" || c === "<" || c === ">") break;
		const a = tryParseAssignment(P);
		if (a) {
			kids.push(a);
			continue;
		}
		if (c === "\"" || c === "'" || c === "$") {
			const w = parseWord(P, "arg");
			if (w) {
				kids.push(w);
				continue;
			}
			break;
		}
		const save = saveLex(P.L);
		const tok = nextToken(P.L, "arg");
		if (tok.type === "WORD" || tok.type === "NUMBER") if (tok.value.startsWith("-")) kids.push(leaf(P, "word", tok));
		else if (isIdentStart(tok.value[0] ?? "")) kids.push(mk(P, "variable_name", tok.start, tok.end, []));
		else kids.push(leaf(P, "word", tok));
		else {
			restoreLex(P.L, save);
			break;
		}
	}
	const last = kids[kids.length - 1];
	return mk(P, "declaration_command", kw.startIndex, last.endIndex, kids);
}
function parseUnset(P, kwTok) {
	const kw = leaf(P, "unset", kwTok);
	const kids = [kw];
	while (true) {
		skipBlanks(P.L);
		const c = peek(P.L);
		if (c === "" || c === "\n" || c === ";" || c === "&" || c === "|" || c === ")" || c === "<" || c === ">") break;
		const arg = parseWord(P, "arg");
		if (!arg) break;
		if (arg.type === "word") if (arg.text.startsWith("-")) kids.push(arg);
		else kids.push(mk(P, "variable_name", arg.startIndex, arg.endIndex, []));
		else kids.push(arg);
	}
	const last = kids[kids.length - 1];
	return mk(P, "unset_command", kw.startIndex, last.endIndex, kids);
}
function consumeKeyword(P, name, kids) {
	skipNewlines(P);
	const save = saveLex(P.L);
	const t = nextToken(P.L, "cmd");
	if (t.type === "WORD" && t.value === name) kids.push(leaf(P, name, t));
	else restoreLex(P.L, save);
}
function parseTestExpr(P, closer) {
	return parseTestOr(P, closer);
}
function parseTestOr(P, closer) {
	let left = parseTestAnd(P, closer);
	if (!left) return null;
	while (true) {
		skipBlanks(P.L);
		const save = saveLex(P.L);
		if (peek(P.L) === "|" && peek(P.L, 1) === "|") {
			const s = P.L.b;
			advance(P.L);
			advance(P.L);
			const op = mk(P, "||", s, P.L.b, []);
			const right = parseTestAnd(P, closer);
			if (!right) {
				restoreLex(P.L, save);
				break;
			}
			left = mk(P, "binary_expression", left.startIndex, right.endIndex, [
				left,
				op,
				right
			]);
		} else break;
	}
	return left;
}
function parseTestAnd(P, closer) {
	let left = parseTestUnary(P, closer);
	if (!left) return null;
	while (true) {
		skipBlanks(P.L);
		if (peek(P.L) === "&" && peek(P.L, 1) === "&") {
			const s = P.L.b;
			advance(P.L);
			advance(P.L);
			const op = mk(P, "&&", s, P.L.b, []);
			const right = parseTestUnary(P, closer);
			if (!right) break;
			left = mk(P, "binary_expression", left.startIndex, right.endIndex, [
				left,
				op,
				right
			]);
		} else break;
	}
	return left;
}
function parseTestUnary(P, closer) {
	skipBlanks(P.L);
	if (peek(P.L) === "(") {
		const s = P.L.b;
		advance(P.L);
		const open = mk(P, "(", s, P.L.b, []);
		const inner = parseTestOr(P, closer);
		skipBlanks(P.L);
		let close;
		if (peek(P.L) === ")") {
			const cs = P.L.b;
			advance(P.L);
			close = mk(P, ")", cs, P.L.b, []);
		} else close = mk(P, ")", P.L.b, P.L.b, []);
		const kids = inner ? [
			open,
			inner,
			close
		] : [open, close];
		return mk(P, "parenthesized_expression", open.startIndex, close.endIndex, kids);
	}
	return parseTestBinary(P, closer);
}
/**
* Parse `!`-negated or test-operator (`-f`) or parenthesized primary — but NOT
* a binary comparison. Used as LHS of binary_expression so `! x =~ y` binds
* `!` to `x` only, not the whole `x =~ y`.
*/
function parseTestNegatablePrimary(P, closer) {
	skipBlanks(P.L);
	const c = peek(P.L);
	if (c === "!") {
		const s = P.L.b;
		advance(P.L);
		const bang = mk(P, "!", s, P.L.b, []);
		const inner = parseTestNegatablePrimary(P, closer);
		if (!inner) return bang;
		return mk(P, "unary_expression", bang.startIndex, inner.endIndex, [bang, inner]);
	}
	if (c === "-" && isIdentStart(peek(P.L, 1))) {
		const s = P.L.b;
		advance(P.L);
		while (isIdentChar(peek(P.L))) advance(P.L);
		const op = mk(P, "test_operator", s, P.L.b, []);
		skipBlanks(P.L);
		const arg = parseTestPrimary(P, closer);
		if (!arg) return op;
		return mk(P, "unary_expression", op.startIndex, arg.endIndex, [op, arg]);
	}
	return parseTestPrimary(P, closer);
}
function parseTestBinary(P, closer) {
	skipBlanks(P.L);
	const left = parseTestNegatablePrimary(P, closer);
	if (!left) return null;
	skipBlanks(P.L);
	const c = peek(P.L);
	const c1 = peek(P.L, 1);
	let op = null;
	const os = P.L.b;
	if (c === "=" && c1 === "=") {
		advance(P.L);
		advance(P.L);
		op = mk(P, "==", os, P.L.b, []);
	} else if (c === "!" && c1 === "=") {
		advance(P.L);
		advance(P.L);
		op = mk(P, "!=", os, P.L.b, []);
	} else if (c === "=" && c1 === "~") {
		advance(P.L);
		advance(P.L);
		op = mk(P, "=~", os, P.L.b, []);
	} else if (c === "=" && c1 !== "=") {
		advance(P.L);
		op = mk(P, "=", os, P.L.b, []);
	} else if (c === "<" && c1 !== "<") {
		advance(P.L);
		op = mk(P, "<", os, P.L.b, []);
	} else if (c === ">" && c1 !== ">") {
		advance(P.L);
		op = mk(P, ">", os, P.L.b, []);
	} else if (c === "-" && isIdentStart(c1)) {
		advance(P.L);
		while (isIdentChar(peek(P.L))) advance(P.L);
		op = mk(P, "test_operator", os, P.L.b, []);
	}
	if (!op) return left;
	skipBlanks(P.L);
	if (closer === "]]") {
		const opText = op.type;
		if (opText === "=~") {
			skipBlanks(P.L);
			const rc = peek(P.L);
			let rhs = null;
			if (rc === "\"" || rc === "'") {
				const save = saveLex(P.L);
				const quoted = rc === "\"" ? parseDoubleQuoted(P) : leaf(P, "raw_string", nextToken(P.L, "arg"));
				let j = P.L.i;
				while (j < P.L.len && (P.src[j] === " " || P.src[j] === "	")) j++;
				const nc = P.src[j] ?? "";
				const nc1 = P.src[j + 1] ?? "";
				if (nc === "]" && nc1 === "]" || nc === "&" && nc1 === "&" || nc === "|" && nc1 === "|" || nc === "\n" || nc === "") rhs = quoted;
				else restoreLex(P.L, save);
			}
			if (!rhs) rhs = parseTestRegexRhs(P);
			if (!rhs) return left;
			return mk(P, "binary_expression", left.startIndex, rhs.endIndex, [
				left,
				op,
				rhs
			]);
		}
		if (opText === "=") {
			const rhs = parseTestRegexRhs(P);
			if (!rhs) return left;
			return mk(P, "binary_expression", left.startIndex, rhs.endIndex, [
				left,
				op,
				rhs
			]);
		}
		if (opText === "==" || opText === "!=") {
			const parts = parseTestExtglobRhs(P);
			if (parts.length === 0) return left;
			const last = parts[parts.length - 1];
			return mk(P, "binary_expression", left.startIndex, last.endIndex, [
				left,
				op,
				...parts
			]);
		}
	}
	const right = parseTestPrimary(P, closer);
	if (!right) return left;
	return mk(P, "binary_expression", left.startIndex, right.endIndex, [
		left,
		op,
		right
	]);
}
function parseTestRegexRhs(P) {
	skipBlanks(P.L);
	const start = P.L.b;
	let parenDepth = 0;
	let bracketDepth = 0;
	while (P.L.i < P.L.len) {
		const c = peek(P.L);
		if (c === "\\" && P.L.i + 1 < P.L.len) {
			advance(P.L);
			advance(P.L);
			continue;
		}
		if (c === "\n") break;
		if (parenDepth === 0 && bracketDepth === 0) {
			if (c === "]" && peek(P.L, 1) === "]") break;
			if (c === " " || c === "	") {
				let j = P.L.i;
				while (j < P.L.len && (P.L.src[j] === " " || P.L.src[j] === "	")) j++;
				const nc = P.L.src[j] ?? "";
				const nc1 = P.L.src[j + 1] ?? "";
				if (nc === "]" && nc1 === "]" || nc === "&" && nc1 === "&" || nc === "|" && nc1 === "|") break;
				advance(P.L);
				continue;
			}
		}
		if (c === "(") parenDepth++;
		else if (c === ")" && parenDepth > 0) parenDepth--;
		else if (c === "[") bracketDepth++;
		else if (c === "]" && bracketDepth > 0) bracketDepth--;
		advance(P.L);
	}
	if (P.L.b === start) return null;
	return mk(P, "regex", start, P.L.b, []);
}
function parseTestExtglobRhs(P) {
	skipBlanks(P.L);
	const parts = [];
	let segStart = P.L.b;
	let segStartI = P.L.i;
	let parenDepth = 0;
	const flushSeg = () => {
		if (P.L.i > segStartI) {
			const text = P.src.slice(segStartI, P.L.i);
			const type = /^\d+$/.test(text) ? "number" : "extglob_pattern";
			parts.push(mk(P, type, segStart, P.L.b, []));
		}
	};
	while (P.L.i < P.L.len) {
		const c = peek(P.L);
		if (c === "\\" && P.L.i + 1 < P.L.len) {
			advance(P.L);
			advance(P.L);
			continue;
		}
		if (c === "\n") break;
		if (parenDepth === 0) {
			if (c === "]" && peek(P.L, 1) === "]") break;
			if (c === " " || c === "	") {
				let j = P.L.i;
				while (j < P.L.len && (P.L.src[j] === " " || P.L.src[j] === "	")) j++;
				const nc = P.L.src[j] ?? "";
				const nc1 = P.L.src[j + 1] ?? "";
				if (nc === "]" && nc1 === "]" || nc === "&" && nc1 === "&" || nc === "|" && nc1 === "|") break;
				advance(P.L);
				continue;
			}
		}
		if (c === "$") {
			const c1 = peek(P.L, 1);
			if (c1 === "(" || c1 === "{" || isIdentStart(c1) || SPECIAL_VARS.has(c1)) {
				flushSeg();
				const exp = parseDollarLike(P);
				if (exp) parts.push(exp);
				segStart = P.L.b;
				segStartI = P.L.i;
				continue;
			}
		}
		if (c === "\"") {
			flushSeg();
			parts.push(parseDoubleQuoted(P));
			segStart = P.L.b;
			segStartI = P.L.i;
			continue;
		}
		if (c === "'") {
			flushSeg();
			const tok = nextToken(P.L, "arg");
			parts.push(leaf(P, "raw_string", tok));
			segStart = P.L.b;
			segStartI = P.L.i;
			continue;
		}
		if (c === "(") parenDepth++;
		else if (c === ")" && parenDepth > 0) parenDepth--;
		advance(P.L);
	}
	flushSeg();
	return parts;
}
function parseTestPrimary(P, closer) {
	skipBlanks(P.L);
	if (closer === "]" && peek(P.L) === "]") return null;
	if (closer === "]]" && peek(P.L) === "]" && peek(P.L, 1) === "]") return null;
	return parseWord(P, "arg");
}
/** Operator precedence table (higher = tighter binding). */
var ARITH_PREC = {
	"=": 2,
	"+=": 2,
	"-=": 2,
	"*=": 2,
	"/=": 2,
	"%=": 2,
	"<<=": 2,
	">>=": 2,
	"&=": 2,
	"^=": 2,
	"|=": 2,
	"||": 4,
	"&&": 5,
	"|": 6,
	"^": 7,
	"&": 8,
	"==": 9,
	"!=": 9,
	"<": 10,
	">": 10,
	"<=": 10,
	">=": 10,
	"<<": 11,
	">>": 11,
	"+": 12,
	"-": 12,
	"*": 13,
	"/": 13,
	"%": 13,
	"**": 14
};
/** Right-associative operators (assignment and exponent). */
var ARITH_RIGHT_ASSOC = /* @__PURE__ */ new Set([
	"=",
	"+=",
	"-=",
	"*=",
	"/=",
	"%=",
	"<<=",
	">>=",
	"&=",
	"^=",
	"|=",
	"**"
]);
function parseArithExpr(P, stop, mode = "var") {
	return parseArithTernary(P, stop, mode);
}
/** Top-level: comma-separated list. arithmetic_expansion emits multiple children. */
function parseArithCommaList(P, stop, mode = "var") {
	const out = [];
	while (true) {
		const e = parseArithTernary(P, stop, mode);
		if (e) out.push(e);
		skipBlanks(P.L);
		if (peek(P.L) === "," && !isArithStop(P, stop)) {
			advance(P.L);
			continue;
		}
		break;
	}
	return out;
}
function parseArithTernary(P, stop, mode) {
	const cond = parseArithBinary(P, stop, 0, mode);
	if (!cond) return null;
	skipBlanks(P.L);
	if (peek(P.L) === "?") {
		const qs = P.L.b;
		advance(P.L);
		const q = mk(P, "?", qs, P.L.b, []);
		const t = parseArithBinary(P, ":", 0, mode);
		skipBlanks(P.L);
		let colon;
		if (peek(P.L) === ":") {
			const cs = P.L.b;
			advance(P.L);
			colon = mk(P, ":", cs, P.L.b, []);
		} else colon = mk(P, ":", P.L.b, P.L.b, []);
		const f = parseArithTernary(P, stop, mode);
		const last = f ?? colon;
		const kids = [cond, q];
		if (t) kids.push(t);
		kids.push(colon);
		if (f) kids.push(f);
		return mk(P, "ternary_expression", cond.startIndex, last.endIndex, kids);
	}
	return cond;
}
/** Scan next arithmetic binary operator; returns [text, length] or null. */
function scanArithOp(P) {
	const c = peek(P.L);
	const c1 = peek(P.L, 1);
	const c2 = peek(P.L, 2);
	if (c === "<" && c1 === "<" && c2 === "=") return ["<<=", 3];
	if (c === ">" && c1 === ">" && c2 === "=") return [">>=", 3];
	if (c === "*" && c1 === "*") return ["**", 2];
	if (c === "<" && c1 === "<") return ["<<", 2];
	if (c === ">" && c1 === ">") return [">>", 2];
	if (c === "=" && c1 === "=") return ["==", 2];
	if (c === "!" && c1 === "=") return ["!=", 2];
	if (c === "<" && c1 === "=") return ["<=", 2];
	if (c === ">" && c1 === "=") return [">=", 2];
	if (c === "&" && c1 === "&") return ["&&", 2];
	if (c === "|" && c1 === "|") return ["||", 2];
	if (c === "+" && c1 === "=") return ["+=", 2];
	if (c === "-" && c1 === "=") return ["-=", 2];
	if (c === "*" && c1 === "=") return ["*=", 2];
	if (c === "/" && c1 === "=") return ["/=", 2];
	if (c === "%" && c1 === "=") return ["%=", 2];
	if (c === "&" && c1 === "=") return ["&=", 2];
	if (c === "^" && c1 === "=") return ["^=", 2];
	if (c === "|" && c1 === "=") return ["|=", 2];
	if (c === "+" && c1 !== "+") return ["+", 1];
	if (c === "-" && c1 !== "-") return ["-", 1];
	if (c === "*") return ["*", 1];
	if (c === "/") return ["/", 1];
	if (c === "%") return ["%", 1];
	if (c === "<") return ["<", 1];
	if (c === ">") return [">", 1];
	if (c === "&") return ["&", 1];
	if (c === "|") return ["|", 1];
	if (c === "^") return ["^", 1];
	if (c === "=") return ["=", 1];
	return null;
}
/** Precedence-climbing binary expression parser. */
function parseArithBinary(P, stop, minPrec, mode) {
	let left = parseArithUnary(P, stop, mode);
	if (!left) return null;
	while (true) {
		skipBlanks(P.L);
		if (isArithStop(P, stop)) break;
		if (peek(P.L) === ",") break;
		const opInfo = scanArithOp(P);
		if (!opInfo) break;
		const [opText, opLen] = opInfo;
		const prec = ARITH_PREC[opText];
		if (prec === void 0 || prec < minPrec) break;
		const os = P.L.b;
		for (let k = 0; k < opLen; k++) advance(P.L);
		const op = mk(P, opText, os, P.L.b, []);
		const right = parseArithBinary(P, stop, ARITH_RIGHT_ASSOC.has(opText) ? prec : prec + 1, mode);
		if (!right) break;
		left = mk(P, "binary_expression", left.startIndex, right.endIndex, [
			left,
			op,
			right
		]);
	}
	return left;
}
function parseArithUnary(P, stop, mode) {
	skipBlanks(P.L);
	if (isArithStop(P, stop)) return null;
	const c = peek(P.L);
	const c1 = peek(P.L, 1);
	if (c === "+" && c1 === "+" || c === "-" && c1 === "-") {
		const s = P.L.b;
		advance(P.L);
		advance(P.L);
		const op = mk(P, c + c1, s, P.L.b, []);
		const inner = parseArithUnary(P, stop, mode);
		if (!inner) return op;
		return mk(P, "unary_expression", op.startIndex, inner.endIndex, [op, inner]);
	}
	if (c === "-" || c === "+" || c === "!" || c === "~") {
		if (mode !== "var" && c === "-" && isDigit(c1)) {
			const s = P.L.b;
			advance(P.L);
			while (isDigit(peek(P.L))) advance(P.L);
			return mk(P, "number", s, P.L.b, []);
		}
		const s = P.L.b;
		advance(P.L);
		const op = mk(P, c, s, P.L.b, []);
		const inner = parseArithUnary(P, stop, mode);
		if (!inner) return op;
		return mk(P, "unary_expression", op.startIndex, inner.endIndex, [op, inner]);
	}
	return parseArithPostfix(P, stop, mode);
}
function parseArithPostfix(P, stop, mode) {
	const prim = parseArithPrimary(P, stop, mode);
	if (!prim) return null;
	const c = peek(P.L);
	const c1 = peek(P.L, 1);
	if (c === "+" && c1 === "+" || c === "-" && c1 === "-") {
		const s = P.L.b;
		advance(P.L);
		advance(P.L);
		const op = mk(P, c + c1, s, P.L.b, []);
		return mk(P, "postfix_expression", prim.startIndex, op.endIndex, [prim, op]);
	}
	return prim;
}
function parseArithPrimary(P, stop, mode) {
	skipBlanks(P.L);
	if (isArithStop(P, stop)) return null;
	const c = peek(P.L);
	if (c === "(") {
		const s = P.L.b;
		advance(P.L);
		const open = mk(P, "(", s, P.L.b, []);
		const inners = parseArithCommaList(P, ")", mode);
		skipBlanks(P.L);
		let close;
		if (peek(P.L) === ")") {
			const cs = P.L.b;
			advance(P.L);
			close = mk(P, ")", cs, P.L.b, []);
		} else close = mk(P, ")", P.L.b, P.L.b, []);
		return mk(P, "parenthesized_expression", open.startIndex, close.endIndex, [
			open,
			...inners,
			close
		]);
	}
	if (c === "\"") return parseDoubleQuoted(P);
	if (c === "$") return parseDollarLike(P);
	if (isDigit(c)) {
		const s = P.L.b;
		while (isDigit(peek(P.L))) advance(P.L);
		if (P.L.b - s === 1 && c === "0" && (peek(P.L) === "x" || peek(P.L) === "X")) {
			advance(P.L);
			while (isHexDigit(peek(P.L))) advance(P.L);
		} else if (peek(P.L) === "#") {
			advance(P.L);
			while (isBaseDigit(peek(P.L))) advance(P.L);
		}
		return mk(P, "number", s, P.L.b, []);
	}
	if (isIdentStart(c)) {
		const s = P.L.b;
		while (isIdentChar(peek(P.L))) advance(P.L);
		const nc = peek(P.L);
		if (mode === "assign") {
			skipBlanks(P.L);
			const ac = peek(P.L);
			const ac1 = peek(P.L, 1);
			if (ac === "=" && ac1 !== "=") {
				const vn = mk(P, "variable_name", s, P.L.b, []);
				const es = P.L.b;
				advance(P.L);
				const eq = mk(P, "=", es, P.L.b, []);
				const val = parseArithTernary(P, stop, mode);
				return mk(P, "variable_assignment", s, val ? val.endIndex : eq.endIndex, val ? [
					vn,
					eq,
					val
				] : [vn, eq]);
			}
		}
		if (nc === "[") {
			const vn = mk(P, "variable_name", s, P.L.b, []);
			const brS = P.L.b;
			advance(P.L);
			const brOpen = mk(P, "[", brS, P.L.b, []);
			const idx = parseArithTernary(P, "]", "var") ?? parseDollarLike(P);
			skipBlanks(P.L);
			let brClose;
			if (peek(P.L) === "]") {
				const cs = P.L.b;
				advance(P.L);
				brClose = mk(P, "]", cs, P.L.b, []);
			} else brClose = mk(P, "]", P.L.b, P.L.b, []);
			const kids = idx ? [
				vn,
				brOpen,
				idx,
				brClose
			] : [
				vn,
				brOpen,
				brClose
			];
			return mk(P, "subscript", s, brClose.endIndex, kids);
		}
		return mk(P, mode === "var" ? "variable_name" : "word", s, P.L.b, []);
	}
	return null;
}
function isArithStop(P, stop) {
	const c = peek(P.L);
	if (stop === "))") return c === ")" && peek(P.L, 1) === ")";
	if (stop === ")") return c === ")";
	if (stop === ";") return c === ";";
	if (stop === ":") return c === ":";
	if (stop === "]") return c === "]";
	if (stop === "}") return c === "}";
	if (stop === ":}") return c === ":" || c === "}";
	return c === "" || c === "\n";
}
/**
* Single-pass collection of all quote-related spans.
* Previously this was 5 separate tree walks (one per type-set plus
* allQuoteTypes plus heredoc); fusing cuts tree-traversal ~5x.
*
* Replicates the per-type walk semantics: each original walk stopped at
* its own type. So the raw_string walk would recurse THROUGH a string
* node (not its type) to reach nested raw_string inside $(...), but the
* string walk would stop at the outer string. We track `inDouble` to
* collect the *outermost* string span per path, while still descending
* into $()/${} bodies to pick up inner raw_string/ansi_c_string.
*
* raw_string / ansi_c_string / quoted-heredoc bodies are literal text
* in bash (no expansion), so no nested quote nodes exist — return early.
*/
function collectQuoteSpans(node, out, inDouble) {
	switch (node.type) {
		case "raw_string":
			out.raw.push([node.startIndex, node.endIndex]);
			return;
		case "ansi_c_string":
			out.ansiC.push([node.startIndex, node.endIndex]);
			return;
		case "string":
			if (!inDouble) out.double.push([node.startIndex, node.endIndex]);
			for (const child of node.children) if (child) collectQuoteSpans(child, out, true);
			return;
		case "heredoc_redirect": {
			let isQuoted = false;
			for (const child of node.children) if (child && child.type === "heredoc_start") {
				const first = child.text[0];
				isQuoted = first === "'" || first === "\"" || first === "\\";
				break;
			}
			if (isQuoted) {
				out.heredoc.push([node.startIndex, node.endIndex]);
				return;
			}
			break;
		}
	}
	for (const child of node.children) if (child) collectQuoteSpans(child, out, inDouble);
}
/**
* Builds a Set of all character positions covered by the given spans.
*/
function buildPositionSet(spans) {
	const set = /* @__PURE__ */ new Set();
	for (const [start, end] of spans) for (let i = start; i < end; i++) set.add(i);
	return set;
}
/**
* Drops spans that are fully contained within another span, keeping only the
* outermost. Nested quotes (e.g., `"$(echo 'hi')"`) yield overlapping spans
* — the inner raw_string is found by recursing into the outer string node.
* Processing overlapping spans corrupts indices since removing/replacing the
* outer span shifts the inner span's start/end into stale positions.
*/
function dropContainedSpans(spans) {
	return spans.filter((s, i) => !spans.some((other, j) => j !== i && other[0] <= s[0] && other[1] >= s[1] && (other[0] < s[0] || other[1] > s[1])));
}
/**
* Removes spans from a string, returning the string with those character
* ranges removed.
*/
function removeSpans(command, spans) {
	if (spans.length === 0) return command;
	const sorted = dropContainedSpans(spans).sort((a, b) => b[0] - a[0]);
	let result = command;
	for (const [start, end] of sorted) result = result.slice(0, start) + result.slice(end);
	return result;
}
/**
* Replaces spans with just the quote delimiters (preserving ' and " characters).
*/
function replaceSpansKeepQuotes(command, spans) {
	if (spans.length === 0) return command;
	const sorted = dropContainedSpans(spans).sort((a, b) => b[0] - a[0]);
	let result = command;
	for (const [start, end, open, close] of sorted) result = result.slice(0, start) + open + close + result.slice(end);
	return result;
}
/**
* Extract quote context from the tree-sitter AST.
* Replaces the manual character-by-character extractQuotedContent() function.
*
* Tree-sitter node types:
* - raw_string: single-quoted ('...')
* - string: double-quoted ("...")
* - ansi_c_string: ANSI-C quoting ($'...') — span includes the leading $
* - heredoc_redirect: QUOTED heredocs only (<<'EOF', <<"EOF", <<\EOF) —
*   the full redirect span (<<, delimiters, body, newlines) is stripped
*   since the body is literal text in bash (no expansion). UNQUOTED
*   heredocs (<<EOF) are left in place since bash expands $(...)/${...}
*   inside them, and validators need to see those patterns. Matches the
*   sync path's extractHeredocs({ quotedOnly: true }).
*/
function extractQuoteContext(rootNode, command) {
	const spans = {
		raw: [],
		ansiC: [],
		double: [],
		heredoc: []
	};
	collectQuoteSpans(rootNode, spans, false);
	const singleQuoteSpans = spans.raw;
	const ansiCSpans = spans.ansiC;
	const doubleQuoteSpans = spans.double;
	const quotedHeredocSpans = spans.heredoc;
	const allQuoteSpans = [
		...singleQuoteSpans,
		...ansiCSpans,
		...doubleQuoteSpans,
		...quotedHeredocSpans
	];
	const singleQuoteSet = buildPositionSet([
		...singleQuoteSpans,
		...ansiCSpans,
		...quotedHeredocSpans
	]);
	const doubleQuoteDelimSet = /* @__PURE__ */ new Set();
	for (const [start, end] of doubleQuoteSpans) {
		doubleQuoteDelimSet.add(start);
		doubleQuoteDelimSet.add(end - 1);
	}
	let withDoubleQuotes = "";
	for (let i = 0; i < command.length; i++) {
		if (singleQuoteSet.has(i)) continue;
		if (doubleQuoteDelimSet.has(i)) continue;
		withDoubleQuotes += command[i];
	}
	const fullyUnquoted = removeSpans(command, allQuoteSpans);
	const spansWithQuoteChars = [];
	for (const [start, end] of singleQuoteSpans) spansWithQuoteChars.push([
		start,
		end,
		"'",
		"'"
	]);
	for (const [start, end] of ansiCSpans) spansWithQuoteChars.push([
		start,
		end,
		"$'",
		"'"
	]);
	for (const [start, end] of doubleQuoteSpans) spansWithQuoteChars.push([
		start,
		end,
		"\"",
		"\""
	]);
	for (const [start, end] of quotedHeredocSpans) spansWithQuoteChars.push([
		start,
		end,
		"",
		""
	]);
	const unquotedKeepQuoteChars = replaceSpansKeepQuotes(command, spansWithQuoteChars);
	return {
		withDoubleQuotes,
		fullyUnquoted,
		unquotedKeepQuoteChars
	};
}
/**
* Extract compound command structure from the AST.
* Replaces isUnsafeCompoundCommand() and splitCommand() for tree-sitter path.
*/
function extractCompoundStructure(rootNode, command) {
	const n = rootNode;
	const operators = [];
	const segments = [];
	let hasSubshell = false;
	let hasCommandGroup = false;
	let hasPipeline = false;
	function walkTopLevel(node) {
		for (const child of node.children) {
			if (!child) continue;
			if (child.type === "list") for (const listChild of child.children) {
				if (!listChild) continue;
				if (listChild.type === "&&" || listChild.type === "||") operators.push(listChild.type);
				else if (listChild.type === "list" || listChild.type === "redirected_statement") walkTopLevel({
					...node,
					children: [listChild]
				});
				else if (listChild.type === "pipeline") {
					hasPipeline = true;
					segments.push(listChild.text);
				} else if (listChild.type === "subshell") {
					hasSubshell = true;
					segments.push(listChild.text);
				} else if (listChild.type === "compound_statement") {
					hasCommandGroup = true;
					segments.push(listChild.text);
				} else segments.push(listChild.text);
			}
			else if (child.type === ";") operators.push(";");
			else if (child.type === "pipeline") {
				hasPipeline = true;
				segments.push(child.text);
			} else if (child.type === "subshell") {
				hasSubshell = true;
				segments.push(child.text);
			} else if (child.type === "compound_statement") {
				hasCommandGroup = true;
				segments.push(child.text);
			} else if (child.type === "command" || child.type === "declaration_command" || child.type === "variable_assignment") segments.push(child.text);
			else if (child.type === "redirected_statement") {
				let foundInner = false;
				for (const inner of child.children) {
					if (!inner || inner.type === "file_redirect") continue;
					foundInner = true;
					walkTopLevel({
						...child,
						children: [inner]
					});
				}
				if (!foundInner) segments.push(child.text);
			} else if (child.type === "negated_command") {
				segments.push(child.text);
				walkTopLevel(child);
			} else if (child.type === "if_statement" || child.type === "while_statement" || child.type === "for_statement" || child.type === "case_statement" || child.type === "function_definition") {
				segments.push(child.text);
				walkTopLevel(child);
			}
		}
	}
	walkTopLevel(n);
	if (segments.length === 0) segments.push(command);
	return {
		hasCompoundOperators: operators.length > 0,
		hasPipeline,
		hasSubshell,
		hasCommandGroup,
		operators,
		segments
	};
}
/**
* Check whether the AST contains actual operator nodes (;, &&, ||).
*
* This is the key function for eliminating the `find -exec \;` false positive.
* Tree-sitter parses `\;` as part of a `word` node (an argument to find),
* NOT as a `;` operator. So if no actual `;` operator nodes exist in the AST,
* there are no compound operators and hasBackslashEscapedOperator() can be skipped.
*/
function hasActualOperatorNodes(rootNode) {
	const n = rootNode;
	function walk(node) {
		if (node.type === ";" || node.type === "&&" || node.type === "||") return true;
		if (node.type === "list") return true;
		for (const child of node.children) if (child && walk(child)) return true;
		return false;
	}
	return walk(n);
}
/**
* Extract dangerous pattern information from the AST.
*/
function extractDangerousPatterns(rootNode) {
	const n = rootNode;
	let hasCommandSubstitution = false;
	let hasProcessSubstitution = false;
	let hasParameterExpansion = false;
	let hasHeredoc = false;
	let hasComment = false;
	function walk(node) {
		switch (node.type) {
			case "command_substitution":
				hasCommandSubstitution = true;
				break;
			case "process_substitution":
				hasProcessSubstitution = true;
				break;
			case "expansion":
				hasParameterExpansion = true;
				break;
			case "heredoc_redirect":
				hasHeredoc = true;
				break;
			case "comment":
				hasComment = true;
				break;
		}
		for (const child of node.children) if (child) walk(child);
	}
	walk(n);
	return {
		hasCommandSubstitution,
		hasProcessSubstitution,
		hasParameterExpansion,
		hasHeredoc,
		hasComment
	};
}
/**
* Perform complete tree-sitter analysis of a command.
* Extracts all security-relevant data from the AST in one pass.
* This data must be extracted before tree.delete() is called.
*/
function analyzeCommand(rootNode, command) {
	return {
		quoteContext: extractQuoteContext(rootNode, command),
		compoundStructure: extractCompoundStructure(rootNode, command),
		hasActualOperatorNodes: hasActualOperatorNodes(rootNode),
		dangerousPatterns: extractDangerousPatterns(rootNode)
	};
}
/**
* PowerShell commands that run something OCADE cannot read.
*
* Ported from the archive's `utils/powershell/dangerousCmdlets.ts`.
*
* WHY THIS IS A SEPARATE CONCERN FROM "DESTRUCTIVE"
* ------------------------------------------------
* `powershellDestructiveWarning` already recognises commands that delete or
* overwrite things. These are different: they do not destroy anything by
* themselves, they EXECUTE SOMETHING ELSE. `Invoke-Expression (Invoke-RestMethod
* https://…)` is a download-and-run in eleven characters, and nothing about the
* text says what will actually happen.
*
* That is exactly the case the permission layer already handles for bash, where
* `$(...)` and backticks make a command unreadable and unreadable beats any
* allow rule. Without this table the same reasoning stopped at the shell
* boundary: a rule saying `Bash(powershell:*)` covered every one of these,
* because the bash parser sees one command called `powershell` and cannot look
* inside its argument.
*
* ADAPTED, AND WHY
* ----------------
* The donor split these across validator lists used by a permission dialog and
* a suggestion gate. OCADE needs one question answered -- does this run code
* nobody can see? -- so the lists are merged into one set and one predicate.
* The `ARG_GATED_CMDLETS` list is deliberately NOT included: those are safe
* cmdlets whose ARGUMENTS can be dangerous, which is a judgement the donor's
* full PowerShell parser made and this does not have.
*/
/** Cmdlets that execute a script file or a script block. */
var SCRIPT_EXECUTION = [
	"invoke-command",
	"invoke-expression",
	"iex",
	"icm",
	"start-job",
	"start-threadjob",
	"register-scheduledjob",
	"register-engineevent",
	"register-objectevent",
	"register-wmievent",
	"new-pssession",
	"enter-pssession"
];
/** Loading a module runs its code. Installing one downloads it first. */
var MODULE_LOADING = [
	"import-module",
	"ipmo",
	"install-module",
	"save-module",
	"update-module",
	"install-script",
	"save-script"
];
/** Fetches. Paired with an execution cmdlet this is download-and-run. */
var NETWORK = [
	"invoke-webrequest",
	"invoke-restmethod",
	"iwr",
	"irm",
	"curl",
	"wget"
];
/** Rebinding a name changes what every later command in the script means. */
var ALIAS_HIJACK = [
	"set-alias",
	"sal",
	"new-alias",
	"nal",
	"set-variable",
	"sv",
	"new-variable",
	"nv"
];
/** Process creation through WMI/CIM, which looks nothing like a spawn. */
var WMI_SPAWN = [
	"invoke-wmimethod",
	"iwmi",
	"invoke-cimmethod"
];
/** Shells, spawners, and the two cmdlets that compile or instantiate code. */
var SHELLS_AND_SPAWNERS = [
	"pwsh",
	"powershell",
	"cmd",
	"wsl",
	"start-process",
	"saps",
	"add-type",
	"new-object"
];
var POWERSHELL_CODE_EXECUTION = /* @__PURE__ */ new Set([
	...SCRIPT_EXECUTION,
	...MODULE_LOADING,
	...NETWORK,
	...ALIAS_HIJACK,
	...WMI_SPAWN,
	...SHELLS_AND_SPAWNERS
]);
/**
* Does this text invoke a PowerShell command that runs something else?
*
* Matched on word boundaries and case-insensitively, because PowerShell is
* case-insensitive and `IEX`, `iex` and `Invoke-Expression` are the same call.
* A hyphenated cmdlet name cannot be matched with `\b` on its right side --
* `\b` sits between `e` and `-` -- so the boundary is written explicitly.
*/
function invokesPowerShellCodeExecution(text) {
	if (!text) return null;
	const lowered = text.toLowerCase();
	for (const cmdlet of POWERSHELL_CODE_EXECUTION) if (new RegExp(`(^|[\\s;|(&{'"\`])${cmdlet}([\\s;|)&}'"\`]|$)`).test(lowered)) return cmdlet;
	return null;
}
var DENIAL_LIMITS = {
	maxConsecutive: 3,
	maxTotal: 20
};
function createDenialTrackingState() {
	return {
		consecutiveDenials: 0,
		totalDenials: 0
	};
}
function recordDenial(state) {
	return {
		...state,
		consecutiveDenials: state.consecutiveDenials + 1,
		totalDenials: state.totalDenials + 1
	};
}
function recordSuccess(state) {
	if (state.consecutiveDenials === 0) return state;
	return {
		...state,
		consecutiveDenials: 0
	};
}
function shouldFallbackToPrompting(state) {
	return state.consecutiveDenials >= DENIAL_LIMITS.maxConsecutive || state.totalDenials >= DENIAL_LIMITS.maxTotal;
}
/**
* One permission and risk layer, for Chat and for Cowork.
*
* WHAT THIS REPLACED, AND WHY IT HAD TO GO
* ----------------------------------------
* Cowork's `approvalPolicy` read, in full:
*
*     if (ALWAYS_ASK.has(toolName)) return "ask";
*     void risk; void mode;
*     return "auto";
*
* It took a risk band and a mode and discarded both. Every tool on the machine
* — deleting files, typing into windows, running shell commands — ran without a
* question, and one hard-coded name was the entire safety model. Chat had no
* permission layer at all, because Chat had no tools; the moment Chat gets
* tools, "no layer" stops being a description and becomes a hole.
*
* The imported primary logic carries a real one: permission modes, rules with
* exact / prefix / wildcard matching, a dangerous-pattern table, destructive-
* command warnings, and denial tracking. This module is the adapter between
* that engine and OCADE's tool registry. The rules, the matching and the
* pattern tables are the donor's; what is OCADE's is the mapping from a tool
* call to the string those rules match against, and the surface rules below.
*
* THE ONE THING THIS LAYER WILL NOT DO
* ------------------------------------
* It never returns `allow` for a call it could not read. An argument shape it
* does not recognise on a mutating tool resolves to `ask`, not to `allow`,
* because "I could not tell what this would do" is a reason to check, never a
* reason to proceed. Silence is not consent, including the compiler's.
*/
function createPermissionContext(mode = "guarded", rules = [], home = null) {
	return {
		mode,
		rules,
		denials: createDenialTrackingState(),
		home
	};
}
/** Record that the user refused a call; repeated refusals re-enable prompting. */
function noteDenied(context) {
	return {
		...context,
		denials: recordDenial(context.denials)
	};
}
/** Record that a call was approved and completed. */
function noteApproved(context) {
	return {
		...context,
		denials: recordSuccess(context.denials)
	};
}
/**
* The string a rule's content is matched against for a given call.
*
* For a shell tool it is the command itself, because that is what the user
* means when they write `Bash(git status)`. For everything else it is the
* primary subject of the call — the path, the URL, the application name —
* since a rule about `file_delete` is almost always a rule about *which files*.
*
* Returning null means "this call has no stable subject", and a null subject
* can only ever match a tool-wide rule. It never matches a content rule by
* accident, which is the failure mode that would quietly widen an allow-list.
*/
function subjectOf(call) {
	const args = call.arguments ?? {};
	for (const key of [
		"command",
		"script",
		"path",
		"file",
		"filePath",
		"url",
		"name",
		"app",
		"query"
	]) {
		const value = args[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}
/** True when the call carries something that will be executed as a command. */
function commandOf(call) {
	const args = call.arguments ?? {};
	for (const key of [
		"command",
		"script",
		"shell"
	]) {
		const value = args[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return null;
}
/**
* Every path this call would act on.
*
* The names are the ones the file and folder tools actually use. A tool that
* grows a new path argument and is not listed here is not silently exempt: it
* is simply not yet checked, which is why the test file asserts this list
* against the registry rather than trusting it.
*/
var PATH_ARGUMENT_KEYS = [
	"path",
	"paths",
	"folder",
	"directory",
	"source",
	"destination",
	"target",
	"file",
	"name",
	"item"
];
function pathsOf(call) {
	const args = call.arguments ?? {};
	const found = [];
	for (const key of PATH_ARGUMENT_KEYS) {
		const value = args[key];
		if (typeof value === "string" && value.trim()) found.push(value.trim());
		else if (Array.isArray(value)) {
			for (const item of value) if (typeof item === "string" && item.trim()) found.push(item.trim());
		}
	}
	return found;
}
/**
* The path objection for this call, if there is one.
*
* Only for tools that CHANGE something. Reading `/etc` is how a person finds
* out what is on their machine; emptying it is not, and a rule that refused
* both would be turned off within a day.
*/
function pathObjectionFor(call, tool, home) {
	if (!tool?.mutating) return null;
	for (const path of pathsOf(call)) {
		if (containsPathTraversal(path)) return "that path climbs out of the folder it starts in";
		const risk = dangerousPath(path, home);
		if (risk.dangerous) return risk.reason;
	}
	return null;
}
function shapeOf(command) {
	const root = getParserModule()?.parse(command);
	if (!root) return {
		segments: [command],
		opaque: false,
		unreadable: true
	};
	try {
		const analysis = analyzeCommand(root, command);
		const segments = analysis.compoundStructure.segments.map((segment) => segment.trim()).filter(Boolean);
		const dangerous = analysis.dangerousPatterns;
		const supplied = command.replace(/\s/g, "").length;
		const recovered = segments.join("").replace(/\s/g, "").length;
		const coverage = supplied === 0 ? 1 : recovered / supplied;
		return {
			segments: segments.length > 0 ? segments : [command.trim()],
			opaque: dangerous.hasCommandSubstitution || dangerous.hasProcessSubstitution || dangerous.hasHeredoc || invokesPowerShellCodeExecution(command) !== null,
			unreadable: coverage < .66
		};
	} catch {
		return {
			segments: [command],
			opaque: false,
			unreadable: true
		};
	}
}
function ruleMatches(parsed, subject) {
	switch (parsed.type) {
		case "exact": return parsed.command === subject;
		case "prefix": return subject === parsed.prefix || subject.startsWith(`${parsed.prefix} `);
		case "wildcard": return matchWildcardPattern(parsed.pattern, subject);
	}
}
/**
* Whether a rule of this behaviour covers the call.
*
* For an ALLOW rule, "covers" means every segment of the command is matched —
* one unmatched segment is an unallowed command, however many of its siblings
* were fine. For DENY and ASK it is the opposite: one matching segment is
* enough, because the strictest answer across a compound command governs.
*/
function findRule(call, rules, behavior) {
	const subject = subjectOf(call);
	const command = commandOf(call);
	const segments = command ? shapeOf(command).segments : null;
	for (const entry of rules) {
		if (entry.behavior !== behavior) continue;
		const value = permissionRuleValueFromString(entry.rule);
		if (value.toolName !== call.name) continue;
		if (!value.ruleContent) return {
			behavior,
			rule: entry.rule
		};
		const parsed = parsePermissionRule(value.ruleContent);
		if (segments) {
			if (behavior === "allow" ? segments.every((segment) => ruleMatches(parsed, segment)) : segments.some((segment) => ruleMatches(parsed, segment))) return {
				behavior,
				rule: entry.rule
			};
			continue;
		}
		if (subject === null) continue;
		if (ruleMatches(parsed, subject)) return {
			behavior,
			rule: entry.rule
		};
	}
	return null;
}
/**
* Whether a command looks like one of the shapes the imported table flags.
*
* The patterns are the donor's and they are string sources, not compiled
* expressions, so they are compiled once here and cached for the process.
*/
var DANGEROUS = [...DANGEROUS_BASH_PATTERNS, ...CROSS_PLATFORM_CODE_EXEC].map((source) => new RegExp(source));
function looksDangerous(command) {
	return DANGEROUS.some((pattern) => pattern.test(command));
}
/**
* The destructive-command note for a command, on either shell.
*
* BOTH TABLES ARE ASKED, ALWAYS, AND THAT IS DELIBERATE.
*
* OCADE's companion runs on Windows as well as on macOS and Linux, and the
* shell a command is meant for is not reliably knowable from the string:
* `Remove-Item -Recurse -Force` is a PowerShell command and arrives through
* exactly the same tool call as `rm -rf`. Choosing a table by guessing the
* platform would mean guessing wrong sometimes, and guessing wrong here means
* a warning that does not appear.
*
* Running both costs two regex passes and cannot produce a false alarm the
* other table would have avoided — `Remove-Item` is not valid bash and `rm -rf`
* is not valid PowerShell, so a hit from either is a hit.
*
* Checked per segment as well as whole: `echo starting && git reset --hard`
* carries no warning as one string under some patterns and plainly does as two.
*/
function destructiveWarningFor(command, shape) {
	const candidates = [command, ...shape?.segments ?? []];
	for (const candidate of candidates) {
		const warning = getDestructiveCommandWarning$1(candidate) ?? getDestructiveCommandWarning(candidate);
		if (warning) return warning;
	}
	return null;
}
/**
* Decide what happens to one tool call.
*
* Order matters and is not arbitrary: deny beats everything, then plan mode
* stops the world, then an explicit ask overrides an automatic allow, then
* rules, then the read-only shortcut, then risk. A user who wrote a deny rule
* has said something more specific than any mode, so no mode may override it.
*/
function decide(call, tool, context) {
	const command = commandOf(call);
	const shape = command ? shapeOf(command) : null;
	const warning = command ? destructiveWarningFor(command, shape) : null;
	const pathObjection = pathObjectionFor(call, tool, context.home ?? null);
	const denied = findRule(call, context.rules, "deny");
	if (denied) return {
		outcome: "deny",
		reason: "You have blocked this action.",
		warning,
		matchedRule: denied.rule
	};
	if (!tool) return {
		outcome: "deny",
		reason: "OCADE does not have that action.",
		warning,
		matchedRule: null
	};
	if (context.mode === "plan") {
		if (!tool.mutating) return {
			outcome: "allow",
			reason: "Looking only.",
			warning,
			matchedRule: null
		};
		return {
			outcome: "deny",
			reason: "Nothing runs while you are reviewing the plan.",
			warning,
			matchedRule: null
		};
	}
	if (shape && (shape.opaque || shape.unreadable)) return {
		outcome: "ask",
		reason: shape.unreadable ? "OCADE could not read this command well enough to check it." : "This command runs another command inside it, so OCADE is checking with you.",
		warning,
		matchedRule: null
	};
	if (pathObjection) return {
		outcome: "ask",
		reason: `OCADE is checking first: ${pathObjection}.`,
		warning,
		matchedRule: null
	};
	const asked = findRule(call, context.rules, "ask");
	if (asked) return {
		outcome: "ask",
		reason: "You asked to be checked with on this.",
		warning,
		matchedRule: asked.rule
	};
	const allowed = findRule(call, context.rules, "allow");
	if (allowed) return {
		outcome: "allow",
		reason: "You allowed this before.",
		warning,
		matchedRule: allowed.rule
	};
	if (!tool.mutating) return {
		outcome: "allow",
		reason: "Looking only.",
		warning,
		matchedRule: null
	};
	if (command && (looksDangerous(command) || shape?.segments.some(looksDangerous) || warning)) return {
		outcome: "ask",
		reason: warning ?? "This command can do damage that cannot be undone.",
		warning,
		matchedRule: null
	};
	if (tool.risk === "high") return {
		outcome: "ask",
		reason: warning ?? "This cannot be undone.",
		warning,
		matchedRule: null
	};
	if (shouldFallbackToPrompting(context.denials)) return {
		outcome: "ask",
		reason: "You have turned several of these down, so OCADE is checking again.",
		warning,
		matchedRule: null
	};
	if (context.mode === "trusted") return {
		outcome: "allow",
		reason: "Running without asking, as you set.",
		warning,
		matchedRule: null
	};
	if (context.mode === "acceptEdits" && (tool.domain === "files" || tool.domain === "content")) return {
		outcome: tool.risk === "read" || tool.risk === "low" || tool.risk === "medium" ? "allow" : "ask",
		reason: "Edits go through without asking, as you set.",
		warning,
		matchedRule: null
	};
	return {
		outcome: "ask",
		reason: warning ?? "This changes something on your device.",
		warning,
		matchedRule: null
	};
}
/**
* Where the permission layer gets its mode and its rules.
*
* This deliberately reads the Computer Use policy the user already set rather
* than introducing a second permission control. Two settings that both mean
* "how much may OCADE do without asking" is a bug even when both are correct,
* because the user changes one and the other silently disagrees.
*
* Rules are separate and additive: the mode says how permissive OCADE is in
* general, a rule says something specific about one action, and a specific
* statement always beats a general one.
*/
var PERMISSION_RULES_KEY = "ocade:permission-rules:v1";
/**
* The Computer Use policy, expressed as a runtime permission mode.
*
* `blocked` and `read_only` both become `plan`, which is the mode in which
* nothing that changes the machine runs. That is what both settings mean; they
* differ only in how the UI explains them.
*/
var MODE_FOR = {
	blocked: "plan",
	read_only: "plan",
	ask_every_mutation: "guarded",
	bounded_workflow: "guarded",
	ask_risky: "acceptEdits",
	session_allowance: "trusted",
	time_limited: "trusted",
	always_selected_low_risk: "trusted"
};
function modeFor(permission) {
	return MODE_FOR[permission] ?? "guarded";
}
var BEHAVIORS = [
	"allow",
	"deny",
	"ask"
];
function normalizeRules(value) {
	if (!Array.isArray(value)) return [];
	const out = [];
	const seen = /* @__PURE__ */ new Set();
	for (const entry of value) {
		if (!entry || typeof entry !== "object") continue;
		const record = entry;
		const rule = typeof record.rule === "string" ? record.rule.trim() : "";
		const behavior = record.behavior;
		if (!rule) continue;
		if (typeof behavior !== "string" || !BEHAVIORS.includes(behavior)) continue;
		const key = `${behavior}:${rule}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			rule,
			behavior
		});
	}
	return out;
}
function loadRules(storage = typeof window === "undefined" ? null : window.localStorage) {
	if (!storage) return [];
	try {
		const raw = storage.getItem(PERMISSION_RULES_KEY);
		return raw ? normalizeRules(JSON.parse(raw)) : [];
	} catch {
		return [];
	}
}
/** The live permission context, read from the user's own settings. */
function currentPermissionContext(storage = typeof window === "undefined" ? null : window.localStorage) {
	const settings = loadComputerUseSettings(storage);
	return createPermissionContext(settings.enabled ? modeFor(settings.defaultPermission) : "plan", loadRules(storage));
}
//#endregion
export { handshakeWithExtension as a, missionSpeakFn as c, refreshMemoryFn as d, startMissionFn as f, extensionChannelAvailable as i, noteApproved as l, stopMissionFn as m, decide as n, missionAudioInputsFn as o, stopAllLocalMissionsFn as p, executeToolCall as r, missionMicFn as s, currentPermissionContext as t, noteDenied as u };

import { c as stringType, o as objectType, r as enumType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/agent.functions-C2ympagL.js
/**
* The agent loop's production owner (server function).
*
* WHY THIS FILE HAS TO EXIST
* --------------------------
* `agent/adapters.node.ts` spawns the Python native-control host and the
* Playwright browser host. Both are `node:child_process`, so the module can
* never be imported from the browser bundle — the same constraint that put the
* generated-code sandbox behind `sandbox.functions.ts`. The `await import()`
* inside each handler is what keeps Node builtins out of the client build.
*
* WHAT THE CALLER DOES NOT GET TO DECIDE
* --------------------------------------
* 1. **Where the sidecars live.** Paths are resolved on the server from the
*    project root. A client-supplied interpreter path would be arbitrary code
*    execution wearing a JSON hat.
* 2. **Whether authentication applies.** `requireSupabaseAuth` is not optional
*    on any handler here; this is the entry point to a real computer.
* 3. **How many steps a task may take.** The loop's own ceiling applies and is
*    not a parameter.
*
* TWO ENTRY POINTS, AND THE DIFFERENCE BETWEEN THEM IS THE PRODUCT
* ----------------------------------------------------------------
* `observeComputerFn` answers questions about this computer and refuses every
* mutating tool. It is what ordinary OCADE Chat may reach, so a chat message can
* never move the mouse.
*
* `controlWorkTaskFn` is Control + Work's own route, and the only one that may
* change anything. Even there, autonomy is passed per task rather than stored,
* and `high`-risk tools are refused outright — see the note on that handler.
*/
var observeInput = objectType({
	/** What the user typed. Bounded: this becomes a model prompt. */
	request: stringType().min(1).max(4e3),
	/** Optional window hint, so "what's in Chrome?" does not need a tool round trip. */
	windowTitle: stringType().max(256).optional()
});
var observeComputerFn_createServerFn_handler = createServerRpc({
	id: "8d73eecd0e91abeff88f638616b994b53355e1a803396c8638e5bde1cb57b79a",
	name: "observeComputerFn",
	filename: "src/lib/agent.functions.ts"
}, (opts) => observeComputerFn.__executeServer(opts));
var observeComputerFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(observeInput).handler(observeComputerFn_createServerFn_handler, async ({ data }) => {
	const [{ runAgentTask }, { OcadeAdapters }, { resolveAdapterConfig }, engine] = await Promise.all([
		import("./loop-CBX9uRwX.mjs").then((n) => n.o).then((n) => n.r),
		import("./adapters.node-CMsOrWj1.mjs"),
		import("./host-paths.node-iwL-hkLV.mjs"),
		import("./model-turn.node-BeuYY_Yn.mjs")
	]);
	const config = await resolveAdapterConfig();
	if (!config.ok) return {
		ok: false,
		reason: "unavailable",
		text: config.reason,
		steps: [],
		domains: [],
		allVerified: false
	};
	const adapters = new OcadeAdapters(config.config);
	try {
		const result = await runAgentTask({
			complete: engine.complete,
			turn: engine.turn,
			execute: (call, signal) => adapters.execute(call, signal),
			permit: async () => false
		}, { request: data.windowTitle ? `${data.request}\n(The user is asking about the window titled "${data.windowTitle}".)` : data.request });
		return {
			ok: result.allVerified,
			reason: result.reason,
			text: result.text,
			steps: result.steps.map(({ call, outcome }) => ({
				tool: call.name,
				outcome: outcome.kind,
				detail: outcome.detail,
				verified: outcome.verified
			})),
			domains: result.classification.domains,
			allVerified: result.allVerified
		};
	} finally {
		adapters.dispose();
	}
});
var agentReadinessFn_createServerFn_handler = createServerRpc({
	id: "73f810a6103278c69034436cdbb4d3ffad53748b88b1ad2d6392db3fc51277a4",
	name: "agentReadinessFn",
	filename: "src/lib/agent.functions.ts"
}, (opts) => agentReadinessFn.__executeServer(opts));
var agentReadinessFn = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(agentReadinessFn_createServerFn_handler, async () => {
	const { resolveAdapterConfig } = await import("./host-paths.node-iwL-hkLV.mjs");
	const config = await resolveAdapterConfig();
	return config.ok ? {
		ready: true,
		reason: "The computer-control hosts are installed.",
		missing: []
	} : {
		ready: false,
		reason: config.reason,
		missing: config.missing
	};
});
var nativePreflightFn_createServerFn_handler = createServerRpc({
	id: "8da950533f3cb72186a8d056026094e782ec8713a0c6b0358106e0280b48d6b3",
	name: "nativePreflightFn",
	filename: "src/lib/agent.functions.ts"
}, (opts) => nativePreflightFn.__executeServer(opts));
var nativePreflightFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(nativePreflightFn_createServerFn_handler, async () => {
	const [{ OcadeAdapters }, { resolveAdapterConfig }] = await Promise.all([import("./adapters.node-CMsOrWj1.mjs"), import("./host-paths.node-iwL-hkLV.mjs")]);
	const config = await resolveAdapterConfig();
	if (!config.ok) return {
		reachable: false,
		detail: config.reason,
		machine: null,
		activeWindow: null,
		action: null,
		voice: null,
		microphone: null
	};
	const adapters = new OcadeAdapters(config.config);
	try {
		const [result, capability] = await Promise.all([adapters.preflight(), adapters.voiceCapability()]);
		const snapshot = result.snapshot;
		const active = result.activeWindow;
		const speech = capability.speech.ok ? capability.speech.data : null;
		const mic = capability.microphone.ok ? capability.microphone.data : null;
		return {
			reachable: result.reachable,
			detail: result.detail,
			machine: snapshot ? {
				cpuPercent: snapshot.cpuPercent,
				memoryUsedPercent: snapshot.memory?.usedPercent,
				displays: Array.isArray(active?.displays) ? active.displays.length : void 0
			} : null,
			activeWindow: active ? {
				title: active.title,
				application: active.process
			} : null,
			action: result.action,
			voice: speech ? {
				engine: speech.engine ?? "unknown",
				voiceName: speech.preferred?.name ?? "the system default",
				cloudRequired: speech.cloudRequired === true
			} : null,
			microphone: mic ? {
				count: mic.count ?? 0,
				detail: mic.reason ?? ""
			} : {
				count: 0,
				detail: "No microphone was found on this computer."
			}
		};
	} finally {
		adapters.dispose();
	}
});
var controlInput = objectType({
	request: stringType().min(1).max(4e3),
	/**
	* `observe` looks and answers. `act` allows the loop to change things.
	*
	* A parameter rather than a setting, because the GUI arms it per task: the
	* user pressing "Let OCADE act" for one instruction has not consented to the
	* next one, and a stored preference would quietly turn that into standing
	* permission.
	*/
	autonomy: enumType(["observe", "act"]).default("observe")
});
var controlWorkTaskFn_createServerFn_handler = createServerRpc({
	id: "66038743829029124311018a0f25fe8868a5c41fe73dd530907550e0c43a5ff6",
	name: "controlWorkTaskFn",
	filename: "src/lib/agent.functions.ts"
}, (opts) => controlWorkTaskFn.__executeServer(opts));
var controlWorkTaskFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(controlInput).handler(controlWorkTaskFn_createServerFn_handler, async ({ data }) => {
	const [{ runAgentTask }, { OcadeAdapters }, { resolveAdapterConfig }, engine, registry] = await Promise.all([
		import("./loop-CBX9uRwX.mjs").then((n) => n.o).then((n) => n.r),
		import("./adapters.node-CMsOrWj1.mjs"),
		import("./host-paths.node-iwL-hkLV.mjs"),
		import("./model-turn.node-BeuYY_Yn.mjs"),
		import("./tool-registry-BXQ-LCdE.mjs").then((n) => n.i).then((n) => n.i)
	]);
	const config = await resolveAdapterConfig();
	if (!config.ok) return {
		ok: false,
		reason: "unavailable",
		text: config.reason,
		steps: [],
		domains: [],
		allVerified: false,
		autonomy: data.autonomy,
		timeline: []
	};
	const adapters = new OcadeAdapters(config.config);
	const timeline = [];
	try {
		const result = await runAgentTask({
			complete: engine.complete,
			turn: engine.turn,
			execute: (call, signal) => adapters.execute(call, signal),
			stopRequested: () => adapters.stopRequested(),
			permit: async (call) => {
				if (data.autonomy !== "act") return false;
				const definition = registry.findTool(call.name);
				return definition !== null && definition.risk !== "high";
			},
			onEvent: (event) => {
				if (event.kind === "tool_start") timeline.push({
					kind: "acting",
					label: describeTool(event.call.name),
					detail: ""
				});
				else if (event.kind === "tool_end") timeline.push({
					kind: event.outcome.kind === "success" ? "done" : "problem",
					label: describeTool(event.call.name),
					detail: event.outcome.detail,
					verified: event.outcome.verified
				});
				else if (event.kind === "refused") timeline.push({
					kind: "refused",
					label: describeTool(event.call.name),
					detail: event.reason
				});
			}
		}, { request: data.request });
		return {
			ok: result.allVerified,
			reason: result.reason,
			text: result.text,
			steps: result.steps.map(({ call, outcome }) => ({
				tool: call.name,
				outcome: outcome.kind,
				detail: outcome.detail,
				verified: outcome.verified
			})),
			domains: result.classification.domains,
			allVerified: result.allVerified,
			autonomy: data.autonomy,
			timeline
		};
	} finally {
		adapters.dispose();
	}
});
/**
* A tool name as a person would say it.
*
* The GUI must not show `control_set_text`, and translating in the component
* would put half the vocabulary in a React file. One table, on the server, next
* to the only thing that produces those names.
*/
function describeTool(name) {
	return {
		screen_observe: "Looking at the screen",
		window_list: "Reading the open windows",
		window_focus: "Bringing a window forward",
		window_arrange: "Moving a window",
		display_list: "Checking the screens",
		app_open: "Opening an application",
		app_focus: "Switching to an application",
		app_list_installed: "Checking what is installed",
		control_find: "Looking for a control",
		control_activate: "Pressing a control",
		control_set_text: "Filling in a field",
		system_status: "Reading this computer's state",
		browser_open: "Opening a browser",
		browser_navigate: "Opening a page",
		browser_read: "Reading the page",
		browser_click: "Clicking on the page",
		browser_tabs: "Reading the open tabs",
		web_search: "Searching the web",
		file_search: "Looking for files",
		file_read: "Reading a file",
		file_copy: "Copying a file",
		file_move: "Moving a file"
	}[name] ?? "Working";
}
/** Say one sentence aloud with this computer's own free voice. */
var speakAloudFn_createServerFn_handler = createServerRpc({
	id: "6f0bb46e7cd55a9361f3d24693ce8382317436e46cf9800dfa94680a5fde26c7",
	name: "speakAloudFn",
	filename: "src/lib/agent.functions.ts"
}, (opts) => speakAloudFn.__executeServer(opts));
var speakAloudFn = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).validator(objectType({
	text: stringType().min(1).max(1200),
	language: stringType().max(8).optional()
})).handler(speakAloudFn_createServerFn_handler, async ({ data }) => {
	const [{ OcadeAdapters }, { resolveAdapterConfig }] = await Promise.all([import("./adapters.node-CMsOrWj1.mjs"), import("./host-paths.node-iwL-hkLV.mjs")]);
	const config = await resolveAdapterConfig();
	if (!config.ok) return {
		ok: false,
		detail: config.reason
	};
	const adapters = new OcadeAdapters(config.config);
	try {
		const outcome = await adapters.speak(data.text, data.language ?? "en");
		return {
			ok: outcome.kind === "success",
			detail: outcome.detail
		};
	} finally {
		adapters.dispose();
	}
});
//#endregion
export { agentReadinessFn_createServerFn_handler, controlWorkTaskFn_createServerFn_handler, nativePreflightFn_createServerFn_handler, observeComputerFn_createServerFn_handler, speakAloudFn_createServerFn_handler };

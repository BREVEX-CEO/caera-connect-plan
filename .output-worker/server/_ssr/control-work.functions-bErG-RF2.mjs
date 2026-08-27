import { a as numberType, c as stringType, n as booleanType, o as objectType, s as recordType, u as unknownType } from "../_libs/zod.mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as createServerRpc } from "./createServerRpc-B90ckaqP.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/control-work.functions-bErG-RF2.js
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
var startMissionFn_createServerFn_handler = createServerRpc({
	id: "74bf6e01a38d8e237b7fdde1016e4cdb562eae1ca7be85d7365441100443c2dd",
	name: "startMissionFn",
	filename: "src/lib/control-work.functions.ts"
}, (opts) => startMissionFn.__executeServer(opts));
var startMissionFn = createServerFn({ method: "POST" }).handler(startMissionFn_createServerFn_handler, async () => {
	const [{ authoriseControl }, { OcadeAdapters }, { resolveAdapterConfig }, host] = await Promise.all([
		import("./control-access.node-Db1Sn6Lc.mjs"),
		import("./adapters.node-BySN9AYe.mjs"),
		import("./host-paths.node-iwL-hkLV.mjs"),
		import("./mission-host.node-ChhwuCxr.mjs")
	]);
	const access = await authoriseControl();
	if (!access.ok) return {
		ok: false,
		missionId: null,
		via: null,
		detail: access.reason,
		machine: null,
		activeWindow: null,
		voice: null,
		microphone: null,
		memory: null
	};
	const config = await resolveAdapterConfig();
	if (!config.ok) return {
		ok: false,
		missionId: null,
		via: access.via,
		detail: config.reason,
		machine: null,
		activeWindow: null,
		voice: null,
		microphone: null,
		memory: null
	};
	const adapters = new OcadeAdapters(config.config);
	const id = host.newMissionId();
	try {
		const [preflight, capability, memory] = await Promise.all([
			adapters.preflight(),
			adapters.voiceCapability(),
			adapters.memoryContext()
		]);
		if (!preflight.reachable) {
			adapters.dispose();
			return {
				ok: false,
				missionId: null,
				via: access.via,
				detail: preflight.detail,
				machine: null,
				activeWindow: null,
				voice: null,
				microphone: null,
				memory: null
			};
		}
		await host.openMission(id, adapters, access.via);
		const snapshot = preflight.snapshot;
		const active = preflight.activeWindow;
		const speech = capability.speech.ok ? capability.speech.data : null;
		const mic = capability.microphone.ok ? capability.microphone.data : null;
		return {
			ok: true,
			missionId: id,
			via: access.via,
			detail: preflight.detail,
			machine: {
				cpuPercent: snapshot?.cpuPercent,
				memoryUsedPercent: snapshot?.memory?.usedPercent,
				displays: Array.isArray(active?.displays) ? active.displays.length : void 0
			},
			activeWindow: active ? {
				title: active.title,
				application: active.process
			} : null,
			voice: speech ? {
				engine: speech.engine ?? "unknown",
				voiceName: speech.preferred?.name ?? "the system default",
				cloudRequired: speech.cloudRequired === true
			} : null,
			microphone: mic ? {
				count: mic.count ?? 0,
				detail: mic.reason ?? ""
			} : null,
			memory
		};
	} catch (error) {
		adapters.dispose();
		return {
			ok: false,
			missionId: null,
			via: access.via,
			detail: error instanceof Error ? error.message : "OCADE could not reach this computer.",
			machine: null,
			activeWindow: null,
			voice: null,
			microphone: null,
			memory: null
		};
	}
});
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
var runControlActionFn_createServerFn_handler = createServerRpc({
	id: "722ca7d497a2e131ff1ba63c5e17cb5063949edd3af632a1ab1964268f879df2",
	name: "runControlActionFn",
	filename: "src/lib/control-work.functions.ts"
}, (opts) => runControlActionFn.__executeServer(opts));
var runControlActionFn = createServerFn({ method: "POST" }).validator(actionInput).handler(runControlActionFn_createServerFn_handler, async ({ data }) => {
	const [{ authoriseControl }, host, registry] = await Promise.all([
		import("./control-access.node-Db1Sn6Lc.mjs"),
		import("./mission-host.node-ChhwuCxr.mjs"),
		import("./tool-registry-BXQ-LCdE.mjs").then((n) => n.i).then((n) => n.i)
	]);
	const access = await authoriseControl();
	if (!access.ok) return {
		ok: false,
		kind: "blocked",
		detail: access.reason
	};
	const mission = host.findMission(data.missionId);
	if (!mission) return {
		ok: false,
		kind: "state_changed",
		detail: "That session has ended. Start again to let OCADE work on this computer."
	};
	if (mission.stopping) return {
		ok: false,
		kind: "cancelled",
		detail: "The task was stopped."
	};
	const definition = registry.findTool(data.tool);
	if (!definition) return {
		ok: false,
		kind: "unsupported",
		detail: `There is no tool called ${data.tool}.`
	};
	if (definition.risk === "high" && !data.confirmed) return {
		ok: false,
		kind: "permission_required",
		detail: "This one needs your confirmation before OCADE will do it."
	};
	mission.actions += 1;
	const outcome = await mission.adapters.execute({
		name: data.tool,
		arguments: data.args
	}, void 0, data.confirmed === true);
	return {
		ok: outcome.kind === "success",
		kind: outcome.kind,
		detail: outcome.detail,
		verified: outcome.verified,
		observation: outcome.observation ?? null,
		elapsedMs: outcome.elapsedMs
	};
});
var stopMissionFn_createServerFn_handler = createServerRpc({
	id: "0b11926bf97dd2a2dce0fc743958402522fcf6521153f27d0150ab5272915b93",
	name: "stopMissionFn",
	filename: "src/lib/control-work.functions.ts"
}, (opts) => stopMissionFn.__executeServer(opts));
var stopMissionFn = createServerFn({ method: "POST" }).validator(objectType({ missionId: stringType().min(1).max(64) })).handler(stopMissionFn_createServerFn_handler, async ({ data }) => {
	const result = await (await import("./mission-host.node-ChhwuCxr.mjs")).stopMission(data.missionId, "The user stopped it.");
	return {
		stopped: result.stopped,
		released: result.released,
		detail: result.stopped ? result.released ? "OCADE stopped and let go of the keyboard and mouse." : "OCADE stopped." : "There was nothing running."
	};
});
var stopAllLocalMissionsFn_createServerFn_handler = createServerRpc({
	id: "3b8e2278bb63ac1ad74d4e06b12183e4b917b8db1c974c5402ac619efdb4b9a4",
	name: "stopAllLocalMissionsFn",
	filename: "src/lib/control-work.functions.ts"
}, (opts) => stopAllLocalMissionsFn.__executeServer(opts));
var stopAllLocalMissionsFn = createServerFn({ method: "POST" }).validator(objectType({ reason: stringType().max(200).default("Stopped.") })).handler(stopAllLocalMissionsFn_createServerFn_handler, async ({ data }) => {
	const stopped = await (await import("./mission-host.node-ChhwuCxr.mjs")).stopAllMissions(data.reason);
	return {
		stopped,
		detail: stopped > 0 ? "OCADE stopped and let go of the keyboard and mouse." : "Nothing was running."
	};
});
var missionAudioInputsFn_createServerFn_handler = createServerRpc({
	id: "5996baae65accddfe160fa2af29e2a1eb4cd3065e4642d01492a2ae9f5fb0e2a",
	name: "missionAudioInputsFn",
	filename: "src/lib/control-work.functions.ts"
}, (opts) => missionAudioInputsFn.__executeServer(opts));
var missionAudioInputsFn = createServerFn({ method: "POST" }).validator(objectType({ missionId: stringType().min(1).max(64) })).handler(missionAudioInputsFn_createServerFn_handler, async ({ data }) => {
	const mission = (await import("./mission-host.node-ChhwuCxr.mjs")).findMission(data.missionId);
	if (!mission) return {
		ok: false,
		devices: [],
		selected: null,
		micEnabled: false,
		detail: "That session has ended."
	};
	const result = await mission.adapters.audioInputs();
	return {
		ok: true,
		...result,
		detail: `${result.devices.length} microphone(s).`
	};
});
var missionMicFn_createServerFn_handler = createServerRpc({
	id: "425d1b14490a9fe5d8d76e87a9e961e6445ec5b65e00a20ce3b87d2c0edf5687",
	name: "missionMicFn",
	filename: "src/lib/control-work.functions.ts"
}, (opts) => missionMicFn.__executeServer(opts));
var missionMicFn = createServerFn({ method: "POST" }).validator(objectType({
	missionId: stringType().min(1).max(64),
	enabled: booleanType().optional(),
	deviceId: numberType().int().min(0).max(512).nullable().optional()
})).handler(missionMicFn_createServerFn_handler, async ({ data }) => {
	const mission = (await import("./mission-host.node-ChhwuCxr.mjs")).findMission(data.missionId);
	if (!mission) return {
		ok: false,
		micEnabled: false,
		deviceId: null,
		listening: false,
		detail: "That session has ended."
	};
	const result = await mission.adapters.setMic({
		enabled: data.enabled,
		deviceId: data.deviceId
	});
	mission.adapters.setBargeIn(result.micEnabled).catch(() => {});
	return result;
});
var missionSpeakFn_createServerFn_handler = createServerRpc({
	id: "7c9d48e580a74ea2bda34ce1a0d61fa715731edcf402b3f4dfab8fbdc99803c7",
	name: "missionSpeakFn",
	filename: "src/lib/control-work.functions.ts"
}, (opts) => missionSpeakFn.__executeServer(opts));
var missionSpeakFn = createServerFn({ method: "POST" }).validator(objectType({
	missionId: stringType().min(1).max(64),
	text: stringType().min(1).max(1200),
	language: stringType().max(8).optional()
})).handler(missionSpeakFn_createServerFn_handler, async ({ data }) => {
	const mission = (await import("./mission-host.node-ChhwuCxr.mjs")).findMission(data.missionId);
	if (!mission) return {
		ok: false,
		detail: "That session has ended."
	};
	const outcome = await mission.adapters.speak(data.text, data.language ?? "en");
	return {
		ok: outcome.kind === "success",
		detail: outcome.detail
	};
});
var refreshMemoryFn_createServerFn_handler = createServerRpc({
	id: "10b9787e08588fe9937f6a114b037459dcfae2f93dff336e695141f3ad91c6a4",
	name: "refreshMemoryFn",
	filename: "src/lib/control-work.functions.ts"
}, (opts) => refreshMemoryFn.__executeServer(opts));
var refreshMemoryFn = createServerFn({ method: "POST" }).validator(objectType({ missionId: stringType().min(1).max(64) })).handler(refreshMemoryFn_createServerFn_handler, async ({ data }) => {
	const mission = (await import("./mission-host.node-ChhwuCxr.mjs")).findMission(data.missionId);
	if (!mission) return {
		ok: false,
		context: "",
		assistantName: "OCADE",
		address: ""
	};
	const memory = await mission.adapters.memoryContext();
	if (!memory) return {
		ok: false,
		context: "",
		assistantName: "OCADE",
		address: ""
	};
	return {
		ok: true,
		context: memory.context,
		assistantName: memory.assistantName,
		address: memory.address
	};
});
//#endregion
export { missionAudioInputsFn_createServerFn_handler, missionMicFn_createServerFn_handler, missionSpeakFn_createServerFn_handler, refreshMemoryFn_createServerFn_handler, runControlActionFn_createServerFn_handler, startMissionFn_createServerFn_handler, stopAllLocalMissionsFn_createServerFn_handler, stopMissionFn_createServerFn_handler };

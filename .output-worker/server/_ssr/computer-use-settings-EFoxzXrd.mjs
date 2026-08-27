//#region node_modules/.nitro/vite/services/ssr/assets/computer-use-settings-EFoxzXrd.js
var COMPUTER_USE_SETTINGS_KEY = "ocade:computer-use:v1";
var DEFAULT_COMPUTER_USE_SETTINGS = {
	enabled: false,
	webControl: false,
	thisComputer: false,
	pairedDevices: false,
	backgroundTasks: false,
	remoteSessions: false,
	recordingMode: "off",
	replayEnabled: false,
	defaultPermission: "ask_every_mutation",
	allowanceMinutes: 30,
	protectedInputs: true
};
var PERMISSIONS = /* @__PURE__ */ new Set([
	"blocked",
	"read_only",
	"ask_every_mutation",
	"ask_risky",
	"bounded_workflow",
	"session_allowance",
	"time_limited",
	"always_selected_low_risk"
]);
var RECORDING_MODES = /* @__PURE__ */ new Set([
	"off",
	"receipts_only",
	"approved_replay"
]);
function isBoolean(value) {
	return typeof value === "boolean";
}
function normalizeComputerUseSettings(value) {
	const candidate = value && typeof value === "object" ? value : {};
	const permission = candidate.defaultPermission;
	const recordingMode = candidate.recordingMode;
	const minutes = typeof candidate.allowanceMinutes === "number" && Number.isInteger(candidate.allowanceMinutes) && candidate.allowanceMinutes >= 5 && candidate.allowanceMinutes <= 480 ? candidate.allowanceMinutes : DEFAULT_COMPUTER_USE_SETTINGS.allowanceMinutes;
	return {
		enabled: isBoolean(candidate.enabled) ? candidate.enabled : DEFAULT_COMPUTER_USE_SETTINGS.enabled,
		webControl: isBoolean(candidate.webControl) ? candidate.webControl : DEFAULT_COMPUTER_USE_SETTINGS.webControl,
		thisComputer: isBoolean(candidate.thisComputer) ? candidate.thisComputer : DEFAULT_COMPUTER_USE_SETTINGS.thisComputer,
		pairedDevices: isBoolean(candidate.pairedDevices) ? candidate.pairedDevices : DEFAULT_COMPUTER_USE_SETTINGS.pairedDevices,
		backgroundTasks: isBoolean(candidate.backgroundTasks) ? candidate.backgroundTasks : DEFAULT_COMPUTER_USE_SETTINGS.backgroundTasks,
		remoteSessions: isBoolean(candidate.remoteSessions) ? candidate.remoteSessions : DEFAULT_COMPUTER_USE_SETTINGS.remoteSessions,
		recordingMode: typeof recordingMode === "string" && RECORDING_MODES.has(recordingMode) ? recordingMode : DEFAULT_COMPUTER_USE_SETTINGS.recordingMode,
		replayEnabled: isBoolean(candidate.replayEnabled) ? candidate.replayEnabled : DEFAULT_COMPUTER_USE_SETTINGS.replayEnabled,
		defaultPermission: typeof permission === "string" && PERMISSIONS.has(permission) ? permission : DEFAULT_COMPUTER_USE_SETTINGS.defaultPermission,
		allowanceMinutes: minutes,
		protectedInputs: true
	};
}
function loadComputerUseSettings(storage = typeof window === "undefined" ? null : window.localStorage) {
	if (!storage) return { ...DEFAULT_COMPUTER_USE_SETTINGS };
	try {
		const raw = storage.getItem(COMPUTER_USE_SETTINGS_KEY);
		return raw ? normalizeComputerUseSettings(JSON.parse(raw)) : { ...DEFAULT_COMPUTER_USE_SETTINGS };
	} catch {
		return { ...DEFAULT_COMPUTER_USE_SETTINGS };
	}
}
function persistComputerUseSettings(settings, storage = typeof window === "undefined" ? null : window.localStorage) {
	if (!storage) return {
		ok: false,
		error: "Computer Use settings could not be saved in this runtime."
	};
	try {
		storage.setItem(COMPUTER_USE_SETTINGS_KEY, JSON.stringify(normalizeComputerUseSettings(settings)));
		return { ok: true };
	} catch {
		return {
			ok: false,
			error: "Computer Use settings could not be saved on this device."
		};
	}
}
function effectiveComputerUseChannels(settings) {
	const active = settings.enabled;
	return {
		webControl: active && settings.webControl,
		thisComputer: active && settings.thisComputer,
		pairedDevices: active && settings.pairedDevices,
		backgroundTasks: active && settings.backgroundTasks,
		remoteSessions: active && settings.remoteSessions
	};
}
/** Fail-closed user-facing gate for an applicable Computer Use channel. */
function computerUseChannelDecision(channel, settings = loadComputerUseSettings()) {
	if (!settings.enabled) return "Computer Use is off. Enable it in Settings before OCADE can act.";
	if (!effectiveComputerUseChannels(settings)[channel]) return `${{
		webControl: "Web Control",
		thisComputer: "This Computer",
		pairedDevices: "Paired Devices",
		backgroundTasks: "Background Tasks",
		remoteSessions: "Remote Sessions"
	}[channel]} is off in Computer Use settings.`;
	return null;
}
/**
* Apply the two default modes that can refuse immediately. Other modes define
* how approval is requested; they never grant execution by themselves.
*/
function computerUsePermissionDecision(risk, settings = loadComputerUseSettings()) {
	if (settings.defaultPermission === "blocked") return "Computer Use permissions are set to Blocked.";
	if (settings.defaultPermission === "read_only" && risk !== "read_only") return "Computer Use permissions are Read-only, so this action cannot change anything.";
	return null;
}
//#endregion
export { persistComputerUseSettings as a, normalizeComputerUseSettings as i, computerUsePermissionDecision as n, loadComputerUseSettings as r, computerUseChannelDecision as t };

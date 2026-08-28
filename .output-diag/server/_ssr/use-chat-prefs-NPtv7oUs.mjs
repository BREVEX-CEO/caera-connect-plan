import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-chat-prefs-NPtv7oUs.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var DEFAULT_CHAT_PREFS = {
	defaultEngineTier: "auto",
	sendKey: "enter",
	showTimestamps: false,
	density: "comfortable",
	renderMarkdown: true,
	keepDrafts: true,
	showDiagnostics: false,
	thinking: true,
	research: true
};
var KEY = "ocade.chat.prefs.v1";
var TIERS = ["auto", "local"];
var SEND_KEYS = ["enter", "mod_enter"];
var DENSITIES = ["comfortable", "compact"];
/** Total parse: unknown or corrupt input yields defaults, never an exception. */
function parseChatPrefs(raw) {
	if (!raw) return { ...DEFAULT_CHAT_PREFS };
	try {
		const p = JSON.parse(raw);
		const bool = (key) => typeof p[key] === "boolean" ? p[key] : DEFAULT_CHAT_PREFS[key] === true;
		return {
			defaultEngineTier: TIERS.includes(p.defaultEngineTier) ? p.defaultEngineTier : DEFAULT_CHAT_PREFS.defaultEngineTier,
			sendKey: SEND_KEYS.includes(p.sendKey) ? p.sendKey : DEFAULT_CHAT_PREFS.sendKey,
			showTimestamps: bool("showTimestamps"),
			density: DENSITIES.includes(p.density) ? p.density : DEFAULT_CHAT_PREFS.density,
			renderMarkdown: bool("renderMarkdown"),
			keepDrafts: bool("keepDrafts"),
			research: bool("research"),
			showDiagnostics: bool("showDiagnostics"),
			thinking: bool("thinking")
		};
	} catch {
		return { ...DEFAULT_CHAT_PREFS };
	}
}
/** Persist one exact snapshot, and report failure instead of implying success. */
function saveChatPrefs(storage, prefs) {
	try {
		storage.setItem(KEY, JSON.stringify(prefs));
		return { ok: true };
	} catch {
		return {
			ok: false,
			reason: "OCADE couldn't save chat settings in this browser. Your previous settings are still active."
		};
	}
}
function readChatPrefs() {
	if (typeof window === "undefined") return { ...DEFAULT_CHAT_PREFS };
	try {
		return parseChatPrefs(window.localStorage.getItem(KEY));
	} catch {
		return { ...DEFAULT_CHAT_PREFS };
	}
}
function useChatPrefs() {
	const [state, setState] = (0, import_react.useState)(() => ({
		prefs: readChatPrefs(),
		storageError: null
	}));
	const update = (0, import_react.useCallback)((patch) => {
		setState((current) => {
			const next = parseChatPrefs(JSON.stringify({
				...current.prefs,
				...patch
			}));
			if (typeof window === "undefined") return {
				prefs: next,
				storageError: null
			};
			const saved = saveChatPrefs(window.localStorage, next);
			return saved.ok ? {
				prefs: next,
				storageError: null
			} : {
				prefs: current.prefs,
				storageError: saved.reason
			};
		});
	}, []);
	const reset = (0, import_react.useCallback)(() => update({ ...DEFAULT_CHAT_PREFS }), [update]);
	return {
		prefs: state.prefs,
		update,
		reset,
		storageError: state.storageError
	};
}
//#endregion
export { useChatPrefs as n, readChatPrefs as t };

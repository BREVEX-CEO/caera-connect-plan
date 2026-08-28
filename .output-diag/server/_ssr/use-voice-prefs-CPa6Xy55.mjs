import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-voice-prefs-CPa6Xy55.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var DEFAULT_VOICE_PREFS = {
	gender: "unknown",
	voiceName: null,
	rate: 1,
	pitch: 1,
	language: "en-US",
	wakeEnabled: false,
	captionsEnabled: true,
	autoSpeak: false,
	muted: false,
	addressStyle: "first_name",
	preferredName: "",
	preferredTitle: "",
	greetingEnabled: true,
	microphoneId: "",
	outputId: ""
};
var KEY = "caera:voice:v1";
var MAX_DEVICE_ID = 160;
function clampNumber(n, lo, hi, fallback) {
	return Math.min(hi, Math.max(lo, typeof n === "number" && Number.isFinite(n) ? n : fallback));
}
/** Merge stored JSON over defaults, rejecting malformed values. */
function parseVoicePrefs(raw) {
	if (!raw) return { ...DEFAULT_VOICE_PREFS };
	try {
		const p = JSON.parse(raw);
		const bool = (key) => typeof p[key] === "boolean" ? p[key] : DEFAULT_VOICE_PREFS[key];
		const boundedString = (value, fallback, max) => typeof value === "string" ? value.slice(0, max) : fallback;
		const addressStyles = [
			"first_name",
			"full_name",
			"custom_title",
			"none"
		];
		const language = typeof p.language === "string" && /^[a-z]{2,3}(?:-[a-z0-9]{2,8})*$/i.test(p.language) && p.language.length <= 35 ? p.language : DEFAULT_VOICE_PREFS.language;
		return {
			gender: p.gender === "male" || p.gender === "female" ? p.gender : "unknown",
			voiceName: p.voiceName === null ? null : boundedString(p.voiceName, "", 160) || DEFAULT_VOICE_PREFS.voiceName,
			rate: clampNumber(p.rate, .5, 2, 1),
			pitch: clampNumber(p.pitch, .5, 2, 1),
			language,
			wakeEnabled: bool("wakeEnabled"),
			captionsEnabled: bool("captionsEnabled"),
			autoSpeak: bool("autoSpeak"),
			muted: bool("muted"),
			addressStyle: addressStyles.includes(p.addressStyle) ? p.addressStyle : DEFAULT_VOICE_PREFS.addressStyle,
			preferredName: typeof p.preferredName === "string" ? p.preferredName.slice(0, 80) : "",
			preferredTitle: typeof p.preferredTitle === "string" ? p.preferredTitle.slice(0, 40) : "",
			greetingEnabled: bool("greetingEnabled"),
			microphoneId: boundedString(p.microphoneId, DEFAULT_VOICE_PREFS.microphoneId, MAX_DEVICE_ID),
			outputId: boundedString(p.outputId, DEFAULT_VOICE_PREFS.outputId, MAX_DEVICE_ID)
		};
	} catch {
		return { ...DEFAULT_VOICE_PREFS };
	}
}
/** Persist one exact snapshot and report failure instead of implying success. */
function saveVoicePrefs(storage, prefs) {
	try {
		storage.setItem(KEY, JSON.stringify(prefs));
		return { ok: true };
	} catch {
		return {
			ok: false,
			reason: "OCADE couldn't save voice settings in this browser. The previous settings remain active."
		};
	}
}
function useVoicePrefs() {
	const [state, setState] = (0, import_react.useState)(() => {
		if (typeof window === "undefined") return {
			prefs: { ...DEFAULT_VOICE_PREFS },
			storageError: null
		};
		try {
			return {
				prefs: parseVoicePrefs(window.localStorage.getItem(KEY)),
				storageError: null
			};
		} catch {
			return {
				prefs: { ...DEFAULT_VOICE_PREFS },
				storageError: "OCADE couldn't read voice settings from this browser."
			};
		}
	});
	const update = (0, import_react.useCallback)((patch) => {
		setState((current) => {
			const next = parseVoicePrefs(JSON.stringify({
				...current.prefs,
				...patch
			}));
			if (typeof window === "undefined") return {
				prefs: next,
				storageError: null
			};
			const saved = saveVoicePrefs(window.localStorage, next);
			return saved.ok ? {
				prefs: next,
				storageError: null
			} : {
				prefs: current.prefs,
				storageError: saved.reason
			};
		});
	}, []);
	/** Emergency mute: stop speech immediately and keep it off. */
	const emergencyMute = (0, import_react.useCallback)(() => {
		if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
		update({
			muted: true,
			autoSpeak: false
		});
	}, [update]);
	return {
		prefs: state.prefs,
		update,
		emergencyMute,
		storageError: state.storageError
	};
}
/**
* Enumerate audio devices. Labels are only exposed by browsers after microphone
* permission is granted, so unlabeled entries are reported honestly rather than
* given invented names.
*/
async function listAudioDevices() {
	if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return {
		inputs: [],
		outputs: []
	};
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		const map = (d, i) => ({
			deviceId: d.deviceId,
			label: d.label || `Device ${i + 1} (name hidden until microphone access is allowed)`
		});
		return {
			inputs: devices.filter((d) => d.kind === "audioinput").map(map),
			outputs: devices.filter((d) => d.kind === "audiooutput").map(map)
		};
	} catch {
		return {
			inputs: [],
			outputs: []
		};
	}
}
//#endregion
export { useVoicePrefs as n, listAudioDevices as t };

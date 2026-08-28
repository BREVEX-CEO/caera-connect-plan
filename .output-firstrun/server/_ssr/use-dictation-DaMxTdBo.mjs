import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { c as thinkingFor, r as deliberationClause } from "./fixed-model-DezWsm1J.mjs";
import { t as useBrain } from "./use-brain-L-NMaObN.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-dictation-DaMxTdBo.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function refuse(code, reason, remedies = []) {
	return {
		ok: false,
		target: null,
		reason,
		code,
		remedies,
		needsCloudApproval: false,
		consumesAllowance: false
	};
}
function chooseLocal(label) {
	return {
		ok: true,
		target: {
			kind: "local",
			label
		},
		reason: null,
		code: null,
		remedies: [],
		needsCloudApproval: false,
		consumesAllowance: false
	};
}
/** Remedies that would make an on-device engine appear, per device mode. */
function localRemedies(mode) {
	switch (mode) {
		case "pc_web": return ["install_ocade", "download_model"];
		case "mobile_web":
		case "mobile_app": return ["pair_a_computer"];
		case "pc_web_paired": return ["start_engine"];
		case "desktop_app": return ["start_engine", "download_model"];
		default: return [];
	}
}
/**
* Decide where one request runs.
*
* Never throws, never returns a partial answer, and never picks cloud without
* having checked every condition that could forbid it.
*/
function resolveEngine(context) {
	if (context.localAvailable && (!context.visionRequired || context.localVision)) return chooseLocal(context.localLabel ?? "OCADE Local");
	if (context.preference === "local_only") {
		if (context.visionRequired && context.localAvailable && !context.localVision) return refuse("vision_unavailable_locally", "This device's engine cannot read images, and OCADE is set to stay on this device.", ["download_model"]);
		return refuse("local_only_and_no_local_engine", "No engine is available on this device, and OCADE is set never to use the cloud.", localRemedies(context.deviceMode));
	}
	if (!context.localAvailable) return refuse(context.online ? "local_engine_preparing" : "offline_and_no_local_engine", context.online ? "OCADE is still preparing its on-device intelligence. This finishes on its own — no setup needed — and Chat will answer as soon as it is ready." : "OCADE has no on-device engine yet and this device is offline. Reconnect once and OCADE will prepare itself; after that it works without a connection.", localRemedies(context.deviceMode));
	if (context.visionRequired && !context.localVision) return refuse("vision_unavailable_locally", "OCADE's on-device engine cannot read images yet. Describe what is in the picture and OCADE can work from that.", ["download_model"]);
	return refuse("local_engine_unavailable", "OCADE could not start its on-device engine for this request.", localRemedies(context.deviceMode));
}
var INITIAL = {
	status: "idle",
	label: null,
	reason: null,
	remedies: [],
	progress: null,
	thinkingDegraded: false
};
function useLocalChatEngine(context = {}) {
	const brain = useBrain();
	const [state, setState] = (0, import_react.useState)(INITIAL);
	const abortRef = (0, import_react.useRef)(null);
	/**
	* The background request, held separately from the user's.
	*
	* Two refs rather than one because the two directions are not symmetric: a
	* background send must never cancel the person, and the person must always
	* cancel the background send. One shared ref can only express the first half.
	*/
	const backgroundRef = (0, import_react.useRef)(null);
	const liveRef = (0, import_react.useRef)(true);
	(0, import_react.useEffect)(() => {
		liveRef.current = true;
		return () => {
			liveRef.current = false;
			abortRef.current?.abort();
			backgroundRef.current?.abort();
		};
	}, []);
	const apply = (0, import_react.useCallback)((next) => {
		if (!liveRef.current) return;
		setState((prev) => ({
			...prev,
			...next
		}));
	}, []);
	const { preference = "auto", privacyMode = "private_sync", visionRequired: contextVision = false, surface: contextSurface = "chat", thinking: contextThinking } = context;
	const decide = (0, import_react.useCallback)(async (visionRequired) => {
		const outcome = await brain.route({ visionRequired });
		const localAvailable = outcome.ok;
		return {
			outcome,
			decision: resolveEngine({
				preference,
				privacyMode,
				deviceMode: brain.mode,
				localAvailable,
				localLabel: outcome.ok ? outcome.availability.label : null,
				localVision: outcome.ok ? Boolean(outcome.availability.capabilities?.vision) : false,
				visionRequired,
				online: typeof navigator === "undefined" ? true : navigator.onLine
			})
		};
	}, [
		brain,
		preference,
		privacyMode
	]);
	return {
		state,
		check: (0, import_react.useCallback)(async () => {
			apply({
				status: "checking",
				reason: null,
				remedies: []
			});
			const { outcome, decision } = await decide(contextVision);
			if (!liveRef.current) return;
			if (decision.ok && decision.target?.kind === "local" && outcome.ok) {
				apply({
					status: "ready",
					label: decision.target.label,
					reason: null,
					remedies: [],
					progress: null
				});
				return;
			}
			apply({
				status: "unavailable",
				label: null,
				reason: decision.reason ?? (outcome.ok ? null : outcome.reason),
				remedies: decision.remedies.length > 0 ? decision.remedies : outcome.ok ? [] : outcome.remedies,
				progress: null
			});
		}, [
			apply,
			decide,
			contextVision
		]),
		send: (0, import_react.useCallback)(async ({ messages, onToken, tools, onToolCall, background = false }) => {
			const controller = new AbortController();
			const report = background ? () => {} : apply;
			const claim = (next) => {
				if (background) backgroundRef.current = next;
				else abortRef.current = next;
			};
			backgroundRef.current?.abort();
			backgroundRef.current = null;
			if (!background) abortRef.current?.abort();
			claim(controller);
			report({
				status: "checking",
				reason: null,
				remedies: []
			});
			const { outcome, decision } = await decide(contextVision);
			if (!liveRef.current) return {
				ok: false,
				cancelled: true
			};
			if (controller.signal.aborted) {
				claim(null);
				report({
					status: "ready",
					progress: null
				});
				return {
					ok: false,
					cancelled: true,
					reason: "Stopped by the user."
				};
			}
			if (!decision.ok || decision.target?.kind !== "local" || !outcome.ok) {
				const reason = decision.reason ?? (outcome.ok ? "No on-device engine can serve this." : outcome.reason);
				report({
					status: "unavailable",
					label: null,
					reason,
					remedies: decision.remedies.length > 0 ? decision.remedies : outcome.ok ? [] : outcome.remedies
				});
				claim(null);
				return {
					ok: false,
					reason
				};
			}
			report({
				status: "generating",
				label: outcome.availability.label,
				reason: null,
				remedies: []
			});
			const wanted = thinkingFor(contextSurface, contextThinking);
			const engineAllows = outcome.availability.thinkingSuitable !== false;
			const deliberate = wanted && engineAllows;
			report({ thinkingDegraded: wanted && !engineAllows });
			const withDeliberation = messages.map((message, index) => index === 0 && message.role === "system" ? {
				...message,
				content: `${message.content}${deliberationClause(deliberate)}`
			} : message);
			let sawToken = false;
			const result = await outcome.adapter.stream(withDeliberation, {
				signal: controller.signal,
				...tools?.length ? { tools } : {},
				...onToolCall ? { onToolCall } : {},
				think: deliberate,
				onToken: (chunk) => {
					if (!sawToken) {
						sawToken = true;
						report({ status: "generating" });
					}
					onToken(chunk);
				}
			});
			claim(null);
			if (!liveRef.current) return {
				ok: false,
				cancelled: true
			};
			if (result.ok) {
				report({
					status: "ready",
					progress: null
				});
				return { ok: true };
			}
			if (result.failure === "cancelled") {
				report({
					status: "ready",
					progress: null
				});
				return {
					ok: false,
					cancelled: true,
					reason: result.reason
				};
			}
			report({
				status: "unavailable",
				reason: result.reason,
				remedies: [],
				progress: null
			});
			return {
				ok: false,
				reason: result.reason
			};
		}, [
			apply,
			decide,
			contextVision,
			contextSurface,
			contextThinking
		]),
		stop: (0, import_react.useCallback)(() => {
			abortRef.current?.abort();
			abortRef.current = null;
			backgroundRef.current?.abort();
			backgroundRef.current = null;
			apply({
				status: "ready",
				progress: null
			});
		}, [apply]),
		warm: (0, import_react.useCallback)(() => {
			brain.warm();
		}, [brain]),
		remedyLabel: brain.remedyLabel
	};
}
/**
* Candidates, not promises.
*
* Indian languages lead because that is where this product's first users are,
* and because they are the ones a hard-coded English-only list failed hardest.
* Presence here means OCADE will look for support; `probeLanguage` decides
* whether it found any.
*/
var LANGUAGE_CANDIDATES = [
	{
		code: "en",
		label: "English",
		nativeLabel: "English",
		preferredTag: "en-US"
	},
	{
		code: "hi",
		label: "Hindi",
		nativeLabel: "हिन्दी",
		preferredTag: "hi-IN"
	},
	{
		code: "ta",
		label: "Tamil",
		nativeLabel: "தமிழ்",
		preferredTag: "ta-IN"
	},
	{
		code: "te",
		label: "Telugu",
		nativeLabel: "తెలుగు",
		preferredTag: "te-IN"
	},
	{
		code: "bn",
		label: "Bengali",
		nativeLabel: "বাংলা",
		preferredTag: "bn-IN"
	},
	{
		code: "mr",
		label: "Marathi",
		nativeLabel: "मराठी",
		preferredTag: "mr-IN"
	},
	{
		code: "gu",
		label: "Gujarati",
		nativeLabel: "ગુજરાતી",
		preferredTag: "gu-IN"
	},
	{
		code: "kn",
		label: "Kannada",
		nativeLabel: "ಕನ್ನಡ",
		preferredTag: "kn-IN"
	},
	{
		code: "ml",
		label: "Malayalam",
		nativeLabel: "മലയാളം",
		preferredTag: "ml-IN"
	},
	{
		code: "pa",
		label: "Punjabi",
		nativeLabel: "ਪੰਜਾਬੀ",
		preferredTag: "pa-IN"
	},
	{
		code: "ur",
		label: "Urdu",
		nativeLabel: "اردو",
		preferredTag: "ur-IN"
	},
	{
		code: "es",
		label: "Spanish",
		nativeLabel: "Español",
		preferredTag: "es-ES"
	},
	{
		code: "fr",
		label: "French",
		nativeLabel: "Français",
		preferredTag: "fr-FR"
	},
	{
		code: "de",
		label: "German",
		nativeLabel: "Deutsch",
		preferredTag: "de-DE"
	},
	{
		code: "pt",
		label: "Portuguese",
		nativeLabel: "Português",
		preferredTag: "pt-BR"
	},
	{
		code: "ar",
		label: "Arabic",
		nativeLabel: "العربية",
		preferredTag: "ar-SA"
	},
	{
		code: "zh",
		label: "Chinese",
		nativeLabel: "中文",
		preferredTag: "zh-CN"
	},
	{
		code: "ja",
		label: "Japanese",
		nativeLabel: "日本語",
		preferredTag: "ja-JP"
	}
];
/** Is a speech-recognition API present at all? */
function speechRecognitionAvailable(scope = globalThis) {
	const w = scope;
	return typeof w?.SpeechRecognition === "function" || typeof w?.webkitSpeechRecognition === "function";
}
/**
* Turn the recogniser's error codes into something a person can act on.
*
* Exported because the chat composer has its own recogniser — one that adds
* secret redaction, live captions and the wake phrase — and its `onerror`
* handler used to reset the button and say nothing at all. Pressing the
* microphone and having it quietly go out is the worst version of this: a
* denied permission, an absent microphone and an unreachable recogniser look
* identical, and none of them look like anything.
*/
function describeRecognitionError(code) {
	switch (code) {
		case "not-allowed":
		case "service-not-allowed": return "OCADE needs permission to use your microphone. Allow it in your browser's address bar, then try again.";
		case "audio-capture": return "No microphone was found. Check that one is connected and selected in your system settings.";
		case "network": return "Speech recognition in this browser needs a connection, and OCADE could not reach it. Typing still works offline.";
		case "no-speech": return "OCADE did not hear anything. Try again a little closer to the microphone.";
		case "aborted": return "Dictation stopped.";
		default: return "Dictation stopped unexpectedly. Try again, or type instead.";
	}
}
function useDictation(options) {
	const { lang, onTranscript, autoSend = false, onAutoSend } = options;
	const [state, setState] = (0, import_react.useState)("idle");
	const [error, setError] = (0, import_react.useState)(null);
	const recognitionRef = (0, import_react.useRef)(null);
	const transcriptRef = (0, import_react.useRef)(onTranscript);
	const autoSendRef = (0, import_react.useRef)(onAutoSend);
	const langRef = (0, import_react.useRef)(lang);
	transcriptRef.current = onTranscript;
	autoSendRef.current = onAutoSend;
	langRef.current = lang;
	const supported = typeof window !== "undefined" && speechRecognitionAvailable(window);
	(0, import_react.useEffect)(() => {
		if (!supported) setState("unsupported");
	}, [supported]);
	(0, import_react.useEffect)(() => () => {
		recognitionRef.current?.abort();
		recognitionRef.current = null;
	}, []);
	const stop = (0, import_react.useCallback)(() => {
		recognitionRef.current?.stop();
		recognitionRef.current = null;
		setState((prev) => prev === "unsupported" ? prev : "idle");
	}, []);
	const start = (0, import_react.useCallback)(() => {
		if (!supported || recognitionRef.current) return;
		setError(null);
		const w = window;
		const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
		if (!Ctor) {
			setState("unsupported");
			return;
		}
		const recognition = new Ctor();
		recognition.lang = langRef.current;
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.maxAlternatives = 1;
		recognition.onstart = () => setState("listening");
		recognition.onresult = (event) => {
			let finalText = "";
			let interimText = "";
			for (let i = event.resultIndex; i < event.results.length; i += 1) {
				const result = event.results[i];
				const text = result[0]?.transcript ?? "";
				if (result.isFinal) finalText += text;
				else interimText += text;
			}
			const combined = (finalText + interimText).trim();
			if (combined) setState("hearing");
			transcriptRef.current(combined, finalText.length > 0 && interimText.length === 0);
			if (autoSend && finalText.trim() && !interimText) autoSendRef.current?.(finalText.trim());
		};
		recognition.onerror = (event) => {
			if (event.error === "aborted") return;
			setError(describeRecognitionError(event.error));
			setState("error");
			recognitionRef.current = null;
		};
		recognition.onend = () => {
			recognitionRef.current = null;
			setState((prev) => prev === "error" || prev === "unsupported" ? prev : "idle");
		};
		recognitionRef.current = recognition;
		try {
			recognition.start();
		} catch {
			setState("listening");
		}
	}, [supported, autoSend]);
	return {
		state,
		error,
		supported,
		start,
		stop,
		toggle: (0, import_react.useCallback)(() => {
			if (recognitionRef.current) stop();
			else start();
		}, [start, stop])
	};
}
//#endregion
export { useLocalChatEngine as a, useDictation as i, describeRecognitionError as n, resolveEngine as r, LANGUAGE_CANDIDATES as t };

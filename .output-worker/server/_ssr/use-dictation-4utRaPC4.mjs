import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-dictation-4utRaPC4.js
var import_react = /* @__PURE__ */ __toESM(require_react());
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
/** Turn the recogniser's error codes into something a person can act on. */
function describeError(code) {
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
			setError(describeError(event.error));
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
export { useDictation as n, LANGUAGE_CANDIDATES as t };

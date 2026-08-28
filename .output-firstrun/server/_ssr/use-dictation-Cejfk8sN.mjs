import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { c as thinkingFor, r as deliberationClause } from "./fixed-model-DezWsm1J.mjs";
import { t as REMEDY_LABELS } from "./adapter-BHZ2v_VZ.mjs";
import { t as DesktopBridgeAdapter } from "./desktop-bridge-D6zQ9cYu.mjs";
import { t as PairedDesktopAdapter } from "./paired-desktop-BmU9OPp9.mjs";
import { n as serverIsThisMachine, r as useDevicePolicy } from "./use-device-policy-3_-2tPN5.mjs";
import { t as installationAuthority } from "./installation-browser-uqj4-qxw.mjs";
import { n as hasPairing, r as pairedCredentials } from "./paired-credentials-DTehWMvo.mjs";
import { t as authorityBackedAdapter } from "./runtime-activation-Da4gjBZz.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-dictation-Cejfk8sN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
function resolveDeviceMode(signals) {
	if (signals.isDesktopApp) return "desktop_app";
	if (signals.isMobileApp) return "mobile_app";
	if (signals.isMobileBrowser) return "mobile_web";
	return signals.hasPairedDesktop ? "pc_web_paired" : "pc_web";
}
/**
* Preference order per device mode.
*
* Read these as "try in this order, take the first that probes ready".
*
* THE REASONING, mode by mode:
*
*  - `desktop_app` owns a real engine on real hardware, so the bridge leads and
*    normally wins on the first probe. The browser engines sit BEHIND it as a
*    fallback, because "owns an engine" is only true while that engine is
*    running. See the note below on why they are there.
*  - `pc_web_paired` prefers the paired desktop because it is the same user's
*    own machine running a far larger model than a browser can hold. The
*    browser engines remain behind it so unplugging the desktop degrades
*    rather than breaks.
*  - `pc_web` has only the browser. WebGPU first because it is an order of
*    magnitude faster than WebAssembly; WASM exists so a browser without
*    WebGPU is still served rather than turned away.
*  - `mobile_app` prefers the paired desktop FOR HEAVY WORK — a phone should
*    not melt to answer a question the user's own laptop can take — and falls
*    back to its native model so the phone still works with no network.
*  - `mobile_web` is the weakest position, and its order says so.
*
* WHY THE PACKAGED SHELLS ALSO LIST THE BROWSER ENGINES.
*
* They used to list only their native adapter, on the reasoning that an app
* which ships an engine never needs a browser one. That reasoning holds for the
* happy path and fails for every other one: an engine that has not been started,
* has not finished installing, or has crashed leaves the list empty, the route
* refused and the composer disabled — while the very same shell is a webview
* that can run WebGPU inference right now. `mobile_app` was worse: it listed
* `mobile_native`, which THIS BUILD DOES NOT REGISTER, so a phone with no
* pairing had zero reachable adapters and could never answer at all.
*
* Found in the running app: local development takes the `serverIsThisMachine`
* path into `desktop_app`, and the demo showed "This browser cannot run an
* on-device engine" with a dead send button on a machine where both browser
* adapters probed available.
*
* This costs nothing when the native engine is healthy — it probes first and
* wins, and neither browser library is loaded unless it is actually routed to.
* It changes nothing about privacy either: both are `locality: "on_device"`, so
* the fallback keeps the conversation on the same machine it was already on.
*
* CLOUD IS NEVER IN THIS LIST. It is not a fallback; it is a separate decision
* the user makes explicitly, handled by the caller. Putting it here is how a
* local-first product quietly becomes a cloud product.
*/
var ADAPTER_PREFERENCE = {
	desktop_app: [
		"desktop_bridge",
		"browser_webgpu",
		"browser_wasm"
	],
	pc_web_paired: [
		"paired_desktop",
		"browser_webgpu",
		"browser_wasm"
	],
	pc_web: ["browser_webgpu", "browser_wasm"],
	mobile_app: [
		"paired_desktop",
		"mobile_native",
		"browser_webgpu",
		"browser_wasm"
	],
	mobile_web: ["browser_webgpu", "browser_wasm"]
};
/**
* Heavy work belongs on the biggest machine available.
*
* A phone CAN answer "what is the capital of Japan" locally in a second. It
* should not be asked to summarise a forty-page document while the user's
* paired laptop sits idle — that is the difference between a warm phone and a
* phone that shuts down mid-answer.
*/
function preferenceFor(mode, heavy) {
	const order = ADAPTER_PREFERENCE[mode];
	if (mode !== "mobile_app" || heavy) return order;
	return [
		"mobile_native",
		"paired_desktop",
		"browser_webgpu",
		"browser_wasm"
	];
}
/** Read the real signals from the running environment. */
function detectDeviceSignals(hasPairedDesktop) {
	const w = typeof window === "undefined" ? void 0 : window;
	const isDesktopApp = !!w?.__TAURI__ || !!w?.__OCADE_DESKTOP__;
	const isMobileApp = !!w?.Capacitor?.isNativePlatform?.();
	const nav = typeof navigator === "undefined" ? void 0 : navigator;
	return {
		isDesktopApp,
		isMobileApp,
		isMobileBrowser: typeof nav?.userAgentData?.mobile === "boolean" ? nav.userAgentData.mobile : /android|iphone|ipad|ipod|mobile|tablet/i.test(nav?.userAgent ?? ""),
		hasPairedDesktop
	};
}
/**
* The refusal sentence.
*
* Written per device mode because the useful next step genuinely differs: a
* browser on a laptop can install the desktop app, a phone should pair with a
* computer, and a machine that already has OCADE probably just needs its
* engine started. One generic "no engine available" would be true everywhere
* and useful nowhere.
*/
function refusalFor(mode, hasAnyRemedy) {
	switch (mode) {
		case "desktop_app": return "OCADE could not reach an engine on this computer, so it has not answered.";
		case "mobile_app": return "OCADE has no engine ready on this phone and no paired computer to borrow, so it has not answered.";
		case "mobile_web": return "This phone's browser cannot run OCADE's engine, so it has not answered. OCADE will not send your conversation to a server without being told to.";
		default: return hasAnyRemedy ? "This browser cannot run OCADE's engine, so it has not answered. OCADE will not send your conversation to a server without being told to." : "No engine is available to answer, and OCADE will not invent a reply.";
	}
}
/**
* Remedies OCADE can always offer for a mode, on top of whatever the adapters
* suggested. A browser that simply cannot run a model has no adapter-level
* remedy at all, and "nothing you can do" is a bad place to leave someone.
*/
function baselineRemedies(mode) {
	switch (mode) {
		case "pc_web":
		case "pc_web_paired": return ["install_ocade", "pair_a_computer"];
		case "mobile_web": return ["install_ocade", "pair_a_computer"];
		case "mobile_app": return ["pair_a_computer"];
		case "desktop_app": return ["start_engine"];
		default: return [];
	}
}
async function routeBrain(input) {
	const order = preferenceFor(input.mode, input.heavy ?? false);
	const attempts = [];
	for (const id of order) {
		const adapter = input.adapters.get(id);
		if (!adapter) continue;
		let availability;
		try {
			availability = await adapter.probe();
		} catch (error) {
			availability = {
				available: false,
				code: "probe_failed",
				reason: `${adapter.displayName} could not report its status: ${error instanceof Error ? error.message : String(error)}`,
				remedies: []
			};
		}
		attempts.push({
			id,
			availability
		});
		if (!availability.available) continue;
		if (input.visionRequired && !availability.capabilities.vision) continue;
		return {
			ok: true,
			adapter,
			availability,
			attempts,
			mode: input.mode
		};
	}
	const fromAdapters = attempts.filter((a) => !a.availability.available).flatMap((a) => a.availability.remedies);
	const remedies = [.../* @__PURE__ */ new Set([...fromAdapters, ...baselineRemedies(input.mode)])];
	return {
		ok: false,
		reason: refusalFor(input.mode, remedies.length > 0),
		remedies,
		attempts,
		mode: input.mode,
		cloudWouldHelp: !input.cloudEnabled
	};
}
function useBrain(options) {
	const device = useDevicePolicy();
	const paired = options?.hasPairedDesktop ?? hasPairing();
	const policyRef = (0, import_react.useRef)(device.policy);
	policyRef.current = device.policy;
	const registry = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		map.set("desktop_bridge", new DesktopBridgeAdapter({ policy: () => policyRef.current }));
		map.set("browser_webgpu", authorityBackedAdapter("browser_webgpu"));
		map.set("browser_wasm", authorityBackedAdapter("browser_wasm"));
		map.set("paired_desktop", new PairedDesktopAdapter({ credentials: pairedCredentials }));
		return map;
	}, []);
	const mode = (0, import_react.useMemo)(() => resolveDeviceMode(detectDeviceSignals(paired)), [paired]);
	const effectiveMode = mode === "pc_web" && serverIsThisMachine() ? "desktop_app" : mode;
	const route = (0, import_react.useCallback)((opts) => routeBrain({
		mode: effectiveMode,
		adapters: registry,
		heavy: opts?.heavy,
		visionRequired: opts?.visionRequired,
		cloudEnabled: false
	}), [effectiveMode, registry]);
	const warm = (0, import_react.useCallback)((pending) => {
		(async () => {
			const bridge = registry.get("desktop_bridge");
			if (bridge instanceof DesktopBridgeAdapter) try {
				if ((await bridge.probe()).available) {
					await bridge.preload(pending);
					return;
				}
			} catch {}
			await installationAuthority().install({ reason: "warm" });
		})();
	}, [registry]);
	const remedyLabel = (0, import_react.useCallback)((remedy) => REMEDY_LABELS[remedy], []);
	return (0, import_react.useMemo)(() => ({
		mode: effectiveMode,
		route,
		warm,
		remedyLabel
	}), [
		effectiveMode,
		route,
		warm,
		remedyLabel
	]);
}
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
export { useDictation as a, useBrain as i, describeRecognitionError as n, useLocalChatEngine as o, resolveEngine as r, LANGUAGE_CANDIDATES as t };

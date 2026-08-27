import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { a as deliberationClause, p as thinkingFor } from "./ocade-local-CUSjQ2bI.mjs";
import { i as useBrain } from "./use-brain-DcsqzQLQ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-local-chat-engine-CJSJPX2D.js
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
//#endregion
export { useLocalChatEngine as n, resolveEngine as t };

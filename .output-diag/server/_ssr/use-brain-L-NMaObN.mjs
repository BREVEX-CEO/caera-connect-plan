import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as REMEDY_LABELS } from "./adapter-BHZ2v_VZ.mjs";
import { t as DesktopBridgeAdapter } from "./desktop-bridge-D6zQ9cYu.mjs";
import { t as PairedDesktopAdapter } from "./paired-desktop-BmU9OPp9.mjs";
import { n as serverIsThisMachine, r as useDevicePolicy } from "./use-device-policy-3_-2tPN5.mjs";
import { t as installationAuthority } from "./installation-browser-cz2yGPNC.mjs";
import { n as hasPairing, r as pairedCredentials } from "./paired-credentials-DTehWMvo.mjs";
import { t as authorityBackedAdapter } from "./runtime-activation-Da4gjBZz.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-brain-L-NMaObN.js
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
//#endregion
export { useBrain as t };

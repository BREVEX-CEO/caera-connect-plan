import { i as __toESM, n as __exportAll } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-CA8BQOW2.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as OCADE_MODEL_ID, t as FIXED_MODEL } from "./fixed-model-DezWsm1J.mjs";
import { t as profileFrom } from "./detect-LJYWOPdG.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-device-policy-3_-2tPN5.js
var use_device_policy_3__2tPN5_exports = /* @__PURE__ */ __exportAll({
	i: () => serverIsThisMachine,
	n: () => useDevicePolicy,
	r: () => use_device_policy_exports,
	t: () => describeDeviceSource
});
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* Turn a measured machine into routing policy — in ONE place.
*
* This used to live inside the `useDevicePolicy` hook, which meant it was
* reachable only from React. Everything else that had to route — the paired
* bridge serving another device, and the evidence harness — passed an empty
* policy instead, and an empty policy means "no constraints", which makes
* `routeTask` pick the LARGEST installed model. On the reference machine that
* selected a 14B model measured at 184 seconds to the first token, on hardware
* that answers in seconds with the tier it was actually matched to. Nothing was
* broken; it was simply routing on nothing.
*
* So the rule is now structural: if you route, you build the policy here.
*/
var GIB$1 = 1024 ** 3;
/**
* `precise` decides whether the memory figure is used at all.
*
* An imprecise total — a browser's capped `deviceMemory`, say — omits
* `totalRamBytes` entirely rather than passing a number known to be too low.
* `modelFit` treats an absent total as "do not check", which is the right
* direction: refusing a model because of a cap the browser imposed is worse
* than not checking at all.
*/
function routePolicyFor(profile, precise) {
	return {
		totalRamBytes: precise && profile.totalRamGib > 0 ? profile.totalRamGib * GIB$1 : void 0,
		hasDiscreteGpu: profile.gpuCertain ? profile.hasDiscreteGpu : void 0,
		deviceMatchedModelId: OCADE_MODEL_ID
	};
}
/**
* Hardware detection server function (W2 production wiring).
*
* Node-only, for the same reason `sandbox.functions.ts` is: the measurement
* imports `node:os`, `node:fs/promises` and `node:child_process`, and a
* client-reachable import would pull Node builtins into the browser bundle. The
* `await import()` inside the handler keeps it on the server.
*
* What it returns is deliberately narrow. The raw snapshot carries a CPU model
* string and adapter names; the profile carries rounded sizes and a sentence.
* Only the profile crosses to the client, so nothing machine-identifying is
* handed to the page beyond what the user is being told anyway.
*/
var detectHardwareFn = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(createSsrRpc("c46a232dd6774620a61cf21686cce6b9227630fe0ca2fec51566c382503bae2d"));
var GIB = 1024 ** 3;
/** Vendors whose adapters genuinely accelerate inference. */
var ACCELERATING_VENDOR = /nvidia|amd|apple|intel/i;
/** A software rasteriser is not a GPU for our purposes. */
var SOFTWARE_ADAPTER = /swiftshader|llvmpipe|software|basic render|microsoft basic/i;
async function probeGpu() {
	const nav = typeof navigator === "undefined" ? void 0 : navigator;
	if (!nav?.gpu) return {
		present: "unknown",
		adapters: [],
		discrete: [],
		reason: "this browser does not expose WebGPU, so graphics capability cannot be measured"
	};
	try {
		const adapter = await nav.gpu.requestAdapter({ powerPreference: "high-performance" });
		if (!adapter) return {
			present: false,
			adapters: [],
			discrete: [],
			reason: "WebGPU reported no adapter at all"
		};
		const info = adapter.info ?? (adapter.requestAdapterInfo ? await adapter.requestAdapterInfo().catch(() => void 0) : void 0);
		const described = [
			info?.vendor,
			info?.architecture,
			info?.device,
			info?.description
		].filter((v) => typeof v === "string" && v.length > 0).join(" ").trim();
		const name = described || "an unnamed adapter";
		if (SOFTWARE_ADAPTER.test(name)) return {
			present: false,
			adapters: [name],
			discrete: [],
			reason: "the only adapter is a software renderer, which does not accelerate models"
		};
		if (!described) return {
			present: "unknown",
			adapters: [name],
			discrete: [],
			reason: "WebGPU exposed an adapter but withheld its identity"
		};
		const accelerating = ACCELERATING_VENDOR.test(described) && !/intel/i.test(described);
		return {
			present: accelerating ? true : "unknown",
			adapters: [name],
			discrete: accelerating ? [name] : [],
			reason: accelerating ? `WebGPU reported ${name}` : `WebGPU reported ${name}, which may or may not accelerate models`
		};
	} catch (error) {
		return {
			present: "unknown",
			adapters: [],
			discrete: [],
			reason: `the graphics probe failed: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}
async function probeStorage() {
	if (typeof navigator === "undefined" || !navigator.storage?.estimate) return 0;
	try {
		const estimate = await navigator.storage.estimate();
		const quota = estimate.quota ?? 0;
		const used = estimate.usage ?? 0;
		return Math.max(0, quota - used);
	} catch {
		return 0;
	}
}
/** Is this a phone or tablet shell? Storage, not speed, binds on those. */
function detectMobile() {
	if (typeof navigator === "undefined") return false;
	const nav = navigator;
	if (typeof nav.userAgentData?.mobile === "boolean") return nav.userAgentData.mobile;
	return /android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent ?? "");
}
/**
* Is the OCADE server running on the SAME machine as this browser?
*
* This is the question that decides whether server-side measurement means
* anything. On a desktop build or in local development the answer is yes and
* the operating system's own figures are far better than anything a page can
* see. Hosted, the answer is no, and server figures describe someone else's
* computer entirely.
*/
function serverIsThisMachine() {
	if (typeof window === "undefined") return false;
	const host = window.location.hostname;
	return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]" || host.endsWith(".localhost");
}
/**
* Measure what this browser is willing to reveal about the device.
*
* Never throws: a probe that fails contributes an unknown, because a settings
* screen that crashes is worse than one that says it could not tell.
*/
async function measureBrowserHardware() {
	const nav = typeof navigator === "undefined" ? void 0 : navigator;
	const [gpu, freeStorageBytes] = await Promise.all([probeGpu(), probeStorage()]);
	const memoryGib = typeof nav?.deviceMemory === "number" ? nav.deviceMemory : 0;
	return {
		totalRamBytes: memoryGib > 0 ? memoryGib * GIB : 0,
		availableRamBytes: 0,
		freeStorageBytes,
		cpuCount: nav?.hardwareConcurrency ?? 0,
		cpuModel: null,
		arch: "unknown",
		platform: nav?.userAgentData?.platform ?? "browser",
		gpuPresent: gpu.present,
		gpuAdapters: gpu.adapters,
		gpuDiscrete: gpu.discrete,
		gpuReason: gpu.reason,
		isMobile: detectMobile(),
		measuredAt: (/* @__PURE__ */ new Date()).toISOString(),
		precise: false,
		memoryIsLowerBound: memoryGib >= 8
	};
}
/** The same profile shape the rest of the product already consumes. */
async function measureBrowserProfile() {
	return profileFrom(await measureBrowserHardware());
}
var use_device_policy_exports = /* @__PURE__ */ __exportAll$1({
	describeDeviceSource: () => describeDeviceSource,
	devicePolicySnapshot: () => devicePolicySnapshot,
	useDevicePolicy: () => useDevicePolicy
});
var EMPTY = {
	policy: {
		totalRamBytes: void 0,
		hasDiscreteGpu: void 0,
		deviceMatchedModelId: null
	},
	profile: null,
	source: "unavailable",
	deviceMatchedModelId: null,
	because: null,
	measured: false,
	loading: true,
	problem: null
};
var toPolicy = (profile, precise) => routePolicyFor(profile, precise);
/**
* The last policy this browser measured, readable without React.
*
* WHY IT HAS TO EXIST. The installation authority starts engines from outside
* the component tree — that is the point of it — and the desktop bridge needs a
* route policy to size its context window. Reading the hook there is not
* possible, and constructing a fresh empty policy would route on no hardware
* facts at all, which is the exact defect the module comment above describes
* for non-React callers.
*
* It is a cache of a measurement, never a second source of truth: the hook
* writes it, nothing else does, and before the first measurement lands it
* honestly reports the empty policy rather than a guess.
*/
var lastMeasuredPolicy = EMPTY.policy;
function devicePolicySnapshot() {
	return lastMeasuredPolicy;
}
function useDevicePolicy() {
	const [state, setState] = (0, import_react.useState)(EMPTY);
	(0, import_react.useEffect)(() => {
		let active = true;
		(async () => {
			if (serverIsThisMachine()) try {
				const profile = await detectHardwareFn();
				if (!active) return;
				lastMeasuredPolicy = toPolicy(profile, true);
				setState({
					policy: toPolicy(profile, true),
					profile,
					source: "this_machine",
					deviceMatchedModelId: OCADE_MODEL_ID,
					because: `OCADE runs ${FIXED_MODEL.family} ${FIXED_MODEL.parameters} on every device, so nothing here changes which engine answers.`,
					measured: true,
					loading: false,
					problem: null
				});
				return;
			} catch {}
			try {
				const profile = await measureBrowserProfile();
				if (!active) return;
				lastMeasuredPolicy = toPolicy(profile, false);
				setState({
					policy: toPolicy(profile, false),
					profile,
					source: "browser_estimate",
					deviceMatchedModelId: OCADE_MODEL_ID,
					because: `OCADE runs ${FIXED_MODEL.family} ${FIXED_MODEL.parameters} on every device, so nothing here changes which engine answers.`,
					measured: false,
					loading: false,
					problem: null
				});
			} catch (error) {
				if (!active) return;
				setState({
					...EMPTY,
					loading: false,
					source: "unavailable",
					problem: `OCADE could not measure this device: ${error instanceof Error ? error.message : String(error)}`
				});
			}
		})();
		return () => {
			active = false;
		};
	}, []);
	return state;
}
/** One sentence a surface can show verbatim about where the figures came from. */
function describeDeviceSource(policy) {
	switch (policy.source) {
		case "this_machine": return "Measured on this computer.";
		case "browser_estimate": return "Estimated in your browser. Browsers report memory as a capped lower bound, so OCADE does not use it to rule engines out.";
		default: return policy.problem ?? "This device could not be measured.";
	}
}
//#endregion
export { use_device_policy_3__2tPN5_exports as i, serverIsThisMachine as n, useDevicePolicy as r, describeDeviceSource as t };

import { n as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { n as WEBGPU_TIERS, t as WASM_TIERS } from "./browser-catalogue-BYTmauOS.mjs";
import { t as modelVault } from "./model-vault-Cdwm-pAI.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/runtime-activation-Da4gjBZz.js
var runtime_activation_Da4gjBZz_exports = /* @__PURE__ */ __exportAll({
	n: () => runtime_activation_exports,
	t: () => authorityBackedAdapter
});
var runtime_activation_exports = /* @__PURE__ */ __exportAll$1({
	REDUCED_CONTEXT_FRACTION: () => REDUCED_CONTEXT_FRACTION,
	activateRuntimeForPath: () => activateRuntimeForPath,
	activeRuntime: () => activeRuntime,
	authorityBackedAdapter: () => authorityBackedAdapter,
	disposeRuntime: () => disposeRuntime,
	reducedContextTokens: () => reducedContextTokens
});
/**
* The engine that is actually running, if any.
*
* Held at module scope because it is a property of the tab, not of a React
* tree: a route change must not dispose an engine that took a minute to load,
* and a second component mounting must not start a second one.
*/
var live = null;
/** The running engine, for routing. Null until the authority has started one. */
function activeRuntime() {
	return live ? {
		path: live.path,
		adapter: live.adapter
	} : null;
}
/**
* How much of the standard context a reduced-context attempt keeps.
*
* Half, because the KV cache is the part that scales with context and it is
* usually what a constrained device runs out of. It is a REAL retry at a
* genuinely smaller working set, not the same attempt with a different label —
* the alternative, declaring the device unsupported on one conservative
* allocation limit, refuses devices that would have worked.
*/
var REDUCED_CONTEXT_FRACTION = .5;
function reducedContextTokens(tier) {
	const reduced = Math.floor(tier.contextTokens * REDUCED_CONTEXT_FRACTION / 256) * 256;
	return Math.max(1024, reduced);
}
/** Start the runtime for one path. Never starts two. */
async function activateRuntimeForPath(path, version, report) {
	if (live && live.path === path && live.version === version) return { ok: true };
	if (live) {
		try {
			await live.adapter.dispose?.();
		} catch {}
		live = null;
	}
	switch (path) {
		case "webgpu":
		case "webgpu_reduced": return startWebGpu(path, version, report);
		case "wasm_threaded":
		case "wasm_single": return startWasm(path, version, report);
		case "desktop_bridge": return startDesktopBridge(version);
		case "paired_device": return startPairedDevice(version);
	}
}
async function startWebGpu(path, version, report) {
	const tier = WEBGPU_TIERS[0];
	if (!tier) return {
		ok: false,
		reason: "No graphics engine is configured."
	};
	const { BrowserWebGpuAdapter } = await import("./browser-webgpu-Csjo9s-0.mjs");
	const { shareAcrossTabs } = await import("./shared-browser-engine-Bhwq7_3u.mjs");
	const adapter = new BrowserWebGpuAdapter({
		onProgress: (p) => report({
			stage: p.fraction !== null && p.fraction >= 1 ? "loading" : "downloading",
			fraction: p.fraction
		}),
		contextTokensOverride: path === "webgpu_reduced" ? reducedContextTokens(tier) : void 0
	});
	const probe = await adapter.probe();
	if (!probe.available) return {
		ok: false,
		reason: probe.reason
	};
	try {
		const shared = shareAcrossTabs(adapter);
		await shared.preload?.();
		live = {
			path,
			adapter: shared,
			version
		};
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : "The graphics engine could not start."
		};
	}
}
async function startWasm(path, version, report) {
	if (!WASM_TIERS[0]) return {
		ok: false,
		reason: "No processor engine is configured."
	};
	const { BrowserWasmAdapter } = await import("./browser-wasm-CfxOyK0w.mjs");
	const adapter = new BrowserWasmAdapter({
		onProgress: (p) => report({
			stage: "loading",
			fraction: p.fraction
		}),
		weightsProvider: async () => {
			if (modelVault.activeVersion() !== version) return null;
			return modelVault.readArtifact(version);
		},
		preferThreads: path === "wasm_threaded"
	});
	const probe = await adapter.probe();
	if (!probe.available) return {
		ok: false,
		reason: probe.reason
	};
	try {
		report({
			stage: "loading",
			fraction: null
		});
		await adapter.load();
		live = {
			path,
			adapter,
			version
		};
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : "The processor engine could not start."
		};
	}
}
async function startDesktopBridge(version) {
	const { DesktopBridgeAdapter } = await import("./desktop-bridge-D6zQ9cYu.mjs").then((n) => n.n).then((n) => n.n);
	const { devicePolicySnapshot } = await import("./use-device-policy-3_-2tPN5.mjs").then((n) => n.i).then((n) => n.r);
	const adapter = new DesktopBridgeAdapter({ policy: devicePolicySnapshot });
	const probe = await adapter.probe();
	if (!probe.available) return {
		ok: false,
		reason: probe.reason
	};
	try {
		await adapter.preload?.();
		live = {
			path: "desktop_bridge",
			adapter,
			version
		};
		return { ok: true };
	} catch (error) {
		return {
			ok: false,
			reason: error instanceof Error ? error.message : "The local engine could not start."
		};
	}
}
async function startPairedDevice(version) {
	const { PairedDesktopAdapter } = await import("./paired-desktop-BmU9OPp9.mjs").then((n) => n.n).then((n) => n.n);
	const { pairedCredentials } = await import("./paired-credentials-DTehWMvo.mjs").then((n) => n.i).then((n) => n.i);
	const adapter = new PairedDesktopAdapter({ credentials: pairedCredentials });
	const probe = await adapter.probe();
	if (!probe.available) return {
		ok: false,
		reason: probe.reason
	};
	live = {
		path: "paired_device",
		adapter,
		version
	};
	return { ok: true };
}
/**
* An adapter that is whatever the authority has actually started.
*
* WHY ROUTING CANNOT JUST BUILD ITS OWN. `use-brain` used to construct a
* `BrowserWebGpuAdapter` and a `BrowserWasmAdapter` inside a `useMemo` and hand
* them to the router. The authority now constructs the one it actually starts.
* Leaving both in place would mean two adapter instances per tab — and on the
* WebGPU path that is two copies of the weights resident on the graphics card,
* which is the exact defect `shared-browser-engine.ts` was written to fix
* across tabs, reintroduced within a single one.
*
* So routing gets this instead: a thin delegate holding no engine of its own.
* When the authority has a live runtime it forwards to it; when it does not, it
* reports unavailable with the reason the authority would give. There is
* exactly one browser engine in a tab, and it is the one the authority chose.
*/
function authorityBackedAdapter(id) {
	const matches = (path) => id === "browser_webgpu" ? path === "webgpu" || path === "webgpu_reduced" : path === "wasm_threaded" || path === "wasm_single";
	const current = () => {
		const running = activeRuntime();
		return running && matches(running.path) ? running.adapter : null;
	};
	return {
		id,
		displayName: id === "browser_webgpu" ? "OCADE Browser" : "OCADE Browser (compatibility)",
		async probe() {
			const adapter = current();
			if (adapter) return adapter.probe();
			return {
				available: false,
				code: "no_model",
				reason: "OCADE is still preparing this device.",
				remedies: []
			};
		},
		async preload() {
			await current()?.preload?.();
		},
		async stream(messages, handlers) {
			const adapter = current();
			if (!adapter) return {
				ok: false,
				failure: "unavailable",
				reason: "OCADE is still preparing this device."
			};
			return adapter.stream(messages, handlers);
		},
		async dispose() {
			await disposeRuntime();
		}
	};
}
/** Tear the running engine down. Used by uninstall and by tests. */
async function disposeRuntime() {
	const current = live;
	live = null;
	try {
		await current?.adapter.dispose?.();
	} catch {}
}
//#endregion
export { runtime_activation_Da4gjBZz_exports as n, authorityBackedAdapter as t };

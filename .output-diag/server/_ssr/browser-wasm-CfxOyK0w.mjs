import { n as unavailable } from "./adapter-BHZ2v_VZ.mjs";
import { a as ggufUrl, c as sameOriginGgufUrl, i as formatSize, l as sha256For, o as resolvedFor, r as chooseBrowserTier, u as storageKeyFor } from "./browser-catalogue-BYTmauOS.mjs";
import { n as modelStore, t as ModelStore } from "./model-store-BPT0fGRD.mjs";
import { r as preferredWeightsUrl, t as downloadModel } from "./model-download-DGFhh7HL.mjs";
import { i as recordTierFailure, n as loadBenchmark, r as recordBenchmark } from "./tier-benchmark-store-DlIk7w-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/browser-wasm-CfxOyK0w.js
/**
* Where a deployment may put the multi-threaded engine binary.
*
* Same idea as `public/models/` for weights: an operator drops the file in and
* the product uses it, with no external request either way. Probed rather than
* assumed, so a deployment that has not vendored it is simply single-threaded
* instead of broken.
*/
var MULTI_THREAD_WASM_PATH = "/wasm/multi-thread/wllama.wasm";
/** Cached, because a HEAD per engine load would be a request on every start. */
var multiThreadProbe = null;
/**
* Is a self-hosted multi-threaded build present AND usable?
*
* Both halves matter. Isolation without the binary means threads that cannot
* run; the binary without isolation means a build that cannot use
* `SharedArrayBuffer`. Only the pair is a threaded engine, and anything else
* falls back to the single-threaded one, which always works.
*/
async function selfHostedMultiThreadWasm() {
	if (typeof SharedArrayBuffer !== "function" || globalThis.crossOriginIsolated !== true) return null;
	if (typeof fetch !== "function") return null;
	multiThreadProbe ??= (async () => {
		try {
			const probe = await fetch(MULTI_THREAD_WASM_PATH, { method: "HEAD" });
			const type = probe.headers.get("content-type") ?? "";
			if (probe.ok && !type.includes("text/html")) return MULTI_THREAD_WASM_PATH;
		} catch {}
		return null;
	})();
	return multiThreadProbe;
}
var BrowserWasmAdapter = class {
	id = "browser_wasm";
	displayName = "OCADE Browser (compatibility)";
	instance = null;
	loadedRepo = null;
	cachedTier = null;
	onProgress;
	weightsProvider;
	preferThreads;
	constructor(options) {
		this.onProgress = options?.onProgress;
		this.weightsProvider = options?.weightsProvider;
		this.preferThreads = options?.preferThreads ?? false;
	}
	async probe() {
		if (typeof window === "undefined") return unavailable("unsupported_device", "There is no browser here to run OCADE in.");
		if (typeof WebAssembly === "undefined") return unavailable("unsupported_device", "This browser cannot run WebAssembly, so OCADE has no engine it can use here.");
		const { tier } = chooseBrowserTier("wasm", null, loadBenchmark("wasm"));
		let quotaBytes = null;
		try {
			const estimate = await navigator.storage?.estimate?.();
			if (estimate?.quota !== void 0) quotaBytes = Math.max(0, estimate.quota - (estimate.usage ?? 0));
		} catch {
			quotaBytes = null;
		}
		if (quotaBytes !== null && quotaBytes < tier.downloadBytes) return unavailable("insufficient_storage", `OCADE's compatibility engine needs about ${formatSize(tier.downloadBytes)} and this browser will only allow ${formatSize(quotaBytes)}.`, ["free_storage"]);
		this.cachedTier = tier;
		return {
			available: true,
			label: tier.label,
			locality: "on_device",
			modelId: storageKeyFor(tier),
			thinkingSuitable: tier.thinkingSuitable,
			capabilities: {
				text: true,
				vision: false,
				imageGeneration: false,
				tools: false
			}
		};
	}
	plan() {
		if (!this.cachedTier) return null;
		return {
			tier: this.cachedTier,
			downloadLabel: formatSize(this.cachedTier.downloadBytes),
			multiThreaded: typeof SharedArrayBuffer !== "undefined"
		};
	}
	/**
	* Download and load the model before anybody asks a question.
	*
	* THE FALLBACK NEEDS THIS MORE THAN THE PRIMARY DID. `use-brain` warmed only
	* the WebGPU adapter, so a browser with no usable GPU adapter -- which is
	* exactly the machine this adapter exists for -- prepared nothing at all,
	* and its download started on the user's first message. A fallback that is
	* not made ready like the primary is a fallback that is always cold.
	*
	* Idempotent and fire-and-forget by contract, matching the WebGPU adapter:
	* `ensureLoaded` returns the existing instance when there is one, and every
	* failure is swallowed. A warm-up that surfaces an error is reporting a
	* problem with a message the user has not sent yet.
	*/
	async preload() {
		try {
			if (!(await this.probe()).available) return;
			const chosen = this.plan();
			if (!chosen) return;
			await this.ensureLoaded(chosen.tier);
		} catch {}
	}
	/**
	* Load now, and REPORT A FAILURE rather than swallowing it.
	*
	* The difference from `preload` is who is asking. `preload` is a speculative
	* warm-up whose failure must never surface — it is a problem with a message
	* the user has not sent. This is the installation authority asking "does this
	* rung work on this device", and there the answer matters: a swallowed error
	* would look like success and stop the ladder from falling through to the
	* next rung.
	*/
	async load() {
		const availability = await this.probe();
		if (!availability.available) throw new Error(availability.reason);
		const chosen = this.plan();
		if (!chosen) throw new Error("No processor engine was selected for this device.");
		await this.ensureLoaded(chosen.tier);
	}
	async ensureLoaded(tier) {
		const key = storageKeyFor(tier);
		if (this.instance && this.loadedRepo === key) return this.instance;
		if (this.instance) await this.dispose();
		const wllama = await import("./wllama-0Jo7yQto.mjs");
		const singleThreadWasm = (await import("./wllama-BGXHWGTU.mjs")).default;
		const builds = {
			default: singleThreadWasm,
			"single-thread/wllama.wasm": singleThreadWasm
		};
		const multiThreadUrl = this.preferThreads ? await selfHostedMultiThreadWasm() : null;
		if (multiThreadUrl) builds["multi-thread/wllama.wasm"] = multiThreadUrl;
		const instance = new wllama.Wllama(builds, { allowOffline: true });
		const url = ggufUrl(tier);
		if (!key || !url) throw new Error("This browser tier has no model file configured.");
		if (this.weightsProvider) {
			const blob = await this.weightsProvider();
			if (!blob) throw new Error("OCADE's prepared engine could not be read back from this device.");
			await instance.loadModel([blob]);
			this.instance = instance;
			this.loadedRepo = key;
			return instance;
		}
		if (ModelStore.isSupported()) {
			const download = await downloadModel({
				key,
				url: ((await modelStore.readMeta(key))?.verified === true && await modelStore.sizeOf(key) > 0 ? {
					url,
					local: false
				} : await preferredWeightsUrl(sameOriginGgufUrl(tier), url)).url,
				expectedBytes: tier.downloadBytes,
				sha256: sha256For(tier),
				onProgress: (p) => this.onProgress?.({
					fraction: p.fraction,
					text: `Downloading ${tier.label}`
				})
			});
			if (!download.ok) throw new Error(download.reason);
			const blob = await modelStore.readBlob(key);
			if (!blob) throw new Error("The engine was downloaded but could not be read back.");
			await instance.loadModel([blob]);
		} else {
			const entry = resolvedFor(tier);
			if (!entry) throw new Error("This browser tier has no model file configured.");
			await instance.loadModelFromHF({
				repo: entry.repo,
				file: entry.path
			}, {
				useCache: true,
				progressCallback: ({ loaded, total }) => {
					this.onProgress?.({
						fraction: total > 0 ? loaded / total : null,
						text: `Downloading ${tier.label}`
					});
				}
			});
		}
		this.instance = instance;
		this.loadedRepo = key;
		return instance;
	}
	async stream(messages, handlers) {
		if (messages.some((m) => (m.images?.length ?? 0) > 0)) return {
			ok: false,
			failure: "unavailable",
			reason: "OCADE's compatibility engine cannot read images. A device engine or a paired computer can."
		};
		const availability = await this.probe();
		if (!availability.available) return {
			ok: false,
			failure: "unavailable",
			reason: availability.reason
		};
		const tier = this.cachedTier;
		if (!tier) return {
			ok: false,
			failure: "unavailable",
			reason: "No browser engine was selected."
		};
		let instance;
		try {
			instance = await this.ensureLoaded(tier);
		} catch (error) {
			return {
				ok: false,
				failure: "error",
				reason: `OCADE's compatibility engine could not start: ${error instanceof Error ? error.message : String(error)}`
			};
		}
		const startedAt = Date.now();
		let firstTokenMs = null;
		try {
			const stream = await instance.createChatCompletion({
				stream: true,
				abortSignal: handlers.signal,
				temperature: .2,
				top_p: .9,
				messages: messages.map((m) => ({
					role: m.role,
					content: m.content
				}))
			});
			for await (const chunk of stream) {
				if (handlers.signal?.aborted) break;
				const piece = chunk.choices?.[0]?.delta?.content;
				if (piece) {
					if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
					handlers.onToken(piece);
				}
			}
			if (handlers.signal?.aborted) return {
				ok: false,
				failure: "cancelled",
				reason: "Stopped."
			};
			if (firstTokenMs !== null) recordBenchmark("wasm", tier.rank, firstTokenMs);
			return {
				ok: true,
				modelId: this.loadedRepo,
				firstTokenMs
			};
		} catch (error) {
			const name = error instanceof Error ? error.name : "";
			if (handlers.signal?.aborted || name === "WllamaAbortError" || name === "AbortError") return {
				ok: false,
				failure: "cancelled",
				reason: "Stopped."
			};
			if (tier.rank > 0) recordTierFailure("wasm", tier.rank);
			return {
				ok: false,
				failure: "error",
				reason: `OCADE's compatibility engine stopped: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}
	async dispose() {
		try {
			await this.instance?.exit();
		} catch {}
		this.instance = null;
		this.loadedRepo = null;
	}
};
//#endregion
export { BrowserWasmAdapter, selfHostedMultiThreadWasm };

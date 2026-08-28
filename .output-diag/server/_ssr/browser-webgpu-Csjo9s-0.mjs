import { n as unavailable } from "./adapter-BHZ2v_VZ.mjs";
import { f as webgpuMirrorFileUrl, i as formatSize, p as webgpuMirrorWeightsUrl, r as chooseBrowserTier, s as runtimeMemoryBytes } from "./browser-catalogue-BYTmauOS.mjs";
import { r as preferredWeightsUrl } from "./model-download-DGFhh7HL.mjs";
import { i as recordTierFailure, n as loadBenchmark, r as recordBenchmark } from "./tier-benchmark-store-DlIk7w-n.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/browser-webgpu-Csjo9s-0.js
var BrowserWebGpuAdapter = class BrowserWebGpuAdapter {
	id = "browser_webgpu";
	displayName = "OCADE Browser";
	engine = null;
	worker = null;
	loadedModelId = null;
	cachedTier = null;
	onProgress;
	contextTokensOverride;
	constructor(options) {
		this.onProgress = options?.onProgress;
		this.contextTokensOverride = options?.contextTokensOverride;
	}
	/**
	* The largest single allocation this adapter permits.
	*
	* NOT a VRAM measurement, and not treated as one: it is passed to the
	* catalogue as a ceiling that can only exclude tiers.
	*/
	static async gpuMemoryBudget() {
		const gpu = navigator.gpu;
		if (!gpu) return {
			ok: false,
			reason: "This browser cannot use the graphics card for OCADE (no WebGPU)."
		};
		let adapter;
		try {
			adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
		} catch (error) {
			return {
				ok: false,
				reason: `The graphics card could not be prepared: ${error instanceof Error ? error.message : String(error)}`
			};
		}
		if (!adapter) return {
			ok: false,
			reason: "The graphics card did not offer OCADE an adapter."
		};
		const maxBuffer = adapter.limits?.maxBufferSize;
		return {
			ok: true,
			bytes: typeof maxBuffer === "number" ? Number(maxBuffer) : null
		};
	}
	async probe() {
		if (typeof window === "undefined") return unavailable("unsupported_device", "There is no browser here to run OCADE in.");
		const budget = await BrowserWebGpuAdapter.gpuMemoryBudget();
		if (!budget.ok) return unavailable("unsupported_device", budget.reason);
		const { tier } = chooseBrowserTier("webgpu", budget.bytes, loadBenchmark("webgpu"));
		if (budget.bytes !== null && runtimeMemoryBytes(tier) > budget.bytes) return unavailable("insufficient_memory", `OCADE's smallest browser engine needs about ${formatSize(runtimeMemoryBytes(tier))} of graphics memory and this device offers ${formatSize(budget.bytes)}.`);
		this.cachedTier = tier;
		return {
			available: true,
			label: tier.label,
			locality: "on_device",
			modelId: tier.webllmId ?? null,
			thinkingSuitable: tier.thinkingSuitable,
			capabilities: {
				text: true,
				vision: false,
				imageGeneration: false,
				tools: false
			}
		};
	}
	/** Everything the user should be told before any bytes are fetched. */
	plan() {
		if (!this.cachedTier) return null;
		return {
			tier: this.cachedTier,
			downloadLabel: formatSize(this.cachedTier.downloadBytes)
		};
	}
	async ensureEngine(tier) {
		if (this.engine && this.loadedModelId === tier.webllmId) return this.engine;
		if (this.engine) await this.dispose();
		const webllm = await import("./webllm.server-gx1_XatZ.mjs");
		if (!webllm.prebuiltAppConfig.model_list.some((m) => m.model_id === tier.webllmId)) throw new Error(`OCADE's browser engine "${tier.label}" is not available in this build of the runtime.`);
		const record = webllm.prebuiltAppConfig.model_list.find((m) => m.model_id === tier.webllmId);
		const mirroredWeights = await preferredWeightsUrl(webgpuMirrorWeightsUrl(tier) ? `${webgpuMirrorWeightsUrl(tier)}/mlc-chat-config.json` : null, record.model);
		const mirroredLib = await preferredWeightsUrl(webgpuMirrorFileUrl(tier, record.model_lib), record.model_lib);
		this.worker = new Worker(new URL("./webllm.worker.ts", import.meta.url), { type: "module" });
		this.engine = await webllm.CreateWebWorkerMLCEngine(this.worker, tier.webllmId, {
			appConfig: {
				...webllm.prebuiltAppConfig,
				cacheBackend: "indexeddb",
				model_list: [{
					...record,
					model: mirroredWeights.local ? webgpuMirrorWeightsUrl(tier) : record.model,
					model_lib: mirroredLib.url,
					vram_required_MB: tier.requiredMemoryBytes / (1024 * 1024),
					overrides: {
						...record.overrides,
						context_window_size: this.contextTokensOverride ?? tier.contextTokens
					}
				}]
			},
			initProgressCallback: (report) => {
				this.onProgress?.({
					fraction: typeof report.progress === "number" ? report.progress : null,
					text: report.text
				});
			}
		});
		this.loadedModelId = tier.webllmId ?? null;
		return this.engine;
	}
	/**
	* Download and compile the model before anybody asks a question.
	*
	* WITHOUT THIS, THE WEB CLIENT DOWNLOADS 340 MB ON THE FIRST MESSAGE.
	* `warm()` in `use-brain` only ever preloaded the desktop bridge, so on the
	* web -- where this adapter is the ONLY engine -- nothing happened until the
	* user pressed send, and then they waited on a progress bar they had not
	* asked for, mid-sentence.
	*
	* Idempotent and fire-and-forget by contract: `ensure` returns the existing
	* engine when there is one, and every failure is swallowed. A warm-up that
	* surfaces an error is reporting a problem with a message the user has not
	* sent yet.
	*
	* The bytes land in IndexedDB — see `cacheBackend` in `ensureEngine` above,
	* and the note there explaining why not Cache Storage — so a second visit
	* compiles from disk and asks the network for nothing. This comment said
	* Cache Storage while the code twenty lines up said otherwise, which is
	* exactly the kind of disagreement that sends somebody looking in the wrong
	* drawer for a missing gigabyte.
	*/
	async preload() {
		try {
			if (!(await this.probe()).available) return;
			const chosen = this.plan();
			if (!chosen) return;
			await this.ensureEngine(chosen.tier);
		} catch {}
	}
	async stream(messages, handlers) {
		if (messages.some((m) => (m.images?.length ?? 0) > 0)) return {
			ok: false,
			failure: "unavailable",
			reason: "OCADE's browser engine cannot read images. Attach it to a device engine instead."
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
		let engine;
		try {
			engine = await this.ensureEngine(tier);
		} catch (error) {
			return {
				ok: false,
				failure: "error",
				reason: `OCADE's browser engine could not start: ${error instanceof Error ? error.message : String(error)}`
			};
		}
		const startedAt = Date.now();
		let firstTokenMs = null;
		const onAbort = () => {
			engine.interruptGenerate();
		};
		handlers.signal?.addEventListener("abort", onAbort, { once: true });
		try {
			const completion = await engine.chat.completions.create({
				stream: true,
				temperature: .2,
				top_p: .9,
				messages: messages.map((m) => ({
					role: m.role,
					content: m.content
				}))
			});
			for await (const chunk of completion) {
				if (handlers.signal?.aborted) break;
				const piece = chunk.choices[0]?.delta?.content;
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
			if (firstTokenMs !== null) recordBenchmark("webgpu", tier.rank, firstTokenMs);
			return {
				ok: true,
				modelId: tier.webllmId ?? null,
				firstTokenMs
			};
		} catch (error) {
			if (handlers.signal?.aborted) return {
				ok: false,
				failure: "cancelled",
				reason: "Stopped."
			};
			if (tier.rank > 0) recordTierFailure("webgpu", tier.rank);
			return {
				ok: false,
				failure: "error",
				reason: `OCADE's browser engine stopped: ${error instanceof Error ? error.message : String(error)}`
			};
		} finally {
			handlers.signal?.removeEventListener("abort", onAbort);
		}
	}
	async dispose() {
		try {
			await this.engine?.unload();
		} catch {}
		this.worker?.terminate();
		this.engine = null;
		this.worker = null;
		this.loadedModelId = null;
	}
};
//#endregion
export { BrowserWebGpuAdapter };

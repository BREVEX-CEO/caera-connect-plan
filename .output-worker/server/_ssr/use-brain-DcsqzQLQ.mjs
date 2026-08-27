import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { c as planContextWindow, d as selectFixedModel, f as streamLocalChat, l as preloadLocalModel, o as detectPlatform, s as discoverLocalModels } from "./ocade-local-CUSjQ2bI.mjs";
import { t as PerfLedger } from "./router-policy-BYv2rPFs.mjs";
import { t as BroadcastChannel } from "../_libs/unenv.mjs";
import { a as ggufUrl, c as runtimeMemoryBytes, d as storageKeyFor, i as formatSize$1, l as sameOriginGgufUrl, m as webgpuMirrorWeightsUrl, o as modelStore, p as webgpuMirrorFileUrl, r as chooseBrowserTier, s as resolvedFor, t as ModelStore, u as sha256For } from "./model-store-DhsdXagY.mjs";
import { c as pairedCredentials, d as serverIsThisMachine, f as unavailable, i as downloadModel, l as preferredWeightsUrl, n as REMEDY_LABELS, o as hasPairing, p as useDevicePolicy, t as PairedDesktopAdapter } from "./paired-credentials-LNcGDT02.mjs";
import { i as recordTierFailure, n as loadBenchmark, r as recordBenchmark } from "./tier-benchmark-store-RtQ42nqe.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/use-brain-DcsqzQLQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
/**
* How long the engine may produce NOTHING before OCADE stops waiting.
*
* Generous on purpose. Measured on the reference machine, a cold qwen2.5:3b
* took 8.2 s to answer its first Control + Work turn while the weights came off
* disk, and a larger model or a busier machine is slower still. This is a
* deadline for "the engine is not coming back", not a performance target — and
* it is the difference between a bounded failure and a spinner that never ends.
*/
var FIRST_TOKEN_TIMEOUT_MS = 6e4;
/**
* How long a stream that has STARTED may go quiet mid-reply.
*
* Much tighter, because nothing legitimate pauses here: once tokens are
* flowing they arrive continuously, so silence means the connection died
* without closing. Re-armed on every token, so a long essay that keeps
* streaming is never interrupted however long it runs in total.
*/
var BETWEEN_TOKEN_TIMEOUT_MS = 2e4;
/**
* The desktop engine, reached through OCADE's local bridge.
*
* This wraps the path that already works and is already proven at runtime —
* discovery, hardware-aware routing, streaming, cancellation. It is deliberately
* a thin adapter rather than a reimplementation: the evidence in
* release/OCADE_CHAT_RUNTIME_EVIDENCE.json was produced against these exact
* functions, and rewriting them here would throw that proof away.
*
* ON PORT EXPOSURE. The engine is bound to loopback by the supervisor, which
* refuses any other bind address, and no website is ever handed this URL —
* a page on the public internet talking to a raw inference port would be an
* unauthenticated prompt endpoint on the user's machine. Reaching this engine
* from anywhere other than the same machine goes through the paired-desktop
* adapter, which authenticates.
*/
var DesktopBridgeAdapter = class {
	id = "desktop_bridge";
	displayName = "OCADE Local";
	bridgeUrl;
	ledger;
	policy;
	lastChoice = null;
	constructor(options) {
		this.bridgeUrl = options.bridgeUrl ?? "http://localhost:11434";
		this.ledger = options.ledger ?? new PerfLedger();
		this.policy = options.policy;
	}
	async probe() {
		const discovery = await discoverLocalModels(this.bridgeUrl);
		if (!discovery.reachable) return unavailable("not_running", "The OCADE engine is not running on this computer.", ["start_engine"]);
		if (discovery.models.length === 0) return unavailable("no_model", "The OCADE engine is running but no model is installed yet.", ["download_model"]);
		const fixed = selectFixedModel({
			platform: detectPlatform(),
			installed: discovery.models.map((m) => ({
				id: m.id,
				vision: m.vision,
				sizeBytes: m.sizeBytes,
				isCloudPointer: m.isCloudPointer
			}))
		});
		if (!fixed.ok || !fixed.modelId) return unavailable("no_model", fixed.reason ?? "OCADE's engine is not installed on this computer yet.", ["download_model"]);
		const chosen = discovery.models.find((m) => m.id === fixed.modelId) ?? null;
		this.lastChoice = chosen;
		const stats = this.ledger.stats(fixed.modelId, "general");
		const visionModel = discovery.models.find((m) => m.vision) ?? null;
		return {
			available: true,
			label: chosen?.label ?? "OCADE Local",
			locality: "on_device",
			modelId: fixed.modelId,
			measuredFirstTokenMs: stats ? Math.round(stats.medianFirstTokenMs) : null,
			capabilities: {
				text: true,
				vision: visionModel !== null,
				imageGeneration: false,
				tools: true
			}
		};
	}
	/**
	* Warm the weights while the user is still typing.
	*
	* `pending` is whatever is already staged for the next message — attachments
	* and the conversation so far. It is used to warm at THE SAME context window
	* the send will ask for, because the runtime reloads the weights when that
	* window changes: warming at the default and then sending a long document
	* pays the whole multi-gigabyte load again, after the send rather than
	* before it, which is precisely when the optimisation was supposed to help.
	*/
	async preload(pending) {
		const id = this.lastChoice?.id;
		if (!id) return;
		const plan = pending?.length ? planContextWindow(pending.map((message) => ({
			role: message.role,
			content: message.content,
			...message.images?.length ? { images: message.images } : {}
		})), this.policy().totalRamBytes) : null;
		await preloadLocalModel(this.bridgeUrl, id, void 0, plan?.numCtx ?? null);
	}
	async stream(messages, handlers) {
		const needsVision = messages.some((m) => (m.images?.length ?? 0) > 0);
		const discovery = await discoverLocalModels(this.bridgeUrl);
		if (!discovery.ok) return {
			ok: false,
			failure: "unavailable",
			reason: discovery.reason ?? "The OCADE engine is not available."
		};
		const fixed = selectFixedModel({
			platform: detectPlatform(),
			installed: discovery.models.map((m) => ({
				id: m.id,
				vision: m.vision,
				sizeBytes: m.sizeBytes,
				isCloudPointer: m.isCloudPointer
			})),
			visionRequired: needsVision
		});
		const route = fixed.ok && fixed.modelId ? {
			ok: true,
			model: discovery.models.find((m) => m.id === fixed.modelId) ?? {
				id: fixed.modelId,
				label: "OCADE Local"
			},
			receipt: { refusal: void 0 }
		} : {
			ok: false,
			model: null,
			receipt: { refusal: fixed.reason }
		};
		if (!route.ok) return {
			ok: false,
			failure: "unavailable",
			reason: route.receipt.refusal ?? (needsVision ? "No image-reading engine is installed on this computer." : "No installed engine can serve this request.")
		};
		const startedAt = Date.now();
		let firstTokenMs = null;
		const stall = new AbortController();
		let stalledAt = null;
		let timer;
		const arm = (ms, what) => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				stalledAt = what;
				stall.abort();
			}, ms);
		};
		arm(FIRST_TOKEN_TIMEOUT_MS, "first token");
		const signal = handlers.signal ? AbortSignal.any([handlers.signal, stall.signal]) : stall.signal;
		let result;
		try {
			result = await streamLocalChat(this.bridgeUrl, route.model.id, messages.map((m) => ({
				role: m.role,
				content: m.content,
				...m.images?.length ? { images: m.images } : {}
			})), {
				signal,
				think: handlers.think,
				...handlers.tools?.length ? { tools: handlers.tools } : {},
				...handlers.onToolCall ? { onToolCall: handlers.onToolCall } : {},
				...this.policy().totalRamBytes ? { totalRamBytes: this.policy().totalRamBytes } : {},
				onToken: (chunk) => {
					if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
					arm(BETWEEN_TOKEN_TIMEOUT_MS, "mid-stream");
					handlers.onToken(chunk);
				}
			});
		} finally {
			if (timer) clearTimeout(timer);
		}
		if (stalledAt !== null) {
			const waited = Math.round((Date.now() - startedAt) / 1e3);
			return {
				ok: false,
				failure: "error",
				reason: stalledAt === "first token" ? `The engine accepted the request but sent nothing back in ${waited}s. Check Ollama is running and ${route.model.id} is installed — OCADE stopped waiting rather than leave you watching a spinner.` : `The engine went quiet part-way through its reply, after ${waited}s. Nothing further arrived, so OCADE stopped waiting. Try again.`
			};
		}
		if (result.reason !== "cancelled") this.ledger.record({
			modelId: route.model.id,
			task: needsVision ? "vision" : "general",
			firstTokenMs: firstTokenMs ?? Date.now() - startedAt,
			totalMs: Date.now() - startedAt,
			ok: result.ok
		});
		if (result.ok) return {
			ok: true,
			modelId: route.model.id,
			firstTokenMs
		};
		return result.reason === "cancelled" ? {
			ok: false,
			failure: "cancelled",
			reason: "Stopped."
		} : {
			ok: false,
			failure: "error",
			reason: result.reason ?? "The engine stopped responding."
		};
	}
};
var BrowserWebGpuAdapter = class BrowserWebGpuAdapter {
	id = "browser_webgpu";
	displayName = "OCADE Browser";
	engine = null;
	worker = null;
	loadedModelId = null;
	cachedTier = null;
	onProgress;
	constructor(options) {
		this.onProgress = options?.onProgress;
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
		if (budget.bytes !== null && runtimeMemoryBytes(tier) > budget.bytes) return unavailable("insufficient_memory", `OCADE's smallest browser engine needs about ${formatSize$1(runtimeMemoryBytes(tier))} of graphics memory and this device offers ${formatSize$1(budget.bytes)}.`);
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
			downloadLabel: formatSize$1(this.cachedTier.downloadBytes)
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
						context_window_size: tier.contextTokens
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
var DEFAULTS = {
	lockName: "ocade.model.owner",
	channelName: "ocade.model.bus",
	requestTimeoutMs: 2e4
};
function modelOwnerSupported() {
	return typeof BroadcastChannel === "function" && typeof navigator !== "undefined" && typeof navigator.locks?.request === "function";
}
function createModelOwner(options) {
	const lockName = options.lockName ?? DEFAULTS.lockName;
	const channelName = options.channelName ?? DEFAULTS.channelName;
	const timeoutMs = options.requestTimeoutMs ?? DEFAULTS.requestTimeoutMs;
	const me = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
	const channel = new BroadcastChannel(channelName);
	let role = "starting";
	let loads = 0;
	let disposed = false;
	let releaseLock = null;
	const roleListeners = /* @__PURE__ */ new Set();
	/** Follower-side: requests this tab is waiting on. */
	const pending = /* @__PURE__ */ new Map();
	function setRole(next) {
		if (role === next) return;
		role = next;
		for (const listener of roleListeners) listener(next);
	}
	function post(message) {
		if (!disposed) channel.postMessage(message);
	}
	async function becomeOwner() {
		setRole("owner");
		post({
			k: "owner",
			who: me
		});
		for (const [id, entry] of [...pending]) {
			clearTimeout(entry.timer);
			pending.delete(id);
			try {
				if (loads === 0) {
					loads += 1;
					await options.load();
				}
				const result = await options.run(entry.payload, entry.onToken);
				entry.settle({
					...result,
					ranOn: "owner"
				});
			} catch (error) {
				entry.settle({
					ok: false,
					reason: error instanceof Error ? error.message : "The model failed.",
					ranOn: "owner"
				});
			}
		}
	}
	async function handleRequest(message) {
		if (role !== "owner") return;
		try {
			if (loads === 0) {
				loads += 1;
				await options.load();
			}
			const result = await options.run(message.payload, (t) => post({
				k: "tok",
				id: message.id,
				t
			}));
			post({
				k: "end",
				id: message.id,
				ok: result.ok,
				reason: result.reason,
				data: result.data
			});
		} catch (error) {
			post({
				k: "end",
				id: message.id,
				ok: false,
				reason: error instanceof Error ? error.message : "The model failed."
			});
		}
	}
	function failPending(reason) {
		for (const [, entry] of pending) {
			clearTimeout(entry.timer);
			entry.settle({
				ok: false,
				reason
			});
		}
		pending.clear();
	}
	channel.onmessage = (event) => {
		const message = event.data;
		if (!message || typeof message !== "object") return;
		switch (message.k) {
			case "req":
				handleRequest(message);
				return;
			case "who":
				if (role === "owner") post({
					k: "owner",
					who: me
				});
				return;
			case "owner":
				if (message.who !== me) retryPending();
				return;
			case "tok":
				pending.get(message.id)?.onToken(message.t);
				return;
			case "end": {
				const entry = pending.get(message.id);
				if (!entry) return;
				clearTimeout(entry.timer);
				pending.delete(message.id);
				entry.settle({
					ok: message.ok,
					reason: message.reason,
					data: message.data,
					ranOn: "follower-forwarded"
				});
				return;
			}
		}
	};
	/** Re-send anything in flight, ONCE, to whoever owns the model now. */
	const retried = /* @__PURE__ */ new Set();
	function retryPending() {
		for (const [id, entry] of pending) {
			if (retried.has(id)) continue;
			retried.add(id);
			clearTimeout(entry.timer);
			entry.timer = setTimeout(() => {
				pending.delete(id);
				entry.settle({
					ok: false,
					reason: "The tab holding the model did not answer."
				});
			}, timeoutMs);
			post({
				k: "req",
				id,
				from: me,
				payload: entry.payload
			});
		}
	}
	async function request(payload, onToken) {
		if (disposed) return {
			ok: false,
			reason: "This tab has stopped using the model."
		};
		if (role === "owner") {
			if (loads === 0) {
				loads += 1;
				await options.load();
			}
			return {
				...await options.run(payload, onToken),
				ranOn: "owner"
			};
		}
		const id = `${me}-${Math.random().toString(36).slice(2, 10)}`;
		return new Promise((resolve) => {
			const entry = {
				onToken,
				settle: resolve,
				payload,
				timer: setTimeout(() => {
					pending.delete(id);
					resolve({
						ok: false,
						reason: "The tab holding the model did not answer."
					});
				}, timeoutMs)
			};
			pending.set(id, entry);
			post({
				k: "req",
				id,
				from: me,
				payload
			});
		});
	}
	if (modelOwnerSupported()) {
		navigator.locks.request(lockName, { mode: "exclusive" }, async () => {
			if (disposed) return;
			await becomeOwner();
			await new Promise((resolve) => {
				releaseLock = resolve;
			});
		}).catch(() => {});
		setRole("follower");
		post({ k: "who" });
	} else becomeOwner();
	return {
		role: () => role,
		request,
		loadCount: () => loads,
		onRoleChange: (listener) => {
			roleListeners.add(listener);
			return () => roleListeners.delete(listener);
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			failPending("This tab stopped using the model.");
			releaseLock?.();
			channel.close();
		}
	};
}
function shareAcrossTabs(inner) {
	if (!modelOwnerSupported()) return inner;
	let handle = null;
	function owner() {
		if (handle) return handle;
		handle = createModelOwner({
			load: async () => {},
			run: async (payload, onToken) => {
				const request = payload;
				if (request.kind === "preload") {
					await inner.preload?.();
					return { ok: true };
				}
				const result = await inner.stream(request.messages, {
					onToken,
					think: request.think
				});
				return result.ok ? {
					ok: true,
					data: { modelId: result.modelId }
				} : {
					ok: false,
					reason: result.reason ?? "The browser engine failed."
				};
			}
		});
		return handle;
	}
	return {
		id: inner.id,
		displayName: inner.displayName,
		probe: () => inner.probe(),
		async preload() {
			const result = await owner().request({ kind: "preload" }, () => {});
			if (!result.ok) throw new Error(result.reason ?? "The browser engine could not warm up.");
		},
		async stream(messages, handlers) {
			const coordinator = owner();
			if (handlers.signal !== void 0 || (handlers.tools?.length ?? 0) > 0 || coordinator.role() === "owner") return inner.stream(messages, handlers);
			const startedAt = Date.now();
			let firstTokenMs = null;
			const result = await coordinator.request({
				kind: "stream",
				messages,
				think: handlers.think
			}, (token) => {
				if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
				handlers.onToken(token);
			});
			const modelId = typeof result.data === "object" && result.data !== null ? result.data.modelId ?? null : null;
			return result.ok ? {
				ok: true,
				modelId,
				firstTokenMs
			} : {
				ok: false,
				failure: "error",
				reason: result.reason ?? "The tab holding the on-device model did not answer. Reload this tab to take it over."
			};
		},
		async dispose() {
			handle?.dispose();
			handle = null;
			await inner.dispose?.();
		}
	};
}
var BrowserWasmAdapter = class {
	id = "browser_wasm";
	displayName = "OCADE Browser (compatibility)";
	instance = null;
	loadedRepo = null;
	cachedTier = null;
	onProgress;
	constructor(options) {
		this.onProgress = options?.onProgress;
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
		if (quotaBytes !== null && quotaBytes < tier.downloadBytes) return unavailable("insufficient_storage", `OCADE's compatibility engine needs about ${formatSize$1(tier.downloadBytes)} and this browser will only allow ${formatSize$1(quotaBytes)}.`, ["free_storage"]);
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
			downloadLabel: formatSize$1(this.cachedTier.downloadBytes),
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
	async ensureLoaded(tier) {
		const key = storageKeyFor(tier);
		if (this.instance && this.loadedRepo === key) return this.instance;
		if (this.instance) await this.dispose();
		const wllama = await import("./wllama-0Jo7yQto.mjs");
		const singleThreadWasm = (await import("./wllama-BGXHWGTU.mjs")).default;
		const instance = new wllama.Wllama({
			default: singleThreadWasm,
			"single-thread/wllama.wasm": singleThreadWasm
		}, { allowOffline: true });
		const url = ggufUrl(tier);
		if (!key || !url) throw new Error("This browser tier has no model file configured.");
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
var current = {
	stage: "idle",
	fraction: null,
	receivedBytes: null,
	totalBytes: null,
	detail: null
};
var listeners = /* @__PURE__ */ new Set();
function preparationState() {
	return current;
}
function subscribeToPreparation(fn) {
	listeners.add(fn);
	fn(current);
	return () => listeners.delete(fn);
}
/**
* Publish a change.
*
* Partial on purpose: an adapter that knows only the fraction should not have
* to restate the stage, and a stage change should not blank a byte count the
* user is watching.
*/
function publishPreparation(patch) {
	const next = {
		...current,
		...patch
	};
	if (next.stage === current.stage && next.fraction === current.fraction && next.receivedBytes === current.receivedBytes && next.totalBytes === current.totalBytes && next.detail === current.detail) return;
	current = next;
	for (const fn of listeners) fn(current);
}
/**
* Turn a runtime's own progress report into something a person can read.
*
* WebLLM reports a fraction and a sentence full of shard names; wllama reports
* received and total bytes. Both are normalised here so the display never has
* to know which engine it is watching, and so the runtime's own wording — which
* names files and quantisation formats — never reaches the screen.
*/
function describePreparation(state) {
	switch (state.stage) {
		case "idle": return "OCADE is ready to start.";
		case "checking": return "Preparing OCADE Intelligence…";
		case "downloading": {
			const pct = state.fraction === null ? null : Math.round(state.fraction * 100);
			const size = formatSize(state.totalBytes);
			if (pct === null) return size ? `Preparing OCADE Intelligence — ${size}` : "Preparing OCADE Intelligence…";
			return size ? `Preparing OCADE Intelligence — ${pct}% of ${size}` : `Preparing OCADE Intelligence — ${pct}%`;
		}
		case "loading": return "Almost ready — starting OCADE Intelligence…";
		case "ready": return "OCADE Intelligence is ready.";
		case "retrying": return state.detail ?? "Connection interrupted. OCADE will carry on from where it stopped.";
		case "unsupported": return state.detail ?? "This browser cannot run OCADE's on-device intelligence.";
	}
}
function formatSize(bytes) {
	if (bytes === null || bytes <= 0) return null;
	const mb = bytes / 1e6;
	if (mb < 1e3) return `${Math.round(mb)} MB`;
	return `${(mb / 1e3).toFixed(1)} GB`;
}
function useBrain(options) {
	const device = useDevicePolicy();
	const paired = options?.hasPairedDesktop ?? hasPairing();
	const policyRef = (0, import_react.useRef)(device.policy);
	policyRef.current = device.policy;
	const registry = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		map.set("desktop_bridge", new DesktopBridgeAdapter({ policy: () => policyRef.current }));
		map.set("browser_webgpu", shareAcrossTabs(new BrowserWebGpuAdapter({ onProgress: (p) => publishPreparation({
			stage: p.fraction !== null && p.fraction >= 1 ? "loading" : "downloading",
			fraction: p.fraction
		}) })));
		map.set("browser_wasm", new BrowserWasmAdapter({ onProgress: (p) => publishPreparation({
			stage: p.fraction !== null && p.fraction >= 1 ? "loading" : "downloading",
			fraction: p.fraction
		}) }));
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
					publishPreparation({
						stage: "ready",
						fraction: 1
					});
					return;
				}
			} catch {}
			const webgpu = registry.get("browser_webgpu");
			if (!webgpu?.preload) return;
			publishPreparation({
				stage: "checking",
				fraction: null
			});
			try {
				const availability = await webgpu.probe();
				await modelStore.requestPersistence();
				if (availability.available) {
					await webgpu.preload();
					publishPreparation({
						stage: "ready",
						fraction: 1
					});
					return;
				}
				const wasm = registry.get("browser_wasm");
				if (wasm?.preload) {
					const fallback = await wasm.probe();
					if (fallback.available) {
						await wasm.preload();
						publishPreparation({
							stage: "ready",
							fraction: 1
						});
						return;
					}
					publishPreparation({
						stage: "unsupported",
						detail: fallback.reason,
						fraction: null
					});
					return;
				}
				publishPreparation({
					stage: "unsupported",
					detail: availability.reason,
					fraction: null
				});
			} catch {
				publishPreparation({ stage: "retrying" });
			}
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
export { useBrain as i, preparationState as n, subscribeToPreparation as r, describePreparation as t };

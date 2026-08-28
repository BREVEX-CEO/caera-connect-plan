import { n as __exportAll } from "../_runtime.mjs";
import { t as __exportAll$1 } from "./rolldown-runtime-D7D4PA-g.mjs";
import { i as detectPlatform, o as selectFixedModel } from "./fixed-model-DezWsm1J.mjs";
import { a as preloadLocalModel, i as planContextWindow, o as streamLocalChat, r as discoverLocalModels } from "./ocade-local-D4ziVbup.mjs";
import { t as PerfLedger } from "./router-policy-DWW41ATq.mjs";
import { n as unavailable } from "./adapter-BHZ2v_VZ.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/desktop-bridge-D6zQ9cYu.js
var desktop_bridge_D6zQ9cYu_exports = /* @__PURE__ */ __exportAll({
	n: () => desktop_bridge_exports,
	t: () => DesktopBridgeAdapter
});
var desktop_bridge_exports = /* @__PURE__ */ __exportAll$1({ DesktopBridgeAdapter: () => DesktopBridgeAdapter });
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
//#endregion
export { desktop_bridge_D6zQ9cYu_exports as n, DesktopBridgeAdapter as t };

import { a as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { c as createServerFn } from "./createServerFn-CIHAFgYl.mjs";
import { t as requireSupabaseAuth } from "./auth-middleware-tiFBA43n.mjs";
import { t as createSsrRpc } from "./createSsrRpc-7nZ60itO.mjs";
import { n as FIXED_MODEL, r as OCADE_MODEL_ID } from "./ocade-local-CUSjQ2bI.mjs";
import { t as profileFrom } from "./detect-LJYWOPdG.mjs";
import { o as modelStore, t as ModelStore } from "./model-store-DhsdXagY.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/paired-credentials-CoRYM1DE.js
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
function useDevicePolicy() {
	const [state, setState] = (0, import_react.useState)(EMPTY);
	(0, import_react.useEffect)(() => {
		let active = true;
		(async () => {
			if (serverIsThisMachine()) try {
				const profile = await detectHardwareFn();
				if (!active) return;
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
/** Convenience for adapters that are simply not present on this platform. */
function unavailable(code, reason, remedies = []) {
	return {
		available: false,
		code,
		reason,
		remedies
	};
}
/** Human sentence for a remedy, so every surface words it the same way. */
var REMEDY_LABELS = {
	install_ocade: "Install OCADE",
	pair_a_computer: "Pair a computer",
	download_model: "Download the engine",
	start_engine: "Start the engine",
	free_storage: "Free up storage",
	enable_in_settings: "Enable in settings"
};
var CHUNK_FLUSH_BYTES = 4 * 1024 * 1024;
/** Lowercase hex SHA-256 of a blob, using the platform's own crypto. */
async function sha256OfBlob(blob) {
	if (typeof crypto === "undefined" || !crypto.subtle) return null;
	try {
		const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
		return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
	} catch {
		return null;
	}
}
/**
* Is there room for this download?
*
* Uses the origin's remaining quota, which is what actually bounds a browser
* download — free disk is invisible to a page. A browser that will not report
* a quota is treated as unknown and allowed to proceed, because refusing on no
* evidence would block every Firefox user.
*/
async function checkRoom(expectedBytes) {
	if (typeof navigator === "undefined" || !navigator.storage?.estimate) return { ok: true };
	try {
		const estimate = await navigator.storage.estimate();
		if (estimate.quota === void 0) return { ok: true };
		const remaining = estimate.quota - (estimate.usage ?? 0);
		const needed = Math.ceil(expectedBytes * 1.1);
		if (remaining < needed) {
			const mb = (n) => `${Math.round(n / (1024 * 1024))} MB`;
			return {
				ok: false,
				reason: `This needs about ${mb(needed)} and the browser will only allow ${mb(remaining)} more.`
			};
		}
		return { ok: true };
	} catch {
		return { ok: true };
	}
}
async function downloadModel(request) {
	const store = request.store ?? modelStore;
	const doFetch = request.fetchImpl ?? globalThis.fetch;
	if (!ModelStore.isSupported()) return {
		ok: false,
		failure: "storage_unavailable",
		reason: "This browser cannot store a model between visits, so OCADE will not download one."
	};
	if (!doFetch) return {
		ok: false,
		failure: "network",
		reason: "No network client is available."
	};
	if (request.expectedBytes !== void 0) {
		const room = await checkRoom(request.expectedBytes);
		if (!room.ok) return {
			ok: false,
			failure: "insufficient_storage",
			reason: room.reason
		};
	}
	const alreadyHave = await store.sizeOf(request.key);
	const resumed = alreadyHave > 0;
	const existingMeta = await store.readMeta(request.key);
	if (alreadyHave > 0 && existingMeta?.verified) return {
		ok: true,
		key: request.key,
		bytes: alreadyHave,
		verified: true,
		resumed: true
	};
	let response;
	try {
		response = await doFetch(request.url, {
			signal: request.signal,
			headers: alreadyHave > 0 ? { Range: `bytes=${alreadyHave}-` } : void 0
		});
	} catch (error) {
		if (request.signal?.aborted) return {
			ok: false,
			failure: "cancelled",
			reason: "Download stopped."
		};
		return {
			ok: false,
			failure: "network",
			reason: `The download could not start: ${error instanceof Error ? error.message : String(error)}`
		};
	}
	if (response.status === 416 && alreadyHave > 0) return await finishVerified(store, request, alreadyHave, true);
	let writeAt = alreadyHave;
	if (alreadyHave > 0 && response.status !== 206) {
		writeAt = 0;
		await store.remove(request.key);
	}
	if (!response.ok && response.status !== 206) return {
		ok: false,
		failure: "network",
		reason: `The model server answered ${response.status}.`
	};
	if (!response.body) return {
		ok: false,
		failure: "network",
		reason: "The model server sent no data."
	};
	const declared = Number(response.headers.get("content-length") ?? "");
	const totalBytes = request.expectedBytes ?? (Number.isFinite(declared) ? declared + writeAt : null);
	const reader = response.body.getReader();
	let received = writeAt;
	let buffer = [];
	let buffered = 0;
	const flush = async () => {
		if (buffered === 0) return true;
		const merged = new Uint8Array(new ArrayBuffer(buffered));
		let at = 0;
		for (const part of buffer) {
			merged.set(part, at);
			at += part.length;
		}
		const wroteAt = received - buffered;
		buffer = [];
		buffered = 0;
		return store.append(request.key, merged, wroteAt);
	};
	try {
		for (;;) {
			const { done, value } = await reader.read();
			if (done) break;
			if (request.signal?.aborted) {
				await flush();
				return {
					ok: false,
					failure: "cancelled",
					reason: "Download stopped."
				};
			}
			buffer.push(value);
			buffered += value.length;
			received += value.length;
			if (buffered >= CHUNK_FLUSH_BYTES) {
				if (!await flush()) return {
					ok: false,
					failure: "insufficient_storage",
					reason: "The browser stopped accepting data, which usually means storage is full."
				};
			}
			request.onProgress?.({
				receivedBytes: received,
				totalBytes,
				fraction: totalBytes ? Math.min(1, received / totalBytes) : null,
				resumedFromBytes: writeAt
			});
		}
		if (!await flush()) return {
			ok: false,
			failure: "insufficient_storage",
			reason: "The browser stopped accepting data, which usually means storage is full."
		};
	} catch (error) {
		await flush();
		if (request.signal?.aborted) return {
			ok: false,
			failure: "cancelled",
			reason: "Download stopped."
		};
		return {
			ok: false,
			failure: "network",
			reason: `The download was interrupted: ${error instanceof Error ? error.message : String(error)}`
		};
	}
	return await finishVerified(store, request, await store.sizeOf(request.key), resumed);
}
/**
* Prefer weights this deployment serves itself over the publisher's host.
*
* A HEAD, not a GET: the question is only "is it there", and asking it with a
* GET would start pulling hundreds of megabytes just to find out. A deployment
* that does not self-host answers 404 in a millisecond on its own origin and
* the remote URL is used exactly as before.
*
* Any failure — 404, an origin that rejects HEAD, no network at all — falls
* through to `remoteUrl`. This can only ever AVOID an external request; it can
* never cause one, and it can never be the reason a download fails.
*/
async function preferredWeightsUrl(sameOriginUrl, remoteUrl, fetchImpl) {
	const doFetch = fetchImpl ?? globalThis.fetch;
	if (!sameOriginUrl || !doFetch) return {
		url: remoteUrl,
		local: false
	};
	try {
		if ((await doFetch(sameOriginUrl, { method: "HEAD" })).ok) return {
			url: sameOriginUrl,
			local: true
		};
	} catch {}
	return {
		url: remoteUrl,
		local: false
	};
}
/**
* Install weights from a file the user already has, with NO NETWORK AT ALL.
*
* WHY THIS EXISTS. Everything else in this module assumes the engine arrives
* over a connection, and `downloadModel` is careful about every way that can
* go wrong. What it cannot do is help the case where there is no connection to
* be careful with: an air-gapped machine, a locked-down site network, a
* metered link nobody will spend 470 MB on, or a fleet that must not fetch
* from a third-party host on first run. Those deployments could not obtain an
* engine at all, so "works offline once downloaded" quietly meant "does not
* work here, ever" — the first download was the one step that could not be
* done offline.
*
* This closes that. The bytes come from a file the operator already has, and
* the ONLY difference from a completed download is where they came from:
*
*  - it is written to the same key, so the adapter finds it with no special
*    case and the storage screen lists it like any other engine;
*  - it is hashed against the SAME committed digest, so an imported file is
*    held to exactly the standard a downloaded one is. A file someone was
*    handed on a USB stick deserves more scrutiny than one fetched over TLS,
*    not less;
*  - a mismatch DELETES it, for the reason given at the top of this file —
*    weights that are almost right load happily and answer nonsense.
*
* It calls no fetch and takes no URL, so it cannot silently fall back to the
* network. That is a property worth keeping deliberately: this function is the
* evidence that OCADE can reach a working engine with the radio off.
*/
async function importModelFile(request) {
	const store = request.store ?? modelStore;
	if (!ModelStore.isSupported()) return {
		ok: false,
		failure: "storage_unavailable",
		reason: "This browser cannot store a model between visits, so OCADE will not import one."
	};
	const totalBytes = request.file.size;
	const room = await checkRoom(totalBytes);
	if (!room.ok) return {
		ok: false,
		failure: "insufficient_storage",
		reason: room.reason
	};
	await store.remove(request.key);
	const reader = request.file.stream().getReader();
	let written = 0;
	let buffer = [];
	let buffered = 0;
	const flush = async () => {
		if (buffered === 0) return true;
		const merged = new Uint8Array(new ArrayBuffer(buffered));
		let at = 0;
		for (const part of buffer) {
			merged.set(part, at);
			at += part.length;
		}
		const wroteAt = written - buffered;
		buffer = [];
		buffered = 0;
		return store.append(request.key, merged, wroteAt);
	};
	const outOfRoom = async () => {
		await store.remove(request.key);
		return {
			ok: false,
			failure: "insufficient_storage",
			reason: "The browser stopped accepting data, which usually means storage is full."
		};
	};
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer.push(value);
		buffered += value.length;
		written += value.length;
		if (buffered >= CHUNK_FLUSH_BYTES && !await flush()) return await outOfRoom();
		request.onProgress?.({
			receivedBytes: written,
			totalBytes,
			fraction: totalBytes > 0 ? Math.min(1, written / totalBytes) : 1
		});
	}
	if (!await flush()) return await outOfRoom();
	const finished = await finishVerified(store, {
		key: request.key,
		url: "",
		sha256: request.sha256,
		expectedBytes: totalBytes
	}, await store.sizeOf(request.key), false);
	return finished.ok ? {
		ok: true,
		key: finished.key,
		bytes: finished.bytes,
		verified: finished.verified
	} : {
		ok: false,
		failure: "digest_mismatch",
		reason: finished.reason
	};
}
/**
* Hash what is on disk, record the result, and decide whether it may be used.
*
* Shared by the normal completion path and the 416 path, so a download that
* turned out to be already complete gets the SAME scrutiny as one that just
* finished streaming. Verifying in one place and trusting in the other is how
* a corrupt file ends up loaded.
*/
async function finishVerified(store, request, finalBytes, resumed) {
	let verified = false;
	if (request.sha256) {
		const blob = await store.readBlob(request.key);
		const actual = blob ? await sha256OfBlob(blob) : null;
		if (actual === null) verified = false;
		else if (actual.toLowerCase() !== request.sha256.toLowerCase()) {
			await store.remove(request.key);
			return {
				ok: false,
				failure: "digest_mismatch",
				reason: "The downloaded engine did not match its published fingerprint, so OCADE deleted it rather than run it."
			};
		} else verified = true;
	}
	await store.writeMeta(request.key, {
		verified,
		expectedBytes: request.expectedBytes ?? finalBytes,
		sha256: request.sha256
	});
	return {
		ok: true,
		key: request.key,
		bytes: finalBytes,
		verified,
		resumed
	};
}
async function hmacSha256(secret, message) {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {
		name: "HMAC",
		hash: "SHA-256"
	}, false, ["sign"]);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
	return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
var PairedDesktopAdapter = class {
	id = "paired_desktop";
	displayName = "Paired computer";
	credentials;
	fetchImpl;
	constructor(options) {
		this.credentials = options.credentials;
		this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
	}
	/** Build the headers that prove who this is, fresh for every request. */
	async authHeaders(creds) {
		const issuedAt = Date.now();
		const nonce = crypto.randomUUID();
		const origin = typeof window === "undefined" ? "" : window.location.origin;
		const signature = await hmacSha256(creds.secret, `${creds.deviceId}|${origin}|${issuedAt}|${nonce}`);
		return {
			"content-type": "application/json",
			"x-ocade-device": creds.deviceId,
			"x-ocade-issued-at": String(issuedAt),
			"x-ocade-nonce": nonce,
			"x-ocade-signature": signature
		};
	}
	async probe() {
		const creds = this.credentials.current();
		if (!creds) return unavailable("not_paired", "No computer is paired with this device yet.", ["pair_a_computer"]);
		try {
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), 4e3);
			const response = await this.fetchImpl(`${creds.bridgeUrl.replace(/\/+$/, "")}/status`, {
				headers: await this.authHeaders(creds),
				signal: controller.signal
			});
			clearTimeout(timer);
			if (response.status === 401 || response.status === 403) return unavailable("not_paired", "That computer no longer accepts this device. Pair it again.", ["pair_a_computer"]);
			if (!response.ok) return unavailable("not_running", `The paired computer answered ${response.status}.`);
			const body = await response.json();
			return {
				available: true,
				label: body.label ?? "Paired computer",
				locality: "paired_device",
				modelId: body.modelId ?? null,
				capabilities: {
					text: true,
					vision: body.vision === true,
					imageGeneration: false,
					tools: body.tools === true
				}
			};
		} catch {
			return unavailable("not_running", "The paired computer is not reachable right now.", ["pair_a_computer"]);
		}
	}
	async stream(messages, handlers) {
		const creds = this.credentials.current();
		if (!creds) return {
			ok: false,
			failure: "unavailable",
			reason: "No computer is paired with this device."
		};
		const startedAt = Date.now();
		let firstTokenMs = null;
		try {
			const response = await this.fetchImpl(`${creds.bridgeUrl.replace(/\/+$/, "")}/chat`, {
				method: "POST",
				headers: await this.authHeaders(creds),
				body: JSON.stringify({
					messages,
					think: handlers.think === true
				}),
				signal: handlers.signal
			});
			if (response.status === 401 || response.status === 403) return {
				ok: false,
				failure: "unavailable",
				reason: "That computer refused this device. Pair it again."
			};
			if (response.status === 429) return {
				ok: false,
				failure: "error",
				reason: "The paired computer is busy. Try again in a moment."
			};
			if (!response.ok || !response.body) return {
				ok: false,
				failure: "error",
				reason: `The paired computer answered ${response.status}.`
			};
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";
			let modelId = null;
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				if (handlers.signal?.aborted) break;
				buffer += decoder.decode(value, { stream: true });
				let newline;
				while ((newline = buffer.indexOf("\n")) >= 0) {
					const line = buffer.slice(0, newline).trim();
					buffer = buffer.slice(newline + 1);
					if (!line) continue;
					try {
						const event = JSON.parse(line);
						if (event.modelId) modelId = event.modelId;
						if (event.token) {
							if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
							handlers.onToken(event.token);
						}
					} catch {}
				}
			}
			if (handlers.signal?.aborted) return {
				ok: false,
				failure: "cancelled",
				reason: "Stopped."
			};
			return {
				ok: true,
				modelId,
				firstTokenMs
			};
		} catch (error) {
			if (handlers.signal?.aborted) return {
				ok: false,
				failure: "cancelled",
				reason: "Stopped."
			};
			return {
				ok: false,
				failure: "error",
				reason: `The paired computer stopped responding: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}
};
/**
* Where this browser keeps its pairing.
*
* The shared secret lives here and is used only to SIGN — it is never sent
* anywhere, which is what makes storing it defensible at all. It is scoped to
* this browser deliberately: a pairing authorises one specific device to use
* one specific computer, and syncing it would silently extend that permission
* to every device the user signs in on.
*/
var KEY = "ocade.pairing.v1";
function read() {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (typeof parsed.deviceId !== "string" || typeof parsed.bridgeUrl !== "string" || typeof parsed.secret !== "string" || !parsed.deviceId || !parsed.secret) return null;
		let url;
		try {
			url = new URL(parsed.bridgeUrl);
		} catch {
			return null;
		}
		const loopback = [
			"localhost",
			"127.0.0.1",
			"[::1]"
		].includes(url.hostname);
		if (url.protocol !== "https:" && !loopback) return null;
		return {
			deviceId: parsed.deviceId,
			bridgeUrl: parsed.bridgeUrl,
			secret: parsed.secret
		};
	} catch {
		return null;
	}
}
var pairedCredentials = { current: read };
/** Store a pairing after the user approved it on the desktop. */
function savePairing(credentials) {
	if (typeof window === "undefined") return false;
	try {
		window.localStorage.setItem(KEY, JSON.stringify(credentials));
		return true;
	} catch {
		return false;
	}
}
/** Forget the pairing on THIS device. Revoking on the desktop is separate. */
function forgetPairing() {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(KEY);
	} catch {}
}
function hasPairing() {
	return read() !== null;
}
//#endregion
export { forgetPairing as a, pairedCredentials as c, serverIsThisMachine as d, unavailable as f, downloadModel as i, preferredWeightsUrl as l, REMEDY_LABELS as n, hasPairing as o, useDevicePolicy as p, describeDeviceSource as r, importModelFile as s, PairedDesktopAdapter as t, savePairing as u };

import { i as detectPlatform, o as selectFixedModel } from "./fixed-model-DezWsm1J.mjs";
import { o as streamLocalChat, r as discoverLocalModels, t as DEFAULT_LOCAL_BRIDGE_URL } from "./ocade-local-D4ziVbup.mjs";
import { t as PerfLedger } from "./router-policy-DWW41ATq.mjs";
import { i as pruneNonces, n as authorisePairedRequest, r as createPairingState } from "./pairing-DCQPVIpW.mjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
//#region node_modules/.nitro/vite/services/ssr/assets/bridge-host.server-C838YxDF.js
/** Pull the four signed headers into the shape the policy expects. */
function readPairingRequest(headers, origin) {
	const deviceId = headers["x-ocade-device"];
	const issuedAtRaw = headers["x-ocade-issued-at"];
	const nonce = headers["x-ocade-nonce"];
	const signature = headers["x-ocade-signature"];
	if (!deviceId || !issuedAtRaw || !nonce || !signature) return null;
	const issuedAt = Number(issuedAtRaw);
	if (!Number.isFinite(issuedAt)) return null;
	return {
		deviceId,
		origin,
		issuedAt,
		nonce,
		signature
	};
}
/**
* Map a denial to an HTTP status.
*
* 401 for "prove who you are again", 403 for "you are known and not allowed",
* 429 for rate limiting. The DISTINCTION MATTERS to the browser adapter: 401
* and 403 make it tell the user to pair again, while 429 makes it say the
* computer is busy. Collapsing them into one status would produce the wrong
* advice for half of the failures.
*/
function statusForDenial(code) {
	switch (code) {
		case "rate_limited": return 429;
		case "unknown_device":
		case "bad_signature":
		case "expired":
		case "clock_skew":
		case "replayed": return 401;
		case "revoked":
		case "origin_not_allowed": return 403;
		default: return 401;
	}
}
/**
* Authorise one request. Returns null when it may proceed.
*
* The refusal body carries a CODE and a sentence, and deliberately nothing
* else — no hint about which check failed beyond the code itself, no echo of
* the submitted signature, and never a list of known devices.
*/
function authoriseBridgeRequest(request, deps) {
	const origin = request.headers["origin"] ?? "";
	const parsed = readPairingRequest(request.headers, origin);
	if (!parsed) return {
		status: 401,
		body: {
			error: "unsigned",
			message: "This request was not signed."
		}
	};
	pruneNonces(deps.state, deps.now());
	const decision = authorisePairedRequest(deps.state, parsed, deps);
	if (!decision.allowed) return {
		status: statusForDenial(decision.code),
		body: {
			error: decision.code,
			message: decision.reason
		}
	};
	return null;
}
/** `GET /status` — what this computer can do, for a device deciding whether to ask. */
async function handleStatus(request, deps) {
	const refusal = authoriseBridgeRequest(request, deps);
	if (refusal) return refusal;
	const engine = await deps.describeEngine();
	if (!engine) return {
		status: 503,
		body: {
			error: "no_engine",
			message: "This computer has no engine ready right now."
		}
	};
	return {
		status: 200,
		body: engine
	};
}
/**
* `POST /chat` — newline-delimited JSON of `{ token }`, optionally `{ modelId }`.
*
* Note the ORDER: authorisation, then validation, then the engine. The engine
* is not touched until both have passed.
*/
async function handleChat(request, deps) {
	const refusal = authoriseBridgeRequest(request, deps);
	if (refusal) return {
		status: refusal.status,
		body: refusal.body
	};
	const body = request.body;
	const messages = body?.messages;
	if (!Array.isArray(messages) || messages.length === 0) return {
		status: 400,
		body: {
			error: "no_messages",
			message: "That request contained no messages."
		}
	};
	if (messages.some((m) => typeof m?.content !== "string" || ![
		"system",
		"user",
		"assistant"
	].includes(m?.role))) return {
		status: 400,
		body: {
			error: "bad_messages",
			message: "That request contained a malformed message."
		}
	};
	return {
		status: 200,
		stream: async (write, signal) => {
			const result = await deps.streamChat(messages, {
				signal,
				think: body?.think === true,
				onToken: (token) => write(`${JSON.stringify({ token })}\n`)
			});
			if (result.modelId) write(`${JSON.stringify({ modelId: result.modelId })}\n`);
			if (!result.ok && result.reason) write(`${JSON.stringify({ error: result.reason })}\n`);
		}
	};
}
/** Route one request. The only entry point a transport should call. */
async function handleBridgeRequest(request, deps) {
	const path = request.path.replace(/\/+$/, "") || "/";
	if (path === "/status" && request.method.toUpperCase() === "GET") return handleStatus(request, deps);
	if (path === "/chat" && request.method.toUpperCase() === "POST") return handleChat(request, deps);
	return {
		status: 404,
		body: {
			error: "not_found",
			message: "No such endpoint."
		}
	};
}
/**
* The listener side of pairing: what actually runs `bridge-server` on a machine.
*
* WHY THIS FILE IS `.server` AND LOADED WITH `await import`. It signs with
* `node:crypto` and reads the approved-device list off disk. Neither belongs in
* a browser bundle, and a static import from a route would drag both into it.
*
* IT IS OFF UNTIL SOMEBODY TURNS IT ON, AND THAT SOMEBODY IS NOT THE NETWORK.
* `OCADE_BRIDGE_ENABLED=1` is required, and so is a device file — an approved
* pairing is a decision a human made at the machine, so there is no code path
* here that creates one. A hosted deployment has neither, which is why the
* endpoint 404s there: OCADE's cloud must never answer as though it were the
* user's own computer, because the whole promise of a paired device is that the
* hardware belongs to them.
*
* WITH THE FLAG SET AND NO APPROVED DEVICES, EVERY REQUEST IS REFUSED. That is
* the correct behaviour, not an unfinished one: the device list is the
* allowlist, and an empty allowlist allows nobody.
*/
/** Where the desktop shell writes the devices a human approved. */
var DEVICE_FILE_ENV = "OCADE_BRIDGE_DEVICES";
var ENABLE_ENV = "OCADE_BRIDGE_ENABLED";
function readBridgeConfig(env = process.env) {
	return {
		enabled: env[ENABLE_ENV] === "1",
		deviceFile: env[DEVICE_FILE_ENV] || null
	};
}
/**
* Parse the approved-device file.
*
* Strict, and silent about why on purpose: this runs on the machine's own disk,
* so a malformed entry is a bug to fix locally, but a half-read allowlist that
* silently admitted a device with no origin would be a hole. Anything that does
* not carry all four fields is dropped rather than defaulted.
*/
function parseDeviceFile(contents) {
	let parsed;
	try {
		parsed = JSON.parse(contents);
	} catch {
		return [];
	}
	const rows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.devices) ? parsed.devices : [];
	const devices = [];
	for (const row of rows) {
		const device = row;
		if (typeof device?.id !== "string" || typeof device?.label !== "string" || typeof device?.origin !== "string" || typeof device?.secret !== "string" || !device.id || !device.origin || !device.secret) continue;
		devices.push({
			id: device.id,
			label: device.label,
			origin: device.origin,
			secret: device.secret,
			approvedAt: typeof device.approvedAt === "number" ? device.approvedAt : 0,
			...typeof device.revokedAt === "number" ? { revokedAt: device.revokedAt } : {}
		});
	}
	return devices;
}
/**
* The signature the browser adapter computes, recomputed here.
*
* It must stay byte-identical to `paired-desktop.ts`'s `authHeaders`, which is
* why the field order is written out rather than derived from an object: a
* reordering there and not here would refuse every genuine request, and the
* only symptom would be "pair again" forever.
*/
function signPairingRequest(secret, request) {
	return createHmac("sha256", secret).update(`${request.deviceId}|${request.origin}|${request.issuedAt}|${request.nonce}`).digest("hex");
}
/** Length-safe constant-time compare; `===` on a signature leaks it by timing. */
function constantTimeEqual(a, b) {
	const left = Buffer.from(a, "utf8");
	const right = Buffer.from(b, "utf8");
	if (left.length !== right.length) return false;
	return timingSafeEqual(left, right);
}
var state = null;
var loadedFrom = null;
new PerfLedger();
async function pairingState(config) {
	if (state && loadedFrom === config.deviceFile) return state;
	let devices = [];
	if (config.deviceFile) try {
		devices = parseDeviceFile(await readFile(config.deviceFile, "utf8"));
	} catch {
		devices = [];
	}
	state = createPairingState(devices);
	loadedFrom = config.deviceFile;
	return state;
}
/** Origins this machine will answer at all — exactly the approved ones. */
async function approvedOrigins(config = readBridgeConfig()) {
	if (!config.enabled) return /* @__PURE__ */ new Set();
	const current = await pairingState(config);
	return new Set([...current.devices.values()].filter((device) => device.revokedAt === void 0).map((device) => device.origin));
}
/** Describe this machine's engine, or null when it has none ready. */
/**
* The one model, for the paired-device path too.
*
* A phone talking to this computer must get the SAME engine the computer's own
* screen gets. When selection lived in `routeTask`, the paired path could pick
* a different model than the local one on the same machine — so the answer a
* user got depended on which device they asked from, which is indefensible for
* a product whose whole promise is consistency.
*/
async function fixedModelFor(models, visionRequired) {
	const choice = selectFixedModel({
		platform: detectPlatform(),
		installed: models.map((m) => ({
			id: m.id,
			vision: m.vision,
			sizeBytes: m.sizeBytes,
			isCloudPointer: m.isCloudPointer
		})),
		visionRequired
	});
	return {
		ok: choice.ok,
		modelId: choice.modelId,
		reason: choice.reason
	};
}
async function describeEngine(engineUrl) {
	const discovery = await discoverLocalModels(engineUrl);
	if (!discovery.reachable || discovery.models.length === 0) return null;
	const chosen = await fixedModelFor(discovery.models, false);
	if (!chosen.ok || !chosen.modelId) return null;
	return {
		label: "Paired computer",
		modelId: chosen.modelId,
		vision: discovery.models.some((model) => model.vision),
		tools: false
	};
}
function bridgeDeps(state, engineUrl = DEFAULT_LOCAL_BRIDGE_URL) {
	return {
		state,
		now: () => Date.now(),
		sign: (device, request) => signPairingRequest(device.secret, request),
		constantTimeEqual,
		describeEngine: () => describeEngine(engineUrl),
		streamChat: async (messages, handlers) => {
			const discovery = await discoverLocalModels(engineUrl);
			if (!discovery.reachable) return {
				ok: false,
				reason: "The engine on that computer is not running."
			};
			const needsVision = messages.some((message) => (message.images?.length ?? 0) > 0);
			const chosen = await fixedModelFor(discovery.models, needsVision);
			if (!chosen.ok || !chosen.modelId) return {
				ok: false,
				reason: chosen.reason ?? (needsVision ? "That computer has no model installed that can read images." : "That computer does not have OCADE's engine installed.")
			};
			return {
				...await streamLocalChat(engineUrl, chosen.modelId, messages.map((message) => ({
					role: message.role,
					content: message.content,
					...message.images?.length ? { images: message.images } : {}
				})), {
					onToken: handlers.onToken,
					signal: handlers.signal,
					think: handlers.think
				}),
				modelId: chosen.modelId
			};
		}
	};
}
/**
* Serve one request, or refuse to exist.
*
* `null` means "this machine is not a bridge" and the caller should answer 404
* rather than 401 — a disabled bridge should look like no endpoint at all, not
* like a locked one, because a locked one advertises that there is something
* behind it.
*/
async function serveBridgeRequest(request, config = readBridgeConfig(), engineUrl = process.env.OCADE_ENGINE_URL || "http://localhost:11434") {
	if (!config.enabled) return null;
	return handleBridgeRequest(request, bridgeDeps(await pairingState(config), engineUrl));
}
//#endregion
export { approvedOrigins, serveBridgeRequest };

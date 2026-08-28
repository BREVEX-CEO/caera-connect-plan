import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { o as require_jsx_runtime } from "../_libs/@radix-ui/react-collection+[...].mjs";
import { E as Smartphone, M as ShieldCheck, N as ShieldAlert, St as OctagonX, Y as RefreshCw, _r as Bell, a as WifiOff, h as Trash2, ir as Check, t as X, tt as QrCode, z as Send } from "../_libs/lucide-react.mjs";
import { l as isProtectedText } from "./companion-bridge-CJ48JKAT.mjs";
import { t as Button } from "./button-Bq5vK6RO.mjs";
import { t as GlassPanel } from "./GlassPanel-YTcQg8L0.mjs";
import { t as PageHeader } from "./PageHeader-EiyP9gGX.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { t as computerUseChannelDecision } from "./computer-use-settings-EFoxzXrd.mjs";
import { t as EmptyState } from "./EmptyState-Bm7ErAtz.mjs";
import { t as Input } from "./input-B8Q2ztVi.mjs";
import { t as useOnline } from "./use-online-DzqlfJYh.mjs";
import { _ as saveApprovalStatus, a as clearApprovals, c as expireIfDue, d as listApprovals, f as notify, g as revokedNotification, i as canEmergencyStop, l as getNotificationTransport, m as pruneApprovals, n as PAIRING_TTL_MS, o as createPairingChallenge, p as pairingPayload, r as applyEmergencyStop, s as decideApproval, t as NOTIFICATIONS_UNAVAILABLE, u as isTrusted, v as stoppedNotification, y as verifyPairing } from "./approval-store-Co53E13u.mjs";
import { t as OfflineQueue } from "./offline-queue-D2sVr9wl.mjs";
import { a as revokeDevice, i as listDevices, o as saveDevice, r as forgetDevice, s as touchDevice, t as activeDevices } from "./device-store-CRf9IOAa.mjs";
import { n as entitlementState, t as canRegisterDevice } from "./ocade-allowance-DRczz3oN.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/settings.mobile-DON-jxIh.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* OCADE mobile companion link (Plan §27).
*
* The mobile app is a MONITOR AND APPROVER, never a remote control: it can see
* what the desktop is doing, approve/deny/cancel it, hand a task over and
* trigger emergency stop. It can never issue arbitrary desktop commands.
*
* This module is the transport-agnostic decision layer over the already-tested
* pairing primitives in `./pairing`. Execution (push, sockets, Capacitor
* plugins) plugs in behind `MobileTransport`; with none connected everything
* reports honestly as unavailable.
*/
/** Intents that move data or stop work need a fresh biometric confirmation. */
var BIOMETRIC_REQUIRED = [
	"approval.decide",
	"emergency.stop",
	"file.handoff",
	"clipboard.handoff"
];
/**
* Decide whether an intent from a phone may proceed. Pure and total.
* A revoked, stale or unknown device is refused before anything else.
*/
function decideMobileIntent(intent, device, now = /* @__PURE__ */ new Date()) {
	if (!device) return {
		allow: false,
		reason: "This device is not paired with your account."
	};
	if (device.kind !== "mobile") return {
		allow: false,
		reason: "Only a paired mobile device can send this."
	};
	if (intent.kind === "emergency.stop") {
		const check = canEmergencyStop(device);
		return check.allowed ? {
			allow: true,
			requiresBiometric: true
		} : {
			allow: false,
			reason: check.reason ?? "Emergency stop is not available."
		};
	}
	if (device.revoked) return {
		allow: false,
		reason: "This device was revoked. Pair it again to continue."
	};
	if (!isTrusted(device, now)) return {
		allow: false,
		reason: "This device hasn't been verified recently. Unlock it and pair again."
	};
	if (intent.kind === "file.handoff" && intent.sizeBytes > 26214400) return {
		allow: false,
		reason: "That file is too large to hand off from mobile."
	};
	if ((intent.kind === "clipboard.handoff" || intent.kind === "task.handoff") && isProtectedText(intent.text)) return {
		allow: false,
		reason: "That looks like a password, one-time code or payment detail. OCADE won't send it — please enter it directly where it's needed."
	};
	return {
		allow: true,
		requiresBiometric: BIOMETRIC_REQUIRED.includes(intent.kind)
	};
}
/**
* Apply a mobile approval decision to a pending request, honouring expiry.
* Returns the resulting status plus a human reason for the audit trail.
*/
function applyMobileApproval(request, decision, device, now = /* @__PURE__ */ new Date()) {
	const current = expireIfDue(request, now);
	if (current.status === "expired") return {
		status: "expired",
		reason: "This request expired before it was answered."
	};
	const result = decideApproval(current, decision, device, now);
	return result.ok ? {
		status: result.request.status,
		reason: `Decided on your phone: ${decision}.`
	} : {
		status: current.status,
		reason: result.reason
	};
}
var MOBILE_TRANSPORT_UNAVAILABLE = "The OCADE mobile companion isn't connected. Pair your phone to monitor and approve tasks.";
var MOBILE_BIOMETRIC_UNAVAILABLE = "Biometric confirmation is not connected in this build. Open the native mobile companion to continue.";
var UnavailableMobileTransport = class {
	async status() {
		return {
			connected: false,
			reason: MOBILE_TRANSPORT_UNAVAILABLE
		};
	}
	async send() {
		return {
			ok: false,
			detail: MOBILE_TRANSPORT_UNAVAILABLE
		};
	}
};
var UnavailableMobileBiometricGate = class {
	async confirm() {
		return {
			ok: false,
			detail: MOBILE_BIOMETRIC_UNAVAILABLE
		};
	}
};
var transport = new UnavailableMobileTransport();
var biometricGate = new UnavailableMobileBiometricGate();
function getMobileTransport() {
	return transport;
}
function setMobileTransport(next) {
	transport = next;
}
/**
* Ask the native gate for a fresh biometric acknowledgement.
*
* The page cannot pass `true` to bypass this. With no native implementation the
* result is explicitly unavailable, and no approval, stop, or protected
* hand-off is applied locally.
*/
async function confirmMobileBiometric(intent, device) {
	return biometricGate.confirm(intent, device);
}
/**
* Offline queue: intents raised with no connectivity are held and replayed.
* Only intents that are SAFE to retry are queued — a stop or approval must be
* decided live, never replayed later against a different task.
*/
var REPLAYABLE = [
	"task.handoff",
	"file.handoff",
	"clipboard.handoff"
];
function isReplayable(intent) {
	return REPLAYABLE.includes(intent.kind);
}
function enqueueIfSafe(queue, intent, now = /* @__PURE__ */ new Date()) {
	if (!isReplayable(intent)) return {
		queued: false,
		reason: "This needs a live connection — it can't be queued and replayed later.",
		queue
	};
	return {
		queued: true,
		reason: "Saved. It will be sent when your phone reconnects.",
		queue: [...queue, {
			intent,
			queuedAt: now.toISOString()
		}]
	};
}
/**
* Durable backing store for the offline queue.
*
* The in-memory `QueuedIntent[]` above is pure and easy to test, but it dies
* with the tab — so a handoff raised on a train would silently vanish. This
* survives reload and crash. `isReplayable` is passed as the gate, so a stop or
* an approval is refused at enqueue time here too.
*/
function createMobileIntentQueue() {
	return new OfflineQueue("caera:mobile:queue:v1", isReplayable, {
		maxItems: 50,
		maxAttempts: 3
	});
}
/** Full guarded dispatch: trust → policy → biometric → transport. */
async function dispatchMobileIntent(intent, device, opts = {}) {
	const now = opts.now ?? /* @__PURE__ */ new Date();
	const decision = decideMobileIntent(intent, device, now);
	if (!decision.allow) return {
		ok: false,
		detail: decision.reason
	};
	if (!device) return {
		ok: false,
		detail: "This device is not paired with your account."
	};
	if (decision.requiresBiometric) {
		const confirmation = await confirmMobileBiometric(intent, device);
		if (!confirmation.ok) return confirmation;
	}
	if (opts.online === false) {
		const q = enqueueIfSafe(opts.queue ?? [], intent, now);
		if (q.queued) opts.durable?.enqueue(intent);
		return {
			ok: q.queued,
			detail: q.reason,
			queue: q.queue
		};
	}
	const result = await getMobileTransport().send(intent);
	return {
		ok: result.ok,
		detail: result.detail
	};
}
/**
* Replay everything held while offline. Each item is re-checked against the
* CURRENT device state — a phone revoked while offline must not have its queued
* work sent afterwards.
*/
async function flushMobileQueue(queue, device, now = /* @__PURE__ */ new Date()) {
	return queue.flush(async (intent, context) => {
		if (!decideMobileIntent(intent, device, now).allow) return false;
		return (await getMobileTransport().send(intent, { idempotencyKey: context.idempotencyKey })).ok;
	});
}
var WebSocketRelayAdapter = class {
	url;
	roomId;
	ws = null;
	statusListeners = /* @__PURE__ */ new Set();
	messageListeners = /* @__PURE__ */ new Set();
	connected = false;
	constructor(url, roomId) {
		this.url = url;
		this.roomId = roomId;
	}
	async connect() {
		if (this.ws) return;
		return new Promise((resolve, reject) => {
			try {
				this.ws = new WebSocket(`${this.url}?room=${encodeURIComponent(this.roomId)}`);
				this.ws.onopen = () => {
					this.connected = true;
					this.notifyStatus({ connected: true });
					resolve();
				};
				this.ws.onmessage = (event) => {
					try {
						const envelope = JSON.parse(event.data);
						if (envelope && envelope.v === 1) for (const listener of this.messageListeners) listener(envelope);
					} catch {}
				};
				this.ws.onclose = () => {
					this.connected = false;
					this.ws = null;
					this.notifyStatus({
						connected: false,
						reason: "WebSocket closed"
					});
				};
				this.ws.onerror = () => {
					if (!this.connected) reject(/* @__PURE__ */ new Error("WebSocket connection failed"));
				};
			} catch (err) {
				reject(err);
			}
		});
	}
	disconnect() {
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
		this.connected = false;
		this.notifyStatus({
			connected: false,
			reason: "Disconnected manually"
		});
	}
	async status() {
		return { connected: this.connected };
	}
	async send(envelope, options) {
		if (!this.connected || !this.ws) return {
			ok: false,
			detail: "Not connected to relay"
		};
		try {
			this.ws.send(JSON.stringify({
				...envelope,
				_options: options
			}));
			return {
				ok: true,
				detail: "Sent"
			};
		} catch (err) {
			return {
				ok: false,
				detail: String(err)
			};
		}
	}
	subscribe(onMessage) {
		this.messageListeners.add(onMessage);
		return () => {
			this.messageListeners.delete(onMessage);
		};
	}
	on(event, listener) {
		if (event === "status") this.statusListeners.add(listener);
	}
	notifyStatus(status) {
		for (const listener of this.statusListeners) listener(status);
	}
};
/**
* Choose the path, and say why in words a person can act on.
*
* Every refusal names the thing to change. "No transport available" tells a
* user nothing; "your computer did not answer on this network, and OCADE is set
* never to use the relay" tells them either to move onto the same network or to
* change one setting.
*/
function chooseTransportPath(input) {
	const { preference, directConfigured, directReachable, relayConfigured } = input;
	if (preference === "relay_only") return relayConfigured ? {
		path: "relay",
		reason: "OCADE is set to always use the relay."
	} : {
		path: null,
		reason: "OCADE is set to always use the relay, but no relay is configured."
	};
	if (directConfigured && directReachable) return {
		path: "direct",
		reason: "Your devices are on the same network, so nothing goes through the relay."
	};
	if (preference === "direct_only") return {
		path: null,
		reason: directConfigured ? "Your computer did not answer on this network, and OCADE is set never to use the relay." : "No direct address is paired, and OCADE is set never to use the relay."
	};
	if (relayConfigured) return {
		path: "relay",
		reason: directConfigured ? "Your computer is not reachable on this network, so OCADE is using the encrypted relay." : "No direct address is paired, so OCADE is using the encrypted relay."
	};
	return {
		path: null,
		reason: "No direct address is paired and no relay is configured, so there is no way to connect."
	};
}
/**
* Is this address one we are willing to treat as "direct"?
*
* Loopback and private ranges only. A public address would technically work and
* would be the exact opposite of the point — it would send the traffic across
* the internet while telling the user it stayed on their network.
*/
function isDirectAddress(url) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	const host = parsed.hostname.replace(/^\[|\]$/g, "");
	if (host === "localhost" || host === "::1" || host === "127.0.0.1") return true;
	if (/^127\./.test(host)) return true;
	if (/^10\./.test(host)) return true;
	if (/^192\.168\./.test(host)) return true;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
	if (/^169\.254\./.test(host)) return true;
	if (/^fe80:/i.test(host)) return true;
	if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true;
	return false;
}
/**
* The adapter that actually keeps traffic off the relay (HWE-26).
*
* It holds both candidates and connects exactly one. The decision itself is in
* `direct-path.ts` and is pure; this class is the small amount of I/O around
* it — probing the direct address, and delegating once a path is chosen.
*
* TWO PROPERTIES THIS TYPE EXISTS TO GUARANTEE:
*
*  1. THE LOSING PATH IS NEVER CONNECTED. When the direct link works, the relay
*     socket is never opened, so the relay operator never learns the pair
*     exists. Opening it "just in case" would minimise bytes while leaking the
*     metadata that was the reason to avoid it.
*  2. NOBODY IS TOLD THEY ARE DIRECT WHEN THEY ARE NOT. `activePath` is set
*     from the connection that actually succeeded, never from the preference
*     that was asked for.
*/
var PreferredPathAdapter = class {
	options;
	active = null;
	choice = null;
	statusListeners = /* @__PURE__ */ new Set();
	messageListeners = /* @__PURE__ */ new Set();
	unsubscribers = [];
	constructor(options) {
		this.options = options;
	}
	/** Which path is carrying traffic right now, or null before connecting. */
	get activePath() {
		return this.choice?.path ?? null;
	}
	/** The sentence explaining that choice, for the screen. */
	get pathReason() {
		return this.choice?.reason ?? "Not connected.";
	}
	async connect() {
		const { preference, direct, relay } = this.options;
		const directConfigured = direct !== null;
		const choice = chooseTransportPath({
			preference,
			directConfigured,
			directReachable: directConfigured && preference !== "relay_only" ? await this.probe(direct) : false,
			relayConfigured: relay !== null
		});
		this.choice = choice;
		if (choice.path === null) {
			this.notifyStatus({
				connected: false,
				reason: choice.reason
			});
			throw new Error(choice.reason);
		}
		const chosen = choice.path === "direct" ? direct : relay;
		await chosen.connect();
		this.adopt(chosen);
		this.notifyStatus({ connected: true });
	}
	async probe(adapter) {
		if (!adapter) return false;
		const probe = this.options.probeDirect ?? defaultProbe;
		const timeoutMs = this.options.timeoutMs ?? 800;
		try {
			return await withTimeout(probe(adapter), timeoutMs);
		} catch {
			return false;
		}
	}
	/** Bind the winning adapter's messages and status to our own listeners. */
	adopt(adapter) {
		this.active = adapter;
		if (adapter.subscribe) this.unsubscribers.push(adapter.subscribe((envelope) => {
			for (const listener of this.messageListeners) listener(envelope);
		}));
		adapter.on("status", (status) => this.notifyStatus(status));
	}
	disconnect() {
		for (const off of this.unsubscribers.splice(0)) off();
		this.active?.disconnect();
		this.active = null;
		this.choice = null;
	}
	async status() {
		if (!this.active) return {
			connected: false,
			reason: this.pathReason
		};
		return this.active.status();
	}
	async send(envelope, options) {
		if (!this.active) return {
			ok: false,
			detail: this.pathReason
		};
		return this.active.send(envelope, options);
	}
	subscribe(onMessage) {
		this.messageListeners.add(onMessage);
		return () => {
			this.messageListeners.delete(onMessage);
		};
	}
	on(event, listener) {
		if (event === "status") this.statusListeners.add(listener);
	}
	notifyStatus(status) {
		for (const listener of this.statusListeners) listener(status);
	}
};
/**
* Default reachability probe: open the socket and see.
*
* Connecting IS the probe — there is no cheaper question to ask a websocket,
* and a candidate that connects is one we are about to use anyway.
*/
async function defaultProbe(adapter) {
	await adapter.connect();
	if (!(await adapter.status()).connected) {
		adapter.disconnect();
		return false;
	}
	return true;
}
function withTimeout(promise, ms) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(/* @__PURE__ */ new Error(`Timed out after ${ms}ms`)), ms);
		promise.then((value) => {
			clearTimeout(timer);
			resolve(value);
		}, (error) => {
			clearTimeout(timer);
			reject(error instanceof Error ? error : new Error(String(error)));
		});
	});
}
var ReliableMobileEnvelopeLink = class {
	adapter;
	now;
	buffer = /* @__PURE__ */ new Map();
	lastReceivedSequence = 0;
	messageListeners = /* @__PURE__ */ new Set();
	adapterUnsubscribe = null;
	connected = false;
	constructor(adapter, now = () => /* @__PURE__ */ new Date()) {
		this.adapter = adapter;
		this.now = now;
		this.adapter.on("status", (status) => {
			this.connected = status.connected;
			if (this.connected) this.reconcile();
		});
		if (this.adapter.subscribe) this.adapterUnsubscribe = this.adapter.subscribe((envelope) => {
			if (envelope.sequence <= this.lastReceivedSequence) return;
			this.lastReceivedSequence = envelope.sequence;
			for (const listener of this.messageListeners) listener(envelope);
		});
	}
	async status() {
		return this.adapter.status();
	}
	async send(envelope, options) {
		this.buffer.set(envelope.sequence, envelope);
		if (!this.connected) return {
			ok: true,
			detail: "Buffered offline"
		};
		return this.adapter.send(envelope, options);
	}
	acknowledge(sequence) {
		this.buffer.delete(sequence);
	}
	reconcile() {
		const pending = Array.from(this.buffer.values()).sort((a, b) => a.sequence - b.sequence);
		const nowTime = this.now().getTime();
		for (const envelope of pending) {
			if (nowTime > Date.parse(envelope.expiresAt)) {
				this.buffer.delete(envelope.sequence);
				continue;
			}
			this.adapter.send(envelope).catch(() => {});
		}
	}
	subscribe(onMessage) {
		this.messageListeners.add(onMessage);
		return () => {
			this.messageListeners.delete(onMessage);
		};
	}
	destroy() {
		if (this.adapterUnsubscribe) this.adapterUnsubscribe();
		this.buffer.clear();
	}
};
var PROTOCOL_VERSION = 1;
var MAX_PLAINTEXT_BYTES = 256 * 1024;
var MAX_CIPHERTEXT_BYTES = 262176;
var MAX_ENVELOPE_TTL_MS = 300 * 1e3;
var CLOCK_SKEW_MS = 30 * 1e3;
var HKDF_INFO = new TextEncoder().encode("ocade-mobile-channel-v1");
function cryptoApi() {
	if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) throw new Error("WebCrypto is required for the encrypted mobile channel.");
	return globalThis.crypto;
}
function base64Url(bytes) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromBase64Url(value) {
	if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Malformed base64url value.");
	const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
	const binary = atob(padded);
	return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function arrayBuffer(bytes) {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}
function canonicalPublicKey(key) {
	if (key.kty !== "EC" || key.crv !== "P-256" || typeof key.x !== "string" || typeof key.y !== "string") throw new Error("The peer identity is not a valid P-256 public key.");
	return JSON.stringify({
		crv: key.crv,
		kty: key.kty,
		x: key.x,
		y: key.y
	});
}
async function fingerprintMobilePublicKey(key) {
	const digest = await cryptoApi().subtle.digest("SHA-256", new TextEncoder().encode(canonicalPublicKey(key)));
	return base64Url(new Uint8Array(digest));
}
async function generateMobileChannelIdentity() {
	const pair = await cryptoApi().subtle.generateKey({
		name: "ECDH",
		namedCurve: "P-256"
	}, false, ["deriveBits"]);
	const publicKey = await cryptoApi().subtle.exportKey("jwk", pair.publicKey);
	return {
		privateKey: pair.privateKey,
		publicKey,
		fingerprint: await fingerprintMobilePublicKey(publicKey)
	};
}
async function deriveAesKey(privateKey, peerPublicKey, salt) {
	const peer = await cryptoApi().subtle.importKey("jwk", peerPublicKey, {
		name: "ECDH",
		namedCurve: "P-256"
	}, false, []);
	const secret = await cryptoApi().subtle.deriveBits({
		name: "ECDH",
		public: peer
	}, privateKey, 256);
	const material = await cryptoApi().subtle.importKey("raw", secret, "HKDF", false, ["deriveKey"]);
	return cryptoApi().subtle.deriveKey({
		name: "HKDF",
		hash: "SHA-256",
		salt: arrayBuffer(salt),
		info: arrayBuffer(HKDF_INFO)
	}, material, {
		name: "AES-GCM",
		length: 256
	}, false, ["encrypt", "decrypt"]);
}
function envelopeMetadata(envelope) {
	return new TextEncoder().encode(JSON.stringify({
		v: envelope.v,
		deviceId: envelope.deviceId,
		sequence: envelope.sequence,
		issuedAt: envelope.issuedAt,
		expiresAt: envelope.expiresAt,
		senderFingerprint: envelope.senderFingerprint,
		senderPublicKey: JSON.parse(canonicalPublicKey(envelope.senderPublicKey)),
		salt: envelope.salt
	}));
}
async function sealMobileMessage(payload, input) {
	if (!input.deviceId || input.deviceId.length > 128) throw new Error("A bounded device id is required.");
	if (!Number.isSafeInteger(input.sequence) || input.sequence < 1) throw new Error("The encrypted message sequence must be a positive safe integer.");
	const ttlMs = input.ttlMs ?? 120 * 1e3;
	if (!Number.isFinite(ttlMs) || ttlMs < 1 || ttlMs > MAX_ENVELOPE_TTL_MS) throw new Error("The encrypted message expiry is outside the allowed window.");
	const plaintext = new TextEncoder().encode(JSON.stringify(payload));
	if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) throw new Error("The encrypted mobile message exceeds the 256 KiB limit.");
	const now = input.now ?? /* @__PURE__ */ new Date();
	const salt = cryptoApi().getRandomValues(/* @__PURE__ */ new Uint8Array(32));
	const iv = cryptoApi().getRandomValues(/* @__PURE__ */ new Uint8Array(12));
	const metadata = {
		v: PROTOCOL_VERSION,
		deviceId: input.deviceId,
		sequence: input.sequence,
		issuedAt: now.toISOString(),
		expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
		senderPublicKey: input.sender.publicKey,
		senderFingerprint: input.sender.fingerprint,
		salt: base64Url(salt)
	};
	const key = await deriveAesKey(input.sender.privateKey, input.recipientPublicKey, salt);
	const ciphertext = await cryptoApi().subtle.encrypt({
		name: "AES-GCM",
		iv: arrayBuffer(iv),
		additionalData: arrayBuffer(envelopeMetadata(metadata)),
		tagLength: 128
	}, key, plaintext);
	return {
		...metadata,
		iv: base64Url(iv),
		ciphertext: base64Url(new Uint8Array(ciphertext))
	};
}
async function openMobileMessage(envelope, input) {
	try {
		if (!Number.isSafeInteger(input.lastSequence) || input.lastSequence < 0) return {
			ok: false,
			reason: "The encrypted mobile replay state is invalid."
		};
		const now = (input.now ?? /* @__PURE__ */ new Date()).getTime();
		if (!Number.isFinite(now)) return {
			ok: false,
			reason: "The encrypted mobile receiver clock is invalid."
		};
		if (envelope.v !== PROTOCOL_VERSION) return {
			ok: false,
			reason: "Unsupported protocol."
		};
		if (!Number.isSafeInteger(envelope.sequence) || envelope.sequence <= input.lastSequence) return {
			ok: false,
			reason: "This encrypted mobile message was replayed or reordered."
		};
		const actualFingerprint = await fingerprintMobilePublicKey(envelope.senderPublicKey);
		if (envelope.senderFingerprint !== actualFingerprint || envelope.senderFingerprint !== input.expectedSenderFingerprint) return {
			ok: false,
			reason: "The encrypted message came from an untrusted device key."
		};
		const issuedAt = Date.parse(envelope.issuedAt);
		const expiresAt = Date.parse(envelope.expiresAt);
		if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= issuedAt || expiresAt - issuedAt > MAX_ENVELOPE_TTL_MS || issuedAt > now + CLOCK_SKEW_MS || expiresAt < now) return {
			ok: false,
			reason: "The encrypted mobile message is expired or has invalid time bounds."
		};
		const salt = fromBase64Url(envelope.salt);
		const iv = fromBase64Url(envelope.iv);
		const ciphertext = fromBase64Url(envelope.ciphertext);
		if (salt.byteLength !== 32 || iv.byteLength !== 12 || ciphertext.byteLength > MAX_CIPHERTEXT_BYTES) return {
			ok: false,
			reason: "The encrypted mobile envelope has invalid bounds."
		};
		const key = await deriveAesKey(input.recipientPrivateKey, envelope.senderPublicKey, salt);
		const plaintext = await cryptoApi().subtle.decrypt({
			name: "AES-GCM",
			iv: arrayBuffer(iv),
			additionalData: arrayBuffer(envelopeMetadata(envelope)),
			tagLength: 128
		}, key, arrayBuffer(ciphertext));
		return {
			ok: true,
			value: JSON.parse(new TextDecoder().decode(plaintext)),
			sequence: envelope.sequence
		};
	} catch {
		return {
			ok: false,
			reason: "The encrypted mobile message failed authentication."
		};
	}
}
/**
* Concrete `MobileTransport` wrapper. Relays receive only encrypted envelopes;
* sequence numbers increase before every send so retry idempotency is supplied
* by the existing queue key, never by reusing an AES-GCM nonce.
*/
var EncryptedMobileTransport = class {
	deviceId;
	identity;
	peerPublicKey;
	link;
	now;
	sequence = 0;
	/**
	* Replay watermark for the RECEIVE path: the highest sequence already
	* accepted. `openMobileMessage` rejects `sequence <= lastSequence`, so this
	* must advance on every accepted message — otherwise a captured envelope can
	* be re-delivered forever and each copy passes the check.
	*/
	receivedSequence = 0;
	/** Pinned peer fingerprint, derived once from the trusted key. */
	peerFingerprint = null;
	/**
	* Serialises envelope processing. Two envelopes arriving concurrently would
	* otherwise both read the same watermark before either advanced it, and a
	* duplicate would be accepted twice — the reconnect race in §8.7.
	*/
	intake = Promise.resolve();
	constructor(deviceId, identity, peerPublicKey, link, now = () => /* @__PURE__ */ new Date()) {
		this.deviceId = deviceId;
		this.identity = identity;
		this.peerPublicKey = peerPublicKey;
		this.link = link;
		this.now = now;
	}
	status() {
		return this.link.status();
	}
	async send(intent, options) {
		const envelope = await sealMobileMessage(intent, {
			sender: this.identity,
			recipientPublicKey: this.peerPublicKey,
			deviceId: this.deviceId,
			sequence: ++this.sequence,
			now: this.now()
		});
		return this.link.send(envelope, options);
	}
	pinnedPeerFingerprint() {
		this.peerFingerprint ??= fingerprintMobilePublicKey(this.peerPublicKey);
		return this.peerFingerprint;
	}
	subscribe(onMessage) {
		if (!this.link.subscribe) return () => {};
		return this.link.subscribe((envelope) => {
			this.intake = this.intake.then(async () => {
				const opened = await openMobileMessage(envelope, {
					recipientPrivateKey: this.identity.privateKey,
					expectedSenderFingerprint: await this.pinnedPeerFingerprint(),
					lastSequence: this.receivedSequence,
					now: this.now()
				});
				if (!opened.ok) return;
				this.receivedSequence = opened.sequence;
				onMessage(opened.value);
			}).catch(() => {});
			return this.intake;
		});
	}
};
/**
* Composes the real mobile transport (P21).
*
* Three modules held the whole encrypted, reconnecting, replay-protected
* mobile channel — and all three were imported only by tests:
*
*   WebSocketRelayAdapter      (transport-adapters)  raw relay socket
*   ReliableMobileEnvelopeLink (reconnect-protocol)  retry + resend on reconnect
*   EncryptedMobileTransport   (secure-channel)      seal/open, replay watermark
*
* `companion-link.ts` meanwhile defaulted to `UnavailableMobileTransport`, so
* the only transport production could reach was the one that refuses
* everything. The pieces existed and were simply never assembled.
*
* This assembles them in the only order that is safe: the socket is the
* lowest layer, reliability wraps it, and ENCRYPTION WRAPS RELIABILITY. Sealing
* above the retry layer means a resend re-sends an already-sealed envelope
* rather than re-encrypting, so a retry cannot leak plaintext to the relay and
* cannot produce two different ciphertexts for one logical message.
*
* Building this does NOT make the phone connected. It makes the connection
* possible; the relay must still exist and the device must still be paired.
*/
/**
* Build the encrypted transport stack.
*
* Does not connect. Connection is the caller's decision because it is a
* network action with a visible consequence, and a factory that dialled out on
* construction would make importing this module a side effect.
*/
async function buildMobileTransport(config) {
	const identity = config.identity ?? await generateMobileChannelIdentity();
	const relayAdapter = new WebSocketRelayAdapter(config.relayUrl, config.roomId);
	const directAdapter = config.directUrl && isDirectAddress(config.directUrl) ? new WebSocketRelayAdapter(config.directUrl, config.roomId) : null;
	const adapter = new PreferredPathAdapter({
		preference: config.relayPreference ?? "prefer_direct",
		direct: directAdapter,
		relay: relayAdapter
	});
	const reliable = new ReliableMobileEnvelopeLink(adapter);
	return {
		transport: new EncryptedMobileTransport(config.deviceId, identity, config.peerPublicKey, reliable),
		adapter,
		identity
	};
}
/**
* Build a transport, or return the refusing one with an honest reason.
*
* A missing relay URL or unpaired device is not an error to throw — it is the
* ordinary state of an unpaired installation, and the correct response is a
* transport that declines every send with a reason the user can act on.
*/
async function buildMobileTransportOrUnavailable(config) {
	if (!config.relayUrl || !config.roomId || !config.deviceId || !config.peerPublicKey) return new UnavailableMobileTransport();
	return (await buildMobileTransport(config)).transport;
}
var MOBILE_MISSION_COMMAND_KINDS = [
	"task.create",
	"instruction.add",
	"instruction.correct",
	"approval.decide",
	"run.pause",
	"run.resume",
	"run.cancel",
	"emergency.stop",
	"session.revoke",
	"output.download"
];
var MOBILE_MISSION_RUNTIME_BOUNDARY = "The mobile companion supervises PC tasks only. It never automates the phone screen, protected inputs or arbitrary desktop actions, and live commands remain unavailable until a native signed transport acknowledges them.";
/** Plain-language summary of a queued intent. Never echoes file contents. */
function describeIntent(intent) {
	switch (intent.kind) {
		case "task.handoff": return `Task for OCADE: “${intent.text.slice(0, 60)}${intent.text.length > 60 ? "…" : ""}”`;
		case "file.handoff": return `File: ${intent.name} (${Math.max(1, Math.round(intent.sizeBytes / 1024))} KB)`;
		case "clipboard.handoff": return "Clipboard hand-off";
		default: return "Queued request";
	}
}
function MobilePage() {
	const online = useOnline();
	const [challenge, setChallenge] = (0, import_react.useState)(null);
	const [channel] = (0, import_react.useState)(null);
	const [now, setNow] = (0, import_react.useState)(() => /* @__PURE__ */ new Date());
	const [devices, setDevices] = (0, import_react.useState)(() => listDevices());
	const [approvals, setApprovals] = (0, import_react.useState)([]);
	const [transportReason, setTransportReason] = (0, import_react.useState)(null);
	const [notifPermission, setNotifPermission] = (0, import_react.useState)("unsupported");
	const [handoffText, setHandoffText] = (0, import_react.useState)("");
	const [confirmCode, setConfirmCode] = (0, import_react.useState)("");
	const [deviceLabel, setDeviceLabel] = (0, import_react.useState)("");
	const firstActiveDevice = activeDevices()[0] ?? null;
	(0, import_react.useEffect)(() => {
		getNotificationTransport().permission().then(setNotifPermission);
	}, []);
	const queue = (0, import_react.useMemo)(() => createMobileIntentQueue(), []);
	const [queued, setQueued] = (0, import_react.useState)([]);
	const refreshQueue = (0, import_react.useCallback)(() => setQueued(queue.all()), [queue]);
	(0, import_react.useEffect)(() => {
		refreshQueue();
	}, [refreshQueue]);
	(0, import_react.useEffect)(() => {
		if (!online || queue.size === 0) return;
		if (computerUseChannelDecision("pairedDevices") || computerUseChannelDecision("remoteSessions")) return;
		let cancelled = false;
		flushMobileQueue(queue, devices.find((d) => !d.revoked) ?? null).then((r) => {
			if (cancelled) return;
			refreshQueue();
			if (r.sent > 0) toast.success(`Sent ${r.sent} queued ${r.sent === 1 ? "item" : "items"}.`);
			if (r.dropped > 0) toast.error(`${r.dropped} queued items were given up on after repeated failures.`);
		});
		return () => {
			cancelled = true;
		};
	}, [
		online,
		queue,
		devices,
		refreshQueue
	]);
	(0, import_react.useEffect)(() => {
		const t = setInterval(() => setNow(/* @__PURE__ */ new Date()), 1e3);
		return () => clearInterval(t);
	}, []);
	(0, import_react.useEffect)(() => {
		let live = true;
		(async () => {
			const next = await buildMobileTransportOrUnavailable({
				deviceId: activeDevices()[0]?.id,
				relayUrl: channel?.relayUrl,
				roomId: channel?.roomId,
				peerPublicKey: channel?.peerPublicKey
			});
			if (!live) return;
			setMobileTransport(next);
			const s = await next.status();
			if (!live) return;
			setTransportReason(s.connected ? null : s.reason ?? "The OCADE mobile companion isn't connected. Pair your phone to monitor and approve tasks.");
		})();
		return () => {
			live = false;
		};
	}, [devices, channel]);
	(0, import_react.useEffect)(() => {
		setApprovals(listApprovals(now));
	}, [now]);
	(0, import_react.useEffect)(() => {
		pruneApprovals();
		setApprovals(listApprovals());
	}, []);
	const startPairing = (0, import_react.useCallback)(() => {
		const room = canRegisterDevice({
			kind: "mobile",
			currentDesktop: 0,
			currentMobile: devices.filter((d) => !d.revoked && d.kind === "mobile").length,
			state: entitlementState(null)
		});
		if (!room.allowed) {
			toast.error(room.reason ?? "You've reached your mobile device limit.");
			return;
		}
		const c = createPairingChallenge(/* @__PURE__ */ new Date());
		setChallenge(c);
		toast.success("Pairing code created. It expires in 5 minutes.");
	}, [devices]);
	const pairingExpired = challenge ? now.getTime() > challenge.expiresAt.getTime() : false;
	const secondsLeft = challenge ? Math.max(0, Math.round((challenge.expiresAt.getTime() - now.getTime()) / 1e3)) : 0;
	const payload = (0, import_react.useMemo)(() => challenge ? pairingPayload(challenge, "account") : "", [challenge]);
	async function decide(request, decision, device) {
		if (decision === "approved") {
			const channelRefusal = computerUseChannelDecision("pairedDevices") ?? computerUseChannelDecision("remoteSessions");
			if (channelRefusal) {
				toast.error(channelRefusal);
				return;
			}
		}
		const confirmation = await confirmMobileBiometric({
			kind: "approval.decide",
			requestId: request.id,
			decision
		}, device);
		if (!confirmation.ok) {
			toast.error(confirmation.detail);
			return;
		}
		const result = applyMobileApproval(request, decision, device, /* @__PURE__ */ new Date());
		if (!saveApprovalStatus(request.id, result.status, device.id)) {
			toast.error("The decision could not be saved. OCADE has not reported this request as decided.");
			return;
		}
		if (result.status === decision) touchDevice(device.id);
		setApprovals(listApprovals());
		setDevices(listDevices());
		toast[result.status === decision ? "success" : "error"](result.reason);
	}
	async function emergencyStop(device) {
		const r = await dispatchMobileIntent({ kind: "emergency.stop" }, device, {
			online,
			durable: queue
		});
		refreshQueue();
		if (r.ok) {
			setApprovals((list) => applyEmergencyStop(list, {
				requestedByDeviceId: device.id,
				requestedAt: /* @__PURE__ */ new Date(),
				reason: "Emergency stop from mobile settings"
			}));
			toast.success("Emergency stop acknowledged — pending actions cancelled.");
			notify(stoppedNotification(device.label));
		} else toast.error(r.detail);
	}
	/**
	* Finish pairing: verify the echoed code against the live challenge, then
	* trust the device. `verifyPairing` enforces expiry, nonce match and code
	* match — a wrong or late code is refused with its own reason rather than a
	* generic failure.
	*/
	function completePairing() {
		if (!challenge) return;
		const result = verifyPairing(challenge, {
			code: confirmCode.trim(),
			nonce: challenge.nonce
		}, /* @__PURE__ */ new Date());
		if (!result.ok) {
			toast.error(result.reason);
			return;
		}
		const now = /* @__PURE__ */ new Date();
		const device = {
			id: crypto.randomUUID(),
			label: deviceLabel.trim() || "My phone",
			kind: "mobile",
			platform: "android",
			pairedAt: now,
			lastSeenAt: now,
			revoked: false
		};
		const saved = saveDevice(device);
		if (!saved.ok) {
			toast.error(saved.reason);
			return;
		}
		setDevices(listDevices());
		setChallenge(null);
		setConfirmCode("");
		setDeviceLabel("");
		toast.success(`${device.label} paired. It can now monitor and approve, never take control.`);
	}
	/**
	* Hand text to the paired phone as a task or clipboard entry.
	*
	* Goes through the full guarded path, so a protected value is refused before
	* it is queued, sent, or written anywhere. When offline the intent is held in
	* the durable queue and replayed on reconnect.
	*/
	async function sendHandoff(kind) {
		const device = firstActiveDevice;
		const text = handoffText.trim();
		if (!device || !text) return;
		const channelRefusal = computerUseChannelDecision("pairedDevices") ?? computerUseChannelDecision("remoteSessions");
		if (channelRefusal) {
			toast.error(channelRefusal);
			return;
		}
		const r = await dispatchMobileIntent(kind === "task.handoff" ? {
			kind,
			conversationId: "handoff",
			text
		} : {
			kind,
			text
		}, device, {
			online,
			durable: queue
		});
		refreshQueue();
		if (r.ok) {
			setHandoffText("");
			toast.success(r.detail || "Sent to your phone.");
		} else toast.error(r.detail);
	}
	function revoke(device) {
		const revoked = revokeDevice(device.id);
		setDevices(listDevices());
		if (!revoked) {
			toast.error(`Couldn't revoke ${device.label}. Try again — it may still be able to act.`);
			return;
		}
		const dropped = queue.all().length;
		queue.clear();
		refreshQueue();
		clearApprovals();
		setApprovals([]);
		toast.success(dropped > 0 ? `${device.label} revoked, and ${dropped} queued ${dropped === 1 ? "item" : "items"} discarded.` : `${device.label} revoked. It can no longer act on your account.`);
		notify(revokedNotification(device.label));
	}
	const pending = approvals.filter((r) => r.status === "pending");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(PageHeader, {
		eyebrow: "Settings",
		title: "Mobile companion",
		description: "Pair a phone to watch what OCADE is doing, approve or cancel actions, and stop everything instantly. A phone can never take arbitrary control of this computer."
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-5",
		children: [
			transportReason ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "flex items-start gap-2 p-4 text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, {
					className: "mt-0.5 h-4 w-4 shrink-0 text-[color:var(--state-warning)]",
					"aria-hidden": true
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-medium text-foreground",
					children: "Mobile companion not connected"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-xs text-muted-foreground",
					children: transportReason
				})] })]
			}) : null,
			!online ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "flex items-center gap-2 p-3 text-xs text-muted-foreground",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WifiOff, {
					className: "h-4 w-4",
					"aria-hidden": true
				}), "You're offline. Safe requests are queued and sent when your phone reconnects; stops and approvals always need a live connection."]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-1 flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Pair a phone"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-xs text-muted-foreground",
						children: "Open OCADE on your phone and scan this code. The code is single-use and expires in five minutes — it carries no password or account secret."
					}),
					challenge && !pairingExpired ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-wrap items-center gap-4",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "rounded-lg border border-border/70 bg-background p-3 font-mono text-2xl tracking-[0.3em] tabular-nums",
								"aria-label": `Pairing code ${challenge.code.split("").join(" ")}`,
								children: challenge.code
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "text-xs text-muted-foreground",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", { children: [
									"Expires in",
									" ",
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
										className: "tabular-nums text-foreground",
										children: [
											Math.floor(secondsLeft / 60),
											":",
											String(secondsLeft % 60).padStart(2, "0")
										]
									})
								] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 max-w-xs break-all font-mono text-[10px] opacity-60",
									children: payload
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
								variant: "ghost",
								size: "sm",
								onClick: startPairing,
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "mr-1.5 h-4 w-4" }), " New code"]
							})
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						onClick: startPairing,
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(QrCode, { className: "mr-1.5 h-4 w-4" }), challenge && pairingExpired ? "Code expired — create a new one" : "Create pairing code"]
					}),
					challenge && !pairingExpired ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 border-t border-border/60 pt-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
								htmlFor: "pair-confirm",
								className: "text-xs font-medium text-foreground",
								children: "Confirm the code your phone shows"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mb-2 text-[11px] text-muted-foreground",
								children: "Your phone displays the same code back. Entering it here proves both devices are looking at the same pairing request."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-2",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										id: "pair-confirm",
										value: confirmCode,
										onChange: (e) => setConfirmCode(e.target.value),
										placeholder: "Code from your phone",
										inputMode: "numeric",
										autoComplete: "off",
										className: "h-9 w-44 font-mono text-sm"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
										value: deviceLabel,
										onChange: (e) => setDeviceLabel(e.target.value),
										placeholder: "Name this phone",
										"aria-label": "Name for this phone",
										className: "h-9 w-48 text-sm"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
										size: "sm",
										className: "h-9",
										onClick: completePairing,
										disabled: !confirmCode.trim(),
										children: "Pair"
									})
								]
							})
						]
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-[11px] text-muted-foreground",
						children: "Until a device finishes pairing it appears nowhere below — OCADE never lists a device it hasn't actually verified."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-2 flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Trusted devices"]
					}),
					devices.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EmptyState, {
						icon: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, {
							className: "h-6 w-6",
							"aria-hidden": true
						}),
						title: "No phones paired yet",
						description: "Pair a phone above to monitor and approve OCADE tasks from anywhere."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-col gap-2",
						children: devices.map((d) => {
							const trusted = isTrusted(d, now);
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
								className: "flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3 text-[13px]",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Smartphone, {
										className: "h-4 w-4 shrink-0 text-muted-foreground",
										"aria-hidden": true
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "font-medium",
										children: d.label
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-[11px] uppercase text-muted-foreground",
										children: d.platform
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: cn("flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]", d.revoked ? "bg-destructive/15 text-destructive" : trusted ? "bg-[color:var(--state-success)]/15 text-[color:var(--state-success)]" : "bg-[color:var(--state-warning)]/15 text-[color:var(--state-warning)]"),
										children: d.revoked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "h-3 w-3" }), " Revoked"] }) : trusted ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldCheck, { className: "h-3 w-3" }), " Trusted"] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ShieldAlert, { className: "h-3 w-3" }), " Needs re-verification"] })
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-auto flex gap-1",
										children: !d.revoked ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											size: "sm",
											variant: "ghost",
											onClick: () => void emergencyStop(d),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OctagonX, { className: "mr-1 h-3.5 w-3.5" }), " Stop"]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											size: "sm",
											variant: "ghost",
											onClick: () => revoke(d),
											children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "mr-1 h-3.5 w-3.5" }), " Revoke"]
										})] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
											size: "sm",
											variant: "ghost",
											onClick: () => {
												forgetDevice(d.id);
												setDevices(listDevices());
												toast.success(`${d.label} forgotten. It can be paired again if you choose.`);
											},
											children: "Forget"
										})
									})
								]
							}, d.id);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-[11px] text-muted-foreground",
						children: "Lost your phone? Revoke it here — a revoked device is refused immediately, even for emergency stop."
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-1 flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Send, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Hand off to your phone"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-xs text-muted-foreground",
						children: "Send a task or some text to continue on the other device. Passwords, one-time codes and payment details are refused before anything is queued or sent."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex flex-col gap-2",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("textarea", {
								value: handoffText,
								onChange: (e) => setHandoffText(e.target.value),
								rows: 2,
								"aria-label": "Text to hand off",
								placeholder: "Ask OCADE to pick this up on your phone…",
								className: "w-full resize-none rounded-md border border-border/60 bg-transparent px-2.5 py-2 text-sm"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "flex flex-wrap gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									onClick: () => void sendHandoff("task.handoff"),
									disabled: !handoffText.trim() || !firstActiveDevice,
									children: "Send as task"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => void sendHandoff("clipboard.handoff"),
									disabled: !handoffText.trim() || !firstActiveDevice,
									children: "Send as clipboard"
								})]
							}),
							!firstActiveDevice ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-[11px] text-muted-foreground",
								children: "Pair a phone above before handing anything off."
							}) : null
						]
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("h3", {
						className: "mb-1 flex items-center gap-2 text-sm font-semibold",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Bell, {
							className: "h-4 w-4",
							"aria-hidden": true
						}), " Alerts"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-2 text-xs text-muted-foreground",
						children: notifPermission === "granted" ? "Your phone alerts you when OCADE needs approval, and whenever everything is stopped." : notifPermission === "denied" ? "Notifications are turned off for OCADE in your phone's settings. Approvals will still appear here." : NOTIFICATIONS_UNAVAILABLE
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
						className: "flex flex-col gap-1 text-[11px] text-muted-foreground",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Approval requests and expiries" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Emergency stop — always delivered, even during quiet hours" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Alerts never show passwords, one-time codes or payment details. If a request contains anything protected, the alert says only “Open OCADE to see the details.”" })
						]
					})
				]
			}),
			queued.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mb-2 text-sm font-semibold",
						children: "Waiting to send"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 text-xs text-muted-foreground",
						children: "Saved on this device and sent automatically when your phone reconnects. Stops and approvals are never queued — they always need a live connection."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "flex flex-col gap-2",
						children: queued.map((q) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3 text-[13px]",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "min-w-0 flex-1",
									children: describeIntent(q.payload)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-[11px] text-muted-foreground",
									children: new Date(q.queuedAt).toLocaleTimeString()
								}),
								q.attempts > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-[10px] uppercase text-[color:var(--state-warning)]",
									children: [
										q.attempts,
										" failed ",
										q.attempts === 1 ? "try" : "tries"
									]
								}) : null,
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => {
										queue.remove(q.id);
										refreshQueue();
									},
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trash2, { className: "h-3.5 w-3.5" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "sr-only",
										children: "Discard"
									})]
								})
							]
						}, q.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "ghost",
						className: "mt-2",
						onClick: () => {
							queue.clear();
							refreshQueue();
							toast.success("Queue cleared.");
						},
						children: "Discard all"
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "mb-2 text-sm font-semibold",
					children: "Approvals waiting for you"
				}), pending.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-xs text-muted-foreground",
					children: "Nothing is waiting. When OCADE needs permission for something risky it appears here and on your paired phone."
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "flex flex-col gap-2",
					children: pending.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex flex-wrap items-center gap-2 rounded-lg border border-border/60 p-3 text-[13px]",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "min-w-0 flex-1",
								children: r.summary
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-[10px] uppercase text-muted-foreground",
								children: r.risk
							}),
							devices[0] ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex gap-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => void decide(r, "approved", devices[0]),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "mr-1 h-3.5 w-3.5" }), " Approve"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
									size: "sm",
									variant: "ghost",
									onClick: () => void decide(r, "denied", devices[0]),
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "mr-1 h-3.5 w-3.5" }), " Deny"]
								})]
							}) : null
						]
					}, r.id))
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(GlassPanel, {
				className: "p-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mb-2 text-sm font-semibold",
						children: "What a paired phone can do"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "grid gap-1 text-xs sm:grid-cols-2",
						children: [
							["See what OCADE is doing", true],
							["Approve or deny an action", true],
							["Cancel a running action", true],
							["Emergency stop", true],
							["Send a task to the desktop", true],
							["Hand off a file or clipboard", true],
							["Take arbitrary control of your PC", false],
							["Enter passwords, OTPs or payment details", false]
						].map(([label, allowed]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("inline-block h-1.5 w-1.5 rounded-full", allowed ? "bg-[color:var(--state-success)]" : "bg-destructive") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: allowed ? "text-foreground" : "text-muted-foreground line-through",
								children: label
							})]
						}, String(label)))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-[11px] text-muted-foreground",
						children: [
							"Pairing codes last ",
							Math.round(PAIRING_TTL_MS / 6e4),
							" minutes. Consequential actions always need a fresh confirmation on the device itself."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-[11px] text-muted-foreground",
						children: [
							"The signed mobile mission protocol exposes ",
							MOBILE_MISSION_COMMAND_KINDS.length,
							" closed, scoped commands. ",
							MOBILE_MISSION_RUNTIME_BOUNDARY
						]
					})
				]
			})
		]
	})] });
}
//#endregion
export { MobilePage as component };

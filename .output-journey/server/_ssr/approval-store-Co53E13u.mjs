import { l as isProtectedText } from "./companion-bridge-CJ48JKAT.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/approval-store-Co53E13u.js
var PAIRING_TTL_MS = 300 * 1e3;
var APPROVAL_TTL_MS = 120 * 1e3;
var CLOCK_SKEW_MS = 30 * 1e3;
function secureRandomUnit() {
	const source = globalThis.crypto;
	if (!source?.getRandomValues) throw new Error("A cryptographically secure random source is required for mobile pairing.");
	const value = /* @__PURE__ */ new Uint32Array(1);
	source.getRandomValues(value);
	return value[0] / 4294967296;
}
function checkedRandom(random) {
	const value = random();
	if (!Number.isFinite(value) || value < 0 || value >= 1) throw new RangeError("Pairing randomness must be a finite number between 0 (inclusive) and 1.");
	return value;
}
/** 6-digit code + nonce. `random` is injectable so tests are deterministic. */
function createPairingChallenge(now = /* @__PURE__ */ new Date(), random = secureRandomUnit) {
	if (!Number.isFinite(now.getTime())) throw new Error("A pairing challenge requires a valid creation time.");
	return {
		code: String(Math.floor(checkedRandom(random) * 1e6)).padStart(6, "0"),
		nonce: Array.from({ length: 4 }, () => Math.floor(checkedRandom(random) * 65536).toString(16).padStart(4, "0")).join(""),
		createdAt: now,
		expiresAt: new Date(now.getTime() + PAIRING_TTL_MS)
	};
}
function verifyPairing(challenge, attempt, now = /* @__PURE__ */ new Date()) {
	const createdAt = challenge.createdAt instanceof Date ? challenge.createdAt.getTime() : NaN;
	const expiresAt = challenge.expiresAt instanceof Date ? challenge.expiresAt.getTime() : NaN;
	const current = now.getTime();
	if (!/^\d{6}$/.test(challenge.code) || !/^[a-f0-9]{16}$/.test(challenge.nonce) || !Number.isFinite(createdAt) || !Number.isFinite(expiresAt) || !Number.isFinite(current) || expiresAt <= createdAt || expiresAt - createdAt > 3e5) return {
		ok: false,
		code: "invalid_challenge",
		reason: "This pairing challenge is invalid. Generate a new one."
	};
	if (current >= expiresAt) return {
		ok: false,
		code: "expired",
		reason: "This pairing code has expired. Generate a new one."
	};
	if (attempt.nonce !== challenge.nonce) return {
		ok: false,
		code: "nonce_mismatch",
		reason: "This pairing request doesn't match. Try again."
	};
	if (attempt.code !== challenge.code) return {
		ok: false,
		code: "code_mismatch",
		reason: "That code is incorrect."
	};
	return { ok: true };
}
/** QR payload — carries no secret beyond the single-use challenge. */
function pairingPayload(challenge, accountRef) {
	return JSON.stringify({
		v: 1,
		ref: accountRef,
		code: challenge.code,
		nonce: challenge.nonce
	});
}
/** A device is trusted only while paired, unrevoked and recently seen. */
var TRUST_STALE_MS = 720 * 60 * 60 * 1e3;
function isTrusted(device, now = /* @__PURE__ */ new Date()) {
	if (device.revoked) return false;
	const current = now.getTime();
	const pairedAt = device.pairedAt instanceof Date ? device.pairedAt.getTime() : NaN;
	const lastSeenAt = device.lastSeenAt instanceof Date ? device.lastSeenAt.getTime() : NaN;
	if (!Number.isFinite(current) || !Number.isFinite(pairedAt) || !Number.isFinite(lastSeenAt) || pairedAt > lastSeenAt || lastSeenAt > current + CLOCK_SKEW_MS) return false;
	return current - lastSeenAt <= TRUST_STALE_MS;
}
function createApprovalRequest(input) {
	const now = input.now ?? /* @__PURE__ */ new Date();
	return {
		id: input.id,
		summary: input.summary,
		risk: input.risk,
		requestedAt: now,
		expiresAt: new Date(now.getTime() + APPROVAL_TTL_MS),
		status: "pending"
	};
}
/**
* Apply a mobile decision. Refuses prohibited actions outright, decisions from
* untrusted devices, expired requests and double-decisions.
*/
function decideApproval(request, decision, device, now = /* @__PURE__ */ new Date()) {
	if (request.risk === "prohibited") return {
		ok: false,
		code: "prohibited",
		reason: "This action involves protected information and can never be approved remotely."
	};
	if (request.status !== "pending") return {
		ok: false,
		code: "already_decided",
		reason: `This request was already ${request.status}.`
	};
	if (now.getTime() > request.expiresAt.getTime()) return {
		ok: false,
		code: "expired",
		reason: "This approval request expired. Ask again from your desktop."
	};
	if (!isTrusted(device, now)) return {
		ok: false,
		code: "untrusted_device",
		reason: "This device isn't trusted. Pair it again."
	};
	return {
		ok: true,
		request: {
			...request,
			status: decision,
			decidedByDeviceId: device.id,
			decidedAt: now
		}
	};
}
function expireIfDue(request, now = /* @__PURE__ */ new Date()) {
	if (request.status === "pending" && now.getTime() > request.expiresAt.getTime()) return {
		...request,
		status: "expired"
	};
	return request;
}
/**
* Emergency stop is always permitted from ANY paired device — including a
* device that has gone stale — because halting is never the dangerous
* direction. Only revoked devices are refused.
*/
function canEmergencyStop(device) {
	if (device.revoked) return {
		allowed: false,
		reason: "This device has been revoked."
	};
	return { allowed: true };
}
/** Which in-flight requests an emergency stop cancels. */
function applyEmergencyStop(requests, stop) {
	return requests.map((r) => r.status === "pending" ? {
		...r,
		status: "cancelled",
		decidedByDeviceId: stop.requestedByDeviceId,
		decidedAt: stop.requestedAt
	} : r);
}
/**
* OCADE mobile notifications (Plan §27).
*
* A notification is rendered on the LOCK SCREEN, where anyone holding the phone
* can read it without unlocking. That makes it the least private surface in the
* product, so this module is deliberately strict about what may appear:
*
*  - protected content (passwords, OTPs, card/recovery data) never appears,
*    even redacted-in-place — the whole body is replaced;
*  - page/file contents are never echoed, only their names and sizes;
*  - a notification never carries an action token; tapping it opens the app,
*    which then re-checks device trust before anything can be approved.
*
* Delivery itself is transport-agnostic (`NotificationTransport`), and with none
* connected everything reports honestly as undelivered rather than pretending.
*/
/** Replaces a body that would otherwise expose protected content. */
var SAFE_BODY = "Open OCADE to see the details.";
/**
* Build a lock-screen-safe body.
*
* If ANY part looks protected the whole string is dropped rather than masked in
* place: partial masking still leaks length, position and surrounding context.
*/
function safeBody(text) {
	const trimmed = (text ?? "").trim();
	if (!trimmed) return SAFE_BODY;
	if (isProtectedText(trimmed)) return SAFE_BODY;
	return trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed;
}
/** An approval waiting on the phone. */
function approvalNotification(request) {
	return {
		kind: "approval.requested",
		title: "OCADE needs your approval",
		body: safeBody(request.summary),
		referenceId: request.id,
		urgent: request.risk === "high" || request.risk === "confirm"
	};
}
function expiredNotification(request) {
	return {
		kind: "approval.expired",
		title: "Approval expired",
		body: "OCADE stopped waiting and did not run it.",
		referenceId: request.id,
		urgent: false
	};
}
function stoppedNotification(deviceLabel) {
	return {
		kind: "emergency.stopped",
		title: "Everything stopped",
		body: `Emergency stop from ${safeBody(deviceLabel)}. Nothing is running.`,
		urgent: true
	};
}
function revokedNotification(deviceLabel) {
	return {
		kind: "device.revoked",
		title: "Device removed",
		body: `${safeBody(deviceLabel)} can no longer act on your account.`,
		urgent: true
	};
}
var NOTIFICATIONS_UNAVAILABLE = "Notifications need the OCADE mobile app. Pair your phone to get approval alerts.";
/** Honest default: reports unsupported and delivers nothing. */
var UnavailableNotifications = class {
	async permission() {
		return "unsupported";
	}
	async request() {
		return "unsupported";
	}
	async deliver() {
		return false;
	}
};
var transport = new UnavailableNotifications();
function getNotificationTransport() {
	return transport;
}
/** True while the clock is inside the quiet window. */
function inQuietHours(quiet, now = /* @__PURE__ */ new Date()) {
	if (!quiet) return false;
	const h = now.getHours();
	const { fromHour: from, toHour: to } = quiet;
	if (from === to) return false;
	return from < to ? h >= from && h < to : h >= from || h < to;
}
/**
* Send a notification, honouring permission and quiet hours.
*
* Emergency stop and other urgent alerts are NEVER suppressed by quiet hours —
* silencing "everything stopped" would hide exactly the event the user most
* needs to know about.
*/
async function notify(notification, opts = {}) {
	const t = getNotificationTransport();
	const permission = await t.permission();
	if (permission !== "granted") return {
		delivered: false,
		reason: permission === "unsupported" ? NOTIFICATIONS_UNAVAILABLE : "Notifications are turned off for OCADE on this device."
	};
	if (!notification.urgent && inQuietHours(opts.quietHours ?? null, opts.now)) return {
		delivered: false,
		reason: "Held until quiet hours end."
	};
	return await t.deliver(notification) ? { delivered: true } : {
		delivered: false,
		reason: "The notification could not be sent."
	};
}
/**
* Shared approval queue (Plan §27).
*
* The producer and the consumer live on different surfaces: the Desktop Copilot
* raises an approval when an action needs a human decision, and the mobile
* companion (or the mobile settings page) answers it. Without a shared store
* between them the approvals panel had no producer at all — it was permanently
* empty, and `expireIfDue` / `applyMobileApproval` had nothing to act on.
*
* Durable on purpose: an approval raised just before a reload or crash must
* still be waiting afterwards, or the desktop blocks forever on a request the
* user can no longer see.
*
* Storage holds only what is already redacted — a request summary never
* contains protected input, because `createApprovalRequest` is given a summary
* that has been through `redactForAudit`.
*/
var KEY = "caera:approvals:v1";
var RISKS = [
	"read_only",
	"low",
	"confirm",
	"high",
	"prohibited"
];
var STATUSES = [
	"pending",
	"approved",
	"denied",
	"expired",
	"cancelled"
];
function canonicalDate(value) {
	if (typeof value !== "string") return false;
	const parsed = new Date(value);
	return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}
function isStoredApproval(value) {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const row = value;
	if (typeof row.id !== "string" || !row.id.trim() || row.id.length > 300 || typeof row.summary !== "string" || !row.summary.trim() || row.summary.length > 4e3 || !RISKS.includes(row.risk) || !STATUSES.includes(row.status) || !canonicalDate(row.requestedAt) || !canonicalDate(row.expiresAt) || Date.parse(row.expiresAt) <= Date.parse(row.requestedAt)) return false;
	return !(row.decidedByDeviceId !== void 0 && (typeof row.decidedByDeviceId !== "string" || !row.decidedByDeviceId.trim()) || row.decidedAt !== void 0 && !canonicalDate(row.decidedAt));
}
function toStored(r) {
	return {
		id: r.id,
		summary: r.summary,
		risk: r.risk,
		requestedAt: r.requestedAt.toISOString(),
		expiresAt: r.expiresAt.toISOString(),
		status: r.status,
		decidedByDeviceId: r.decidedByDeviceId,
		decidedAt: r.decidedAt?.toISOString()
	};
}
function fromStored(s) {
	return {
		id: s.id,
		summary: s.summary,
		risk: s.risk,
		requestedAt: new Date(s.requestedAt),
		expiresAt: new Date(s.expiresAt),
		status: s.status,
		decidedByDeviceId: s.decidedByDeviceId,
		decidedAt: s.decidedAt ? new Date(s.decidedAt) : void 0
	};
}
function readAll() {
	if (typeof localStorage === "undefined") return [];
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
		if (!Array.isArray(parsed)) return [];
		const seen = /* @__PURE__ */ new Set();
		return parsed.filter((value) => {
			if (!isStoredApproval(value) || seen.has(value.id)) return false;
			seen.add(value.id);
			return true;
		});
	} catch {
		return [];
	}
}
function writeAll(rows) {
	if (typeof localStorage === "undefined") return false;
	try {
		localStorage.setItem(KEY, JSON.stringify(rows));
		return true;
	} catch {
		return false;
	}
}
/**
* List every approval, expiring any that timed out while nothing was watching.
* Expiry is applied on READ so a request cannot appear "pending" forever just
* because no tab was open when it lapsed.
*
* A request that expires HERE also notifies, because the user was waiting on a
* decision that will now never happen — silently flipping it to "expired" would
* leave them expecting an outcome that never arrives.
*/
function listApprovals(now = /* @__PURE__ */ new Date()) {
	const before = readAll().map(fromStored);
	const rows = before.map((r) => expireIfDue(r, now));
	for (let i = 0; i < rows.length; i++) if (before[i].status === "pending" && rows[i].status === "expired") notify(expiredNotification(rows[i]));
	writeAll(rows.map(toStored));
	return rows;
}
/** Raise an approval. Returns the created request. */
function requestApproval(input, now = /* @__PURE__ */ new Date()) {
	if (!Number.isFinite(now.getTime())) throw new Error("An approval requires a valid request time.");
	const id = input.id ?? (typeof crypto !== "undefined" ? crypto.randomUUID() : `a-${now.getTime()}`);
	if (readAll().some((row) => row.id === id)) throw new Error("An approval with this id already exists; no duplicate was created.");
	const request = createApprovalRequest({
		id,
		summary: input.summary,
		risk: input.risk,
		now
	});
	if (!writeAll([...readAll(), toStored(request)])) throw new Error("This approval could not be saved. OCADE will not claim that a phone can decide it.");
	notify(approvalNotification(request));
	return request;
}
/** Record a decision. Returns the updated request, or null if it is gone. */
function saveApprovalStatus(id, status, deviceId, now = /* @__PURE__ */ new Date()) {
	const rows = readAll();
	const idx = rows.findIndex((r) => r.id === id);
	if (idx === -1) return null;
	const current = fromStored(rows[idx]);
	const fresh = expireIfDue(current, now);
	if (fresh.status !== "pending") {
		if (fresh.status !== current.status) {
			rows[idx] = toStored(fresh);
			writeAll(rows);
		}
		return null;
	}
	if (![
		"approved",
		"denied",
		"cancelled"
	].includes(status)) return null;
	rows[idx] = {
		...rows[idx],
		status,
		decidedByDeviceId: deviceId ?? rows[idx].decidedByDeviceId,
		decidedAt: now.toISOString()
	};
	return writeAll(rows) ? fromStored(rows[idx]) : null;
}
/** Drop decided/expired rows so the list does not grow without bound. */
function pruneApprovals(now = /* @__PURE__ */ new Date()) {
	const rows = readAll().map(fromStored).map((r) => expireIfDue(r, now));
	const keep = rows.filter((r) => r.status === "pending");
	writeAll(keep.map(toStored));
	return rows.length - keep.length;
}
/** Remove everything — used when a device is revoked or the user clears state. */
function clearApprovals() {
	writeAll([]);
}
//#endregion
export { saveApprovalStatus as _, clearApprovals as a, expireIfDue as c, listApprovals as d, notify as f, revokedNotification as g, requestApproval as h, canEmergencyStop as i, getNotificationTransport as l, pruneApprovals as m, PAIRING_TTL_MS as n, createPairingChallenge as o, pairingPayload as p, applyEmergencyStop as r, decideApproval as s, NOTIFICATIONS_UNAVAILABLE as t, isTrusted as u, stoppedNotification as v, verifyPairing as y };

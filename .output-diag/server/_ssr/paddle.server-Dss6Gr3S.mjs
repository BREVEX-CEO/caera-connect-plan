import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { createHmac, timingSafeEqual } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/paddle.server-Dss6Gr3S.js
/**
* Server-side Paddle webhook verification.
*
* Free-launch mode does not start new checkouts, but signed historical/provider
* events may still arrive and must remain auditable. Verification intentionally
* uses Node core crypto rather than a provider SDK so the security boundary is
* small, deterministic and present in the lockfile-independent runtime.
*
* IMPORTANT: the exact raw request body is authenticated before JSON parsing.
* Re-serializing JSON before verification would change the signed payload.
*/
var paddle_server_exports = /* @__PURE__ */ __exportAll({
	gatewayFetch: () => gatewayFetch,
	getPaddleClient: () => getPaddleClient,
	getWebhookSecret: () => getWebhookSecret,
	isPaddleEnv: () => isPaddleEnv,
	verifyWebhook: () => verifyWebhook
});
var getEnv = (key) => {
	const value = process.env[key];
	if (!value) throw new Error(`${key} is not configured`);
	return value;
};
var SIGNATURE_TOLERANCE_SECONDS = 5;
/**
* The largest webhook body OCADE will read.
*
* A provider event is a few kilobytes. 64 KiB is generous enough that a schema
* change cannot break delivery and small enough that a flood of them cannot
* exhaust an isolate.
*/
var MAX_WEBHOOK_BODY_BYTES = 64 * 1024;
var HEX_SHA256 = /^[a-f0-9]{64}$/i;
function isPaddleEnv(value) {
	return value === "sandbox" || value === "live";
}
function getWebhookSecret(env) {
	return env === "sandbox" ? getEnv("PAYMENTS_SANDBOX_WEBHOOK_SECRET") : getEnv("PAYMENTS_LIVE_WEBHOOK_SECRET");
}
function parseSignatureHeader(header) {
	let timestamp = null;
	const signatures = [];
	for (const rawPart of header.split(";")) {
		const separator = rawPart.indexOf("=");
		if (separator < 1) continue;
		const key = rawPart.slice(0, separator).trim();
		const value = rawPart.slice(separator + 1).trim();
		if (key === "ts" && /^\d+$/.test(value)) timestamp = Number(value);
		if (key === "h1" && HEX_SHA256.test(value)) signatures.push(value.toLowerCase());
	}
	if (timestamp === null || !Number.isSafeInteger(timestamp) || signatures.length === 0) throw new Error("Malformed Paddle-Signature header");
	return {
		timestamp,
		signatures
	};
}
function constantTimeHexEqual(leftHex, rightHex) {
	if (!HEX_SHA256.test(leftHex) || !HEX_SHA256.test(rightHex)) return false;
	const left = Buffer.from(leftHex, "hex");
	const right = Buffer.from(rightHex, "hex");
	return left.length === right.length && timingSafeEqual(left, right);
}
function parseVerifiedEvent(body) {
	let decoded;
	try {
		decoded = JSON.parse(body);
	} catch {
		throw new Error("Verified Paddle webhook body is not valid JSON");
	}
	if (!decoded || typeof decoded !== "object") throw new Error("Verified Paddle webhook body is not an event object");
	const record = decoded;
	const eventType = typeof record.event_type === "string" ? record.event_type : typeof record.eventType === "string" ? record.eventType : null;
	if (!eventType || !("data" in record)) throw new Error("Verified Paddle webhook is missing event_type or data");
	const eventId = typeof record.event_id === "string" ? record.event_id : record.eventId;
	const occurredAt = typeof record.occurred_at === "string" ? record.occurred_at : record.occurredAt;
	if (typeof eventId !== "string" || eventId.length === 0) throw new Error("Verified Paddle webhook is missing event_id");
	if (typeof occurredAt !== "string" || Number.isNaN(new Date(occurredAt).getTime())) throw new Error("Verified Paddle webhook is missing a usable occurred_at");
	return {
		eventId,
		eventType,
		occurredAt,
		data: record.data
	};
}
/**
* Verify a webhook signature before believing a single field of the body.
*
* Paddle signs `${timestamp}:${rawBody}` with HMAC-SHA256. Multiple `h1`
* signatures may be present during secret rotation, so any valid `h1` is
* accepted. The timestamp must also be within the replay window.
*/
async function verifyWebhook(req, env, nowSeconds = Math.floor(Date.now() / 1e3)) {
	const signatureHeader = req.headers.get("paddle-signature");
	if (!signatureHeader) throw new Error("Missing Paddle signature");
	const declaredLength = Number(req.headers.get("content-length") ?? "0");
	if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BODY_BYTES) throw new Error("Paddle webhook body is too large");
	const body = await req.text();
	if (!body) throw new Error("Missing Paddle body");
	if (body.length > MAX_WEBHOOK_BODY_BYTES) throw new Error("Paddle webhook body is too large");
	const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
	if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) throw new Error("Paddle webhook timestamp is outside the replay window");
	const secret = getWebhookSecret(env);
	const signedPayload = `${timestamp}:${body}`;
	const expected = createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");
	if (!signatures.some((signature) => constantTimeHexEqual(signature, expected))) throw new Error("Invalid Paddle webhook signature");
	return parseVerifiedEvent(body);
}
/**
* Direct REST access to the provider API.
*
* The provider SDK is not a dependency of this app: the two calls we make are
* plain authenticated JSON requests, and an SDK would add a large surface for
* no behavioural gain. Credentials come from the environment, so an
* unconfigured environment throws "... is not configured" and callers report
* "payments are not connected" rather than inventing a status.
*/
var API_BASE = {
	sandbox: "https://sandbox-api.paddle.com",
	live: "https://api.paddle.com"
};
function getApiKey(env) {
	return env === "sandbox" ? getEnv("PAYMENTS_SANDBOX_API_KEY") : getEnv("PAYMENTS_LIVE_API_KEY");
}
async function gatewayFetch(env, path, init = {}) {
	const apiKey = getApiKey(env);
	return fetch(`${API_BASE[env]}${path.startsWith("/") ? path : `/${path}`}`, {
		...init,
		headers: {
			...init.headers ?? {},
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json"
		}
	});
}
async function gatewayJson(env, path, init) {
	const response = await gatewayFetch(env, path, init);
	if (!response.ok) throw new Error(`The payment provider returned ${response.status} for ${path}.`);
	return (await response.json()).data;
}
/** The narrow slice of the provider API this app actually calls. */
function getPaddleClient(env) {
	return {
		customerPortalSessions: { create: (customerId, subscriptionIds) => gatewayJson(env, `/customers/${customerId}/portal-sessions`, {
			method: "POST",
			body: JSON.stringify({ subscription_ids: subscriptionIds })
		}) },
		subscriptions: { cancel: (subscriptionId, options) => gatewayJson(env, `/subscriptions/${subscriptionId}/cancel`, {
			method: "POST",
			body: JSON.stringify({ effective_from: options.effectiveFrom })
		}) }
	};
}
//#endregion
export { verifyWebhook as a, paddle_server_exports as i, getWebhookSecret as n, isPaddleEnv as r, gatewayFetch as t };

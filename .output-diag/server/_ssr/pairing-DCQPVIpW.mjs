//#region node_modules/.nitro/vite/services/ssr/assets/pairing-DCQPVIpW.js
/**
* How long a minted token stays usable.
*
* Short because a token is a licence to run prompts on someone's computer.
* Two minutes is long enough for a slow network and short enough that a copied
* token is worthless before it can be used deliberately.
*/
var TOKEN_LIFETIME_MS = 12e4;
/** Requests one paired device may make per window. */
var RATE_LIMIT = {
	windowMs: 6e4,
	maxRequests: 60
};
function createPairingState(devices = []) {
	return {
		devices: new Map(devices.map((d) => [d.id, d])),
		seenNonces: /* @__PURE__ */ new Map(),
		recentRequests: /* @__PURE__ */ new Map()
	};
}
/**
* Decide whether one request may be served.
*
* ORDER MATTERS, and it is deliberate: cheap, non-secret checks first, so an
* attacker probing with garbage never reaches the signature comparison, and
* the rate limit is charged before the expensive work rather than after.
*/
function authorisePairedRequest(state, request, deps) {
	const now = deps.now();
	const device = state.devices.get(request.deviceId);
	if (!device) return {
		allowed: false,
		code: "unknown_device",
		reason: "This device is not paired with that computer."
	};
	if (device.revokedAt !== void 0) return {
		allowed: false,
		code: "revoked",
		reason: "That pairing was revoked on the computer it belonged to."
	};
	if (request.origin !== device.origin) return {
		allowed: false,
		code: "origin_not_allowed",
		reason: "This website is not the one that pairing was approved for."
	};
	if (request.issuedAt > now + 3e4) return {
		allowed: false,
		code: "clock_skew",
		reason: "That request is dated in the future. Check the clock on the sending device."
	};
	if (now - request.issuedAt > 12e4) return {
		allowed: false,
		code: "expired",
		reason: "That request took too long to arrive and is no longer valid."
	};
	const fresh = (state.recentRequests.get(device.id) ?? []).filter((at) => now - at < RATE_LIMIT.windowMs);
	if (fresh.length >= RATE_LIMIT.maxRequests) {
		state.recentRequests.set(device.id, fresh);
		return {
			allowed: false,
			code: "rate_limited",
			reason: "That device is making too many requests. It will be allowed again shortly."
		};
	}
	const nonceKey = `${device.id}:${request.nonce}`;
	if (state.seenNonces.has(nonceKey)) return {
		allowed: false,
		code: "replayed",
		reason: "That request was already used once and cannot be repeated."
	};
	const expected = deps.sign(device, {
		deviceId: request.deviceId,
		origin: request.origin,
		issuedAt: request.issuedAt,
		nonce: request.nonce
	});
	if (!deps.constantTimeEqual(expected, request.signature)) return {
		allowed: false,
		code: "bad_signature",
		reason: "That request was not signed by the paired device."
	};
	state.seenNonces.set(nonceKey, now);
	state.recentRequests.set(device.id, [...fresh, now]);
	return {
		allowed: true,
		device
	};
}
/**
* Drop nonces that can no longer be replayed.
*
* A nonce only needs remembering for as long as a token could still be valid.
* Without this the set grows without bound and becomes its own denial of
* service against the machine it protects.
*/
function pruneNonces(state, now) {
	const cutoff = now - 15e4;
	let removed = 0;
	for (const [key, at] of state.seenNonces) if (at < cutoff) {
		state.seenNonces.delete(key);
		removed += 1;
	}
	return removed;
}
//#endregion
export { pruneNonces as i, authorisePairedRequest as n, createPairingState as r, TOKEN_LIFETIME_MS as t };

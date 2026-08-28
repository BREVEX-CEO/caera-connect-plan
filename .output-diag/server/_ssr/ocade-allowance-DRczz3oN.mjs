import { t as PLANS$1 } from "./paddle-plans-Pm8sU42X.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ocade-allowance-DRczz3oN.js
/**
* OCADE entitlements and device limits (Plan §33/§38).
*
* Rules encoded here:
*  - On-device processing is unlimited and never metered.
*  - Every plan (2-day / 8-day / 1-month / 1-year) grants the same core
*    entitlements and differs by DURATION (and price); 2 desktop + 2 mobile.
*  - After expiry, local data and local inference remain available. A user is
*    never locked out of their own local data.
*
* Pure and deterministic so it is fully unit-testable without a database.
*/
var HOUR_MS = 3600 * 1e3;
var DAY_MS = 24 * HOUR_MS;
var PLANS = Object.fromEntries(PLANS$1.filter((plan) => plan.id !== "demo").map((plan) => [plan.id, {
	id: plan.id,
	label: plan.name,
	durationDays: Math.round(plan.durationMs / DAY_MS),
	desktopDevices: plan.desktopDevices,
	mobileDevices: plan.mobileDevices
}]));
function expiryOf(e) {
	if (e.expiresAt) return e.expiresAt;
	const plan = PLANS[e.planId];
	return new Date(e.startedAt.getTime() + plan.durationDays * 24 * HOUR_MS);
}
/**
* Resolve what the user may do right now. Local capabilities are unconditional:
* a lapsed plan never locks a user out of their own device or data.
*/
function entitlementState(e, now = /* @__PURE__ */ new Date()) {
	if (!e) return {
		active: false,
		expiresAt: now,
		localInferenceAvailable: true,
		localDataAvailable: true,
		localExportAvailable: true,
		desktopDevices: 2,
		mobileDevices: 2
	};
	const expiresAt = expiryOf(e);
	const active = now.getTime() < expiresAt.getTime();
	const plan = PLANS[e.planId];
	return {
		active,
		expiresAt,
		localInferenceAvailable: true,
		localDataAvailable: true,
		localExportAvailable: true,
		desktopDevices: plan.desktopDevices,
		mobileDevices: plan.mobileDevices
	};
}
function canRegisterDevice(input) {
	const limit = input.kind === "desktop" ? input.state.desktopDevices : input.state.mobileDevices;
	const current = input.kind === "desktop" ? input.currentDesktop : input.currentMobile;
	if (!Number.isSafeInteger(limit) || limit < 0 || !Number.isSafeInteger(current) || current < 0) return {
		allowed: false,
		reason: "Device limits could not be verified, so registration was refused."
	};
	if (current >= limit) return {
		allowed: false,
		reason: `You've reached your limit of ${limit} ${input.kind} devices. Remove one to add another.`
	};
	return { allowed: true };
}
function offlineEntitlementValid(lastVerifiedAt, now = /* @__PURE__ */ new Date()) {
	const current = now.getTime();
	const verified = lastVerifiedAt.getTime();
	if (!Number.isFinite(current) || !Number.isFinite(verified) || verified > current) return false;
	return current - verified <= 168 * HOUR_MS;
}
//#endregion
export { entitlementState as n, offlineEntitlementValid as r, canRegisterDevice as t };

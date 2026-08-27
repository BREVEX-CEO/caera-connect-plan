//#region node_modules/.nitro/vite/services/ssr/assets/device-store-CRf9IOAa.js
var KEY = "caera:devices:v1";
function toStored(d, revokedAt) {
	return {
		id: d.id,
		label: d.label,
		kind: d.kind,
		platform: d.platform,
		pairedAt: d.pairedAt.toISOString(),
		lastSeenAt: d.lastSeenAt.toISOString(),
		revoked: d.revoked,
		revokedAt: revokedAt?.toISOString()
	};
}
function fromStored(s) {
	return {
		id: s.id,
		label: s.label,
		kind: s.kind,
		platform: s.platform,
		pairedAt: new Date(s.pairedAt),
		lastSeenAt: new Date(s.lastSeenAt),
		revoked: s.revoked
	};
}
function readAll() {
	if (typeof localStorage === "undefined") return [];
	try {
		const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((v) => typeof v === "object" && v !== null && typeof v.id === "string" && typeof v.pairedAt === "string");
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
/** Every device, including revoked tombstones. */
function listDevices() {
	return readAll().map(fromStored);
}
/** Devices that may still act. */
function activeDevices() {
	return listDevices().filter((d) => !d.revoked);
}
/**
* Register a newly paired device.
*
* Refuses to re-pair an id that was revoked: a lost phone must not be able to
* quietly restore its own trust by pairing again under the same identity.
*/
function saveDevice(device) {
	const rows = readAll();
	const existing = rows.find((r) => r.id === device.id);
	if (existing?.revoked) return {
		ok: false,
		reason: "That device was revoked. Remove it from the list before pairing it again."
	};
	return writeAll(existing ? rows.map((r) => r.id === device.id ? toStored(device) : r) : [...rows, toStored(device)]) ? { ok: true } : {
		ok: false,
		reason: "This device could not be saved securely. Check private-storage access and try pairing again."
	};
}
/**
* Revoke a device. Persisted as a tombstone so the refusal survives a reload —
* the whole point of revoking a lost phone.
*/
function revokeDevice(id, now = /* @__PURE__ */ new Date()) {
	const rows = readAll();
	const idx = rows.findIndex((r) => r.id === id);
	if (idx === -1) return null;
	rows[idx] = {
		...rows[idx],
		revoked: true,
		revokedAt: now.toISOString()
	};
	return writeAll(rows) ? fromStored(rows[idx]) : null;
}
/** Permanently forget a device, allowing it to pair again. Explicit user action. */
function forgetDevice(id) {
	writeAll(readAll().filter((r) => r.id !== id));
}
/** Refresh the last-seen timestamp used by the trust-staleness check. */
function touchDevice(id, now = /* @__PURE__ */ new Date()) {
	const rows = readAll();
	const idx = rows.findIndex((r) => r.id === id);
	if (idx === -1 || rows[idx].revoked) return;
	rows[idx] = {
		...rows[idx],
		lastSeenAt: now.toISOString()
	};
	writeAll(rows);
}
/** Remove every device — used when clearing local state entirely. */
function clearDevices() {
	writeAll([]);
}
//#endregion
export { revokeDevice as a, listDevices as i, clearDevices as n, saveDevice as o, forgetDevice as r, touchDevice as s, activeDevices as t };

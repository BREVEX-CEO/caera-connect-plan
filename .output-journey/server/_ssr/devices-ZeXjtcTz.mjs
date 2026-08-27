import { n as supabase } from "./client-YIOAnk22.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/devices-ZeXjtcTz.js
/**
* Locally-generated, random Browser Installation ID.
*
* Per plan §6, we do NOT fingerprint the browser. Each browser install gets a
* random UUID stored in that browser's localStorage. If the user clears
* storage, they re-pair — no cross-browser correlation, no PII.
*/
var KEY = "caera.browser_install_id";
function getBrowserInstallId() {
	if (typeof window === "undefined") return "";
	let id = window.localStorage.getItem(KEY);
	if (!id) {
		id = crypto.randomUUID();
		window.localStorage.setItem(KEY, id);
	}
	return id;
}
/**
* Best-effort desktop / mobile classification for device registration.
* Not fingerprinting — a coarse form factor guess only.
*/
function guessDeviceKind() {
	if (typeof navigator === "undefined") return "desktop";
	const ua = navigator.userAgent || "";
	if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return "mobile";
	return "desktop";
}
/**
* Best-effort browser label from UA (for display only — user can rename).
*/
function browserLabel() {
	if (typeof navigator === "undefined") return "This browser";
	const ua = navigator.userAgent || "";
	let browser = "Browser";
	if (/Edg\//.test(ua)) browser = "Edge";
	else if (/Chrome\//.test(ua)) browser = "Chrome";
	else if (/Firefox\//.test(ua)) browser = "Firefox";
	else if (/Safari\//.test(ua)) browser = "Safari";
	let os = "";
	if (/Windows/.test(ua)) os = "Windows";
	else if (/Mac OS X/.test(ua)) os = "macOS";
	else if (/Android/.test(ua)) os = "Android";
	else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
	else if (/Linux/.test(ua)) os = "Linux";
	return os ? `${browser} on ${os}` : browser;
}
/**
* Device + browser-grant registration.
*
* One physical PC may eventually aggregate multiple browser grants through the
* native companion. In the web-only path, browser identity is the immutable
* local install id stored in `browser_grants` — never the mutable display name.
*/
async function createBrowserGrant(input) {
	const { error } = await supabase.from("browser_grants").insert({
		user_id: input.userId,
		browser_install_id: input.installId,
		device_id: input.deviceId,
		user_agent: input.userAgent,
		origin: typeof window === "undefined" ? null : window.location.origin,
		last_seen_at: (/* @__PURE__ */ new Date()).toISOString(),
		revoked_at: input.revokedAt ?? null
	});
	if (error) throw new Error(`Could not register this browser grant: ${error.message}`);
}
async function registerDeviceForCurrentSession() {
	if (typeof window === "undefined") return;
	const { data, error: authError } = await supabase.auth.getUser();
	if (authError) throw authError;
	const user = data.user;
	if (!user) return;
	const installId = getBrowserInstallId();
	const kind = guessDeviceKind();
	const ua = navigator.userAgent || "";
	const generatedName = `${browserLabel()} · ${installId.slice(0, 8)}`;
	const now = (/* @__PURE__ */ new Date()).toISOString();
	/**
	* Stable identity comes from browser_install_id. Multiple rows are tolerated
	* defensively in case an older deployment created duplicates; any revoked
	* grant wins so a stale active duplicate cannot resurrect a browser.
	*/
	const { data: grants, error: grantReadError } = await supabase.from("browser_grants").select("id, device_id, revoked_at, created_at").eq("user_id", user.id).eq("browser_install_id", installId).order("created_at", { ascending: false });
	if (grantReadError) throw grantReadError;
	if ((grants ?? []).some((grant) => Boolean(grant.revoked_at))) return;
	const currentGrant = grants?.[0] ?? null;
	if (currentGrant) {
		const { data: device, error: deviceReadError } = await supabase.from("devices").select("id, revoked_at").eq("id", currentGrant.device_id).eq("user_id", user.id).maybeSingle();
		if (deviceReadError) throw deviceReadError;
		if (!device) throw new Error("This browser grant points to a device record that no longer exists.");
		if (device.revoked_at) return;
		const [{ error: deviceUpdateError }, { error: grantUpdateError }] = await Promise.all([supabase.from("devices").update({ last_active_at: now }).eq("id", device.id).eq("user_id", user.id), supabase.from("browser_grants").update({
			last_seen_at: now,
			user_agent: ua,
			origin: window.location.origin
		}).eq("id", currentGrant.id).eq("user_id", user.id)]);
		if (deviceUpdateError) throw deviceUpdateError;
		if (grantUpdateError) throw grantUpdateError;
		return;
	}
	/**
	* Legacy migration path: older builds identified the browser from the
	* generated name. Link that row to the stable install id once, then future
	* renames cannot break identity. A revoked legacy row creates a revoked grant
	* before returning so the install remains explicitly denied.
	*/
	const { data: legacyDevice, error: legacyError } = await supabase.from("devices").select("id, revoked_at").eq("user_id", user.id).eq("name", generatedName).order("created_at", { ascending: false }).limit(1).maybeSingle();
	if (legacyError) throw legacyError;
	if (legacyDevice) {
		await createBrowserGrant({
			userId: user.id,
			installId,
			deviceId: legacyDevice.id,
			userAgent: ua,
			revokedAt: legacyDevice.revoked_at
		});
		if (legacyDevice.revoked_at) return;
		const { error } = await supabase.from("devices").update({ last_active_at: now }).eq("id", legacyDevice.id).eq("user_id", user.id);
		if (error) throw error;
		return;
	}
	const { data: insertedDevice, error: insertError } = await supabase.from("devices").insert({
		user_id: user.id,
		kind,
		name: generatedName,
		user_agent: ua,
		last_active_at: now
	}).select("id").single();
	if (insertError) throw insertError;
	try {
		await createBrowserGrant({
			userId: user.id,
			installId,
			deviceId: insertedDevice.id,
			userAgent: ua
		});
	} catch (error) {
		await supabase.from("devices").delete().eq("id", insertedDevice.id).eq("user_id", user.id);
		throw error;
	}
}
async function listDevicesForCurrentUser() {
	const { data, error } = await supabase.from("devices").select("id, kind, name, user_agent, physical_pc_id, last_active_at, revoked_at, created_at").order("created_at", { ascending: false });
	if (error) throw error;
	return data ?? [];
}
async function revokeDevice(id) {
	const { data, error } = await supabase.rpc("revoke_device_for_current_user", { _device_id: id });
	if (error) return { error: error.message };
	if (data !== true) return { error: "Device revocation did not update an account-owned device." };
	return {};
}
/** Rename a device. Label only — stable browser identity lives in browser_grants. */
async function renameDevice(id, name) {
	const trimmed = name.trim().slice(0, 120);
	if (!trimmed) return { error: "Enter a name." };
	const { data, error } = await supabase.from("devices").update({ name: trimmed }).eq("id", id).select("id").maybeSingle();
	if (error) return { error: error.message };
	if (!data) return { error: "Device rename did not update an account-owned device." };
	return {};
}
//#endregion
export { revokeDevice as i, registerDeviceForCurrentSession as n, renameDevice as r, listDevicesForCurrentUser as t };

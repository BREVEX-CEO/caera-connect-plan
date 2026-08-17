/**
 * Device + browser-grant registration.
 *
 * One physical PC may eventually aggregate multiple browser grants through the
 * native companion. In the web-only path, browser identity is the immutable
 * local install id stored in `browser_grants` — never the mutable display name.
 */

import { supabase } from "@/integrations/supabase/client";
import { getBrowserInstallId, guessDeviceKind, browserLabel } from "./browser-install-id";

export interface DeviceRow {
  id: string;
  kind: "desktop" | "mobile";
  name: string | null;
  user_agent: string | null;
  physical_pc_id: string | null;
  last_active_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

async function createBrowserGrant(input: {
  userId: string;
  installId: string;
  deviceId: string;
  userAgent: string;
  revokedAt?: string | null;
}) {
  const { error } = await supabase.from("browser_grants").insert({
    user_id: input.userId,
    browser_install_id: input.installId,
    device_id: input.deviceId,
    user_agent: input.userAgent,
    origin: typeof window === "undefined" ? null : window.location.origin,
    last_seen_at: new Date().toISOString(),
    revoked_at: input.revokedAt ?? null,
  });
  if (error) throw new Error(`Could not register this browser grant: ${error.message}`);
}

export async function registerDeviceForCurrentSession(): Promise<void> {
  if (typeof window === "undefined") return;

  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const user = data.user;
  if (!user) return;

  const installId = getBrowserInstallId();
  const kind = guessDeviceKind();
  const ua = navigator.userAgent || "";
  const generatedName = `${browserLabel()} · ${installId.slice(0, 8)}`;
  const now = new Date().toISOString();

  /**
   * Stable identity comes from browser_install_id. Multiple rows are tolerated
   * defensively in case an older deployment created duplicates; any revoked
   * grant wins so a stale active duplicate cannot resurrect a browser.
   */
  const { data: grants, error: grantReadError } = await supabase
    .from("browser_grants")
    .select("id, device_id, revoked_at, created_at")
    .eq("user_id", user.id)
    .eq("browser_install_id", installId)
    .order("created_at", { ascending: false });
  if (grantReadError) throw grantReadError;

  if ((grants ?? []).some((grant) => Boolean(grant.revoked_at))) return;
  const currentGrant = grants?.[0] ?? null;

  if (currentGrant) {
    const { data: device, error: deviceReadError } = await supabase
      .from("devices")
      .select("id, revoked_at")
      .eq("id", currentGrant.device_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (deviceReadError) throw deviceReadError;
    if (!device) throw new Error("This browser grant points to a device record that no longer exists.");

    // Device revocation is authoritative even if an old grant row was not
    // stamped during a previous partial write.
    if (device.revoked_at) return;

    const [{ error: deviceUpdateError }, { error: grantUpdateError }] = await Promise.all([
      supabase.from("devices").update({ last_active_at: now }).eq("id", device.id).eq("user_id", user.id),
      supabase
        .from("browser_grants")
        .update({ last_seen_at: now, user_agent: ua, origin: window.location.origin })
        .eq("id", currentGrant.id)
        .eq("user_id", user.id),
    ]);
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
  const { data: legacyDevice, error: legacyError } = await supabase
    .from("devices")
    .select("id, revoked_at")
    .eq("user_id", user.id)
    .eq("name", generatedName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (legacyError) throw legacyError;

  if (legacyDevice) {
    await createBrowserGrant({
      userId: user.id,
      installId,
      deviceId: legacyDevice.id,
      userAgent: ua,
      revokedAt: legacyDevice.revoked_at,
    });
    if (legacyDevice.revoked_at) return;

    const { error } = await supabase
      .from("devices")
      .update({ last_active_at: now })
      .eq("id", legacyDevice.id)
      .eq("user_id", user.id);
    if (error) throw error;
    return;
  }

  const { data: insertedDevice, error: insertError } = await supabase
    .from("devices")
    .insert({
      user_id: user.id,
      kind,
      name: generatedName,
      user_agent: ua,
      last_active_at: now,
    })
    .select("id")
    .single();
  if (insertError) throw insertError;

  try {
    await createBrowserGrant({
      userId: user.id,
      installId,
      deviceId: insertedDevice.id,
      userAgent: ua,
    });
  } catch (error) {
    // Best-effort rollback: a device without its stable browser identity must
    // not consume a slot and later appear as a successfully registered device.
    await supabase.from("devices").delete().eq("id", insertedDevice.id).eq("user_id", user.id);
    throw error;
  }
}

export async function listDevicesForCurrentUser(): Promise<DeviceRow[]> {
  const { data, error } = await supabase
    .from("devices")
    .select("id, kind, name, user_agent, physical_pc_id, last_active_at, revoked_at, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function revokeDevice(id: string): Promise<{ error?: string }> {
  const revokedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("devices")
    .update({ revoked_at: revokedAt })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Device revocation did not update an account-owned device." };

  // Keep browser-grant state aligned with the authoritative device row. A
  // failure here does not un-revoke the device; registration also checks the
  // device's revoked_at before refreshing any grant.
  const { error: grantError } = await supabase
    .from("browser_grants")
    .update({ revoked_at: revokedAt })
    .eq("device_id", id)
    .is("revoked_at", null);
  if (grantError) {
    return {
      error: `The device is revoked, but its browser-grant mirror could not be updated: ${grantError.message}`,
    };
  }
  return {};
}

/** Rename a device. Label only — stable browser identity lives in browser_grants. */
export async function renameDevice(id: string, name: string): Promise<{ error?: string }> {
  const trimmed = name.trim().slice(0, 120);
  if (!trimmed) return { error: "Enter a name." };
  const { data, error } = await supabase
    .from("devices")
    .update({ name: trimmed })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Device rename did not update an account-owned device." };
  return {};
}

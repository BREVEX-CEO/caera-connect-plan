/**
 * Device + browser-grant registration.
 *
 * Plan §6 rule: one physical PC = one desktop device slot. Multiple browsers on
 * the same PC share that slot via separate rows in `browser_grants`. Until the
 * Native Companion (P35) ships, we cannot detect the physical PC, so each
 * desktop browser install registers as its own `devices` row. When the
 * companion arrives it will promote sibling browsers onto one shared
 * `physical_pc_id` and free the extra slots.
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

export async function registerDeviceForCurrentSession(): Promise<void> {
  if (typeof window === "undefined") return;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return;

  const installId = getBrowserInstallId();
  const kind = guessDeviceKind();
  const ua = navigator.userAgent || "";
  const name = browserLabel();

  // Find existing device row for this browser install (matched by name+ua for now).
  const { data: existing } = await supabase
    .from("devices")
    .select("id, revoked_at")
    .eq("user_id", user.id)
    .eq("name", `${name} · ${installId.slice(0, 8)}`)
    .maybeSingle();

  if (existing?.id) {
    /**
     * A REVOKED DEVICE MUST NEVER UN-REVOKE ITSELF BY RECONNECTING.
     *
     * Revocation is the user's decision about a device they no longer trust —
     * typically one that is lost or stolen. Clearing `revoked_at` here because
     * the device showed up again would hand access straight back to whoever is
     * holding it, and would make the device-management screen a lie: the user
     * revokes it, the thief reloads the page, and it silently returns.
     *
     * Re-enabling a revoked device is an explicit user action, not a side
     * effect of registration. Nothing is written here, so the revoked row keeps
     * the exact revocation timestamp the user created.
     */
    if (existing.revoked_at) return;

    await supabase
      .from("devices")
      .update({ last_active_at: new Date().toISOString() })
      .eq("id", existing.id);
    return;
  }

  await supabase.from("devices").insert({
    user_id: user.id,
    kind,
    name: `${name} · ${installId.slice(0, 8)}`,
    user_agent: ua,
    last_active_at: new Date().toISOString(),
  });
}

export async function listDevicesForCurrentUser(): Promise<DeviceRow[]> {
  const { data } = await supabase
    .from("devices")
    .select("id, kind, name, user_agent, physical_pc_id, last_active_at, revoked_at, created_at")
    .order("created_at", { ascending: false });
  return (data ?? []) as DeviceRow[];
}

export async function revokeDevice(id: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id);
  return error ? { error: error.message } : {};
}

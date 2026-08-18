/**
 * Device + browser-grant registration.
 *
 * Browser identity is the immutable local install id stored in
 * `browser_grants` — never the mutable display name. Registration and
 * revocation are database-owned atomic operations so a lost browser connection
 * cannot leave half-written identity state.
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

type BrowserRegistrationRpcClient = {
  rpc: (
    functionName: "register_browser_device_for_current_user",
    args: {
      _browser_install_id: string;
      _kind: "desktop" | "mobile";
      _name: string;
      _user_agent: string;
      _origin: string;
    },
  ) => PromiseLike<{ data: string | null; error: { message: string } | null }>;
};

type AtomicDeviceRpcClient = {
  rpc: (
    functionName: "revoke_device_for_current_user",
    args: { _device_id: string },
  ) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
};

/**
 * Register this browser in one authenticated PostgreSQL transaction.
 *
 * Migration `20260818195000_atomic_browser_device_registration.sql` acquires a
 * per-(user, install-id) advisory lock, updates an existing identity or inserts
 * both `devices` and `browser_grants` atomically, and returns null for a revoked
 * browser. Several tabs can call this at once without creating duplicate ghost
 * devices.
 */
export async function registerDeviceForCurrentSession(): Promise<void> {
  if (typeof window === "undefined") return;

  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!data.user) return;

  const installId = getBrowserInstallId();
  const kind = guessDeviceKind();
  const ua = navigator.userAgent || "";
  const generatedName = `${browserLabel()} · ${installId.slice(0, 8)}`;

  /**
   * Generated Supabase types must follow the deployed database, so keep the
   * compatibility cast local until the migration is applied and types are
   * regenerated. Hand-editing generated types would falsely claim schema parity.
   */
  const rpcClient = supabase as unknown as BrowserRegistrationRpcClient;
  const { error } = await rpcClient.rpc("register_browser_device_for_current_user", {
    _browser_install_id: installId,
    _kind: kind,
    _name: generatedName,
    _user_agent: ua,
    _origin: window.location.origin,
  });
  if (error) throw new Error(`Could not register this browser: ${error.message}`);
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
  /**
   * Introduced by `20260817153000_atomic_device_revocation.sql`. As above, the
   * cast disappears after generated database types are refreshed from a schema
   * that has actually applied the migration.
   */
  const rpcClient = supabase as unknown as AtomicDeviceRpcClient;
  const { data, error } = await rpcClient.rpc("revoke_device_for_current_user", { _device_id: id });
  if (error) return { error: error.message };
  if (data !== true) return { error: "Device revocation did not update an account-owned device." };
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

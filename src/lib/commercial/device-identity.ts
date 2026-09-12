/**
 * WHICH DEVICE THIS IS, FOR THE ACCOUNT'S ALLOWANCE.
 *
 * The offline half of the usage authority issues a signed lease to an account
 * AND a device, so a browser that answers with no network still spends from one
 * shared allowance rather than inventing its own. That requires a stable device
 * identity, and this is the whole of it.
 *
 * Browser identity is the immutable local install id recorded in
 * `browser_grants` — never the mutable display name, which a person can change
 * and which an older build wrongly used as the key.
 *
 * WHAT THIS IS NOT ANY MORE. It was `devices.ts`, and it also listed, renamed
 * and revoked devices for a Devices screen that no longer exists. Registration
 * and identity are what the allowance needs; the rest went with the screen.
 */

import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { getBrowserInstallId, guessDeviceKind, browserLabel } from "@/lib/browser-install-id";

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

export interface CurrentDeviceIdentity {
  accountId: string;
  deviceId: string;
  browserInstallId: string;
}

const CURRENT_DEVICE_CACHE = "ocade:current-device:v1";

/*
 * CAPS, SO A READ CANNOT GROW WITHOUT ANYBODY DECIDING IT SHOULD.
 *
 * One browser install holds one grant, which is exactly why an unbounded read
 * here would never be noticed until an account that had accumulated duplicate
 * rows from an older deployment tried to spend an offline lease.
 */
const MAX_GRANTS_PER_INSTALL = 20;

function cacheCurrentDeviceIdentity(identity: CurrentDeviceIdentity): CurrentDeviceIdentity {
  try {
    window.localStorage?.setItem(CURRENT_DEVICE_CACHE, JSON.stringify(identity));
  } catch {
    // Registration remains valid in storage-restricted/private contexts; such
    // a browser simply cannot use a lease after a restart while disconnected.
  }
  return identity;
}

function clearCachedCurrentDeviceIdentity(accountId: string): void {
  const cached = readCachedCurrentDeviceIdentity(accountId);
  if (!cached) return;
  try {
    window.localStorage?.removeItem(CURRENT_DEVICE_CACHE);
  } catch {
    // See cacheCurrentDeviceIdentity: a missing storage authority is already
    // a fail-closed offline state, not a reason to fail online revocation.
  }
}

/**
 * The last server-verified browser grant. This is not an authorization token:
 * the signed offline lease is still account/device bound and verified before
 * use. Keeping the identifier locally lets an already authenticated session
 * spend its preallocated block when the network is gone.
 */
export function readCachedCurrentDeviceIdentity(accountId?: string): CurrentDeviceIdentity | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(CURRENT_DEVICE_CACHE) ?? "null",
    ) as Partial<CurrentDeviceIdentity> | null;
    if (!parsed?.accountId || !parsed.deviceId || !parsed.browserInstallId) return null;
    if (accountId && parsed.accountId !== accountId) return null;
    return parsed as CurrentDeviceIdentity;
  } catch {
    return null;
  }
}

type AtomicDeviceRpcClient = {
  rpc: (
    functionName: "revoke_device_for_current_user",
    args: { _device_id: string },
  ) => PromiseLike<{ data: boolean | null; error: { message: string } | null }>;
};

async function createBrowserGrant(input: {
  userId: string;
  installId: string;
  deviceId: string;
  userAgent: string;
  revokedAt?: string | null;
}) {
  const supabase = await loadSupabaseClient();
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
  const supabase = await loadSupabaseClient();
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
    .order("created_at", { ascending: false })
    // One browser install has one grant; the cap is here because a duplicate
    // from an older deployment must not turn this into an unbounded read.
    .limit(MAX_GRANTS_PER_INSTALL);
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
    if (!device)
      throw new Error("This browser grant points to a device record that no longer exists.");

    // Device revocation is authoritative even if an old grant row was not
    // stamped during a previous partial write.
    if (device.revoked_at) {
      clearCachedCurrentDeviceIdentity(user.id);
      return;
    }

    const [{ error: deviceUpdateError }, { error: grantUpdateError }] = await Promise.all([
      supabase
        .from("devices")
        .update({ last_active_at: now })
        .eq("id", device.id)
        .eq("user_id", user.id),
      supabase
        .from("browser_grants")
        .update({ last_seen_at: now, user_agent: ua, origin: window.location.origin })
        .eq("id", currentGrant.id)
        .eq("user_id", user.id),
    ]);
    if (deviceUpdateError) throw deviceUpdateError;
    if (grantUpdateError) throw grantUpdateError;
    cacheCurrentDeviceIdentity({
      accountId: user.id,
      deviceId: device.id,
      browserInstallId: installId,
    });
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
    if (legacyDevice.revoked_at) {
      clearCachedCurrentDeviceIdentity(user.id);
      return;
    }

    const { error } = await supabase
      .from("devices")
      .update({ last_active_at: now })
      .eq("id", legacyDevice.id)
      .eq("user_id", user.id);
    if (error) throw error;
    cacheCurrentDeviceIdentity({
      accountId: user.id,
      deviceId: legacyDevice.id,
      browserInstallId: installId,
    });
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
    cacheCurrentDeviceIdentity({
      accountId: user.id,
      deviceId: insertedDevice.id,
      browserInstallId: installId,
    });
  } catch (error) {
    // Best-effort rollback: a device without its stable browser identity must
    // not consume a slot and later appear as a successfully registered device.
    await supabase.from("devices").delete().eq("id", insertedDevice.id).eq("user_id", user.id);
    throw error;
  }
}

/**
 * Resolve the stable, account-owned device behind this browser session.
 * Revoked grants and devices fail closed; display names never participate in
 * identity.
 */
export async function getCurrentDeviceIdentity(): Promise<CurrentDeviceIdentity | null> {
  if (typeof window === "undefined") return null;
  const supabase = await loadSupabaseClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) return null;
  const browserInstallId = getBrowserInstallId();
  const { data: grants, error } = await supabase
    .from("browser_grants")
    .select("device_id, revoked_at, devices!inner(revoked_at)")
    .eq("user_id", auth.user.id)
    .eq("browser_install_id", browserInstallId)
    .order("created_at", { ascending: false })
    .limit(MAX_GRANTS_PER_INSTALL);
  if (error) throw error;
  const active = (grants ?? []).find((grant) => {
    const device = grant.devices as unknown as { revoked_at: string | null } | null;
    return !grant.revoked_at && !device?.revoked_at;
  });
  if (!active) {
    clearCachedCurrentDeviceIdentity(auth.user.id);
    return null;
  }
  return cacheCurrentDeviceIdentity({
    accountId: auth.user.id,
    deviceId: active.device_id,
    browserInstallId,
  });
}

/** Resolve the locally persisted auth session without requiring a network call. */
export async function getOfflineCurrentDeviceIdentity(): Promise<CurrentDeviceIdentity | null> {
  if (typeof window === "undefined") return null;
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user.id) return null;
  return readCachedCurrentDeviceIdentity(data.session.user.id);
}

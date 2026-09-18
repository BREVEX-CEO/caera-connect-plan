import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { getBrowserInstallId, guessDeviceKind, browserLabel } from "@/lib/browser-install-id";

export interface CurrentDeviceIdentity {
  accountId: string;
  deviceId: string;
  browserInstallId: string;
}

const CURRENT_DEVICE_CACHE = "ocade:current-device:v1";

/** Cached identity locates a lease; spending still requires its valid server signature. */
export async function getOfflineCurrentDeviceIdentity(): Promise<CurrentDeviceIdentity | null> {
  if (typeof window === "undefined") return null;
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user.id) return null;
  try {
    const identity = JSON.parse(window.localStorage.getItem(CURRENT_DEVICE_CACHE) ?? "null");
    return identity?.accountId === data.session.user.id &&
      identity.deviceId &&
      identity.browserInstallId
      ? identity
      : null;
  } catch {
    return null;
  }
}

/** Register a fresh installation, or revalidate its existing grant before caching it. */
export async function ensureCurrentDeviceIdentity(): Promise<CurrentDeviceIdentity | null> {
  if (typeof window === "undefined" || !navigator.onLine || !navigator.locks) return null;
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user.id) return null;
  const accountId = data.session.user.id;
  const browserInstallId = getBrowserInstallId();
  if (!browserInstallId) return null;
  return navigator.locks.request(`ocade:device:${accountId}:${browserInstallId}`, async () => {
    const grant = await supabase
      .from("browser_grants")
      .select("device_id, revoked_at")
      .eq("user_id", accountId)
      .eq("browser_install_id", browserInstallId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (grant.error) throw new Error("This browser grant could not be verified.");
    let deviceId = grant.data?.device_id;
    if (deviceId) {
      const device = await supabase
        .from("devices")
        .select("id, revoked_at")
        .eq("id", deviceId)
        .eq("user_id", accountId)
        .maybeSingle();
      if (device.error) throw new Error("This device could not be verified.");
      if (grant.data?.revoked_at || !device.data || device.data.revoked_at) {
        window.localStorage.removeItem(CURRENT_DEVICE_CACHE);
        return null;
      }
    } else {
      const device = await supabase
        .from("devices")
        .insert({
          user_id: accountId,
          kind: guessDeviceKind(),
          name: browserLabel(),
        })
        .select("id")
        .single();
      if (device.error || !device.data) throw new Error("This device could not be registered.");
      deviceId = device.data.id;
      const created = await supabase.from("browser_grants").insert({
        user_id: accountId,
        device_id: deviceId,
        browser_install_id: browserInstallId,
        origin: window.location.origin,
        user_agent: navigator.userAgent,
      });
      if (created.error) {
        await supabase.from("devices").delete().eq("id", deviceId).eq("user_id", accountId);
        throw new Error("This browser grant could not be registered.");
      }
    }
    const identity = { accountId, deviceId, browserInstallId };
    window.localStorage.setItem(CURRENT_DEVICE_CACHE, JSON.stringify(identity));
    return identity;
  });
}

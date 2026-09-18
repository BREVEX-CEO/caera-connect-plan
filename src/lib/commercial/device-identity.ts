import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { getBrowserInstallId, guessDeviceKind, browserLabel } from "@/lib/browser-install-id";
import { buildHealthRecord } from "@/lib/telemetry/operation-health";

export interface CurrentDeviceIdentity {
  accountId: string;
  deviceId: string;
  browserInstallId: string;
}

const CURRENT_DEVICE_CACHE = "ocade:current-device:v1";

/** Postgres `check_violation`, which is how the account's device cap refuses. */
const DEVICE_CAP_REFUSAL = "23514";

/**
 * Why this browser has no device of its own.
 *
 * Two outcomes, because they need different sentences: an account at its device
 * limit is a decision the person can act on, and anything else is a fault that
 * fixes itself on the next visit.
 */
export type DeviceRegistrationProblem = "device_limit" | "unavailable";

export class DeviceRegistrationFailed extends Error {
  constructor(
    readonly problem: DeviceRegistrationProblem,
    message: string,
  ) {
    super(message);
  }
}

let problem: DeviceRegistrationProblem | null = null;
const watchers = new Set<() => void>();

/** Why this browser has no device, or null while it has one. */
export function deviceRegistrationProblem(): DeviceRegistrationProblem | null {
  return problem;
}

/** Subscribe a surface to that answer. Returns its own unsubscribe. */
export function watchDeviceRegistration(notify: () => void): () => void {
  watchers.add(notify);
  return () => void watchers.delete(notify);
}

/**
 * Publish the outcome, and say it once in the console.
 *
 * Registration runs in a background task nobody asked for, so it cannot throw
 * at the person — but it used to be swallowed whole, which left an account at
 * its device limit with no offline answers and no explanation anywhere.
 *
 * The console line is built by the diagnostics authority, so every field in it
 * is an enumerated value known at build time: it can describe the failure and
 * it cannot carry an account, a prompt, a device name or a key.
 */
function publish(next: DeviceRegistrationProblem | null): void {
  if (next === problem) return;
  problem = next;
  if (next) {
    console.warn(
      "[OCADE]",
      buildHealthRecord({
        component: "web",
        operation: "offline_allowance",
        outcome: next === "device_limit" ? "refused" : "failed",
        errorClass: next === "device_limit" ? "quota" : "transport",
      }),
    );
  }
  for (const notify of watchers) notify();
}

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
  try {
    const identity = await registerCurrentDevice(supabase, accountId, browserInstallId);
    publish(null);
    return identity;
  } catch (error) {
    publish(error instanceof DeviceRegistrationFailed ? error.problem : "unavailable");
    throw error;
  }
}

type SupabaseClient = Awaited<ReturnType<typeof loadSupabaseClient>>;

async function registerCurrentDevice(
  supabase: SupabaseClient,
  accountId: string,
  browserInstallId: string,
): Promise<CurrentDeviceIdentity | null> {
  return navigator.locks.request(`ocade:device:${accountId}:${browserInstallId}`, async () => {
    const grant = await supabase
      .from("browser_grants")
      .select("device_id, revoked_at")
      .eq("user_id", accountId)
      .eq("browser_install_id", browserInstallId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (grant.error)
      throw new DeviceRegistrationFailed(
        "unavailable",
        "This browser grant could not be verified.",
      );
    let deviceId = grant.data?.device_id;
    if (deviceId) {
      const device = await supabase
        .from("devices")
        .select("id, revoked_at")
        .eq("id", deviceId)
        .eq("user_id", accountId)
        .maybeSingle();
      if (device.error)
        throw new DeviceRegistrationFailed("unavailable", "This device could not be verified.");
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
      if (device.error || !device.data)
        throw new DeviceRegistrationFailed(
          device.error?.code === DEVICE_CAP_REFUSAL ? "device_limit" : "unavailable",
          "This device could not be registered.",
        );
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
        throw new DeviceRegistrationFailed(
          "unavailable",
          "This browser grant could not be registered.",
        );
      }
    }
    const identity = { accountId, deviceId, browserInstallId };
    window.localStorage.setItem(CURRENT_DEVICE_CACHE, JSON.stringify(identity));
    return identity;
  });
}

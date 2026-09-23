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

class DeviceRegistrationFailed extends Error {
  constructor(
    readonly problem: DeviceRegistrationProblem,
    message: string,
  ) {
    super(message);
  }
}

let problem: DeviceRegistrationProblem | null = null;
/** The account the answer above is about. A different one has not been asked. */
let problemAccount: string | null = null;
const watchers = new Set<() => void>();

/**
 * Why this browser has no device, or null while it has one.
 *
 * `forAccount` is how a screen refuses to show somebody else's answer. This was
 * module-global and unkeyed, so signing out and in as another account left the
 * first account's "you are at your device limit" on the second account's
 * Settings until a refresh happened to overwrite it.
 */
export function deviceRegistrationProblem(
  forAccount?: string | null,
): DeviceRegistrationProblem | null {
  if (forAccount !== undefined && forAccount !== problemAccount) return null;
  return problem;
}

/** Forget what was learned about another account. */
function observeAccount(accountId: string | null): void {
  if (problemAccount === accountId) return;
  problemAccount = accountId;
  problem = null;
  for (const notify of watchers) notify();
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

/**
 * Forget this browser's device.
 *
 * Used when the person removes it: the allocation is gone server-side, and a
 * cached identity pointing at a revoked device would send the next offline
 * request looking for a lease that no longer exists.
 */
export function forgetCurrentDeviceIdentity(): void {
  try {
    window.localStorage.removeItem(CURRENT_DEVICE_CACHE);
  } catch {
    /* A browser that will not let go of it must not fail the removal. */
  }
}

/** Cached identity locates a lease; spending still requires its valid server signature. */
export async function getOfflineCurrentDeviceIdentity(): Promise<CurrentDeviceIdentity | null> {
  if (typeof window === "undefined") return null;
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user.id) return null;
  observeAccount(data.session.user.id);
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
  /*
   * NO WEB LOCKS REQUIREMENT ANY MORE.
   *
   * This returned null — silently, publishing nothing — in any browser without
   * `navigator.locks`, so an unsupported or restricted browser never registered
   * and was never told why, while the model UI could still say Ready. The lock
   * it was reaching for is now the database's, held by the registration
   * transaction, which also covers the tabs and devices a browser-local lock
   * could never see.
   */
  if (typeof window === "undefined" || !navigator.onLine) return null;
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user.id) return null;
  const accountId = data.session.user.id;
  observeAccount(accountId);
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

/**
 * ONE CALL, ONE TRANSACTION, ONE OUTCOME.
 *
 * The device row and the grant that points at it are written together by
 * `register_browser_device_for_current_user`, so there is no moment at which
 * one exists without the other and no compensating delete whose own failure
 * could leave an orphan device holding a slot for ever.
 *
 * A null answer means this browser's grant was revoked. It is not re-admitted:
 * removing a device in Settings would be worthless if the browser signed itself
 * back in on the next visit.
 */
async function registerCurrentDevice(
  supabase: Awaited<ReturnType<typeof loadSupabaseClient>>,
  accountId: string,
  browserInstallId: string,
): Promise<CurrentDeviceIdentity | null> {
  const { data, error } = await supabase.rpc("register_browser_device_for_current_user", {
    _browser_install_id: browserInstallId,
    _kind: guessDeviceKind(),
    _name: browserLabel(),
    _origin: window.location.origin,
    _user_agent: navigator.userAgent,
  });
  if (error)
    throw new DeviceRegistrationFailed(
      error.code === DEVICE_CAP_REFUSAL ? "device_limit" : "unavailable",
      "This device could not be registered.",
    );
  const deviceId = data as string | null;
  if (!deviceId) {
    window.localStorage.removeItem(CURRENT_DEVICE_CACHE);
    return null;
  }
  const identity = { accountId, deviceId, browserInstallId };
  window.localStorage.setItem(CURRENT_DEVICE_CACHE, JSON.stringify(identity));
  return identity;
}

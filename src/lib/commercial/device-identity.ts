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

/** Resolve the locally persisted auth session without requiring a network call. */
export async function getOfflineCurrentDeviceIdentity(): Promise<CurrentDeviceIdentity | null> {
  if (typeof window === "undefined") return null;
  const supabase = await loadSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user.id) return null;
  return readCachedCurrentDeviceIdentity(data.session.user.id);
}

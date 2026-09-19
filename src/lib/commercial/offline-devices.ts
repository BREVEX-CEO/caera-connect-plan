/**
 * THE DEVICES THAT CAN ANSWER WITHOUT A NETWORK, AND HOW TO FREE A SLOT.
 *
 * An account may answer offline on a fixed number of devices, and the database
 * has enforced that from the beginning — `revoke_device_for_current_user` has
 * existed, granted to `authenticated`, the whole time. Nothing in the product
 * ever called it, so somebody on their third browser was told the truth and
 * given no way to act on it: no list, no name, no Remove.
 *
 * Reads go through RLS rather than a function: `devices_self_all` already
 * restricts both to the signed-in account, and a security-definer read would be
 * a second authority saying the same thing with more ways to be wrong.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import { forgetCurrentDeviceIdentity, getOfflineCurrentDeviceIdentity } from "./device-identity";

export interface OfflineDevice {
  id: string;
  name: string;
  kind: "desktop" | "mobile";
  lastActiveAt: string;
  /** The browser this list is being read in. */
  current: boolean;
}

/** Every device of this account that still holds a slot, newest use first. */
export async function listOfflineDevices(): Promise<OfflineDevice[]> {
  const supabase = await loadSupabaseClient();
  const identity = await getOfflineCurrentDeviceIdentity();
  const { data, error } = await supabase
    .from("devices")
    .select("id, name, kind, last_active_at")
    .is("revoked_at", null)
    .order("last_active_at", { ascending: false });
  if (error) throw new Error("Your devices could not be read just now.");
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind === "mobile" ? "mobile" : "desktop",
    lastActiveAt: row.last_active_at,
    current: row.id === identity?.deviceId,
  }));
}

/**
 * Remove a device, and with it the browser grants that pointed at it.
 *
 * One transactional server function does both, so a device can never be gone
 * while a grant still names it. Removing the CURRENT device also forgets the
 * cached identity here, because this browser no longer has an allocation and
 * the next offline request must not go looking for one.
 */
export async function revokeOfflineDevice(deviceId: string): Promise<void> {
  const supabase = await loadSupabaseClient();
  const identity = await getOfflineCurrentDeviceIdentity();
  const mine = identity?.deviceId === deviceId;

  /*
   * REPORT BEFORE REMOVING. Whatever this browser spent without a network is
   * sent first, while it still has a device to send it against — afterwards the
   * lease is closed and those events have nowhere to go.
   */
  if (mine) {
    const { syncOfflineAllowance } = await import("./offline-allowance");
    await syncOfflineAllowance();
  }

  const { data, error } = await supabase.rpc("revoke_device_for_current_user", {
    _device_id: deviceId,
  });
  if (error || data === false) throw new Error("That device could not be removed just now.");
  if (!mine) return;

  forgetCurrentDeviceIdentity();

  /*
   * THEN GIVE THE UNSPENT PART BACK.
   *
   * The signed blocks are deleted here first, so nothing can be spent against
   * them after the server has credited the account with what they held. A
   * failure leaves the capacity held until the block expires, which is the
   * outcome that existed before this and is never worse than it.
   */
  try {
    const { forgetOfflineUsageLease, readInstalledOfflineLeases } =
      await import("./offline-counter");
    const held = await readInstalledOfflineLeases(identity!.accountId, deviceId);
    for (const entry of held) {
      await forgetOfflineUsageLease(identity!.accountId, deviceId, entry.lease.payload.leaseId);
    }
    const { closeOfflineUsageForRevokedDevice } = await import("./offline-usage.functions");
    await closeOfflineUsageForRevokedDevice({ data: { deviceId } });
  } catch {
    /* The device is removed either way, which is what was asked for. */
  }
}

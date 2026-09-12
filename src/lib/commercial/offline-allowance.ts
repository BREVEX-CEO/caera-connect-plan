import { getOfflineCurrentDeviceIdentity } from "./device-identity";
import {
  ensureOfflineDeviceKey,
  installOfflineUsageLease,
  listOfflineUsageEvents,
  readInstalledOfflineLeases,
} from "./offline-counter";
import { allocateOfflineUsage, reconcileOfflineUsage } from "./offline-usage.functions";
import { trustedOfflineTimeNow } from "./offline-lease";
import { readTrustedClockHighWater } from "@/lib/time/trusted-clock";

/**
 * KEEPING A SIGNED ALLOWANCE ON THE DEVICE, SO OFFLINE WORK STILL COUNTS.
 *
 * The whole offline half of the allowance was built and unreachable. The
 * browser could SPEND a signed lease — `use-generation-permit` reads installed
 * leases and reserves against them — and nothing had ever installed one,
 * because `allocateOfflineUsage` had no caller. So a device with no network had
 * no allowance to spend and Offline Intelligence could not answer at all: the
 * exact capability the download exists for.
 *
 * This is the missing half and it is deliberately small. While there IS a
 * network it does two things and no more:
 *
 *   RECONCILE first. Anything spent offline is reported before more is asked
 *   for, so the account-wide count is right and a device cannot quietly hold
 *   spent usage that the server never hears about.
 *
 *   TOP UP second, and only when the device is running low. A lease is a block
 *   of the account's own allowance held on one device; asking for a new one on
 *   every visit would strand the account's allowance across devices that are
 *   not using it.
 *
 * It never invents an allowance. Every number here is signed by the server and
 * verified before it is stored; a refusal is a refusal.
 */

/** Ask for more only when less than this much of the held block is left. */
const TOP_UP_BELOW_HUNDREDTHS = 100;

/**
 * Bring this device's offline allowance up to date. Safe to call on any visit.
 *
 * Every failure is swallowed deliberately: this runs in the background on a
 * visit nobody asked it for, and an account with no offline allowance available
 * is a normal state that the online path handles. What must never happen is a
 * thrown error from a background top-up reaching a person who was typing.
 */
export async function syncOfflineAllowance(): Promise<void> {
  try {
    if (typeof indexedDB === "undefined" || typeof navigator === "undefined") return;
    if (navigator.onLine === false) return;

    const identity = await getOfflineCurrentDeviceIdentity();
    if (!identity) return;

    const installed = await readInstalledOfflineLeases(identity.accountId, identity.deviceId);

    /* --- report what was spent while there was no network ----------------- */

    for (const entry of installed) {
      const events = await listOfflineUsageEvents(entry.lease.payload.leaseId);
      if (events.length === 0) continue;
      await reconcileOfflineUsage({
        data: {
          deviceId: identity.deviceId,
          leaseId: entry.lease.payload.leaseId,
          events,
        },
      }).catch(() => undefined);
    }

    /* --- hold a block only while one is actually needed -------------------- */

    const remaining = installed.reduce((total, entry) => {
      const allocated = entry.lease.payload.allocatedHundredths ?? 0;
      return total + Math.max(0, allocated - entry.consumedHundredths - entry.reservedHundredths);
    }, 0);
    if (remaining >= TOP_UP_BELOW_HUNDREDTHS) return;

    const devicePublicKey = await ensureOfflineDeviceKey(identity.accountId, identity.deviceId);
    const allocation = await allocateOfflineUsage({
      data: {
        deviceId: identity.deviceId,
        browserInstallId: identity.browserInstallId,
        devicePublicKey,
        /*
         * ONE KEY PER TOP-UP WINDOW, not per call. The server treats a repeated
         * key as the same request and returns the lease it already issued, so a
         * second tab on the same day cannot take a second block.
         */
        requestKey: `${identity.deviceId}:${new Date().toISOString().slice(0, 13)}`,
      },
    });
    if (!allocation.ok) return;

    await installOfflineUsageLease({
      lease: allocation.lease,
      keys: allocation.verificationKeys,
      accountId: identity.accountId,
      deviceId: identity.deviceId,
      time: trustedOfflineTimeNow(allocation.lease.payload.issuedAt, readTrustedClockHighWater()),
      // A block for the next window is stored but cannot be spent until it
      // begins. Verified now, usable later.
      allowFuture: true,
    });
  } catch {
    /* A device without an offline allowance still works online. */
  }
}

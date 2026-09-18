import { ensureCurrentDeviceIdentity } from "./device-identity";
import {
  ensureOfflineDeviceKey,
  installOfflineUsageLease,
  listOfflineUsageEvents,
  readInstalledOfflineLeases,
} from "./offline-counter";
import { allocateOfflineUsage, reconcileOfflineUsage } from "./offline-usage.functions";
import { trustedOfflineTimeNow } from "./offline-lease";
import { readTrustedClockHighWater } from "@/lib/time/trusted-clock";

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

    const identity = await ensureCurrentDeviceIdentity();
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
      const time = trustedOfflineTimeNow(entry.lease.payload.issuedAt, readTrustedClockHighWater());
      if (
        time.rollbackDetected ||
        time.now >= Date.parse(entry.lease.payload.expiresAt) ||
        time.now < Date.parse(entry.lease.payload.notBefore)
      )
        return total;
      const allocated = entry.lease.payload.allocatedHundredths ?? 0;
      return total + Math.max(0, allocated - entry.consumedHundredths - entry.reservedHundredths);
    }, 0);
    if (remaining >= TOP_UP_BELOW_HUNDREDTHS) return;

    const devicePublicKey = await ensureOfflineDeviceKey(identity.accountId, identity.deviceId);
    const latest = [...installed]
      .sort(
        (a, b) =>
          a.lease.payload.issuedAt.localeCompare(b.lease.payload.issuedAt) ||
          a.lease.payload.leaseId.localeCompare(b.lease.payload.leaseId),
      )
      .at(-1);
    const allocation = await allocateOfflineUsage({
      data: {
        deviceId: identity.deviceId,
        browserInstallId: identity.browserInstallId,
        devicePublicKey,
        // Block identity allows same-hour top-ups; time bounds retries after lost local storage.
        requestKey: `${identity.deviceId}:${latest?.lease.payload.leaseId ?? "initial"}:${new Date().toISOString().slice(0, 13)}`,
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

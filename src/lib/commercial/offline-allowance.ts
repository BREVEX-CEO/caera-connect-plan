import { ensureCurrentDeviceIdentity } from "./device-identity";
import {
  ensureOfflineDeviceKey,
  forgetOfflineUsageLease,
  installOfflineUsageLease,
  listOfflineUsageEvents,
  readInstalledOfflineLeases,
} from "./offline-counter";
import { allocateOfflineUsage, reconcileOfflineUsage } from "./offline-usage.functions";
import { trustedOfflineTimeNow } from "./offline-lease";
import { settleTrustedClock } from "@/lib/time/trusted-clock";

/** Ask for more only when less than this much of the held block is left. */
const TOP_UP_BELOW_HUNDREDTHS = 100;

/**
 * Bring this device's offline allowance up to date. Safe to call on any visit.
 *
 * No failure interrupts the person: this runs in the background on a visit
 * nobody asked for, and a thrown error from a top-up must never reach somebody
 * who was typing. Registration is not silent about it, though — it publishes
 * why it could not give this browser a device, and Usage & Limits and the
 * offline refusal both read that.
 */
export async function syncOfflineAllowance(): Promise<void> {
  try {
    if (typeof indexedDB === "undefined" || typeof navigator === "undefined") return;
    if (navigator.onLine === false) return;

    const identity = await ensureCurrentDeviceIdentity();
    if (!identity) return;

    const installed = await readInstalledOfflineLeases(identity.accountId, identity.deviceId);

    /* --- report what was spent while there was no network ----------------- */

    /*
     * AND THEN FORGET THE BLOCKS THAT ARE OVER.
     *
     * Nothing ever removed a lease, and the server verifies an event chain from
     * its first sequence — so every visit re-sent every event of every block
     * this browser had ever held. A profile used daily accumulates about four
     * blocks a day, each with a chain, and the reconnect that was one request
     * becomes a thousand. An expired block cannot be spent again and the server
     * now has its events, so the only correct copy is the server's.
     */
    for (const entry of installed) {
      const lease = entry.lease.payload;
      const events = await listOfflineUsageEvents(lease.leaseId);
      const settled =
        events.length === 0 ||
        (await reconcileOfflineUsage({
          data: { deviceId: identity.deviceId, leaseId: lease.leaseId, events },
        }).then(
          () => true,
          () => false,
        ));
      const time = trustedOfflineTimeNow(lease.issuedAt);
      if (settled && time.now >= Date.parse(lease.expiresAt)) {
        await forgetOfflineUsageLease(identity.accountId, identity.deviceId, lease.leaseId);
      }
    }

    /* --- hold a block only while one is actually needed -------------------- */

    const remaining = installed.reduce((total, entry) => {
      const time = trustedOfflineTimeNow(entry.lease.payload.issuedAt);
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
    // A clock set forward and back again left a mark ahead of the server: settled here.
    settleTrustedClock(Date.parse(allocation.lease.payload.issuedAt));

    await installOfflineUsageLease({
      lease: allocation.lease,
      keys: allocation.verificationKeys,
      accountId: identity.accountId,
      deviceId: identity.deviceId,
      time: trustedOfflineTimeNow(allocation.lease.payload.issuedAt),
      // A block for the next window is stored but cannot be spent until it
      // begins. Verified now, usable later.
      allowFuture: true,
    });
  } catch {
    /* A device without an offline allowance still works online. */
  }
}

/**
 * Can this browser answer with no network right now? Needs a verified model
 * and an unexpired signed allowance with room left. The banner reads this so
 * it never promises an answer the send would refuse (F16).
 */
export async function canAnswerWithoutNetwork(): Promise<boolean> {
  try {
    const [{ modelVault }, { getOfflineCurrentDeviceIdentity }] = await Promise.all([
      import("@/lib/brain/model-vault"),
      import("./device-identity"),
    ]);
    const [view, identity] = await Promise.all([
      modelVault.installationView(),
      getOfflineCurrentDeviceIdentity(),
    ]);
    if (!view.ready || !identity) return false;
    const leases = await readInstalledOfflineLeases(identity.accountId, identity.deviceId);
    const now = Date.now();
    return leases.some(
      (entry) =>
        // A block for a later window cannot be spent yet, as the reservation itself refuses (F-204).
        Date.parse(entry.lease.payload.notBefore) <= now &&
        Date.parse(entry.lease.payload.expiresAt) > now &&
        entry.lease.payload.allocatedHundredths -
          entry.consumedHundredths -
          entry.reservedHundredths >=
          100,
    );
  } catch {
    return false;
  }
}

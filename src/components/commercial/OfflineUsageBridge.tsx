import { useEffect } from "react";
import { getCurrentDeviceIdentity, registerDeviceForCurrentSession } from "@/lib/devices";
import {
  ensureOfflineDeviceKey,
  installOfflineUsageLease,
  listOfflineUsageEvents,
  readInstalledOfflineLeases,
} from "@/lib/commercial/offline-counter";
import {
  resolveTrustedOfflineTime,
  type SignedOfflineUsageLease,
} from "@/lib/commercial/offline-lease";
import {
  allocateOfflineUsage,
  readOfflineUsage,
  reconcileOfflineUsage,
} from "@/lib/commercial/offline-usage.functions";
import { observeNow, readTrustedClockHighWater } from "@/lib/time/trusted-clock";

const REQUEST_PREFIX = "ocade:offline-allocation-request:v1:";
const UPDATED_EVENT = "ocade:offline-usage-updated";

function allocationRequestKey(
  deviceId: string,
  purpose: "current" | "refill" | "preissue",
): string {
  const key = `${REQUEST_PREFIX}${deviceId}:${purpose}`;
  const current = window.localStorage.getItem(key);
  if (current) return current;
  const created = crypto.randomUUID();
  window.localStorage.setItem(key, created);
  return created;
}

function clearAllocationRequestKey(
  deviceId: string,
  purpose: "current" | "refill" | "preissue",
): void {
  window.localStorage.removeItem(`${REQUEST_PREFIX}${deviceId}:${purpose}`);
}

function trustedTime(lease: SignedOfflineUsageLease) {
  const wallNow = Date.now();
  const monotonicNow =
    typeof performance === "undefined" ? wallNow : performance.timeOrigin + performance.now();
  const resolved = resolveTrustedOfflineTime({
    wallNow,
    monotonicNow,
    serverTimeAtSync: Date.parse(lease.payload.issuedAt),
    monotonicAtSync: monotonicNow,
    durableHighWater: readTrustedClockHighWater(),
  });
  observeNow(resolved.now);
  return resolved;
}

/**
 * Keeps this signed-in browser's offline allocation current. It renders
 * nothing and cannot block navigation. Missing signing configuration is a
 * truthful unavailable state returned by the server, not a client fallback.
 */
export function OfflineUsageBridge() {
  useEffect(() => {
    let cancelled = false;
    let running = false;

    const synchronize = async () => {
      if (cancelled || running || (typeof navigator !== "undefined" && navigator.onLine === false))
        return;
      running = true;
      try {
        await registerDeviceForCurrentSession();
        const identity = await getCurrentDeviceIdentity();
        if (!identity || cancelled) return;
        const devicePublicKey = await ensureOfflineDeviceKey(identity.accountId, identity.deviceId);
        const view = await readOfflineUsage();
        if (!view.configured || cancelled) return;

        for (const serverLease of view.leases) {
          if (
            serverLease.deviceId === identity.deviceId &&
            serverLease.signedLease &&
            ["active", "preissued"].includes(serverLease.status)
          ) {
            await installOfflineUsageLease({
              lease: serverLease.signedLease,
              keys: view.verificationKeys,
              accountId: identity.accountId,
              deviceId: identity.deviceId,
              time: trustedTime(serverLease.signedLease),
              allowFuture: serverLease.preissued,
            });
          }
        }

        const installed = await readInstalledOfflineLeases(identity.accountId, identity.deviceId);
        for (const local of installed) {
          const events = await listOfflineUsageEvents(local.lease.payload.leaseId);
          if (events.length > 0) {
            await reconcileOfflineUsage({
              data: {
                deviceId: identity.deviceId,
                leaseId: local.lease.payload.leaseId,
                events,
              },
            });
          }
        }

        const now = Date.now();
        let current = view.leases.find(
          (lease) =>
            lease.deviceId === identity.deviceId &&
            lease.status === "active" &&
            Date.parse(lease.notBefore) <= now &&
            Date.parse(lease.expiresAt) > now &&
            lease.signedLease,
        );
        if (current?.signedLease) {
          await installOfflineUsageLease({
            lease: current.signedLease,
            keys: view.verificationKeys,
            accountId: identity.accountId,
            deviceId: identity.deviceId,
            time: trustedTime(current.signedLease),
          });
          clearAllocationRequestKey(identity.deviceId, "current");
          window.dispatchEvent(new Event(UPDATED_EVENT));
        }

        const requestBlock = async (purpose: "current" | "refill" | "preissue") => {
          const preissue = purpose === "preissue";
          const result = await allocateOfflineUsage({
            data: {
              deviceId: identity.deviceId,
              browserInstallId: identity.browserInstallId,
              devicePublicKey,
              requestKey: allocationRequestKey(identity.deviceId, purpose),
              preissue,
            },
          });
          if (!result.ok || cancelled) return undefined;
          clearAllocationRequestKey(identity.deviceId, purpose);
          await installOfflineUsageLease({
            lease: result.lease,
            keys: result.verificationKeys,
            accountId: identity.accountId,
            deviceId: identity.deviceId,
            time: trustedTime(result.lease),
            allowFuture: preissue,
          });
          if (!preissue) {
            current = {
              leaseId: result.lease.payload.leaseId,
              deviceId: identity.deviceId,
              deviceName: "This device",
              status: "active",
              tier: result.lease.payload.tier,
              preissued: false,
              sessionWindowStart: result.lease.payload.sessionWindowStart,
              sessionResetAt: result.lease.payload.sessionResetAt,
              weekWindowStart: result.lease.payload.weekWindowStart,
              weekResetAt: result.lease.payload.weekResetAt,
              notBefore: result.lease.payload.notBefore,
              expiresAt: result.lease.payload.expiresAt,
              signedLease: result.lease,
            };
          }
          window.dispatchEvent(new Event(UPDATED_EVENT));
          return result;
        };

        if (!current) await requestBlock("current");

        // Refill only after three quarters of the device's currently installed
        // capacity has been spent. Each refill is its own signed block, so a
        // signing outage can never invalidate a block that already works.
        const local = await readInstalledOfflineLeases(identity.accountId, identity.deviceId);
        const active = local.filter(({ lease }) => {
          const starts = Date.parse(lease.payload.notBefore);
          const ends = Date.parse(lease.payload.expiresAt);
          return starts <= now && ends > now;
        });
        const allocated = active.reduce(
          (total, entry) => total + entry.lease.payload.allocatedHundredths,
          0,
        );
        const unavailable = active.reduce(
          (total, entry) => total + entry.consumedHundredths + entry.reservedHundredths,
          0,
        );
        if (allocated > 0 && allocated - unavailable <= allocated / 4) {
          await requestBlock("refill");
        }

        // One future block lets a device cross the next account-authored reset
        // while disconnected. The server de-duplicates this per device/window.
        const hasPreissued = view.leases.some(
          (lease) =>
            lease.deviceId === identity.deviceId &&
            lease.preissued &&
            lease.status === "preissued" &&
            Date.parse(lease.expiresAt) > now,
        );
        if (!hasPreissued) await requestBlock("preissue");
      } finally {
        running = false;
      }
    };

    const run = () => void synchronize().catch(() => undefined);
    run();
    window.addEventListener("online", run);
    const timer = window.setInterval(run, 60_000);
    return () => {
      cancelled = true;
      window.removeEventListener("online", run);
      window.clearInterval(timer);
    };
  }, []);
  return null;
}

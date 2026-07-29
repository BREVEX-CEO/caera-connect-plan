/**
 * Durable paired-device registry (Plan §27).
 *
 * Devices were previously held in component state only, which meant pairing was
 * cosmetic: a reload lost every device, and — more seriously — a REVOCATION did
 * not survive either. A revocation that evaporates is worse than none, because
 * the user believes a lost phone has been cut off.
 *
 * A revoked device is kept as a tombstone rather than deleted. Removing the row
 * would let the same device pair again silently; keeping it means the refusal
 * is explicit and auditable.
 */
import type { PairedDevice } from "./pairing";

const KEY = "caera:devices:v1";

interface StoredDevice {
  id: string;
  label: string;
  kind: PairedDevice["kind"];
  platform: PairedDevice["platform"];
  pairedAt: string;
  lastSeenAt: string;
  revoked: boolean;
  revokedAt?: string;
}

function toStored(d: PairedDevice, revokedAt?: Date): StoredDevice {
  return {
    id: d.id,
    label: d.label,
    kind: d.kind,
    platform: d.platform,
    pairedAt: d.pairedAt.toISOString(),
    lastSeenAt: d.lastSeenAt.toISOString(),
    revoked: d.revoked,
    revokedAt: revokedAt?.toISOString(),
  };
}

function fromStored(s: StoredDevice): PairedDevice {
  return {
    id: s.id,
    label: s.label,
    kind: s.kind,
    platform: s.platform,
    pairedAt: new Date(s.pairedAt),
    lastSeenAt: new Date(s.lastSeenAt),
    revoked: s.revoked,
  };
}

function readAll(): StoredDevice[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is StoredDevice =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as StoredDevice).id === "string" &&
        typeof (v as StoredDevice).pairedAt === "string",
    );
  } catch {
    return [];
  }
}

function writeAll(rows: StoredDevice[]): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    localStorage.setItem(KEY, JSON.stringify(rows));
    return true;
  } catch {
    return false;
  }
}

/** Every device, including revoked tombstones. */
export function listDevices(): PairedDevice[] {
  return readAll().map(fromStored);
}

/** Devices that may still act. */
export function activeDevices(): PairedDevice[] {
  return listDevices().filter((d) => !d.revoked);
}

/**
 * Register a newly paired device.
 *
 * Refuses to re-pair an id that was revoked: a lost phone must not be able to
 * quietly restore its own trust by pairing again under the same identity.
 */
export function saveDevice(device: PairedDevice): { ok: true } | { ok: false; reason: string } {
  const rows = readAll();
  const existing = rows.find((r) => r.id === device.id);
  if (existing?.revoked) {
    return {
      ok: false,
      reason: "That device was revoked. Remove it from the list before pairing it again.",
    };
  }
  const next = existing
    ? rows.map((r) => (r.id === device.id ? toStored(device) : r))
    : [...rows, toStored(device)];
  return writeAll(next)
    ? { ok: true }
    : {
        ok: false,
        reason:
          "This device could not be saved securely. Check private-storage access and try pairing again.",
      };
}

/**
 * Revoke a device. Persisted as a tombstone so the refusal survives a reload —
 * the whole point of revoking a lost phone.
 */
export function revokeDevice(id: string, now: Date = new Date()): PairedDevice | null {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], revoked: true, revokedAt: now.toISOString() };
  return writeAll(rows) ? fromStored(rows[idx]) : null;
}

/** Permanently forget a device, allowing it to pair again. Explicit user action. */
export function forgetDevice(id: string): void {
  writeAll(readAll().filter((r) => r.id !== id));
}

/** Refresh the last-seen timestamp used by the trust-staleness check. */
export function touchDevice(id: string, now: Date = new Date()): void {
  const rows = readAll();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1 || rows[idx].revoked) return;
  rows[idx] = { ...rows[idx], lastSeenAt: now.toISOString() };
  writeAll(rows);
}

/** Remove every device — used when clearing local state entirely. */
export function clearDevices(): void {
  writeAll([]);
}

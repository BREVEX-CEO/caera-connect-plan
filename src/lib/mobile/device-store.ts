/**
 * The paired-device registry (Plan §27) — the account's, not the browser's.
 *
 * WHY THIS IS A SAFETY QUESTION AND NOT A STORAGE ONE. Devices lived in
 * `localStorage` under `caera:devices:v1` while `public.devices` held the same
 * idea for browsers and PCs. Two registries answering "which devices may act
 * for this account" is a defect anywhere; here it was dangerous. A REVOCATION
 * that lives only in the browser it was performed in is not a revocation:
 * somebody who loses a phone and revokes it from a laptop would find it still
 * trusted on every other device they own, and the refusal gone entirely once
 * that laptop's storage was cleared.
 *
 * So this file is now a typed view over `public.devices`, and every function is
 * a request. `devices.ts` owns registering THIS browser; this owns the phones a
 * person has paired. They are the same table.
 *
 * A REVOKED DEVICE IS KEPT AS A TOMBSTONE — `revoked_at` set, row present —
 * rather than deleted. Removing it would let the same device pair again
 * silently; keeping it means the refusal is explicit and auditable.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import type { DeviceKind, DevicePlatform, PairedDevice } from "./pairing";

const COLUMNS = "id, name, kind, platform, created_at, last_active_at, revoked_at";

interface DeviceRow {
  id: string;
  name: string;
  kind: DeviceKind;
  platform: string | null;
  created_at: string;
  last_active_at: string;
  revoked_at: string | null;
}

const PLATFORMS: DevicePlatform[] = ["windows", "macos", "android", "ios"];

/**
 * A row registered before `platform` was recorded does not know its own.
 * `windows` is the shape the rest of the product treats as "an ordinary desktop
 * we cannot say more about"; it is never presented as a fact somebody stated.
 */
function platformOf(row: DeviceRow): DevicePlatform {
  const stored = row.platform as DevicePlatform | null;
  if (stored && PLATFORMS.includes(stored)) return stored;
  return row.kind === "mobile" ? "android" : "windows";
}

function toPaired(row: DeviceRow): PairedDevice {
  return {
    id: row.id,
    label: row.name,
    kind: row.kind,
    platform: platformOf(row),
    pairedAt: new Date(row.created_at),
    lastSeenAt: new Date(row.last_active_at),
    revoked: row.revoked_at !== null,
  };
}

/** Every device, including revoked tombstones. */
/** Approved devices, newest first. Beyond this the answer is revocation. */
const PAIRED_DEVICE_CAP = 200;

export async function listDevices(): Promise<PairedDevice[]> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from("devices")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      // A person's approved devices, newest first. More than this and the
      // answer is revocation, not a longer list.
      .limit(PAIRED_DEVICE_CAP);
    if (error) throw new Error(error.message);
    return (data as DeviceRow[] | null)?.map(toPaired) ?? [];
  } catch {
    /*
     * An unreachable account lists NOTHING rather than a remembered set. The
     * list is used to decide what may act, and a stale copy is exactly how a
     * revoked phone keeps working — failing closed is the only safe answer.
     */
    return [];
  }
}

/** Devices that may still act. */
export async function activeDevices(): Promise<PairedDevice[]> {
  return (await listDevices()).filter((device) => !device.revoked);
}

/**
 * Register a newly paired device.
 *
 * Refuses to re-pair an id that was revoked: a lost phone must not be able to
 * quietly restore its own trust by pairing again under the same identity. The
 * check reads the account rather than anything this browser remembers, so it
 * holds on a device that has never seen the revocation.
 */
export async function saveDevice(
  device: PairedDevice,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const supabase = await loadSupabaseClient();
    const { data: existing, error: readError } = await supabase
      .from("devices")
      .select("id, revoked_at")
      .eq("id", device.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (existing?.revoked_at) {
      return {
        ok: false,
        reason: "That device was revoked. Remove it from the list before pairing it again.",
      };
    }

    const { data: session } = await supabase.auth.getUser();
    const userId = session.user?.id;
    if (!userId) return { ok: false, reason: "Sign in before pairing a device." };

    const { error } = await supabase.from("devices").upsert(
      {
        id: device.id,
        user_id: userId,
        name: device.label,
        kind: device.kind,
        platform: device.platform,
        last_active_at: device.lastSeenAt.toISOString(),
        created_at: device.pairedAt.toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      reason: `This device could not be paired: ${
        cause instanceof Error ? cause.message : "your account could not be reached"
      }. Nothing was changed.`,
    };
  }
}

/**
 * Revoke a device.
 *
 * A tombstone rather than a delete, so the refusal survives — that is the whole
 * point of revoking a lost phone. Returns null when nothing was revoked, so a
 * screen cannot report a revocation that did not happen.
 */
export async function revokeDevice(
  id: string,
  now: Date = new Date(),
): Promise<PairedDevice | null> {
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from("devices")
      .update({ revoked_at: now.toISOString() })
      .eq("id", id)
      .select(COLUMNS)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toPaired(data as DeviceRow) : null;
  } catch {
    return null;
  }
}

/** Permanently forget a device, allowing it to pair again. Explicit user action. */
export async function forgetDevice(id: string): Promise<void> {
  try {
    const supabase = await loadSupabaseClient();
    await supabase.from("devices").delete().eq("id", id);
  } catch {
    /*
     * Silent because forgetting is the SAFE direction of this pair: a device
     * that stays in the list stays visible and stays revoked. The caller
     * re-reads the list, so a failure shows as the row still being there.
     */
  }
}

/** Refresh the last-seen timestamp used by the trust-staleness check. */
export async function touchDevice(id: string, now: Date = new Date()): Promise<void> {
  try {
    const supabase = await loadSupabaseClient();
    await supabase
      .from("devices")
      .update({ last_active_at: now.toISOString() })
      .eq("id", id)
      // A revoked device must not have its trust refreshed by its own traffic.
      .is("revoked_at", null);
  } catch {
    /* A missed heartbeat expires trust, which is the safe direction. */
  }
}

/**
 * Forget every paired device.
 *
 * Used when somebody clears their data. Revoked tombstones go too: this is a
 * deliberate request to remove the record, not a revocation.
 */
export async function clearDevices(): Promise<void> {
  try {
    const supabase = await loadSupabaseClient();
    const { data: session } = await supabase.auth.getUser();
    const userId = session.user?.id;
    if (!userId) return;
    await supabase.from("devices").delete().eq("user_id", userId);
  } catch {
    /* Reported by the list still showing them, rather than by a silent claim. */
  }
}

/**
 * Where notification preferences live on this device.
 *
 * ON THE DEVICE, AND THE SCREEN SAYS SO. PLAN.md §D also asks for cross-device
 * synchronisation, which needs a store OCADE does not have yet. Writing them
 * locally and CLAIMING they sync would be the worse of the two failures: a
 * person would set quiet hours on a laptop and be woken by a phone that never
 * heard about it.
 *
 * Reads validate, because storage is writable by anything on the origin and a
 * preference is an input like any other — and because the one rule that must
 * not be overridable by a stored value (protected categories are never muted)
 * is enforced in the resolver rather than here.
 */

import { normalisePreferences, type NotificationPreferences } from "./preferences";
import type { NotificationChannelId } from "./channels";

const STORAGE_KEY = "ocade.notifications.preferences.v1";

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): PreferenceStorage | null {
  try {
    if (typeof globalThis.localStorage === "undefined") return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export function readNotificationPreferences(
  availableChannelIds: readonly NotificationChannelId[],
  storage: PreferenceStorage | null = browserStorage(),
): NotificationPreferences {
  if (!storage) return normalisePreferences(null, availableChannelIds);
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return normalisePreferences(raw ? JSON.parse(raw) : null, availableChannelIds);
  } catch {
    return normalisePreferences(null, availableChannelIds);
  }
}

export function writeNotificationPreferences(
  preferences: NotificationPreferences,
  storage: PreferenceStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    /* Blocked, full or private. The choice applies to this session regardless. */
  }
}

/** The key, exported so the local-data deletion authority can classify it. */
export const NOTIFICATION_PREFERENCES_KEY = STORAGE_KEY;

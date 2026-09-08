/**
 * ONE PREFERENCE, TWO PLACES IT LIVES, AND A CLEAR RULE ABOUT WHICH WINS.
 *
 * PLAN.md §D asks for cross-device synchronisation and for save confirmation.
 * Neither is served by simply moving the preference to the server: a settings
 * screen that cannot render until a round trip finishes is worse on a train
 * than the local-only version it replaced, and one that reports "saved" before
 * the server has agreed is lying.
 *
 * SO THE DEVICE COPY STAYS, AS A CACHE RATHER THAN AS AN AUTHORITY. The screen
 * paints from it immediately, the account copy arrives and replaces it, and
 * every change is written to both. The local write happens first and
 * unconditionally, because the person's choice must survive a refresh even if
 * the network never answers.
 *
 * WHOSE COPY WINS. The account's, whenever it can be read — that is what makes
 * it synchronisation rather than two independent settings. The one exception is
 * an account with no row yet: a person who set quiet hours on this laptop
 * before ever signing in should not have them erased by an empty server
 * document, so the local copy is pushed up instead.
 *
 * SAVING IS REPORTED HONESTLY. `saveNotificationPreferences` returns a state a
 * screen can show without inventing anything: `saved` when the server
 * acknowledged and returned a revision, `device_only` when it could not be
 * reached and the choice applies here, and `failed` when the server refused.
 * The three are genuinely different and a person needs to be able to tell them
 * apart — "device only" means the phone has not heard about it.
 */

import { normalisePreferences, type NotificationPreferences } from "./preferences";
import {
  readNotificationPreferences,
  writeNotificationPreferences,
  type PreferenceStorage,
} from "./preference-store";
import type { NotificationChannelId } from "./channels";
import type { Json } from "@/integrations/supabase/types";

/** The database calls this module makes, injected so they can be tested. */
export interface PreferenceBackend {
  read(): Promise<{ row: StoredPreferenceRow | null; error: string | null }>;
  save(
    preferences: NotificationPreferences,
  ): Promise<{ revision: number | null; error: string | null }>;
}

export interface StoredPreferenceRow {
  mute_optional: boolean;
  quiet_hours: Json;
  categories: Json;
  revision: number;
}

export type SaveOutcome =
  | { state: "saved"; revision: number }
  | { state: "device_only"; reason: string }
  | { state: "failed"; reason: string };

export interface LoadedPreferences {
  preferences: NotificationPreferences;
  /** Where the value on screen came from, so the screen can say so. */
  source: "account" | "device";
  /** Present when the account copy could not be read. */
  unavailable?: string;
}

/**
 * Read the preference the product should act on.
 *
 * The local copy is read first and used as the fallback for every failure path,
 * so this never returns nothing: a settings screen always has something to
 * paint, and `decideDelivery` always has something to decide from.
 */
export async function loadNotificationPreferences(input: {
  backend: PreferenceBackend | null;
  availableChannelIds: readonly NotificationChannelId[];
  storage?: PreferenceStorage | null;
}): Promise<LoadedPreferences> {
  const local = readNotificationPreferences(input.availableChannelIds, input.storage);
  if (!input.backend) return { preferences: local, source: "device" };

  const { row, error } = await input.backend.read();
  if (error) return { preferences: local, source: "device", unavailable: error };

  if (!row) {
    /*
     * No account row yet. The local document is the only one that exists, so it
     * is pushed up rather than replaced by a default — otherwise signing in on
     * a device that already had preferences would silently reset them.
     */
    await input.backend.save(local).catch(() => undefined);
    return { preferences: local, source: "device" };
  }

  const merged = normalisePreferences(
    {
      muteOptional: row.mute_optional,
      quietHours: row.quiet_hours,
      categories: row.categories,
    },
    input.availableChannelIds,
  );
  writeNotificationPreferences(merged, input.storage);
  return { preferences: merged, source: "account" };
}

/**
 * Save a preference to the device and to the account.
 *
 * THE LOCAL WRITE IS NOT CONDITIONAL ON THE REMOTE ONE. A person who changes a
 * setting on a train has changed it; refusing to remember that because a
 * request failed would be the product arguing with them about what they just
 * did.
 */
export async function saveNotificationPreferences(input: {
  preferences: NotificationPreferences;
  backend: PreferenceBackend | null;
  storage?: PreferenceStorage | null;
}): Promise<SaveOutcome> {
  writeNotificationPreferences(input.preferences, input.storage);
  if (!input.backend) {
    return {
      state: "device_only",
      reason: "You are not signed in, so this applies to this browser only.",
    };
  }

  const { revision, error } = await input.backend.save(input.preferences);
  if (error) {
    return {
      state: "failed",
      reason: error,
    };
  }
  if (revision === null) {
    return {
      state: "device_only",
      reason: "OCADE could not reach your account. This applies on this device for now.",
    };
  }
  return { state: "saved", revision };
}

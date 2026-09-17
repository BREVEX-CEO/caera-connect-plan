/**
 * ONE PREFERENCE, IN ONE PLACE, AND AN HONEST ANSWER ABOUT WHETHER IT GOT THERE.
 *
 * PLAN.md §D asks for cross-device synchronisation and for save confirmation.
 * This module used to keep a browser copy alongside the account's and treat it
 * as a cache, and the cache is what went wrong: it survived sign-out, so the
 * next person to use the browser was shown the previous person's quiet hours
 * until the account read landed, and a settings screen that shows the wrong
 * answer for half a second is a settings screen somebody can act on.
 *
 * `PLAN.md` Phase 2 leaves the account as the only place preferences are kept.
 * Nothing is written to the browser. Until the account answers, the screen has
 * the defaults, which is the truthful thing to show somebody whose preferences
 * have not been read yet.
 *
 * SAVING IS REPORTED HONESTLY. `saveNotificationPreferences` returns a state a
 * screen can show without inventing anything: `saved` when the server
 * acknowledged and returned a revision, `session_only` when it could not be
 * reached and the choice applies for as long as this tab is open, and `failed`
 * when the server refused. The three are genuinely different and a person needs
 * to be able to tell them apart — "session only" means the phone has not heard
 * about it, and neither will this browser after a reload.
 */

import { normalisePreferences, type NotificationPreferences } from "./preferences";
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
  | { state: "session_only"; reason: string }
  | { state: "failed"; reason: string };

export interface LoadedPreferences {
  preferences: NotificationPreferences;
  /** Where the value on screen came from, so the screen can say so. */
  source: "account" | "defaults";
  /** Present when the account copy could not be read. */
  unavailable?: string;
}

/**
 * Read the preference the product should act on.
 *
 * Defaults are the fallback for every failure path, so this never returns
 * nothing: a settings screen always has something to paint, and
 * `decideDelivery` always has something to decide from. The `source` says which
 * it is, and the screen tells the person — showing defaults as though they were
 * somebody's chosen settings is how a muted category appears to be on.
 */
export async function loadNotificationPreferences(input: {
  backend: PreferenceBackend | null;
  availableChannelIds: readonly NotificationChannelId[];
}): Promise<LoadedPreferences> {
  const fallback = normalisePreferences(null, input.availableChannelIds);
  if (!input.backend) return { preferences: fallback, source: "defaults" };

  const { row, error } = await input.backend.read();
  if (error) return { preferences: fallback, source: "defaults", unavailable: error };

  /*
   * No row yet is not a failure: it is somebody who has never changed a
   * notification setting. The defaults are what the product is actually acting
   * on for them, and writing a row here would record a choice they did not
   * make.
   */
  if (!row) return { preferences: fallback, source: "account" };

  return {
    preferences: normalisePreferences(
      {
        muteOptional: row.mute_optional,
        quietHours: row.quiet_hours,
        categories: row.categories,
      },
      input.availableChannelIds,
    ),
    source: "account",
  };
}

/**
 * Save a preference to the account.
 *
 * THE CHOICE STILL APPLIES WHEN THE SAVE DOES NOT. The caller holds what the
 * person just chose and keeps acting on it, and this says plainly how far it
 * got. Refusing to honour a change because a request failed would be the
 * product arguing with somebody about what they just did; claiming it was saved
 * would be worse.
 */
export async function saveNotificationPreferences(input: {
  preferences: NotificationPreferences;
  backend: PreferenceBackend | null;
}): Promise<SaveOutcome> {
  if (!input.backend) {
    return {
      state: "session_only",
      reason: "You are not signed in, so this applies until you close this tab.",
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
      state: "session_only",
      reason:
        "OCADE could not reach your account. This applies until you close this tab, and your other devices have not been told.",
    };
  }
  return { state: "saved", revision };
}

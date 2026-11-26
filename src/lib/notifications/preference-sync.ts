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

import { normalisePreferences, type NotificationPreferences } from "./preferences.ts";
import type { NotificationChannelId } from "./channels.ts";
import type { Json } from "@/integrations/supabase/types";

/** The database calls this module makes, injected so they can be tested. */
export interface PreferenceBackend {
  read(): Promise<{ row: StoredPreferenceRow | null; error: string | null }>;
  save(
    preferences: NotificationPreferences,
    expectedRevision: number,
  ): Promise<{ revision: number | null; error: string | null; stale?: boolean }>;
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
  | { state: "failed"; reason: string }
  /** Another device saved a newer choice first; nothing was overwritten. */
  | { state: "changed_elsewhere"; reason: string };

export interface LoadedPreferences {
  preferences: NotificationPreferences;
  /** Where the value on screen came from, so the screen can say so. */
  source: "account" | "defaults";
  /** The revision this copy was read at (0 when the account has no row yet). */
  revision: number;
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
  if (!input.backend) return { preferences: fallback, source: "defaults", revision: 0 };

  const { row, error } = await input.backend.read();
  if (error) return { preferences: fallback, source: "defaults", revision: 0, unavailable: error };

  /*
   * No row yet is not a failure: it is somebody who has never changed a
   * notification setting. The defaults are what the product is actually acting
   * on for them, and writing a row here would record a choice they did not
   * make.
   */
  if (!row) return { preferences: fallback, source: "account", revision: 0 };

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
    revision: row.revision,
  };
}

/**
 * Save a preference to the account.
 *
 * Says plainly how far the save got. Delivery reads only the account's saved
 * choices, so a choice that did not save changes nothing that is sent, and the
 * outcome says so rather than claiming it applies here.
 */
export async function saveNotificationPreferences(input: {
  preferences: NotificationPreferences;
  /** The revision the person last saw; a newer account copy is never overwritten. */
  expectedRevision: number;
  backend: PreferenceBackend | null;
}): Promise<SaveOutcome> {
  if (!input.backend) {
    return {
      state: "session_only",
      reason: "You are not signed in, so there is no account to save this to.",
    };
  }

  const { revision, error, stale } = await input.backend.save(
    input.preferences,
    input.expectedRevision,
  );
  if (stale) {
    return {
      state: "changed_elsewhere",
      reason:
        "These settings were changed on another device since you opened this screen. Nothing was overwritten; reload to see the newer choices.",
    };
  }
  if (error) {
    return {
      state: "failed",
      reason: error,
    };
  }
  if (revision === null) {
    return {
      state: "session_only",
      // Delivery reads only the account's saved choices, so an unsaved one
      // changes nothing that is sent (F-218).
      reason:
        "OCADE could not reach your account, so notifications still follow your saved choices on every device, this one included. Try again.",
    };
  }
  return { state: "saved", revision };
}

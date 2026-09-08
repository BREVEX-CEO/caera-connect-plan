/**
 * The preference backend, bound to Supabase.
 *
 * Kept apart from `preference-sync.ts` so the synchronisation RULES — which
 * copy wins, what happens when there is no row, what a failed save is called —
 * are testable without a database, and so this file has nothing in it but the
 * two calls.
 *
 * A NETWORK FAILURE IS NOT A REFUSAL, and the two are reported differently
 * because the person is told different things. A read that could not reach the
 * server leaves the device copy in charge; a save the server REFUSED is a
 * failure the screen must show rather than swallow.
 */

import { loadSupabaseClient } from "@/integrations/supabase/on-demand";
import type { NotificationPreferences } from "./preferences";
import type { PreferenceBackend, StoredPreferenceRow } from "./preference-sync";
import type { Json } from "@/integrations/supabase/types";

/**
 * The backend for the signed-in account, or `null` when nobody is signed in.
 *
 * Returning null rather than a backend that always fails keeps the caller's
 * branch honest: "not signed in" is a state the screen says out loud, not an
 * error it reports.
 */
export function supabasePreferenceBackend(userId: string | null): PreferenceBackend | null {
  if (!userId) return null;

  return {
    async read() {
      try {
        const supabase = await loadSupabaseClient();
        const { data, error } = await supabase
          .from("ocade_notification_preferences")
          .select("mute_optional, quiet_hours, categories, revision")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) return { row: null, error: error.message };
        return { row: (data as StoredPreferenceRow | null) ?? null, error: null };
      } catch (cause) {
        return { row: null, error: describe(cause) };
      }
    },

    async save(preferences: NotificationPreferences) {
      try {
        const supabase = await loadSupabaseClient();
        /*
         * Through the RPC rather than an upsert from the browser. The function
         * writes `auth.uid()` and takes no account id at all, so there is no
         * argument to aim at somebody else's row — and it bumps the revision in
         * the same statement, which a client-side read-modify-write could not
         * do safely from two devices at once.
         */
        const { data, error } = await supabase.rpc("ocade_save_notification_preferences", {
          p_mute_optional: preferences.muteOptional,
          p_quiet_hours: preferences.quietHours as unknown as Json,
          p_categories: preferences.categories as unknown as Json,
        });
        if (error) return { revision: null, error: error.message };
        return { revision: typeof data === "number" ? data : null, error: null };
      } catch {
        /*
         * UNREACHABLE, RATHER THAN REFUSED, and the difference is what the
         * person is told. A thrown request never got an answer, so there is no
         * refusal to report: the caller turns this into "this applies on this
         * device for now", which is exactly what happened. A server that
         * ANSWERS with an error takes the branch above and is shown as a
         * failure.
         */
        return { revision: null, error: null };
      }
    },
  };
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

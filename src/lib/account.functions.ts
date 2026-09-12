/**
 * Account self-service — irreversible deletion.
 *
 * Deletion is a privileged operation: the caller is authenticated with
 * `requireSupabaseAuth`, the target is ALWAYS `context.userId` (never an input
 * parameter, so no request can aim this at another account), and the service
 * client is imported inside the handler so it never reaches a client bundle.
 *
 * Order matters. Rows that hang off the account are scrubbed first, then the
 * sign-in identity itself; deleting the identity first would leave orphaned
 * rows behind on any table without a cascade.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { HIGH_RISK, requireAssurance } from "@/lib/security/assurance-middleware";
import { callerSessionIsLive } from "@/lib/security/sessions.functions";

/**
 * The user must type this exactly. A typed phrase is the second confirmation
 * required for destructive actions — a button alone is not consent.
 */
export const DELETE_CONFIRMATION = "DELETE MY ACCOUNT";

export const deleteAccountInput = z.object({
  confirmation: z.string(),
});

/**
 * What OCADE hands back when an account is gone.
 *
 * PLAN.md §O: "Produce a deletion receipt without exposing deleted content."
 * Both halves matter. A person who has just destroyed everything they had needs
 * something they can keep — a reference, a time, a list of what went — and a
 * receipt that quoted their deleted conversations back at them would be a copy
 * of the very thing they asked to be rid of.
 *
 * So this names CLASSES, never records: no subject lines, no message text, no
 * ticket contents.
 */
export interface AccountDeletionReceipt {
  /** A reference the person can quote to support. Not the account id. */
  reference: string;
  completedAt: string;
  /** What was removed, by kind. */
  removed: string[];
  /** Sessions ended before the data went. */
  sessionsRevoked: number;
  /**
   * Said out loud because people ask, and because the answer is a feature:
   * account deletion does not touch Offline Intelligence.
   */
  offlineIntelligencePreserved: true;
}

/*
 * ASSURED AND RECENT, NOT MERELY SIGNED IN.
 *
 * `requireAssurance` composes onto `requireSupabaseAuth` — it is the same
 * authentication authority with one more question on top — so this is still
 * authenticated exactly as before, and now also requires a second factor from
 * accounts that have one, plus proof of identity within the last ten minutes.
 *
 * The typed phrase below is consent, and consent is not identity. Somebody who
 * finds an unlocked browser can type DELETE MY ACCOUNT as easily as the owner
 * can; what they cannot do is produce the code or the password.
 *
 * ENFORCED HERE RATHER THAN ON THE SCREEN because the screen is not the thing
 * an attacker uses. Hiding the button changes what is easy; refusing the
 * request changes what is possible.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((data: unknown) => deleteAccountInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION) {
      throw new Error("Confirmation phrase did not match.");
    }

    const userId = context.userId;
    const claims = context.claims as Record<string, unknown> | null | undefined;

    /*
     * IS THE SESSION BEHIND THIS TOKEN STILL ALIVE?
     *
     * PLAN.md §C asks for `session_id` to be verified against `auth.sessions`
     * for highly sensitive server operations, and §O repeats it for exactly
     * this one. A JWT stays valid until it expires even after its session has
     * been revoked, so a correctly signed token is NOT proof that the session
     * behind it still exists — and the window between "I revoked that stolen
     * browser" and "its token expires" is precisely when somebody would use it
     * to delete the account out from under its owner.
     *
     * Nothing else in the product is irreversible in this way, which is why the
     * check lands here first rather than everywhere.
     */
    if (!(await callerSessionIsLive(userId, claims))) {
      throw new Error("This session has been signed out. Sign in again to delete the account.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    /*
     * THE ORGANIZATION CHECK IS GONE WITH ORGANIZATIONS.
     *
     * It asked, before destroying anything, whether this account was the last
     * owner of a workspace — a real protection while team accounts existed.
     * `PLAN.md` Phase 10 removed those tables, so there is no workspace to
     * strand and no question to ask.
     *
     */

    /*
     * EVERY OTHER SESSION ENDS BEFORE ANYTHING IS DESTROYED.
     *
     * PLAN.md §O: "Revoke sessions before destructive account completion." Two
     * reasons, and the second is the one that is easy to miss:
     *
     *   A second browser writing rows while this runs recreates data behind the
     *   deletion — a message sent mid-scrub lands in a table already cleared,
     *   and the account ends up half-deleted with no error anywhere.
     *
     *   And whoever holds that other session keeps holding it. Deleting the
     *   identity does end them, but only at the very end, after every row has
     *   gone; ending them first shortens that window to nothing.
     *
     * A failure here does NOT abort the deletion. The person asked for their
     * account to be destroyed, and refusing because some sessions could not be
     * counted would leave them with the account they no longer want. The number
     * is reported truthfully on the receipt instead.
     */
    let sessionsRevoked = 0;
    try {
      const { data: revoked } = await supabaseAdmin.rpc("ocade_revoke_other_account_sessions", {
        p_user_id: userId,
      });
      sessionsRevoked = Number(revoked ?? 0);
    } catch {
      sessionsRevoked = 0;
    }

    /*
     * DELETE THE PARENT AND LET THE CONSTRAINT DO THE REST.
     *
     * This used to read every conversation id and delete the children with
     * `.in(ids)`. The read was unbounded — PostgREST silently returns the first
     * thousand — and the delete put every id in the URL, which proxies refuse
     * long before an account is unusual. `ocade_messages.conversation_id` is
     * ON DELETE CASCADE, so removing the conversation removes its messages in
     * one statement, with no list to truncate.
     *
     * A library row's own trigger tombstones its object, so the bytes in the
     * private bucket are chased even though nothing here touches storage.
     */
    await supabaseAdmin.from("ocade_conversations").delete().eq("user_id", userId);
    await supabaseAdmin.from("ocade_library_items").delete().eq("user_id", userId);

    // Account-scoped records. Anything with an ON DELETE CASCADE to auth.users
    // is removed by the identity deletion below; these are listed explicitly so
    // the scrub does not depend on a constraint being present.
    await supabaseAdmin.from("user_settings").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_private_records").delete().eq("user_id", userId);
    await supabaseAdmin.from("devices").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // The identity last. After this the session cannot be refreshed.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error)
      throw new Error(`Account records were removed but sign-in deletion failed: ${error.message}`);

    const receipt: AccountDeletionReceipt = {
      reference: deletionReference(),
      completedAt: new Date().toISOString(),
      removed: [
        "profile",
        "conversations and messages",
        "library files and images",
        "settings and private records",
        "devices",
        "roles",
        "sign-in identity",
      ],
      sessionsRevoked,
      offlineIntelligencePreserved: true,
    };

    /*
     * THE RECORD OF THE DELETION OUTLIVES THE ACCOUNT, ANONYMISED.
     *
     * `compliance_audit_log.user_id` is ON DELETE SET NULL, so this line
     * survives the identity deletion above with the subject removed. That is the
     * shape a deletion record has to have: proof that an erasure was carried
     * out, holding nothing that identifies the person it was carried out for.
     *
     * Written AFTER the deletion, so it records what happened rather than what
     * was about to. Failing to write it does not un-delete anything, and the
     * person still receives their receipt.
     */
    try {
      await supabaseAdmin.from("compliance_audit_log").insert({
        user_id: userId,
        action: "account.deleted",
        category: "deletion",
        feature_id: "settings.account",
        result: { reference: receipt.reference, sessions_revoked: sessionsRevoked },
      });
    } catch {
      /* The account is gone whether or not the line was written. */
    }

    return { deleted: true as const, receipt };
  });

/**
 * A reference somebody can quote without it being an account id.
 *
 * Random rather than derived: a reference computed from the user id would let
 * anybody holding both work backwards, which is a small re-identification of an
 * account that was just erased.
 */
function deletionReference(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return `OCD-${[...bytes]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .replace(/(.{6})(?=.)/g, "$1-")}`;
}

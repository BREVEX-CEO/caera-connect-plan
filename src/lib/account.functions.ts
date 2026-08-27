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
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * The user must type this exactly. A typed phrase is the second confirmation
 * required for destructive actions — a button alone is not consent.
 */
export const DELETE_CONFIRMATION = "DELETE MY ACCOUNT";

export const deleteAccountInput = z.object({
  confirmation: z.string(),
});

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: unknown) => deleteAccountInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION) {
      throw new Error("Confirmation phrase did not match.");
    }

    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    /*
     * DELETE THE PARENT AND LET THE CONSTRAINT DO THE REST.
     *
     * This used to read every ticket id and every conversation id, then delete
     * the children with `.in(ids)`. Both halves of that were unsafe at size and
     * neither was necessary:
     *
     *   - The read was unbounded, and PostgREST silently returns only the first
     *     `db-max-rows` (1,000 by default). An account past that had the rest of
     *     its ids simply not appear, so those children were never named.
     *   - The delete put every id into the request URL. A few thousand UUIDs is
     *     tens of kilobytes of query string, which proxies and PostgREST refuse
     *     long before the account is unusual.
     *
     * And it was redundant: `ocade_messages.conversation_id` and
     * `ocade_support_messages.ticket_id` are both declared ON DELETE CASCADE,
     * so removing the parent removes them, completely, in one statement, with
     * no list to truncate.
     *
     * Support messages get one extra pass. `ocade_support_messages.author_id`
     * references `auth.users` ON DELETE RESTRICT, so a message this person
     * wrote on a ticket they do not own would block the identity deletion at
     * the very last step, after everything else was already gone.
     */
    await supabaseAdmin.from("ocade_support_tickets").delete().eq("user_id", userId);
    await supabaseAdmin.from("ocade_support_messages").delete().eq("author_id", userId);
    await supabaseAdmin.from("ocade_conversations").delete().eq("user_id", userId);

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

    return { deleted: true as const };
  });

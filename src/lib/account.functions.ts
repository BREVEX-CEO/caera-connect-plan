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
  .inputValidator((data: unknown) => deleteAccountInput.parse(data))
  .handler(async ({ data, context }) => {
    if (data.confirmation.trim().toUpperCase() !== DELETE_CONFIRMATION) {
      throw new Error("Confirmation phrase did not match.");
    }

    const userId = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Support conversation first: messages reference their ticket.
    const { data: tickets } = await supabaseAdmin
      .from("ocade_support_tickets")
      .select("id")
      .eq("user_id", userId);
    const ticketIds = (tickets ?? []).map((t) => t.id);
    if (ticketIds.length > 0) {
      await supabaseAdmin.from("ocade_support_messages").delete().in("ticket_id", ticketIds);
    }
    await supabaseAdmin.from("ocade_support_tickets").delete().eq("user_id", userId);

    // Chat history: messages reference their conversation.
    const { data: conversations } = await supabaseAdmin
      .from("ocade_conversations")
      .select("id")
      .eq("user_id", userId);
    const conversationIds = (conversations ?? []).map((c) => c.id);
    if (conversationIds.length > 0) {
      await supabaseAdmin.from("ocade_messages").delete().in("conversation_id", conversationIds);
    }
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
    if (error) throw new Error(`Account records were removed but sign-in deletion failed: ${error.message}`);

    return { deleted: true as const };
  });

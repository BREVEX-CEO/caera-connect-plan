/**
 * ACCESS AND ERASURE, AUTHENTICATED — PLAN.md §O.
 *
 * These two functions are deliberately thin. Everything that can be wrong about
 * an export or a per-class deletion lives in `lib/account/data-rights.ts`,
 * which takes the database as a parameter and is therefore testable at sizes a
 * real database in a test never reaches. What is here is the part that cannot
 * be tested away: who is asking, and what they are allowed to ask for.
 *
 * THE TARGET IS ALWAYS `context.userId`, NEVER AN INPUT. There is no account
 * parameter on either function, so no request can aim them at somebody else —
 * the same rule account deletion follows, and for the same reason: a validated
 * parameter can be forgotten, a bound one cannot.
 *
 * BOTH REQUIRE ASSURANCE. An export is every message, device and invoice on the
 * account in one download; a per-class deletion is irreversible. Someone who
 * finds an unlocked browser must not be able to do either without producing a
 * second factor and a recent proof of identity. §B lists exactly this class of
 * action, and hiding a button only changes what is easy.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { HIGH_RISK, requireAssurance } from "@/lib/security/assurance-middleware";
import {
  buildAccountExport,
  clearAccountDataClass,
  type AccountDataExport,
  type DataClassDeletionReceipt,
  type DynamicTableClient,
} from "@/lib/account/data-rights";

export type {
  AccountDataExport,
  AccountExportClass,
  AccountExportTable,
  DataClassDeletionReceipt,
} from "@/lib/account/data-rights";
export { ACCOUNT_EXPORT_SCHEMA_VERSION } from "@/lib/account/data-rights";

/** The service client, in the shape the data-rights core asks for. */
async function adminClient(): Promise<DynamicTableClient> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as DynamicTableClient;
}

export const exportMyAccountData = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .handler(async ({ context }): Promise<AccountDataExport> =>
    buildAccountExport(await adminClient(), context.userId),
  );

export const deleteDataClassInput = z.object({
  dataClass: z.string(),
  confirmation: z.string(),
});

export const deleteMyAccountDataClass = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((data: unknown) => deleteDataClassInput.parse(data))
  .handler(async ({ data, context }): Promise<DataClassDeletionReceipt> => {
    const admin = await adminClient();
    const receipt = await clearAccountDataClass(admin, context.userId, data);

    /*
     * The erasure is recorded, with the CLASS and never its contents — the same
     * rule the account-deletion receipt follows. `compliance_audit_log.user_id`
     * is ON DELETE SET NULL, so this line survives a later account deletion
     * with the subject removed.
     *
     * Written AFTER the rows are gone, so it records what happened rather than
     * what was about to. Failing to write it does not un-delete anything, and
     * the person still receives their receipt.
     */
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("compliance_audit_log").insert({
        user_id: context.userId,
        action: "account.data_class_deleted",
        category: "deletion",
        feature_id: "settings.privacy",
        result: { data_class: receipt.dataClass, tables: receipt.cleared },
      });
    } catch {
      /* The rows are gone whether or not the line was written. */
    }

    return receipt;
  });

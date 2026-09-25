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
import { HIGH_RISK, requireAssurance } from "@/lib/security/assurance-middleware";
import {
  buildAccountExport,
  type AccountDataExport,
  type DynamicTableClient,
} from "@/lib/account/data-rights";

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

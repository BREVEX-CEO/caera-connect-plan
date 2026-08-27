import { supabase } from "@/integrations/supabase/client";
import { readNextEligibleAt } from "./session";

/**
 * Carry the demo forward from the browser to the account.
 *
 * The 28-minute session and its reset window live in this browser's storage,
 * which is the only place an anonymous visitor exists at all. That is honest
 * and it is erasable: clearing site data starts a new one. It is deliberately
 * NOT defended with fingerprinting — identifying an anonymous person across
 * profiles is precisely what this product refuses to do, and it does not work
 * reliably enough to be worth the cost of trying.
 *
 * What can be recorded truthfully is the moment somebody stops being
 * anonymous. If an account is created from a browser that has used a demo,
 * the account carries that from then on, on every device they sign in from.
 * It is a fact about the account, not a claim about the person.
 *
 * WRITTEN ONCE. A later sign-in from the same browser must not move the
 * timestamp forward, or "when did this account use its demo" becomes "when did
 * it last sign in from a browser that had". The guard is `is null`, so the
 * first write wins and every later one matches no rows.
 */
export async function recordDemoConsumed(userId: string): Promise<"recorded" | "none" | "failed"> {
  const consumed = readNextEligibleAt();
  if (consumed === null) return "none";

  try {
    const { error } = await supabase
      .from("profiles")
      .update({ demo_consumed_at: new Date().toISOString() })
      .eq("id", userId)
      .is("demo_consumed_at", null);
    return error ? "failed" : "recorded";
  } catch {
    /*
     * Offline, or the column is not deployed yet. Never fatal: failing to note
     * a demo must not stop somebody finishing their signup, and the browser's
     * own record still holds for this browser.
     */
    return "failed";
  }
}

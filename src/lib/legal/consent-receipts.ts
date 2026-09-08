/**
 * WHICH DOCUMENTS AN ACCOUNT ACCEPTED, AND WHEN — KEPT WHERE IT CAN BE PROVEN.
 *
 * Acceptance was recorded only in `localStorage`, which is the right place for
 * it before there is an account and the wrong place afterwards, in both
 * directions at once:
 *
 *   The PERSON is asked again on every device, and again after clearing site
 *   data, having already agreed. A gate that reappears is a gate people learn
 *   to click through, which is the opposite of informed consent.
 *
 *   And OCADE cannot answer "which version did this account accept, and when?"
 *   The evidence sits on the person's own machine, where they can erase it and
 *   where nobody else can read it.
 *
 * So the local receipt stays — it is what a demo visitor and a pre-auth
 * session have — and once an account exists the acceptance is also written to
 * the server, under RLS, append-only.
 *
 * NOTHING HERE BLOCKS. Every function degrades to the local receipt on
 * failure: a database that is unreachable must not stop somebody agreeing to
 * the terms and getting on with their work, and a re-ask on the next device is
 * a far smaller harm than a gate that cannot be passed.
 */
/*
 * ON DEMAND, because this module is reached from the root through
 * `LegalConsentGate` and a static import would put the whole Supabase client
 * in the entry bundle — see `integrations/supabase/on-demand.ts`. Both
 * functions below are already async and neither runs without an account id.
 */
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

/**
 * The versions currently in force.
 *
 * SEPARATE, because the documents change separately. One combined string
 * cannot answer "did they accept THIS privacy notice?" after a terms-only
 * revision, and answering that question is the whole reason to keep a receipt.
 */
export const TERMS_VERSION = "ocade-prelaunch-2026-08-16";
export const PRIVACY_VERSION = "ocade-prelaunch-2026-08-16";

/**
 * The single string the LOCAL receipt is keyed on.
 *
 * Derived from the two document versions rather than typed a second time, so
 * a revision to either one invalidates the local receipt and the server
 * receipt together. Two hand-maintained version strings would eventually
 * disagree, and the disagreement would show up as a person being re-asked on
 * one device and not another.
 */
export const LEGAL_CONSENT_VERSION = `${TERMS_VERSION}|${PRIVACY_VERSION}`;

/**
 * Where the LOCAL receipt lives.
 *
 * One key, declared beside the version it is validated against, so the writer
 * and the reader cannot drift apart.
 */
export const LEGAL_CONSENT_STORAGE_KEY = "caera:legal-consent:v1";

export interface ConsentReceipt {
  version: string;
  acceptedAt: string;
  terms: true;
  privacy: true;
}

export function needsLegalConsent(pathname: string): boolean {
  return ["/auth", "/home", "/ocade", "/settings", "/ficia", "/madee", "/cania"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function usesAccountConsentReceipt(pathname: string): boolean {
  return needsLegalConsent(pathname) && !pathname.startsWith("/auth");
}

export function readLegalConsent(storage?: Pick<Storage, "getItem">): ConsentReceipt | null {
  if (typeof window === "undefined" && !storage) return null;
  try {
    const raw = (storage ?? window.localStorage).getItem(LEGAL_CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentReceipt>;
    if (
      parsed.version !== LEGAL_CONSENT_VERSION ||
      parsed.terms !== true ||
      parsed.privacy !== true ||
      typeof parsed.acceptedAt !== "string"
    ) {
      return null;
    }
    return parsed as ConsentReceipt;
  } catch {
    return null;
  }
}

export interface ConsentReceiptRow {
  termsVersion: string;
  privacyVersion: string;
  acceptedAt: string;
}

/**
 * Whether a stored acceptance still covers the documents in force.
 *
 * Pure, so the re-ask rule can be tested without a database. A version bump on
 * EITHER document means the acceptance no longer covers what is currently
 * published — and re-asking once for a legally meaningful change is the
 * behaviour; re-asking on every load is not.
 */
export function coversCurrentDocuments(
  receipt: { termsVersion: string; privacyVersion: string } | null,
  current: { terms: string; privacy: string } = {
    terms: TERMS_VERSION,
    privacy: PRIVACY_VERSION,
  },
): boolean {
  if (!receipt) return false;
  return receipt.termsVersion === current.terms && receipt.privacyVersion === current.privacy;
}

/**
 * The most recent acceptance recorded for this account, or null.
 *
 * "Most recent" rather than "any": the table is append-only, so an account
 * that has accepted three versions has three rows, and only the newest says
 * whether they are current.
 */
export async function latestServerReceipt(userId: string): Promise<ConsentReceiptRow | null> {
  if (!userId) return null;
  try {
    const supabase = await loadSupabaseClient();
    const { data, error } = await supabase
      .from("legal_consent_receipts")
      .select("terms_version, privacy_version, accepted_at")
      .eq("user_id", userId)
      .order("accepted_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      termsVersion: data.terms_version,
      privacyVersion: data.privacy_version,
      acceptedAt: data.accepted_at,
    };
  } catch {
    /*
     * Unreachable is not "did not accept". Returning null makes the gate fall
     * back to the local receipt, which is the honest degradation: OCADE cannot
     * currently see the server record, so it trusts what this device knows.
     */
    return null;
  }
}

/**
 * Record an acceptance for this account.
 *
 * An INSERT, never an upsert. What somebody agreed to in March is not amended
 * by what they agree to in June, and there is no UPDATE policy on the table to
 * allow it even if this file asked.
 */
export async function recordServerConsent(
  userId: string,
  source: "gate" | "reacceptance" = "gate",
): Promise<{ ok: boolean; reason?: string }> {
  if (!userId) return { ok: false, reason: "No account is signed in." };
  try {
    const supabase = await loadSupabaseClient();
    const { error } = await supabase.from("legal_consent_receipts").insert({
      user_id: userId,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
      source,
    });
    return error ? { ok: false, reason: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

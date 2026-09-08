/**
 * SIGN-IN METHODS: CHANGING THE EMAIL, LINKING AND UNLINKING PROVIDERS.
 *
 * All three change what can be used to become this account, which is why
 * PLAN.md §C groups them with the destructive actions: adding a provider adds a
 * way in, removing one can take away the only way in, and changing the email
 * moves where a password reset is sent.
 *
 * THROUGH SUPABASE AUTH, WHICH REMAINS THE ONE LOGIN AUTHORITY. This module
 * adds no second store of identities and no parallel notion of who you are; it
 * wraps the calls, names the failures in language a person can act on, and
 * enforces the one rule Supabase cannot know about — see `canUnlink` below.
 *
 * VERIFY BEFORE REPLACE, for email. `updateUser({ email })` does NOT change the
 * login: it sends a confirmation, and the address only becomes authoritative
 * once the link in it is followed. That ordering is the requirement, and the
 * copy here says so rather than reporting a change that has not happened —
 * telling somebody their email is changed when it is pending is how they lock
 * themselves out by deleting the old mailbox.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadSupabaseClient } from "@/integrations/supabase/on-demand";

export interface LinkedIdentity {
  id: string;
  provider: string;
  /** The address or handle this provider knows them by, when it says. */
  label: string | null;
  linkedAt: string | null;
}

type Client = SupabaseClient<never, never, never>;

async function client(override?: unknown): Promise<Client> {
  if (override) return override as Client;
  return (await loadSupabaseClient()) as unknown as Client;
}

/** Say what went wrong in words that suggest what to do next. */
export function describeIdentityError(error: { message?: string } | null): string {
  const raw = error?.message ?? "";
  if (/already.*(registered|exists|linked)/i.test(raw)) {
    return "That is already linked to an account. Sign out and sign in with it instead, or use a different one.";
  }
  if (/rate.?limit|too many|for security purposes/i.test(raw)) {
    return "Too many attempts just now. Wait a minute and try again.";
  }
  if (/invalid.*email|valid email/i.test(raw)) {
    return "That does not look like an email address.";
  }
  if (/manual linking.*disabled|not enabled/i.test(raw)) {
    return "Linking another sign-in method is not enabled on this deployment.";
  }
  if (/reauthentication|aal2|assurance/i.test(raw)) {
    return "Confirm it is you before changing how you sign in.";
  }
  return raw || "That did not work. Try again in a moment.";
}

/** Every sign-in method attached to this account. */
export async function listIdentities(override?: unknown): Promise<LinkedIdentity[]> {
  const { data, error } = await (await client(override)).auth.getUserIdentities();
  if (error) throw new Error(describeIdentityError(error));
  return (data?.identities ?? []).map((identity) => ({
    id: identity.identity_id ?? identity.id,
    provider: identity.provider,
    label:
      (identity.identity_data?.["email"] as string | undefined) ??
      (identity.identity_data?.["name"] as string | undefined) ??
      null,
    linkedAt: identity.created_at ?? null,
  }));
}

/**
 * MAY THIS ONE BE REMOVED?
 *
 * THE RULE SUPABASE CANNOT ENFORCE FOR US. Unlinking the last identity leaves
 * an account with no way to sign in — the rows are still there, the data is
 * still there, and nobody can ever reach it again. Supabase refuses to unlink
 * the final identity, but it does not know about OCADE's password credential,
 * so the honest question is whether ANY way in survives.
 *
 * Returned as a reason rather than a boolean so the interface can say why the
 * control is unavailable instead of showing a button that always fails.
 */
export function canUnlink(
  identities: LinkedIdentity[],
  target: LinkedIdentity,
  hasPassword: boolean,
): { allowed: true } | { allowed: false; reason: string } {
  const remaining = identities.filter((identity) => identity.id !== target.id);
  if (remaining.length > 0 || hasPassword) return { allowed: true };
  return {
    allowed: false,
    reason:
      "This is the only way into this account. Set a password or link another sign-in method first, or you will not be able to get back in.",
  };
}

/**
 * Begin changing the account's email address.
 *
 * Returns the pending address. NOTHING HAS CHANGED YET when this resolves:
 * Supabase has sent a confirmation, and the login stays what it was until the
 * link is followed. The caller must say so.
 */
export async function requestEmailChange(
  nextEmail: string,
  override?: unknown,
): Promise<{ pending: string }> {
  const email = nextEmail.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new Error("That does not look like an email address.");
  }
  const { error } = await (await client(override)).auth.updateUser({ email });
  if (error) throw new Error(describeIdentityError(error));
  return { pending: email };
}

/** Start linking another sign-in provider. Redirects away and comes back. */
export async function linkProvider(
  provider: "google" | "apple",
  redirectTo: string,
  override?: unknown,
): Promise<void> {
  const { error } = await (
    await client(override)
  ).auth.linkIdentity({
    provider,
    options: { redirectTo },
  });
  if (error) throw new Error(describeIdentityError(error));
}

/** Remove a sign-in provider. The caller checks `canUnlink` first. */
export async function unlinkProvider(identityId: string, override?: unknown): Promise<void> {
  const supabaseClient = await client(override);
  const { data, error: readError } = await supabaseClient.auth.getUserIdentities();
  if (readError) throw new Error(describeIdentityError(readError));

  const identity = (data?.identities ?? []).find(
    (entry) => (entry.identity_id ?? entry.id) === identityId,
  );
  /*
   * Resolved from the SERVER'S list rather than reconstructed from what the
   * screen was holding. A stale page could otherwise send an identity id that
   * no longer means what it did, and unlinking is not an action to take against
   * a guess.
   */
  if (!identity) throw new Error("That sign-in method is no longer on this account.");

  const { error } = await supabaseClient.auth.unlinkIdentity(identity);
  if (error) throw new Error(describeIdentityError(error));
}

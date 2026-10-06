/**
 * WHAT PROVES SOMEBODY IS ALLOWED TO SET A NEW PASSWORD.
 *
 * THE DEFECT THIS EXISTS TO CLOSE. `/reset-password` decided it was reachable
 * by asking `getSession()` whether anyone was signed in, and by accepting a
 * bare `SIGNED_IN` auth event:
 *
 *     if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") …
 *     setLinkValid(Boolean(data.session));
 *
 * Neither is evidence of a reset link. An ordinary signed-in session satisfies
 * both. So anyone sitting at a browser where the owner is still signed in —
 * a shared desk, a library machine, a phone left on a table — could open
 * `/reset-password` and set a new password without knowing the old one, and
 * the account's real owner would be locked out of their own workspace. That is
 * an account takeover reachable by typing a URL.
 *
 * A PASSWORD IS THE THING THAT PROVES YOU ARE YOU, so replacing it requires
 * proving you are you by some OTHER means. There are exactly two:
 *
 *   1. you followed a recovery link, which carries a one-time recovery token
 *      that Supabase issued to the address on the account; or
 *   2. you are signed in and can still enter the CURRENT password, which is
 *      the change-password flow in Settings › Security, not this page.
 *
 * This module answers the first question only, from the URL that was
 * navigated to. It is deliberately pure: no Supabase client, no session, no
 * clock — a URL in, a verdict out — so the rule can be tested exhaustively
 * against the shapes real recovery links actually take.
 */

export type RecoveryEvidence =
  /** The link carried a recovery token in the fragment. */
  | { kind: "recovery_token" }
  /** A PKCE-style recovery link: a `code` to exchange for a recovery session. */
  | { kind: "recovery_code"; code: string }
  /** The provider told us why the link will not work. */
  | { kind: "error"; message: string }
  /** Nothing here says this person followed a reset link. */
  | { kind: "none" };

function paramsOf(raw: string): URLSearchParams {
  return new URLSearchParams(raw.startsWith("#") || raw.startsWith("?") ? raw.slice(1) : raw);
}

/**
 * Read what a navigation says about a password reset, and nothing else.
 *
 * An unparseable URL is `none`, never an assumption in the user's favour: this
 * gate fails closed, because the cost of a wrong "yes" is somebody else's
 * account and the cost of a wrong "no" is requesting another email.
 */
export function readRecoveryEvidence(href: string): RecoveryEvidence {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: "none" };
  }

  const hash = paramsOf(url.hash);
  const query = url.searchParams;

  /*
   * The provider's own explanation comes first. An expired link arrives as an
   * error in the fragment, and reporting that is more useful than reporting
   * the absence of a token it also does not have.
   */
  const described = hash.get("error_description") ?? query.get("error_description");
  if (described) return { kind: "error", message: described };
  const code = hash.get("error") ?? query.get("error");
  if (code) return { kind: "error", message: code };

  // The implicit flow: `#access_token=…&type=recovery`.
  if (hash.get("type") === "recovery" && hash.get("access_token")) {
    return { kind: "recovery_token" };
  }

  /*
   * The PKCE flow: `?code=…`. Supabase does not label it `recovery`, so this
   * is only accepted when the deployment sent the user here — which it does by
   * setting `redirectTo` on `resetPasswordForEmail` to this page and nowhere
   * else. The code still has to survive the exchange before the form appears;
   * this says "worth attempting", not "allowed".
   */
  const pkce = query.get("code");
  if (pkce) return { kind: "recovery_code", code: pkce };

  return { kind: "none" };
}

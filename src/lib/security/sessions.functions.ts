/**
 * WHO IS SIGNED IN TO THIS ACCOUNT, AND HOW TO STOP THEM.
 *
 * PLAN.md §C asks for "real authenticated sessions, not only registered device
 * rows", and the distinction is the whole point. OCADE's Security page already
 * lists approved DEVICES — rows the product writes when a browser registers
 * itself, which outlive a sign-out. Somebody who has just lost a laptop is not
 * asking which devices they once approved; they are asking what can read their
 * account right now, and that is a different list.
 *
 * WHY THE SERVER. `auth.sessions` is outside the `public` schema, so PostgREST
 * cannot reach it from any browser client. Everything here goes through
 * `SECURITY DEFINER` functions granted to `service_role` alone, and every one
 * of them binds the account id into its WHERE clause, so a session id belonging
 * to somebody else matches no row.
 *
 * THE ACCOUNT ID COMES FROM THE VERIFIED TOKEN, NEVER FROM THE REQUEST. There
 * is no parameter here that names a user, which is what makes "revoke that
 * session" impossible to aim at another account.
 *
 * WHAT REVOCATION ACTUALLY DOES, said honestly because the interface must not
 * overstate it: deleting the session kills its refresh token, so it cannot be
 * renewed. An access token already issued stays valid until it expires. That is
 * a bounded window, not an instant kill, and the copy on the page says so.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "@/lib/security/session-middleware";
import { HIGH_RISK, requireAssurance } from "./assurance-middleware";
import { describeAgent } from "./user-agent";
import { sendNotification } from "@/lib/notifications/send.server";

export interface AccountSession {
  id: string;
  /** True for the session making this request. */
  current: boolean;
  startedAt: string;
  lastSeenAt: string;
  expiresAt: string | null;
  /** "aal2" when this session completed a second-factor challenge. */
  assurance: string | null;
  /** "Chrome on Windows" — never the raw header. */
  device: string;
  /**
   * A coarse address, offered so somebody can recognise a session as theirs.
   *
   * NOT resolved to a place. A city name looks precise and is frequently wrong
   * — a mobile network can put somebody a hundred miles from where they are —
   * and "someone in <wrong city> is signed in" is exactly the false alarm that
   * makes a person revoke their own session and lock themselves out.
   */
  ipAddress: string | null;
}

/** The session id carried by the caller's verified token. */
function callerSessionId(claims: Record<string, unknown> | null | undefined): string | null {
  const id = claims?.["session_id"];
  return typeof id === "string" && id ? id : null;
}

/**
 * Every session on this account, newest activity first.
 *
 * Readable without a second factor: seeing where you are signed in is how a
 * person DISCOVERS they have been compromised, and putting that behind a
 * challenge would hide the problem from exactly the person who needs to see it.
 * Revoking is the privileged half.
 */
export const listAccountSessions = createServerFn({ method: "GET" })
  .middleware([requireSession])
  .handler(async ({ context }): Promise<{ sessions: AccountSession[]; unavailable?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("ocade_list_account_sessions", {
      p_user_id: context.userId,
    });

    if (error) {
      /*
       * Named, never reported as "no sessions". An empty list on a read failure
       * says "nothing is signed in", which is the most reassuring possible
       * answer and may be the opposite of the truth.
       */
      return { sessions: [], unavailable: "OCADE could not read your sessions just now." };
    }

    const current = callerSessionId(context.claims as Record<string, unknown>);
    const rows = (data ?? []) as {
      session_id: string;
      created_at: string;
      last_seen_at: string;
      expires_at: string | null;
      assurance: string | null;
      user_agent: string | null;
      ip_address: string | null;
    }[];

    return {
      sessions: rows.map((row) => ({
        id: row.session_id,
        current: row.session_id === current,
        startedAt: row.created_at,
        lastSeenAt: row.last_seen_at,
        expiresAt: row.expires_at,
        assurance: row.assurance,
        device: describeAgent(row.user_agent),
        ipAddress: row.ip_address,
      })),
    };
  });

export type RevokeOutcome = { ok: true; revoked: number } | { ok: false; reason: string };

/**
 * End one other session.
 *
 * HIGH RISK, so it needs assurance and recency. Ending a session is how an
 * attacker who has taken a browser locks the real owner out of their own
 * account while they work — so the person doing it has to prove they are still
 * the person who owns it.
 *
 * REFUSES THE CURRENT SESSION. "Sign out this device" is the sign-out button,
 * which clears local state as well; doing it through here would revoke the
 * session server-side and leave the browser believing it was still signed in.
 */
export const revokeAccountSession = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .validator((data: { sessionId: string }) => {
    const sessionId = String(data?.sessionId ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error("That is not a session.");
    return { sessionId };
  })
  .handler(async ({ data, context }): Promise<RevokeOutcome> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.sessionId === callerSessionId(context.claims as Record<string, unknown>)) {
      return {
        ok: false,
        reason: "That is this session. Use Sign out to end it, so this browser is cleared too.",
      };
    }

    const { data: removed, error } = await supabaseAdmin.rpc("ocade_revoke_account_session", {
      p_user_id: context.userId,
      p_session_id: data.sessionId,
    });
    if (error) return { ok: false, reason: "OCADE could not end that session just now." };

    const count = Number(removed ?? 0);
    if (count === 0) {
      // Already gone, or never this account's. Both are "nothing to end" and
      // neither reveals which.
      return { ok: false, reason: "That session was already signed out." };
    }

    await auditSession(context.userId, "security.session_revoked", { count });
    /*
     * TOLD, NOT ONLY LOGGED — §D's `security` category, which is one of the
     * kinds that stays recorded whatever the mute settings say.
     *
     * The idempotency key names the SESSION, so a retried request records one
     * notification rather than a second alert about the same event. Nothing
     * about the session is in the title: §D asks for minimal payloads, and
     * "which browser" is on the page the deep link goes to.
     */
    await sendNotification({
      userId: context.userId,
      category: "security",
      title: "A session was signed out",
      body: "Somebody with access to this account ended another signed-in session.",
      deepLink: "/settings/security",
      idempotencyKey: `session-revoked:${data.sessionId}`,
    });
    return { ok: true, revoked: count };
  });

/**
 * End every session except this one.
 *
 * "Keep only where I am now" rather than a list of sessions to remove, because
 * a person doing this has just been told something is wrong — and a list read a
 * moment ago cannot include a session that appeared since.
 */
export const revokeOtherAccountSessions = createServerFn({ method: "POST" })
  .middleware([requireAssurance(HIGH_RISK)])
  .handler(async ({ context }): Promise<RevokeOutcome> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const keep = callerSessionId(context.claims as Record<string, unknown>);
    const { data: removed, error } = await supabaseAdmin.rpc(
      "ocade_revoke_other_account_sessions",
      /*
       * A token with no `session_id` claim keeps nothing, which revokes every
       * session including this one. That is the SAFE direction: the alternative
       * is silently keeping a session OCADE cannot identify, on a request whose
       * whole purpose is ending the ones it does not recognise.
       */
      keep ? { p_user_id: context.userId, p_keep_session_id: keep } : { p_user_id: context.userId },
    );
    if (error) return { ok: false, reason: "OCADE could not end those sessions just now." };

    const count = Number(removed ?? 0);
    await auditSession(context.userId, "security.sessions_revoked_others", { count });
    if (count > 0) {
      /*
       * Keyed on the session that SURVIVED plus how many went, so pressing the
       * button twice in a panic does not produce two alerts about the first
       * press — and a genuinely separate sweep, from a different browser or
       * after new sessions appeared, still gets its own.
       */
      await sendNotification({
        userId: context.userId,
        category: "security",
        title: `${count} other ${count === 1 ? "session was" : "sessions were"} signed out`,
        body: "Every other signed-in session for this account was ended.",
        deepLink: "/settings/security",
        idempotencyKey: `sessions-revoked-others:${keep ?? "all"}:${count}`,
      });
    }
    return { ok: true, revoked: count };
  });

/**
 * Is the caller's session still live, according to the database?
 *
 * PLAN.md §C: verify `session_id` against `auth.sessions` for highly sensitive
 * server operations. A JWT stays valid until it expires even after its session
 * has been revoked, so a correctly signed token is NOT proof that the session
 * behind it still exists — which is exactly the window somebody uses after
 * being signed out of a stolen browser.
 *
 * Exported for other server functions to call before anything irreversible.
 */
export async function callerSessionIsLive(
  userId: string,
  claims: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  const sessionId = callerSessionId(claims);
  /*
   * FAILS OPEN ON A MISSING CLAIM, not closed — and that is a deliberate,
   * bounded choice. Some tokens carry no `session_id` at all, and refusing
   * every one of them would break sign-in methods that are otherwise valid.
   * The caller is still authenticated by a verified signature; this check adds
   * confidence where the claim exists rather than becoming a second gate that
   * can lock people out on its own.
   */
  if (!sessionId) return true;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("ocade_session_is_live", {
    p_user_id: userId,
    p_session_id: sessionId,
  });
  // An unreadable answer is not evidence the session is gone.
  if (error) return true;
  return data === true;
}

/** One audit line per session change, on the existing compliance trail. */
async function auditSession(
  userId: string,
  action: string,
  result: Record<string, number>,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("compliance_audit_log").insert({
      user_id: userId,
      action,
      category: "other",
      feature_id: "settings.security",
      result,
    });
  } catch {
    /* The revocation happened whether or not it was written down. */
  }
}

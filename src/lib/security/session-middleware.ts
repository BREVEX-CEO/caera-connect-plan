/**
 * EVERY SIGNED-IN SERVER FUNCTION GOES THROUGH HERE.
 *
 * `requireSupabaseAuth` (generated) proves the token's signature. It cannot
 * answer two things the database can: whether the session behind the token has
 * been ended (a token outlives its session by up to an hour), and whether an
 * account with a second factor is being used by a session that completed it.
 * One call asks both, because PostgREST runs the same check before it
 * (`public.ocade_enforce_second_factor`). So server functions that go on to
 * use the service role — JARVIS dispatch, device approval — are held to the
 * same rule as the tables.
 */
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** What a server function answers when the session behind the token was ended. */
export const SESSION_ENDED = "Unauthorized: Session ended";

/** A session whose account has a second factor it has not answered yet. */
class SecondFactorRequired extends Error {
  readonly reason = "factor_required";
  constructor() {
    super("Confirm the code from your authenticator app to continue.");
    this.name = "SecondFactorRequired";
  }
}

// Short on purpose: "signed out everywhere" must be true within seconds, and a
// task polling once a second must not double its database calls to get that.
const CACHE_MS = 5_000;
// ponytail: per-isolate memory, bounded; a shared cache only if this ever shows in latency.
const answered = new Map<string, { at: number; standing: Standing }>();

type Standing = "ok" | "factor_required" | "ended";

type RpcClient = {
  rpc: (fn: "ocade_session_meets_second_factor") => PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string; hint?: string } | null;
  }>;
};

/** Whether this session may use the account right now; the decision is the database's. */
export async function sessionStanding(
  supabase: RpcClient,
  claims: Record<string, unknown> | null | undefined,
  now = Date.now(),
): Promise<Standing> {
  // The assurance is part of the question: a session's aal1 and aal2 tokens can
  // be issued in the same second, and an answer for one is not an answer for the other.
  const key = `${String(claims?.sub)}:${String(claims?.session_id)}:${String(claims?.exp)}:${String(claims?.aal)}`;
  const held = answered.get(key);
  if (held && now - held.at < CACHE_MS) return held.standing;
  const { data, error } = await supabase.rpc("ocade_session_meets_second_factor");
  let standing: Standing;
  if (!error) standing = data === true ? "ok" : "factor_required";
  // The pre-request check refuses the call itself in exactly these two cases.
  else if (error.code === "PT401" || error.hint === "session_ended") standing = "ended";
  else if (error.code === "42501" || error.hint === "factor_required") standing = "factor_required";
  else throw new Error("OCADE could not check this session just now. Try again.");
  if (answered.size > 5000) answered.clear();
  answered.set(key, { at: now, standing });
  return standing;
}

export const requireSession = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const standing = await sessionStanding(
      context.supabase as unknown as RpcClient,
      context.claims as Record<string, unknown>,
    );
    // Its own words, so the browser can tell "signed out elsewhere" (leave this
    // tab too) from a token the server merely could not verify this once.
    if (standing === "ended") throw new Error(SESSION_ENDED);
    if (standing === "factor_required") throw new SecondFactorRequired();
    return next();
  });

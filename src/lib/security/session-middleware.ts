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
import { getRequest } from "@tanstack/react-start/server";
import { isSameOriginWrite } from "./isolation";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sessionStanding, type RpcClient } from "./session-standing";

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

export const requireSession = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const request = getRequest();
    const writes = request.method !== "GET" && request.method !== "HEAD";
    if (writes && !isSameOriginWrite(request)) throw new Error("Forbidden: Cross-origin request");
    const standing = await sessionStanding(
      context.supabase as unknown as RpcClient,
      context.claims as Record<string, unknown>,
      Date.now(),
      writes,
    );
    // Its own words, so the browser can tell "signed out elsewhere" (leave this
    // tab too) from a token the server merely could not verify this once.
    if (standing === "ended") throw new Error(SESSION_ENDED);
    if (standing === "factor_required") throw new SecondFactorRequired();
    return next();
  });

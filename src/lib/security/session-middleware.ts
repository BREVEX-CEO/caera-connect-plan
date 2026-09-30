/**
 * EVERY SIGNED-IN SERVER FUNCTION GOES THROUGH HERE.
 *
 * `requireSupabaseAuth` (generated) proves the token is valid. This adds the
 * one question it cannot answer: an account with a verified second factor is
 * reachable only by a session that completed it. The database decides
 * (`public.ocade_session_meets_second_factor`, also run by PostgREST before
 * every request), so server functions that go on to use the service role —
 * JARVIS dispatch, device approval — are held to the same rule as the tables.
 */
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** A session whose account has a second factor it has not answered yet. */
export class SecondFactorRequired extends Error {
  readonly reason = "factor_required";
  constructor() {
    super("Confirm the code from your authenticator app to continue.");
    this.name = "SecondFactorRequired";
  }
}

const CACHE_MS = 60_000;
// ponytail: per-isolate memory, bounded; a shared cache only if this ever shows in latency.
const answered = new Map<string, { at: number; ok: boolean }>();

type RpcClient = {
  rpc: (fn: "ocade_session_meets_second_factor") => PromiseLike<{
    data: unknown;
    error: { code?: string; message?: string; hint?: string } | null;
  }>;
};

/** True when this session may use the account; the decision is the database's. */
export async function meetsSecondFactor(
  supabase: RpcClient,
  claims: Record<string, unknown> | null | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (claims?.aal === "aal2") return true;
  const key = `${String(claims?.sub)}:${String(claims?.session_id)}:${String(claims?.exp)}`;
  const held = answered.get(key);
  if (held && now - held.at < CACHE_MS) return held.ok;
  const { data, error } = await supabase.rpc("ocade_session_meets_second_factor");
  if (error) {
    // The pre-request check refuses the call itself for exactly this case.
    if (error.code === "42501" || error.hint === "factor_required")
      return remember(key, false, now);
    throw new Error("OCADE could not check this session just now. Try again.");
  }
  return remember(key, data === true, now);
}

function remember(key: string, ok: boolean, now: number): boolean {
  if (answered.size > 5000) answered.clear();
  answered.set(key, { at: now, ok });
  return ok;
}

export const requireSession = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const ok = await meetsSecondFactor(
      context.supabase as unknown as RpcClient,
      context.claims as Record<string, unknown>,
    );
    if (!ok) throw new SecondFactorRequired();
    return next();
  });

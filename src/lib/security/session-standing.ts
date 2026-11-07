/**
 * Whether the session behind a verified token may use the account right now.
 *
 * The decision is the database's (`ocade_session_meets_second_factor`, guarded by
 * the pre-request check): an ended session (162) or a missing second factor is
 * refused there, so a token that outlives its session stops working within
 * CACHE_MS. Kept free of framework imports so the decision table is testable.
 */
// Short on purpose: "signed out everywhere" must be true within seconds, and a
// task polling once a second must not double its database calls to get that.
const CACHE_MS = 5_000;
// ponytail: per-isolate memory, bounded; a shared cache only if this ever shows in latency.
const answered = new Map<string, { at: number; standing: Standing }>();

export type Standing = "ok" | "factor_required" | "ended";

export type RpcClient = {
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
  fresh = false,
): Promise<Standing> {
  // The assurance is part of the question: a session's aal1 and aal2 tokens can
  // be issued in the same second, and an answer for one is not an answer for the other.
  const key = `${String(claims?.sub)}:${String(claims?.session_id)}:${String(claims?.exp)}:${String(claims?.aal)}`;
  const held = answered.get(key);
  if (!fresh && held && now - held.at < CACHE_MS) return held.standing;
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

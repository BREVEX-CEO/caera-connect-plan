/**
 * SEC-04: one per-person limit for server actions that start work or reach outside OCADE
 * (`ocade_rate_admit`, atomic in the database). Over the limit, or when the count cannot be
 * made, the action is refused in plain words: a limit that fails open is no limit.
 */
export const RATE_LIMITS = {
  start_task: [20, 60],
  replay_task: [10, 60],
  instruct_task: [30, 60],
  save_watch: [10, 60],
  save_skill: [30, 60],
  save_chat_hook: [5, 300],
  begin_upload: [30, 60],
} as const satisfies Record<string, readonly [number, number]>;

export async function admit(userId: string, action: keyof typeof RATE_LIMITS): Promise<void> {
  const [limit, seconds] = RATE_LIMITS[action];
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (
    supabaseAdmin.rpc as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: unknown }>
  )("ocade_rate_admit", {
    p_user: userId,
    p_action: action,
    p_limit: limit,
    p_window_seconds: seconds,
  });
  if (error || data !== true)
    throw new Error(
      error
        ? "OCADE could not check how often this was done just now. Try again in a moment."
        : "You are doing that too often. Wait a minute, then try again.",
    );
}

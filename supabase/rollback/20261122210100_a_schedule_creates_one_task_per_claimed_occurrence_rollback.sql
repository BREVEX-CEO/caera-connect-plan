BEGIN;

DROP TRIGGER jarvis_watch_delete_cancels_pending_work ON public.jarvis_watches;
DROP TRIGGER jarvis_watch_pause_cancels_pending_work ON public.jarvis_watches;
DROP FUNCTION public.jarvis_cancel_pending_watch_schedules();

DROP FUNCTION public.jarvis_finish_schedule(uuid, timestamptz, uuid, timestamptz, text);
DROP FUNCTION public.jarvis_run_schedule(uuid, uuid, timestamptz, uuid, text);
DROP FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer);
ALTER TABLE public.jarvis_schedules DROP COLUMN claim_token;

-- Claim due occurrences exactly once. A claim older than ten minutes was left by a run that
-- died, and is taken again; the occurrence key on the task stops a second task.
CREATE FUNCTION public.jarvis_claim_due_schedules(p_now timestamptz, p_limit integer)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  conversation_id uuid,
  device_id uuid,
  what text,
  repeat text,
  time_zone text,
  occurrence timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO ''
AS $$
  UPDATE public.jarvis_schedules AS s
     SET claimed_at = p_now,
         claimed_occurrence = coalesce(s.claimed_occurrence, s.next_at)
   WHERE s.id IN (
     SELECT d.id FROM public.jarvis_schedules AS d
      WHERE d.active
        AND d.next_at <= p_now
        AND (d.claimed_at IS NULL OR d.claimed_at < p_now - interval '10 minutes')
      ORDER BY d.next_at
      LIMIT least(greatest(p_limit, 1), 50)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING s.id, s.user_id, s.conversation_id, s.device_id, s.what, s.repeat, s.time_zone,
            s.claimed_occurrence;
$$;
REVOKE ALL ON FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer) TO service_role;

-- Finish a claimed occurrence: record what happened and move to the next run, or end a
-- one-time schedule. Only the claim of that exact occurrence can finish it.
CREATE FUNCTION public.jarvis_finish_schedule(
  p_id uuid,
  p_occurrence timestamptz,
  p_next_at timestamptz,
  p_outcome text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.jarvis_schedules
     SET last_run_at = p_occurrence,
         last_outcome = left(p_outcome, 300),
         next_at = coalesce(p_next_at, next_at),
         active = active AND p_next_at IS NOT NULL,
         claimed_at = NULL,
         claimed_occurrence = NULL
   WHERE id = p_id AND claimed_occurrence = p_occurrence;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_finish_schedule(uuid, timestamptz, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_finish_schedule(uuid, timestamptz, timestamptz, text)
  TO service_role;

COMMIT;

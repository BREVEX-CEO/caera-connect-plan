BEGIN;

CREATE OR REPLACE FUNCTION public.jarvis_finish_schedule(
  p_id uuid, p_occurrence timestamptz, p_claim_token uuid, p_next_at timestamptz, p_outcome text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  UPDATE public.jarvis_schedules
     SET last_run_at = p_occurrence,
         last_outcome = left(p_outcome, 300),
         next_at = coalesce(p_next_at, next_at),
         active = p_next_at IS NOT NULL,
         claimed_at = NULL, claimed_occurrence = NULL, claim_token = NULL
   WHERE id = p_id AND active AND claimed_occurrence = p_occurrence AND claim_token = p_claim_token;
  RETURN FOUND;
END;
$$;

DROP FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer);
CREATE FUNCTION public.jarvis_claim_due_schedules(p_now timestamptz, p_limit integer)
RETURNS TABLE (
  id uuid, user_id uuid, what text, repeat text, time_zone text,
  occurrence timestamptz, claim_token uuid, occurrence_key text
)
LANGUAGE sql
SECURITY INVOKER
SET search_path TO ''
SET timezone TO 'UTC'
AS $$
  UPDATE public.jarvis_schedules AS s
     SET claimed_at = p_now, claimed_occurrence = coalesce(s.claimed_occurrence, s.next_at),
         claim_token = gen_random_uuid()
   WHERE s.id IN (
     SELECT d.id FROM public.jarvis_schedules AS d
      WHERE d.active
        AND d.next_at <= p_now
        AND (d.claimed_at IS NULL OR d.claimed_at < p_now - interval '10 minutes')
      ORDER BY d.next_at
      LIMIT least(greatest(p_limit, 1), 50)
      FOR UPDATE SKIP LOCKED
   )
  RETURNING s.id, s.user_id, s.what, s.repeat, s.time_zone, s.claimed_occurrence, s.claim_token,
            'schedule:' || s.id::text || ':' || (to_json(s.claimed_occurrence) #>> '{}');
$$;
REVOKE ALL ON FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_claim_due_schedules(timestamptz, integer) TO service_role;

DROP FUNCTION public.jarvis_set_schedule_goal(uuid, uuid, timestamptz, integer);
ALTER TABLE public.jarvis_schedules
  DROP CONSTRAINT jarvis_schedules_max_runs_check,
  DROP COLUMN runs_done,
  DROP COLUMN max_runs,
  DROP COLUMN run_until;

COMMIT;

-- OUTCOME AUTOPILOT (plan 28.1.2): an ongoing goal states when it stops. A schedule may end on a
-- date, after a number of runs, or both. The database enforces the stop condition, so a goal
-- never silently becomes perpetual: a schedule past its end is never claimed, and the run that
-- reaches its count or its date ends the schedule.
BEGIN;

ALTER TABLE public.jarvis_schedules
  ADD COLUMN run_until timestamptz,
  ADD COLUMN max_runs integer,
  ADD COLUMN runs_done integer NOT NULL DEFAULT 0,
  ADD CONSTRAINT jarvis_schedules_max_runs_check CHECK (max_runs IS NULL OR max_runs BETWEEN 1 AND 1000);

-- Set or clear the stop condition of one of the person's schedules. Changing it starts the count
-- again, as an edit is a fresh schedule from now on.
CREATE FUNCTION public.jarvis_set_schedule_goal(
  p_user uuid, p_id uuid, p_run_until timestamptz, p_max_runs integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
BEGIN
  IF p_run_until IS NOT NULL AND p_run_until < now() THEN
    RAISE EXCEPTION 'schedule_end_in_past';
  END IF;
  UPDATE public.jarvis_schedules
     SET run_until = p_run_until, max_runs = p_max_runs, runs_done = 0
   WHERE id = p_id AND user_id = p_user;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_set_schedule_goal(uuid, uuid, timestamptz, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.jarvis_set_schedule_goal(uuid, uuid, timestamptz, integer)
  TO service_role;

-- A schedule whose next run is after its end date is ended instead of claimed.
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
  WITH ended AS (
    UPDATE public.jarvis_schedules AS e
       SET active = false, last_outcome = 'Ended on its end date'
     WHERE e.active AND e.claimed_at IS NULL AND e.run_until IS NOT NULL
       AND e.next_at > e.run_until AND e.next_at <= p_now
  )
  UPDATE public.jarvis_schedules AS s
     SET claimed_at = p_now, claimed_occurrence = coalesce(s.claimed_occurrence, s.next_at),
         claim_token = gen_random_uuid()
   WHERE s.id IN (
     SELECT d.id FROM public.jarvis_schedules AS d
      WHERE d.active
        AND d.next_at <= p_now
        AND (d.run_until IS NULL OR d.next_at <= d.run_until)
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

-- Each finished run counts. The run that reaches the count, or whose next run would fall after
-- the end date, ends the schedule.
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
         runs_done = runs_done + 1,
         next_at = coalesce(p_next_at, next_at),
         active = p_next_at IS NOT NULL
                  AND (max_runs IS NULL OR runs_done + 1 < max_runs)
                  AND (run_until IS NULL OR p_next_at <= run_until),
         claimed_at = NULL, claimed_occurrence = NULL, claim_token = NULL
   WHERE id = p_id AND active AND claimed_occurrence = p_occurrence AND claim_token = p_claim_token;
  RETURN FOUND;
END;
$$;

COMMIT;

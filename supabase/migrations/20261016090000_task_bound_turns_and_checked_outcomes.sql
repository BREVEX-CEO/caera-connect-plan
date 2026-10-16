-- A task's planning turns belong to that task by name, and completion is bound to the
-- exact actions the server checked (PLAN Phase 01, V01/V02).
--
-- 1. 20261013090000 guessed a JARVIS turn's task: any task of the account open or
--    finished in the last ten minutes, so a turn of another task, or of no task, could
--    ride free; and the 151st turn of a long task was charged as a request. Now a
--    permit is bound to its task explicitly (ocade_bind_permit_to_task, called by the
--    server for the task the planner names) and a bound turn is free. A task holds at
--    most 150 bound turns: the 151st is refused before anything is sent, so the task
--    pauses uncharged. Nothing is inferred: an unbound JARVIS turn is one request,
--    except the reply that starts a task (the boundary settles it at 0; the server
--    then binds it to the task it started).
-- 2. jarvis_tasks.outcome: the checks the result must pass, fixed when the task starts
--    (scheduled work: when it was scheduled, jarvis_schedules.checks). No one can change
--    them later; a different goal is a different task.
-- 3. Completion names how many actions the server checked (verified_actions). The
--    database refuses it if the task has a different number, or one is unsettled, so
--    an action added between the check and the write cannot ride on it. A new action
--    is never queued on a completed task; queueing waits for a completion in flight.
BEGIN;

ALTER TABLE public.jarvis_tasks
  ADD COLUMN IF NOT EXISTS outcome jsonb,
  ADD COLUMN IF NOT EXISTS verified_actions integer;
ALTER TABLE public.jarvis_tasks
  DROP CONSTRAINT IF EXISTS jarvis_tasks_outcome_check;
ALTER TABLE public.jarvis_tasks
  ADD CONSTRAINT jarvis_tasks_outcome_check CHECK (
    outcome IS NULL OR (jsonb_typeof(outcome) = 'array' AND jsonb_array_length(outcome) BETWEEN 1 AND 10
                        AND length(outcome::text) <= 20000)
  );

-- Scheduled work carries its checks from the moment the person asked for it.
ALTER TABLE public.jarvis_schedules
  ADD COLUMN IF NOT EXISTS checks jsonb;
ALTER TABLE public.jarvis_schedules
  DROP CONSTRAINT IF EXISTS jarvis_schedules_checks_check;
ALTER TABLE public.jarvis_schedules
  ADD CONSTRAINT jarvis_schedules_checks_check CHECK (
    checks IS NULL OR (jsonb_typeof(checks) = 'array' AND jsonb_array_length(checks) BETWEEN 1 AND 10
                       AND length(checks::text) <= 20000)
  );

/** The checks are the task's: set when it starts, never changed. */
CREATE OR REPLACE FUNCTION public.jarvis_task_outcome_is_fixed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF NEW.outcome IS DISTINCT FROM OLD.outcome THEN
    RAISE EXCEPTION 'A task''s checks are fixed when it starts' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_task_outcome_is_fixed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS jarvis_task_outcome_is_fixed ON public.jarvis_tasks;
CREATE TRIGGER jarvis_task_outcome_is_fixed
BEFORE UPDATE OF outcome ON public.jarvis_tasks
FOR EACH ROW EXECUTE FUNCTION public.jarvis_task_outcome_is_fixed();

/** Completed only for exactly the settled actions the server checked. */
CREATE OR REPLACE FUNCTION public.jarvis_tasks_completion_matches_its_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actions integer;
  v_open integer;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;
  -- The row is locked by this UPDATE; queueing takes a share lock on it first, so every
  -- action queued before now is visible here and none can be queued after.
  SELECT count(*), count(*) FILTER (WHERE a.status IN ('queued', 'claimed', 'needs_confirmation'))
    INTO v_actions, v_open
    FROM public.jarvis_activity AS a
   WHERE a.task_id = NEW.id AND a.status <> 'note';
  IF v_open > 0 OR NEW.verified_actions IS DISTINCT FROM v_actions THEN
    RAISE EXCEPTION 'The task changed after its result was checked' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_tasks_completion_matches_its_check() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS jarvis_tasks_completion_matches_its_check ON public.jarvis_tasks;
CREATE TRIGGER jarvis_tasks_completion_matches_its_check
BEFORE UPDATE OF status ON public.jarvis_tasks
FOR EACH ROW EXECUTE FUNCTION public.jarvis_tasks_completion_matches_its_check();

/** Nothing new runs on a completed task. */
CREATE OR REPLACE FUNCTION public.jarvis_no_action_after_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_status text;
BEGIN
  IF NEW.status NOT IN ('queued', 'claimed', 'needs_confirmation') OR NEW.task_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT t.status INTO v_status FROM public.jarvis_tasks AS t WHERE t.id = NEW.task_id FOR SHARE;
  IF v_status = 'completed' THEN
    RAISE EXCEPTION 'That task is completed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.jarvis_no_action_after_completion() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS jarvis_no_action_after_completion ON public.jarvis_activity;
CREATE TRIGGER jarvis_no_action_after_completion
BEFORE INSERT ON public.jarvis_activity
FOR EACH ROW EXECUTE FUNCTION public.jarvis_no_action_after_completion();

/**
 * Bind one JARVIS permit to the task it plans for. 'bound' (also when already bound to
 * it), 'task_budget_exhausted' (150 turns held), 'task_not_open', or 'refused' (not this
 * account's JARVIS permit, already bound elsewhere, or a turn already charged).
 */
CREATE OR REPLACE FUNCTION public.ocade_bind_permit_to_task(
  p_user_id uuid,
  p_idempotency_key text,
  p_task_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_permit record;
  v_turns integer;
BEGIN
  -- The same lock acquisition and settlement take, so turn counts never race.
  PERFORM u.id FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
  SELECT p.* INTO v_permit
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key)
   FOR UPDATE;
  IF NOT FOUND OR v_permit.surface <> 'jarvis' THEN
    RETURN 'refused';
  END IF;
  IF v_permit.task_id = p_task_id THEN
    RETURN 'bound';
  END IF;
  IF v_permit.task_id IS NOT NULL
     OR NOT (v_permit.status = 'reserved'
             OR (v_permit.status = 'succeeded' AND v_permit.charged_hundredths = 0)) THEN
    RETURN 'refused';
  END IF;
  PERFORM t.id FROM public.jarvis_tasks AS t
   WHERE t.id = p_task_id AND t.user_id = p_user_id
     AND t.status IN ('running', 'waiting', 'taken_over');
  IF NOT FOUND THEN
    RETURN 'task_not_open';
  END IF;
  SELECT count(*) INTO v_turns
    FROM public.ocade_generation_permits AS q
   WHERE q.task_id = p_task_id AND q.status IN ('reserved', 'succeeded');
  IF v_turns >= 150 THEN
    RETURN 'task_budget_exhausted';
  END IF;
  UPDATE public.ocade_generation_permits AS p
     SET task_id = p_task_id, updated_at = statement_timestamp()
   WHERE p.id = v_permit.id;
  RETURN 'bound';
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_bind_permit_to_task(uuid, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_bind_permit_to_task(uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.ocade_finalize_generation_permit(
  p_user_id uuid,
  p_idempotency_key text,
  p_cost_hundredths bigint
)
RETURNS TABLE (charged_hundredths bigint, outcome text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_permit record;
  v_total bigint;
  v_difference bigint;
  v_now timestamptz := statement_timestamp();
BEGIN
  IF p_cost_hundredths IS NULL OR p_cost_hundredths < 0 OR p_cost_hundredths > 1000000000 THEN
    RAISE EXCEPTION 'invalid commercial usage cost' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM u.id FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
  PERFORM public.ocade_expire_commercial_permits(p_user_id, v_now);
  SELECT p.* INTO v_permit
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key)
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::bigint, 'missing'::text;
    RETURN;
  END IF;
  IF v_permit.status = 'succeeded' THEN
    RETURN QUERY SELECT v_permit.charged_hundredths, 'succeeded'::text;
    RETURN;
  END IF;
  IF v_permit.status <> 'reserved' THEN
    RETURN QUERY SELECT 0::bigint, v_permit.status::text;
    RETURN;
  END IF;

  v_total := CASE WHEN v_permit.tier = 'free' THEN 100
                  ELSE GREATEST(25, p_cost_hundredths) END;

  -- A turn of a task is part of that task's one use, charged when it completes: a turn
  -- bound to its task, and the reply that starts one (the boundary settles it at 0).
  IF v_permit.surface = 'jarvis' AND (p_cost_hundredths = 0 OR v_permit.task_id IS NOT NULL) THEN
    v_total := 0;
  END IF;

  v_difference := v_total - v_permit.reserved_hundredths;

  IF v_difference > 0 THEN
    PERFORM public.ocade_consume_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
      v_permit.session_window_start, v_difference, NULL
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_consume_commercial_work(
        p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
        v_permit.week_window_start, v_difference, NULL
      );
    END IF;
  ELSIF v_difference < 0 THEN
    PERFORM public.ocade_release_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
      v_permit.session_window_start, -v_difference
    );
    IF v_permit.week_limit_hundredths IS NOT NULL THEN
      PERFORM public.ocade_release_commercial_work(
        p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
        v_permit.week_window_start, -v_difference
      );
    END IF;
  END IF;

  UPDATE public.ocade_generation_permits AS p
     SET status = 'succeeded', charged_hundredths = v_total,
         finalized_at = v_now, updated_at = v_now
   WHERE p.id = v_permit.id;

  RETURN QUERY SELECT v_total, 'succeeded'::text;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_finalize_generation_permit(uuid, text, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_finalize_generation_permit(uuid, text, bigint)
  TO service_role;

COMMIT;

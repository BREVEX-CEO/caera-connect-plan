-- Undo 20261016090000 for the code before it. That code does not bind a turn to its task,
-- so the turn's task is inferred again (the 20261013090000 finalize) — but WITHOUT its
-- 150-turn charge: a rollback never brings back charging a task's turns (PLAN Phase 01).
-- Disable new task admission instead whenever settlement cannot be trusted.
BEGIN;
DROP TRIGGER IF EXISTS jarvis_no_action_after_completion ON public.jarvis_activity;
DROP FUNCTION IF EXISTS public.jarvis_no_action_after_completion();
DROP TRIGGER IF EXISTS jarvis_tasks_completion_matches_its_check ON public.jarvis_tasks;
DROP FUNCTION IF EXISTS public.jarvis_tasks_completion_matches_its_check();
DROP TRIGGER IF EXISTS jarvis_task_outcome_is_fixed ON public.jarvis_tasks;
DROP FUNCTION IF EXISTS public.jarvis_task_outcome_is_fixed();
DROP FUNCTION IF EXISTS public.ocade_bind_permit_to_task(uuid, text, uuid);
ALTER TABLE public.jarvis_tasks DROP CONSTRAINT IF EXISTS jarvis_tasks_outcome_check;
ALTER TABLE public.jarvis_tasks DROP COLUMN IF EXISTS verified_actions, DROP COLUMN IF EXISTS outcome;
ALTER TABLE public.jarvis_schedules DROP CONSTRAINT IF EXISTS jarvis_schedules_checks_check;
ALTER TABLE public.jarvis_schedules DROP COLUMN IF EXISTS checks;
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
  v_task uuid;
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

  -- A turn of a task is part of that task's one use (charged when it completes): the
  -- turn that starts one (the boundary settles it at 0), and every turn while one is open.
  IF v_permit.surface = 'jarvis' AND p_cost_hundredths = 0 THEN
    v_total := 0;
  ELSIF v_permit.surface = 'jarvis' THEN
    SELECT t.id INTO v_task
      FROM public.jarvis_tasks AS t
     WHERE t.user_id = p_user_id
       AND (t.status IN ('running', 'waiting', 'taken_over')
            OR t.finished_at > v_now - INTERVAL '10 minutes')
     ORDER BY t.updated_at DESC
     LIMIT 1;
    IF v_task IS NOT NULL THEN
      v_total := 0;
    END IF;
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
     SET status = 'succeeded', charged_hundredths = v_total, task_id = v_task,
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

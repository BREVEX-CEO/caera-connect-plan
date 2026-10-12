-- Undo: every JARVIS turn is charged as a request again (the 20260926090000 finalize).
BEGIN;
-- The finalize of 20260926090000, which knows nothing of tasks, before task_id goes.
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
DROP TRIGGER IF EXISTS jarvis_completed_task_is_one_use ON public.jarvis_tasks;
DROP FUNCTION IF EXISTS public.jarvis_completed_task_is_one_use();
DROP FUNCTION IF EXISTS public.ocade_usage_windows_now(uuid);
DROP TABLE IF EXISTS public.ocade_jarvis_task_charges;
DROP INDEX IF EXISTS public.ocade_generation_permits_task_idx;
ALTER TABLE public.ocade_generation_permits DROP COLUMN IF EXISTS task_id;
COMMIT;

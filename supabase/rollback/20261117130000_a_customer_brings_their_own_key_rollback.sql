-- Rollback of 20261117130000: customer model connections (BYOK) are removed, with their Vault keys.
BEGIN;
DELETE FROM vault.secrets WHERE id IN (SELECT secret_id FROM public.byok_connections);
DROP FUNCTION IF EXISTS public.ocade_bind_permit_to_customer_key(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.ocade_byok_route_for_turn(uuid, text);
DROP TRIGGER IF EXISTS jarvis_tasks_keep_their_source ON public.jarvis_tasks;
DROP FUNCTION IF EXISTS private.jarvis_task_keeps_its_source();
ALTER TABLE public.jarvis_tasks
  DROP COLUMN IF EXISTS model_customer_key,
  DROP COLUMN IF EXISTS model_connection;
ALTER TABLE public.ocade_generation_permits
  DROP COLUMN IF EXISTS customer_connection,
  DROP COLUMN IF EXISTS customer_key;
DROP FUNCTION IF EXISTS public.ocade_byok_delete(uuid, uuid);
DROP FUNCTION IF EXISTS public.ocade_byok_choose(uuid, text, uuid);
DROP FUNCTION IF EXISTS public.ocade_byok_enable(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.ocade_byok_record(uuid, uuid, text, boolean, boolean);
DROP FUNCTION IF EXISTS public.ocade_byok_route(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.ocade_byok_save(uuid, uuid, text, text, text, text, text);
DROP TABLE IF EXISTS public.byok_choices;
DROP TABLE IF EXISTS public.byok_connections;
DROP FUNCTION IF EXISTS private.byok_forget_secret();

-- The finalize function as 20261016090000 left it.
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

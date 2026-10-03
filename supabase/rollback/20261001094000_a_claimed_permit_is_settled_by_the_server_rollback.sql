-- Undo: any reserved permit may be released again (20260926090000's function).
BEGIN;
CREATE OR REPLACE FUNCTION public.ocade_release_generation_permit(
  p_user_id uuid,
  p_idempotency_key text,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_permit record;
  v_now timestamptz := statement_timestamp();
BEGIN
  PERFORM u.id FROM public.profiles AS u WHERE u.id = p_user_id FOR UPDATE;
  SELECT p.* INTO v_permit
    FROM public.ocade_generation_permits AS p
   WHERE p.user_id = p_user_id AND p.idempotency_key = btrim(p_idempotency_key)
   FOR UPDATE;
  IF NOT FOUND OR v_permit.status <> 'reserved' THEN
    RETURN false;
  END IF;

  PERFORM public.ocade_release_commercial_work(
    p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'session'),
    v_permit.session_window_start, v_permit.reserved_hundredths
  );
  IF v_permit.week_limit_hundredths IS NOT NULL THEN
    PERFORM public.ocade_release_commercial_work(
      p_user_id, public.ocade_usage_window_kind(v_permit.surface, 'week'),
      v_permit.week_window_start, v_permit.reserved_hundredths
    );
  END IF;

  UPDATE public.ocade_generation_permits AS p
     SET status = 'released', charged_hundredths = 0,
         finalized_at = v_now,
         release_reason = left(COALESCE(NULLIF(btrim(p_reason), ''), 'released'), 80),
         updated_at = v_now
   WHERE p.id = v_permit.id;
  RETURN true;
END;
$$;
COMMIT;

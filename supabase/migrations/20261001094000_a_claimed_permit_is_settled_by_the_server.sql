-- ONCE THE SERVER TOOK THE TRANSPORT, ONLY THE SERVER SETTLES THE PERMIT.
--
-- The browser may release a permit it reserved but never used (a request that
-- failed before reaching the boundary). It could also release one the boundary
-- had already claimed and was answering, and the boundary's charge at the end
-- then found the permit released: every answer was free to anyone who called
-- release while it streamed. A claimed permit is now released only by the
-- boundary itself, when its transport ended without any output; otherwise the
-- boundary charges it.
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
  -- The browser's own release names other reasons only (usage.functions.ts).
  IF v_permit.transport_claimed_at IS NOT NULL
     AND p_reason IS DISTINCT FROM 'transport_ended_without_output' THEN
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

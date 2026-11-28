-- PRIVACY-04 / QUOTA-08: diagnostic and throttle records have a fixed life, and generation permits
-- are audited every run. Called by the Worker's scheduled sweep with the service role only.
BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_housekeeping()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_rate bigint; v_mfa bigint; v_watch bigint;
  v_over_charged bigint; v_stuck bigint; v_unfinished bigint;
BEGIN
  -- Retention: throttle windows 2 days; recovery-attempt counters 30 days once unlocked;
  -- file-watch events 30 days.
  DELETE FROM public.ocade_rate_windows WHERE window_start < now() - interval '2 days';
  GET DIAGNOSTICS v_rate = ROW_COUNT;
  DELETE FROM public.ocade_mfa_recovery_attempts
   WHERE window_started_at < now() - interval '30 days' AND (locked_until IS NULL OR locked_until < now());
  GET DIAGNOSTICS v_mfa = ROW_COUNT;
  DELETE FROM public.jarvis_watch_events WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_watch = ROW_COUNT;

  -- Permit audit: a charge above its reservation, a reservation left open an hour past its expiry,
  -- and a settled permit with no settle time are each a defect to look at.
  SELECT count(*) INTO v_over_charged FROM public.ocade_generation_permits
   WHERE charged_hundredths > reserved_hundredths;
  SELECT count(*) INTO v_stuck FROM public.ocade_generation_permits
   WHERE status = 'reserved' AND expires_at < now() - interval '1 hour';
  SELECT count(*) INTO v_unfinished FROM public.ocade_generation_permits
   WHERE status IN ('succeeded', 'released') AND finalized_at IS NULL;

  RETURN jsonb_build_object(
    'purged', jsonb_build_object('rate_windows', v_rate, 'recovery_attempts', v_mfa, 'watch_events', v_watch),
    'permit_audit', jsonb_build_object('over_charged', v_over_charged, 'stuck_reserved', v_stuck, 'unfinished', v_unfinished));
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_housekeeping() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_housekeeping() TO service_role;

COMMIT;

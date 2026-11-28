-- PRIVACY-04 / QUOTA-08: old throttle and diagnostic rows are purged, new ones stay, and the permit audit counts defects.
-- Disposable DB only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE hk AS SELECT gen_random_uuid() AS a;
INSERT INTO auth.users (id, email) SELECT a, a::text || '@example.test' FROM hk;
INSERT INTO public.ocade_rate_windows (user_id, action, window_start, count)
  SELECT a, 'old', now() - interval '3 days', 1 FROM hk UNION ALL SELECT a, 'new', now(), 1 FROM hk;
INSERT INTO public.ocade_mfa_recovery_attempts (user_id, failed_count, window_started_at, locked_until)
  SELECT a, 3, now() - interval '40 days', NULL FROM hk;
DO $$
DECLARE r jsonb; v_a uuid := (SELECT a FROM hk);
BEGIN
  r := public.ocade_housekeeping();
  IF (r #>> '{purged,rate_windows}')::int < 1 OR (r #>> '{purged,recovery_attempts}')::int < 1 THEN
    RAISE EXCEPTION 'housekeeping: old rows were not purged (%)', r;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ocade_rate_windows WHERE user_id = v_a AND action = 'new') THEN
    RAISE EXCEPTION 'housekeeping: a current throttle window was purged';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ocade_rate_windows WHERE user_id = v_a AND action = 'old') THEN
    RAISE EXCEPTION 'housekeeping: an old throttle window survived';
  END IF;
  IF (r #>> '{permit_audit,over_charged}')::int <> 0 THEN RAISE EXCEPTION 'housekeeping: clean data reported over-charged permits'; END IF;
  -- a permit charged above its reservation is reported
  INSERT INTO public.ocade_generation_permits (user_id, idempotency_key, generation_id, surface, tier, status,
      reserved_hundredths, charged_hundredths, session_limit_hundredths, week_limit_hundredths,
      session_window_start, session_reset_at, week_window_start, week_reset_at, issued_at, expires_at, finalized_at)
    VALUES (v_a, 'hk-1', 'g1', 'chat', 'free', 'succeeded', 100, 250, 1000, 1000,
      now(), now() + interval '1 hour', now(), now() + interval '1 day', now(), now() + interval '1 hour', now());
  r := public.ocade_housekeeping();
  IF (r #>> '{permit_audit,over_charged}')::int <> 1 THEN RAISE EXCEPTION 'housekeeping: an over-charged permit was not reported (%)', r; END IF;
  IF has_function_privilege('authenticated', 'public.ocade_housekeeping()', 'EXECUTE') THEN
    RAISE EXCEPTION 'housekeeping: a signed-in person can run the purge';
  END IF;
END $$;
ROLLBACK;

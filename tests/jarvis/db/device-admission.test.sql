-- Shared per-device admission (165): freshness, revocation and the request budget are one
-- database decision, so many server instances cannot each grant the full budget.
-- Disposable database only; the device below is synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.admit_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'device admission: %', p_what; END IF;
END;
$$;
CREATE TEMP TABLE admission_ids AS SELECT gen_random_uuid() AS user_id;
INSERT INTO auth.users (id, email) SELECT user_id, user_id::text || '@example.test' FROM admission_ids;
GRANT SELECT ON admission_ids TO service_role;
SET LOCAL ROLE service_role;
DO $$
DECLARE
  v record;
  dev uuid;
BEGIN
  SELECT * INTO v FROM public.jarvis_enroll_device(
    repeat('C', 120), 'Admission PC', 'windows', '0.1.0', repeat('2', 64));
  dev := public.jarvis_approve_device((SELECT user_id FROM admission_ids), lower(v.code));
  PERFORM pg_temp.admit_assert(public.jarvis_device_admit(dev, 1000, 2, 60000) = 'admitted', 'first request');
  PERFORM pg_temp.admit_assert(public.jarvis_device_admit(dev, 1001, 2, 60000) = 'admitted', 'second request');
  PERFORM pg_temp.admit_assert(public.jarvis_device_admit(dev, 1002, 2, 60000) = 'rate_limited', 'over budget');
  PERFORM pg_temp.admit_assert(public.jarvis_device_admit(dev, 1002, 2, 60000) = 'refused',
                               'a rate-limited timestamp is still consumed: no later replay');
  PERFORM pg_temp.admit_assert(public.jarvis_device_admit(dev, 999, 2, 60000) = 'refused', 'older timestamp');
  PERFORM pg_temp.admit_assert(public.jarvis_device_admit(dev, 1003, NULL, 60000) = 'admitted',
                               'a request without a budget (a receipt) is always recorded');
  UPDATE public.jarvis_devices SET request_window_started_ms = request_window_started_ms - 60001 WHERE id = dev;
  PERFORM pg_temp.admit_assert(public.jarvis_device_admit(dev, 1004, 2, 60000) = 'admitted',
                               'a new window starts by the database clock');
  UPDATE public.jarvis_devices SET revoked_at = now() WHERE id = dev;
  PERFORM pg_temp.admit_assert(public.jarvis_device_admit(dev, 1005, NULL, 60000) = 'refused', 'revoked device');
  PERFORM pg_temp.admit_assert(public.jarvis_device_admit(gen_random_uuid(), 1, 2, 60000) = 'refused', 'unknown device');
END;
$$;
RESET ROLE;
DO $$
BEGIN
  PERFORM pg_temp.admit_assert(NOT has_function_privilege('authenticated',
    'public.jarvis_device_admit(uuid, bigint, integer, integer)', 'EXECUTE'), 'signed-in users cannot call it');
  PERFORM pg_temp.admit_assert(NOT has_function_privilege('anon',
    'public.jarvis_device_admit(uuid, bigint, integer, integer)', 'EXECUTE'), 'anonymous callers cannot call it');
END;
$$;
ROLLBACK;

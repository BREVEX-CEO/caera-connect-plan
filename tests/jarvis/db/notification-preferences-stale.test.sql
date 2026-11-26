-- OFFLINE-03: a notification-preference save made from an out-of-date copy is refused and changes
-- nothing; the first save expects revision 0; a current save bumps the revision. Disposable DB only.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE TEMP TABLE np_ids AS SELECT gen_random_uuid() AS a;
INSERT INTO auth.users (id, email) SELECT a, a::text || '@example.test' FROM np_ids;
GRANT SELECT ON np_ids TO authenticated;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_a uuid := (SELECT a FROM np_ids);
  r1 bigint;
  r2 bigint;
  stale_refused boolean := false;
  first_stale_refused boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_a, 'role', 'authenticated')::text, true);
  r1 := public.ocade_save_notification_preferences_checked(0, false, '{"a":1}', '{}');
  IF r1 <> 1 THEN RAISE EXCEPTION 'stale-prefs: first save revision % (want 1)', r1; END IF;
  r2 := public.ocade_save_notification_preferences_checked(1, true, '{"a":2}', '{}');
  IF r2 <> 2 THEN RAISE EXCEPTION 'stale-prefs: current save revision % (want 2)', r2; END IF;
  BEGIN
    PERFORM public.ocade_save_notification_preferences_checked(1, false, '{"a":3}', '{}');
  EXCEPTION WHEN serialization_failure THEN stale_refused := true;
  END;
  IF NOT stale_refused THEN RAISE EXCEPTION 'stale-prefs: a save from revision 1 was accepted at revision 2'; END IF;
  IF (SELECT quiet_hours ->> 'a' FROM public.ocade_notification_preferences WHERE user_id = v_a) <> '2'
     OR (SELECT revision FROM public.ocade_notification_preferences WHERE user_id = v_a) <> 2 THEN
    RAISE EXCEPTION 'stale-prefs: a refused save changed the stored row';
  END IF;
  -- a device that never read any row cannot overwrite an existing one
  BEGIN
    PERFORM public.ocade_save_notification_preferences_checked(0, false, '{"a":4}', '{}');
  EXCEPTION WHEN serialization_failure THEN first_stale_refused := true;
  END;
  IF NOT first_stale_refused THEN RAISE EXCEPTION 'stale-prefs: a save expecting no row overwrote one'; END IF;
END;
$$;
RESET ROLE;
ROLLBACK;

-- Ended sessions, owed second factors and cross-account task control (162).
-- A token that outlives its session is refused by the pre-request check; another
-- account can neither stop nor take over a task it does not own, and the task is untouched.
-- Disposable database only; the accounts and device below are synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.session_assert(p_ok boolean, p_what text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_ok IS NOT TRUE THEN RAISE EXCEPTION 'session/account: %', p_what; END IF;
END;
$$;
-- Which error a statement raises ('' when it succeeds).
CREATE FUNCTION pg_temp.raised(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN '';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ':' || SQLERRM;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.raised(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pg_temp.session_assert(boolean, text) TO authenticated, service_role;

CREATE TEMP TABLE session_ids (name text PRIMARY KEY, id uuid);
GRANT SELECT ON session_ids TO authenticated, service_role;
INSERT INTO session_ids VALUES ('a', gen_random_uuid()), ('b', gen_random_uuid()), ('conv', gen_random_uuid()),
  ('live', gen_random_uuid()), ('factor', gen_random_uuid());
INSERT INTO auth.users (id, email) SELECT id, name || '-' || id || '@example.test' FROM session_ids WHERE name IN ('a', 'b');
INSERT INTO auth.sessions (id, user_id)
  SELECT (SELECT id FROM session_ids WHERE name = 'live'), (SELECT id FROM session_ids WHERE name = 'a');
INSERT INTO public.ocade_conversations (id, user_id, title, surface)
  SELECT (SELECT id FROM session_ids WHERE name = 'conv'), (SELECT id FROM session_ids WHERE name = 'a'), 'J', 'jarvis';

-- The pre-request check PostgREST runs before every signed-in request.
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  a uuid := (SELECT id FROM session_ids WHERE name = 'a');
  live uuid := (SELECT id FROM session_ids WHERE name = 'live');
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated',
    'session_id', live, 'aal', 'aal1')::text, true);
  PERFORM pg_temp.session_assert(pg_temp.raised('SELECT public.ocade_enforce_second_factor()') = '',
                                 'a live session passes');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated',
    'session_id', gen_random_uuid(), 'aal', 'aal1')::text, true);
  PERFORM pg_temp.session_assert(pg_temp.raised('SELECT public.ocade_enforce_second_factor()') LIKE 'PT401:%',
                                 'a token whose session was ended is refused as signed out');
END;
$$;
RESET ROLE;

-- Ending the session (sign out everywhere) takes effect on the very next request.
DELETE FROM auth.sessions WHERE id = (SELECT id FROM session_ids WHERE name = 'live');
INSERT INTO auth.mfa_factors (id, user_id, factor_type, status)
  SELECT (SELECT id FROM session_ids WHERE name = 'factor'), (SELECT id FROM session_ids WHERE name = 'b'), 'totp', 'verified';
INSERT INTO auth.sessions (id, user_id)
  SELECT (SELECT id FROM session_ids WHERE name = 'factor'), (SELECT id FROM session_ids WHERE name = 'b');
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  a uuid := (SELECT id FROM session_ids WHERE name = 'a');
  b uuid := (SELECT id FROM session_ids WHERE name = 'b');
  live uuid := (SELECT id FROM session_ids WHERE name = 'live');
  factor uuid := (SELECT id FROM session_ids WHERE name = 'factor');
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', a, 'role', 'authenticated',
    'session_id', live, 'aal', 'aal1')::text, true);
  PERFORM pg_temp.session_assert(pg_temp.raised('SELECT public.ocade_enforce_second_factor()') LIKE 'PT401:%',
                                 'the same token stops working once its session is ended');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', b, 'role', 'authenticated',
    'session_id', factor, 'aal', 'aal1')::text, true);
  PERFORM pg_temp.session_assert(pg_temp.raised('SELECT public.ocade_enforce_second_factor()') LIKE '42501:%',
                                 'a password-only session of an account with a second factor is refused');
  PERFORM pg_temp.session_assert(NOT public.ocade_session_meets_second_factor(), 'the server function check agrees');
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', b, 'role', 'authenticated',
    'session_id', factor, 'aal', 'aal2')::text, true);
  PERFORM pg_temp.session_assert(pg_temp.raised('SELECT public.ocade_enforce_second_factor()') = '',
                                 'the same account after its second factor passes');
END;
$$;
RESET ROLE;

-- Another account cannot stop or take over a task, and the task is left exactly as it was.
SET LOCAL ROLE service_role;
DO $$
DECLARE
  a uuid := (SELECT id FROM session_ids WHERE name = 'a');
  b uuid := (SELECT id FROM session_ids WHERE name = 'b');
  v record;
  dev uuid;
  t record;
  before jsonb;
BEGIN
  SELECT * INTO v FROM public.jarvis_enroll_device(repeat('S', 120), 'Session PC', 'windows', '0.1.0', repeat('4', 64));
  dev := public.jarvis_approve_device(a, lower(v.code));
  INSERT INTO public.jarvis_permissions (user_id, device_id, capability, allowed) VALUES
    (a, NULL, 'master', true), (a, dev, 'files', true);
  SELECT * INTO t FROM public.jarvis_open_task(a, (SELECT id FROM session_ids WHERE name = 'conv'), dev,
    'Owned', '[{"id": "c"}]', '[]');
  SELECT to_jsonb(x) - 'updated_at' INTO before FROM public.jarvis_tasks AS x WHERE x.id = t.task_id;
  PERFORM pg_temp.session_assert(pg_temp.raised(format('SELECT * FROM public.jarvis_stop_task(%L, %L)', b, t.task_id))
                                 LIKE '%task_not_found%', 'another account cannot stop it');
  PERFORM pg_temp.session_assert(pg_temp.raised(format('SELECT public.jarvis_take_over(%L, %L)', b, t.task_id))
                                 LIKE '%task_not_found%', 'another account cannot take it over');
  PERFORM pg_temp.session_assert(pg_temp.raised(format('SELECT public.jarvis_resume_task(%L, %L)', b, t.task_id))
                                 LIKE '%task_not_found%', 'another account cannot resume it');
  PERFORM pg_temp.session_assert((SELECT to_jsonb(x) - 'updated_at' FROM public.jarvis_tasks AS x WHERE x.id = t.task_id) = before,
                                 'the task is untouched');
  PERFORM pg_temp.session_assert(NOT public.jarvis_revoke_device(b, dev), 'another account cannot remove the device');
  PERFORM pg_temp.session_assert((SELECT revoked_at IS NULL FROM public.jarvis_devices WHERE id = dev), 'the device stays');
END;
$$;
RESET ROLE;
ROLLBACK;

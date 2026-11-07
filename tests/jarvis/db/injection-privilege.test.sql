-- SQL injection and privilege escalation at the database (169).
-- Every rule is checked over the whole migrated schema, so a future function or table
-- that breaks one fails here by name. Disposable database only; accounts are synthetic.
\set ON_ERROR_STOP on
BEGIN;
SET client_min_messages = warning;
CREATE FUNCTION pg_temp.none(p_what text, p_sql text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  found text;
BEGIN
  EXECUTE 'SELECT string_agg(x, '', '') FROM (' || p_sql || ') AS q(x)' INTO found;
  IF found IS NOT NULL THEN RAISE EXCEPTION 'injection/privilege: % — %', p_what, found; END IF;
END;
$$;
CREATE FUNCTION pg_temp.raised(p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN '';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END;
$$;
GRANT EXECUTE ON FUNCTION pg_temp.raised(text) TO authenticated;

-- No callable function builds SQL from text at run time, so no argument can become SQL.
DO $$ BEGIN PERFORM pg_temp.none('a function runs dynamic SQL', $q$
  SELECT n.nspname || '.' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'private') AND p.prosrc ~* '\mEXECUTE\M\s+(?!FUNCTION\M)'$q$); END $$;
-- An elevated function cannot be redirected to an attacker's object through search_path.
DO $$ BEGIN PERFORM pg_temp.none('an elevated function has no fixed search_path', $q$
  SELECT n.nspname || '.' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'private') AND p.prosecdef
     AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) AS c WHERE c LIKE 'search_path=%')$q$); END $$;
-- Signed-out visitors run only the pre-request check, which runs for every request.
DO $$ BEGIN PERFORM pg_temp.none('anonymous callers can execute an account function', $q$
  SELECT n.nspname || '.' || p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname IN ('public', 'private') AND has_function_privilege('anon', p.oid, 'EXECUTE')
     AND p.proname <> 'ocade_enforce_second_factor'$q$); END $$;
-- Every public table is filtered per account by row level security.
DO $$ BEGIN PERFORM pg_temp.none('a table without row level security', $q$
  SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity$q$); END $$;

-- Customer content stays the customer's (175): no policy lets staff read it, and no staff,
-- support or owner function reads it. A support case sees only what the person shares.
DO $$ BEGIN PERFORM pg_temp.none('a policy lets staff read customer content', $q$
  SELECT tablename || '.' || policyname FROM pg_policies
   WHERE schemaname = 'public' AND tablename IN ('ocade_conversations', 'ocade_messages', 'ocade_library_items',
         'jarvis_tasks', 'jarvis_activity', 'jarvis_memories', 'jarvis_schedules', 'user_private_records',
         'ocade_notifications')
     AND (coalesce(qual, '') || coalesce(with_check, '')) ~* 'staff|admin|owner_can|has_role'$q$); END $$;
DO $$ BEGIN PERFORM pg_temp.none('a staff or support function reads customer content', $q$
  SELECT p.proname || ' reads ' || m[1] FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace,
         regexp_matches(p.prosrc, '(ocade_messages|ocade_library_items|jarvis_memories|user_private_records|jarvis_tasks\.objective)', 'g') AS m
   WHERE n.nspname IN ('public', 'private') AND p.proname ~ 'staff|support|admin|owner'$q$); END $$;

-- A signed-in account that is not staff cannot use any function that acts on another account.
CREATE TEMP TABLE privilege_ids AS SELECT gen_random_uuid() AS attacker, gen_random_uuid() AS victim, gen_random_uuid() AS session;
GRANT SELECT ON privilege_ids TO authenticated;
INSERT INTO auth.users (id, email) SELECT attacker, attacker || '@example.test' FROM privilege_ids;
INSERT INTO auth.users (id, email) SELECT victim, victim || '@example.test' FROM privilege_ids;
INSERT INTO auth.sessions (id, user_id) SELECT session, attacker FROM privilege_ids;
CREATE TEMP TABLE before_actions AS SELECT count(*) AS n FROM public.ocade_admin_actions;
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  ids record := (SELECT p FROM privilege_ids AS p);
  calls text[];
  call text;
  outcome text;
  stamp bigint := extract(epoch FROM now())::bigint;
BEGIN
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', ids.attacker, 'role', 'authenticated',
    'session_id', ids.session, 'aal', 'aal2', 'amr', jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', stamp)))::text, true);
  calls := ARRAY[
    format('SELECT public.ocade_staff_set_permissions(%L, ARRAY[%L], ARRAY[]::text[], %L)', ids.victim, 'staff.manage', 'escalating myself'),
    format('SELECT public.ocade_staff_revoke(%L, %L)', ids.victim, 'remove the real owner'),
    format('SELECT public.ocade_staff_end_customer_sessions(%L, %L)', ids.victim, 'sign the victim out'),
    format('SELECT public.ocade_staff_adjust_usage(%L, %L, %L, %s, %L)', ids.victim, 'chat', 'day', 100000, 'give myself usage'),
    format('SELECT public.ocade_staff_suspend_account(%L, true, %L)', ids.victim, 'suspend the victim'),
    format('SELECT public.ocade_grant_unlimited(%L, now() + interval %L, %L)', ids.attacker, '1 year', 'free usage forever'),
    format('SELECT public.ocade_revoke_unlimited(%L, %L)', ids.victim, 'take theirs away'),
    format('SELECT public.ocade_staff_reset_second_factor(%L, %L)', ids.victim, 'take over their account'),
    format('SELECT public.ocade_staff_begin_account_deletion(%L, %L, %L)', ids.victim, ids.victim || '@example.test', 'delete the victim')
  ];
  FOREACH call IN ARRAY calls LOOP
    outcome := pg_temp.raised(call);
    IF outcome = '' THEN RAISE EXCEPTION 'injection/privilege: a non-staff account ran %', call; END IF;
  END LOOP;
  -- Text that would be SQL if it were ever concatenated is only a value.
  outcome := pg_temp.raised($q$SELECT public.ocade_save_notification_preferences(false, '{"x": "''); DROP TABLE public.ocade_admin_actions; --"}', '{}')$q$);
  IF outcome <> '' THEN RAISE EXCEPTION 'injection/privilege: a hostile value broke a normal call (%)', outcome; END IF;
END;
$$;
RESET ROLE;
DO $$
BEGIN
  IF to_regclass('public.ocade_admin_actions') IS NULL THEN
    RAISE EXCEPTION 'injection/privilege: hostile text dropped a table';
  END IF;
  IF (SELECT count(*) FROM public.ocade_admin_actions) <> (SELECT n FROM before_actions) THEN
    RAISE EXCEPTION 'injection/privilege: a refused call left an admin action';
  END IF;
  IF (SELECT quiet_hours ->> 'x' FROM public.ocade_notification_preferences
       WHERE user_id = (SELECT attacker FROM privilege_ids)) NOT LIKE '%DROP TABLE%' THEN
    RAISE EXCEPTION 'injection/privilege: the hostile value was not stored verbatim';
  END IF;
END;
$$;
ROLLBACK;

-- VERIFICATION for 20260722110000_ocade_automations.sql
-- Run AFTER applying. Every query must return the expected rows.

-- 1) Both tables exist. Expect 2 rows.
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ocade_automations', 'ocade_automation_runs')
ORDER BY tablename;

-- 2) RLS enabled on both. Expect rowsecurity = true twice.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('ocade_automations', 'ocade_automation_runs')
ORDER BY c.relname;

-- 3) Own-row policies exist. Expect own_automations + own_automation_runs.
-- The run policy's parent_owned column must be true.
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  CASE
    WHEN tablename = 'ocade_automation_runs'
      THEN with_check LIKE '%ocade_automations%'
    ELSE NULL
  END AS parent_owned
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ocade_automations', 'ocade_automation_runs')
ORDER BY tablename;

-- 4) Explicit grants exist. authenticated has CRUD during this base migration,
-- service_role may administer, and anon/PUBLIC have no rows. Migration 4 later
-- removes direct run UPDATE/DELETE in favour of RPCs.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('ocade_automations', 'ocade_automation_runs')
  AND grantee IN ('authenticated', 'service_role', 'anon', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- 5) Status + risk CHECK constraints are present. Expect >= 3 rows.
SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('ocade_automations', 'ocade_automation_runs')
  AND con.contype = 'c'
ORDER BY con.conname;

-- 6) Scheduler partial index exists. Expect 1 row.
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND indexname = 'ocade_automations_due_idx';

-- 7) updated_at trigger attached. Expect 1 row.
SELECT event_object_table, trigger_name FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'ocade_automations_touch';

-- 8) Foreign key from runs -> automations with ON DELETE CASCADE. Expect 1 row.
SELECT con.conname, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
WHERE c.relname = 'ocade_automation_runs' AND con.contype = 'f';

-- 9) Cross-tenant isolation (run as an authenticated user): expect 0.
-- SELECT count(*) FROM public.ocade_automations WHERE user_id <> auth.uid();

-- 10) The "never double-start" guard exists and is PARTIAL. Expect 1 row whose
--    indexdef contains both the dry_run exclusion and the in-flight statuses.
SELECT indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname = 'ocade_automation_runs_one_in_flight_idx';

-- 11) Behavioural proof of the guard. Run as an authenticated user, replacing
--     <AUTOMATION_ID> with one you own. The SECOND insert must FAIL with a
--     unique violation — that failure is the expected, passing result.
--
--   INSERT INTO public.ocade_automation_runs (user_id, automation_id, status, dry_run, plan)
--     VALUES (auth.uid(), '<AUTOMATION_ID>', 'running', false, '{}'::jsonb);
--   INSERT INTO public.ocade_automation_runs (user_id, automation_id, status, dry_run, plan)
--     VALUES (auth.uid(), '<AUTOMATION_ID>', 'running', false, '{}'::jsonb);
--   -- expected: ERROR duplicate key value violates unique constraint
--   --           "ocade_automation_runs_one_in_flight_idx"
--
--   Then confirm dry runs are exempt (both must SUCCEED):
--   INSERT INTO public.ocade_automation_runs (user_id, automation_id, status, dry_run, plan)
--     VALUES (auth.uid(), '<AUTOMATION_ID>', 'succeeded', true, '{}'::jsonb);
--   INSERT INTO public.ocade_automation_runs (user_id, automation_id, status, dry_run, plan)
--     VALUES (auth.uid(), '<AUTOMATION_ID>', 'succeeded', true, '{}'::jsonb);
--
--   Clean up:  DELETE FROM public.ocade_automation_runs WHERE automation_id = '<AUTOMATION_ID>';

-- ---------------------------------------------------------------------------
-- SELF-CHECKING ASSERTIONS
--
-- The queries above are read by a human and always exit 0. This block RAISES on
-- any gap so an automated apply can detect failure.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  expected text[] := ARRAY['ocade_automations', 'ocade_automation_runs'];
  gap text;
BEGIN
  SELECT string_agg(t, ', ') INTO gap
  FROM unnest(expected) AS t
  WHERE to_regclass('public.' || t) IS NULL;
  IF gap IS NOT NULL THEN
    RAISE EXCEPTION 'Migration incomplete - missing table(s): %', gap;
  END IF;

  SELECT string_agg(c.relname, ', ') INTO gap
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = ANY(expected) AND NOT c.relrowsecurity;
  IF gap IS NOT NULL THEN
    RAISE EXCEPTION 'Row-level security is NOT enabled on: %', gap;
  END IF;

  SELECT string_agg(t, ', ') INTO gap
  FROM unnest(expected) AS t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = t
  );
  IF gap IS NOT NULL THEN
    RAISE EXCEPTION 'RLS enabled but NO policy exists on: %', gap;
  END IF;

  RAISE NOTICE 'VERIFIED: automation tables present, RLS enabled, policies in place.';
END
$verify$;

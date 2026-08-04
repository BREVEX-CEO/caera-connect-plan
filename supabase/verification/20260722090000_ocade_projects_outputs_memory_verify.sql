-- VERIFICATION for 20260722090000_ocade_projects_outputs_memory.sql
--
-- Run AFTER applying the migration. Every query must return the expected rows;
-- anything missing means the migration did not fully apply.

-- 1) All four tables exist. Expect 4 rows.
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ocade_projects', 'ocade_project_items', 'ocade_outputs', 'ocade_memory')
ORDER BY tablename;

-- 2) RLS is ENABLED on all four. Expect rowsecurity = true for every row.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('ocade_projects', 'ocade_project_items', 'ocade_outputs', 'ocade_memory')
ORDER BY c.relname;

-- 3) Own-row policies exist. Expect 4 rows (own_projects, own_project_items,
--    own_outputs, own_memory). The parent_owned column must be true for every
--    child table and NULL for the root ocade_projects table.
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check,
  CASE
    WHEN tablename = 'ocade_projects' THEN NULL
    ELSE with_check LIKE '%ocade_projects%'
  END AS parent_owned
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ocade_projects', 'ocade_project_items', 'ocade_outputs', 'ocade_memory')
ORDER BY tablename;

-- 4) The updated conversation policy validates the project parent. Expect one
--    row with parent_owned=true.
SELECT
  policyname,
  with_check,
  with_check LIKE '%ocade_projects%' AS parent_owned
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'ocade_conversations'
  AND policyname = 'own_conversations';

-- 5) The message policy validates its conversation parent. Expect one row with
--    parent_owned=true.
SELECT
  policyname,
  qual,
  with_check,
  with_check LIKE '%ocade_conversations%' AS parent_owned
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'ocade_messages'
  AND policyname = 'own_messages';

-- 6) Explicit client/service grants exist. Expect authenticated CRUD and
--    service_role administration for each table, with no anon/PUBLIC rows.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('ocade_projects', 'ocade_project_items', 'ocade_outputs', 'ocade_memory')
  AND grantee IN ('authenticated', 'service_role', 'anon', 'PUBLIC')
ORDER BY table_name, grantee, privilege_type;

-- 7) Additive/versioning columns landed. Expect 7 rows.
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'ocade_conversations' AND column_name = 'project_id')
    OR (table_name = 'user_settings' AND column_name = 'ocade_memory_enabled')
    OR (
      table_name = 'ocade_outputs'
      AND column_name IN (
        'lineage_id',
        'version',
        'parent_output_id',
        'content_sha256',
        'expires_at'
      )
    )
  )
ORDER BY table_name;

-- 8) Memory defaults to OFF (opt-in). Expect column_default = false.
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_settings'
  AND column_name = 'ocade_memory_enabled';

-- 9) updated_at triggers are attached. Expect 2 rows.
SELECT event_object_table AS table_name, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('ocade_projects_touch', 'ocade_memory_touch')
ORDER BY table_name;

-- 10) Cross-tenant isolation smoke test (run as an authenticated user):
--    must return 0 rows — RLS prevents reading another user's projects.
-- SELECT count(*) FROM public.ocade_projects WHERE user_id <> auth.uid();
--
-- Parent-FK refusal (run with <OTHER_PROJECT_ID> owned by another account):
-- this insert must fail its RLS WITH CHECK, not create a cross-owner link.
-- INSERT INTO public.ocade_memory (user_id, scope, project_id, content)
-- VALUES (auth.uid(), 'project', '<OTHER_PROJECT_ID>'::uuid, 'must fail');

-- ---------------------------------------------------------------------------
-- SELF-CHECKING ASSERTIONS
--
-- The queries above are for a human to read. They exit 0 whether or not the
-- migration applied, so an automated run cannot tell success from failure.
-- This block RAISES on any gap, giving psql a non-zero exit.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  expected text[] := ARRAY['ocade_projects', 'ocade_project_items', 'ocade_outputs', 'ocade_memory'];
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
    RAISE EXCEPTION 'RLS enabled but NO policy exists on: % (table would be unreadable)', gap;
  END IF;

  RAISE NOTICE 'VERIFIED: 4 tables present, RLS enabled, policies in place.';
END
$verify$;

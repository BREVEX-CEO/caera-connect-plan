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
--    own_outputs, own_memory), each qualifying on auth.uid() = user_id.
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ocade_projects', 'ocade_project_items', 'ocade_outputs', 'ocade_memory')
ORDER BY tablename;

-- 4) Additive columns landed. Expect 2 rows.
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'ocade_conversations' AND column_name = 'project_id')
    OR (table_name = 'user_settings' AND column_name = 'ocade_memory_enabled')
  )
ORDER BY table_name;

-- 5) Memory defaults to OFF (opt-in). Expect column_default = false.
SELECT column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_settings'
  AND column_name = 'ocade_memory_enabled';

-- 6) updated_at triggers are attached. Expect 2 rows.
SELECT event_object_table AS table_name, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('ocade_projects_touch', 'ocade_memory_touch')
ORDER BY table_name;

-- 7) Cross-tenant isolation smoke test (run as an authenticated user):
--    must return 0 rows — RLS prevents reading another user's projects.
-- SELECT count(*) FROM public.ocade_projects WHERE user_id <> auth.uid();

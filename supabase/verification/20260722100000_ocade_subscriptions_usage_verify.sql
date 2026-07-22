-- VERIFICATION for 20260722100000_ocade_subscriptions_usage.sql
-- Run AFTER applying. Each query must return the expected rows.

-- 1) Both tables exist. Expect 2 rows.
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('ocade_subscriptions', 'ocade_cloud_usage')
ORDER BY tablename;

-- 2) RLS enabled on both. Expect rowsecurity = true for each.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('ocade_subscriptions', 'ocade_cloud_usage')
ORDER BY c.relname;

-- 3) Read-only owner policies exist and there is NO client write policy.
--    Expect exactly 2 rows, both cmd = 'SELECT'.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('ocade_subscriptions', 'ocade_cloud_usage')
ORDER BY tablename;

-- 4) The atomic consume function exists and is SECURITY DEFINER.
SELECT p.proname, p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'ocade_consume_cloud_use';

-- 5) Execute is NOT granted to anon/authenticated (service_role only).
--    Expect no rows for anon/authenticated.
SELECT grantee, privilege_type
FROM information_schema.role_routine_grants
WHERE routine_schema = 'public'
  AND routine_name = 'ocade_consume_cloud_use'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC');

-- 6) One-row-per-window uniqueness is enforced. Expect the unique constraint.
SELECT conname, contype
FROM pg_constraint
WHERE conrelid = 'public.ocade_cloud_usage'::regclass AND contype = 'u';

-- 7) Allowance cannot be exceeded (run as service_role in a scratch tx):
-- BEGIN;
--   SELECT public.ocade_consume_cloud_use('<user-uuid>', date_trunc('hour', now()), 1); -- returns 1
--   SELECT public.ocade_consume_cloud_use('<user-uuid>', date_trunc('hour', now()), 1); -- must RAISE allowance_exhausted
-- ROLLBACK;

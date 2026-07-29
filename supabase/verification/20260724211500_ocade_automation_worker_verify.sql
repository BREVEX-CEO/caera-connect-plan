-- VERIFICATION for 20260724211500_ocade_automation_worker.sql
-- Run AFTER applying. No statement below mutates data unless explicitly
-- uncommented inside the behavioural proof transaction.

-- 1) Receipt table exists with RLS. Expect one row with rls_enabled=true.
SELECT c.relname, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'ocade_automation_step_receipts';

-- 2) Worker columns exist. Expect 11 rows.
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ocade_automation_runs'
  AND column_name IN (
    'execution_steps', 'worker_id', 'claim_token', 'claimed_at',
    'heartbeat_at', 'lease_expires_at', 'cancel_requested_at', 'pause_requested_at',
    'approval_expires_at', 'deadline_at', 'next_step_index'
  )
ORDER BY column_name;

-- 3) Ownership policies remain explicit, but direct INSERT/UPDATE/DELETE table
-- privileges are absent: enqueue and lifecycle changes are RPC-only.
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ocade_automation_runs'
ORDER BY policyname;

-- Expect no rows.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'ocade_automation_runs'
  AND grantee = 'authenticated'
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

-- 4) Receipt rows are owner-readable only. Expect one SELECT policy.
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'ocade_automation_step_receipts';

-- Receipt table ACL is append-only for application roles. Expect SELECT rows
-- only; this query must return no INSERT/UPDATE/DELETE/TRUNCATE privilege.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'ocade_automation_step_receipts'
  AND grantee IN ('authenticated', 'service_role')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');

-- 5) All fourteen enqueue/lifecycle functions exist, are SECURITY DEFINER, and
-- pin search_path. Expect 14 rows with security_definer=true.
SELECT
  p.proname,
  p.prosecdef AS security_definer,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'ocade_enqueue_automation_run',
    'ocade_claim_automation_run',
    'ocade_heartbeat_automation_run',
    'ocade_append_automation_receipt',
    'ocade_complete_automation_run',
    'ocade_requeue_automation_run',
    'ocade_suspend_automation_run',
    'ocade_request_automation_pause',
    'ocade_expire_automation_approval',
    'ocade_resume_automation_run',
    'ocade_decide_automation_run',
    'ocade_request_automation_cancel',
    'ocade_cancel_all_automation_runs',
    'ocade_recover_stale_automation_runs'
  )
ORDER BY p.proname;

-- 6) PUBLIC and anon have no function privileges. Expect public_exec=false and
-- anon_exec=false for every row; authenticated_exec=true.
SELECT
  p.proname,
  EXISTS (
    SELECT 1
    FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) acl
    WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'
  ) AS public_exec,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'ocade_enqueue_automation_run',
    'ocade_claim_automation_run',
    'ocade_heartbeat_automation_run',
    'ocade_append_automation_receipt',
    'ocade_complete_automation_run',
    'ocade_requeue_automation_run',
    'ocade_suspend_automation_run',
    'ocade_request_automation_pause',
    'ocade_expire_automation_approval',
    'ocade_resume_automation_run',
    'ocade_decide_automation_run',
    'ocade_request_automation_cancel',
    'ocade_cancel_all_automation_runs',
    'ocade_recover_stale_automation_runs'
  )
ORDER BY p.proname;

-- 7) Receipt constraints include verified-success and idempotency guards.
SELECT conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.ocade_automation_step_receipts'::regclass
ORDER BY conname;

-- 8) Cross-tenant receipt isolation (authenticated): expect 0.
-- SELECT count(*) FROM public.ocade_automation_step_receipts
-- WHERE user_id <> auth.uid();

-- 9) Behavioural proof (authenticated owner only). Replace both UUIDs, then
-- uncomment inside a disposable environment. The transaction always rolls back.
--
-- BEGIN;
-- SELECT * FROM public.ocade_claim_automation_run(
--   '<RUN_ID>'::uuid, 'verification-worker'
-- );
-- -- Copy the returned claim_token into <CLAIM_TOKEN>.
-- SELECT public.ocade_heartbeat_automation_run(
--   '<RUN_ID>'::uuid, '<CLAIM_TOKEN>'::uuid
-- ); -- expect true
-- SELECT public.ocade_append_automation_receipt(
--   '<RUN_ID>'::uuid, '<CLAIM_TOKEN>'::uuid, 0,
--   'execute', '<RUN_ID>:step:0', 'window.list', 'succeeded',
--   true, true, 'Verified disposable receipt', now(), now()
-- ); -- expect true
-- SELECT public.ocade_complete_automation_run(
--   '<RUN_ID>'::uuid, '<CLAIM_TOKEN>'::uuid,
--   'succeeded', NULL, now()
-- ); -- true only when every execution step has a verified receipt
-- ROLLBACK;

-- ---------------------------------------------------------------------------
-- SELF-CHECKING ASSERTIONS
--
-- The queries above are read by a human and always exit 0. This block RAISES on
-- any gap. The worker migration is mostly FUNCTIONS, so their absence is checked
-- explicitly: a missing routine would fail silently at run time instead.
-- ---------------------------------------------------------------------------
DO $verify$
DECLARE
  expected_routines text[] := ARRAY[
    'ocade_enqueue_automation_run',
    'ocade_claim_automation_run',
    'ocade_heartbeat_automation_run',
    'ocade_complete_automation_run',
    'ocade_requeue_automation_run',
    'ocade_recover_stale_automation_runs',
    'ocade_request_automation_cancel',
    'ocade_request_automation_pause',
    'ocade_resume_automation_run',
    'ocade_suspend_automation_run',
    'ocade_decide_automation_run',
    'ocade_expire_automation_approval',
    'ocade_cancel_all_automation_runs',
    'ocade_append_automation_receipt'
  ];
  gap text;
BEGIN
  IF to_regclass('public.ocade_automation_step_receipts') IS NULL THEN
    RAISE EXCEPTION 'Migration incomplete - missing table: ocade_automation_step_receipts';
  END IF;

  SELECT string_agg(r, ', ') INTO gap
  FROM unnest(expected_routines) AS r
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = r
  );
  IF gap IS NOT NULL THEN
    RAISE EXCEPTION 'Migration incomplete - missing function(s): %', gap;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'ocade_automation_step_receipts'
      AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'Row-level security is NOT enabled on ocade_automation_step_receipts';
  END IF;

  RAISE NOTICE 'VERIFIED: worker table, RLS and 14 routines present.';
END
$verify$;

-- Rollback for 20260721134240 (user_roles admin-write policies; feature_flags read swap).
-- Idempotent. Restores the original permissive feature_flags read policy.
BEGIN;
DROP POLICY IF EXISTS "user_roles_admin_insert" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_update" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_admin_delete" ON public.user_roles;
DROP POLICY IF EXISTS "feature_flags_enabled_read" ON public.feature_flags;
-- Restore the original policy this migration replaced.
DROP POLICY IF EXISTS "feature_flags_all_read" ON public.feature_flags;
CREATE POLICY "feature_flags_all_read" ON public.feature_flags FOR SELECT TO authenticated USING (true);
COMMIT;

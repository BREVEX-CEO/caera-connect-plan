-- Live-project hardening after reconciling every repository migration with the
-- positively identified OCADE Supabase project.
--
-- Keep browser-callable, ownership-bound RPCs in public.  Move RLS-only
-- SECURITY DEFINER helpers out of the exposed API schema, remove anonymous
-- default privileges, and make service-role-only webhook access explicit.

BEGIN;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- These helpers are implementation details of RLS policies. ALTER ... SET
-- SCHEMA preserves the policy dependency OIDs, so the policies keep working
-- while PostgREST no longer exposes the helpers as public RPCs.
ALTER FUNCTION public.is_tenant_owner_or_manager(UUID, UUID) SET SCHEMA private;
ALTER FUNCTION public.ficia_has_permission(UUID, UUID, TEXT) SET SCHEMA private;
ALTER FUNCTION public.msg_is_thread_member(UUID, UUID) SET SCHEMA private;
ALTER FUNCTION public.msg_is_thread_admin(UUID, UUID) SET SCHEMA private;
ALTER FUNCTION public.msg_thread_writable(UUID, UUID) SET SCHEMA private;
ALTER FUNCTION public.ocade_is_support_admin() SET SCHEMA private;

-- The writable helper calls the membership helper by name at execution time,
-- so point that call at its new non-exposed schema explicitly.
CREATE OR REPLACE FUNCTION private.msg_thread_writable(_thread_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private, pg_temp
AS $$
DECLARE
  t public.msg_threads%ROWTYPE;
BEGIN
  SELECT * INTO t FROM public.msg_threads WHERE id = _thread_id;
  IF NOT FOUND OR t.is_archived THEN RETURN false; END IF;
  IF NOT private.msg_is_thread_member(_thread_id, _user_id) THEN RETURN false; END IF;
  IF t.kind = 'cross_company' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.msg_cross_company_grants AS g
      WHERE g.thread_id = _thread_id AND g.status = 'active'
    );
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION private.is_tenant_owner_or_manager(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.ficia_has_permission(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.msg_is_thread_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.msg_is_thread_admin(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.msg_thread_writable(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.ocade_is_support_admin() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_tenant_owner_or_manager(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.ficia_has_permission(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.msg_is_thread_member(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.msg_is_thread_admin(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.msg_thread_writable(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.ocade_is_support_admin() TO authenticated, service_role;

-- pg_trgm is relocatable. Its existing GIN index depends on extension objects by
-- OID and remains valid when the extension leaves the exposed public schema.
DO $$
DECLARE
  extension_schema TEXT;
BEGIN
  SELECT n.nspname
  INTO extension_schema
  FROM pg_catalog.pg_extension AS e
  JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  IF extension_schema IS NOT NULL AND extension_schema <> 'extensions' THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END;
$$;

-- Trigger and event-trigger functions execute through their owning trigger;
-- browser roles never need direct EXECUTE permission.
DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
  IF pg_catalog.to_regprocedure('public.tombstone_deleted_attachment()') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.tombstone_deleted_attachment() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

-- This is the one intended browser RPC in this group. It derives ownership
-- exclusively from auth.uid(); anonymous callers must not reach it.
REVOKE ALL ON FUNCTION public.revoke_device_for_current_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_device_for_current_user(UUID) TO authenticated, service_role;

-- No repository flow uses anonymous database access. RLS was already denying
-- every anonymous row, but removing the underlying grants gives defense in
-- depth and prevents an accidentally permissive future policy from exposing
-- existing data.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;

-- Migrations run as postgres in this project. New public objects therefore
-- start closed to anonymous callers and functions no longer inherit PostgreSQL's
-- default PUBLIC EXECUTE privilege.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon;

-- payment_webhook_events is consumed only through a service-role RPC. The
-- restrictive policy documents and mechanically proves that browser roles have
-- no row path while service_role continues to bypass RLS as designed.
DROP POLICY IF EXISTS "No client access to payment webhook events"
  ON public.payment_webhook_events;
CREATE POLICY "No client access to payment webhook events"
  ON public.payment_webhook_events
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;

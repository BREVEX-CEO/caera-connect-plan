-- Assert that browser-inaccessible helpers and pg_trgm left the exposed public
-- schema and that the payment webhook table retains its client-deny policy.
DO $$
DECLARE
  private_helpers INTEGER;
  webhook_policy_ok BOOLEAN;
BEGIN
  SELECT count(*)
  INTO private_helpers
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  WHERE n.nspname = 'private'
    AND p.proname IN (
      'is_tenant_owner_or_manager',
      'ficia_has_permission',
      'msg_is_thread_member',
      'msg_is_thread_admin',
      'msg_thread_writable',
      'ocade_is_support_admin'
    );

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'payment_webhook_events'
      AND policyname = 'No client access to payment webhook events'
      AND permissive = 'RESTRICTIVE'
  ) INTO webhook_policy_ok;

  IF private_helpers <> 6
    OR NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_extension AS e
      JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
      WHERE e.extname = 'pg_trgm' AND n.nspname = 'extensions'
    )
    OR NOT webhook_policy_ok
  THEN
    RAISE EXCEPTION 'Live Supabase security hardening verification failed.';
  END IF;
END;
$$;

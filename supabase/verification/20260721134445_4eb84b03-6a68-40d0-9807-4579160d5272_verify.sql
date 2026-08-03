-- Verify 20260721134445: authenticated must NOT hold INSERT on compliance_audit_log.
DO $$
BEGIN
  IF to_regclass('public.compliance_audit_log') IS NOT NULL
     AND has_table_privilege('authenticated', 'public.compliance_audit_log', 'INSERT') THEN
    RAISE EXCEPTION 'compliance_audit_log INSERT still granted to authenticated — hardening lost';
  END IF;
  RAISE NOTICE 'verify 20260721134445 OK (compliance_audit_log direct writes locked down)';
END $$;

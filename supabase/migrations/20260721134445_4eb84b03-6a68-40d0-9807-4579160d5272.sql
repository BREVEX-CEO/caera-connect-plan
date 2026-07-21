-- Lock down direct compliance log inserts. Clients must go through the
-- server function which uses supabaseAdmin after validating the caller.
DROP POLICY IF EXISTS audit_log_self_insert ON public.compliance_audit_log;
REVOKE INSERT, UPDATE, DELETE ON public.compliance_audit_log FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.compliance_audit_log FROM anon;
-- Undo: the broad admin role reads these tables again.
BEGIN;
DROP POLICY IF EXISTS ocade_commercial_usage_read ON public.ocade_commercial_usage;
CREATE POLICY ocade_commercial_usage_read ON public.ocade_commercial_usage FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
DROP POLICY IF EXISTS ocade_consolidated_select ON public.profiles;
CREATE POLICY ocade_consolidated_select ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
DROP POLICY IF EXISTS ocade_consolidated_select ON public.user_roles;
CREATE POLICY ocade_consolidated_select ON public.user_roles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
DROP POLICY IF EXISTS audit_log_self_select ON public.compliance_audit_log;
CREATE POLICY audit_log_self_select ON public.compliance_audit_log FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
COMMIT;

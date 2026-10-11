-- A staff read straight at the database follows the same granular rights as the console
-- (PLAN P05, audit C18). These four read policies let in anyone with the broad "admin"
-- role, so a staff member whose Owner denied, say, usage.read could still read every
-- customer's usage through the Data API. Each now asks for the one permission it serves.
-- What a person may read of their own rows is unchanged.
BEGIN;

DROP POLICY IF EXISTS ocade_commercial_usage_read ON public.ocade_commercial_usage;
CREATE POLICY ocade_commercial_usage_read
  ON public.ocade_commercial_usage FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.ocade_staff_can('usage.read')));

DROP POLICY IF EXISTS ocade_consolidated_select ON public.profiles;
CREATE POLICY ocade_consolidated_select
  ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id OR (SELECT public.ocade_staff_can('customers.read')));

DROP POLICY IF EXISTS ocade_consolidated_select ON public.user_roles;
CREATE POLICY ocade_consolidated_select
  ON public.user_roles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.ocade_staff_can('staff.manage')));

DROP POLICY IF EXISTS audit_log_self_select ON public.compliance_audit_log;
CREATE POLICY audit_log_self_select
  ON public.compliance_audit_log FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id OR (SELECT public.ocade_staff_can('audit.read')));

COMMIT;

-- Reverses 20260910110000_one_read_policy_per_role.sql.
--
-- Restores the split policies exactly as they were, including `own_usage_read`
-- without a `TO` clause, so the rollback reproduces the prior state rather than
-- a tidier version of it.

BEGIN;

ALTER FUNCTION public.ocade_recent_proof_window() RESET search_path;

DROP POLICY IF EXISTS ocade_commercial_usage_read ON public.ocade_commercial_usage;
CREATE POLICY admin_usage_read
  ON public.ocade_commercial_usage FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY own_usage_read
  ON public.ocade_commercial_usage FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS ocade_organization_events_read ON public.ocade_organization_events;
CREATE POLICY ocade_organization_events_admin_platform_read
  ON public.ocade_organization_events FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY ocade_organization_events_admin_read
  ON public.ocade_organization_events FOR SELECT TO authenticated
  USING (public.ocade_org_can_administer(organization_id));

DROP POLICY IF EXISTS ocade_organizations_read ON public.ocade_organizations;
CREATE POLICY ocade_organizations_admin_platform_read
  ON public.ocade_organizations FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY ocade_organizations_member_read
  ON public.ocade_organizations FOR SELECT TO authenticated
  USING (public.ocade_org_role(id) IS NOT NULL);

DROP POLICY IF EXISTS ocade_support_articles_read ON public.ocade_support_articles;
DROP POLICY IF EXISTS ocade_support_articles_public_read ON public.ocade_support_articles;
CREATE POLICY ocade_support_articles_admin_read
  ON public.ocade_support_articles FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'::public.app_role));
CREATE POLICY ocade_support_articles_public_read
  ON public.ocade_support_articles FOR SELECT TO anon, authenticated
  USING (status = 'published');

COMMIT;

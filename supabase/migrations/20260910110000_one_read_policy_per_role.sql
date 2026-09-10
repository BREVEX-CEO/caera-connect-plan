-- One read policy per role, and a pinned search path on the proof window.
--
-- Both come from the live advisors, and both are cheap to get wrong later.
--
-- MULTIPLE PERMISSIVE POLICIES ARE NOT FREE. Four tables carried two permissive
-- SELECT policies for the same role: an owner/member rule and an administrator
-- rule. Postgres evaluates EVERY permissive policy for every candidate row and
-- ORs the results, so each read ran both — including `has_role`, a function
-- call, against rows the first rule had already admitted. The access these
-- tables grant is unchanged below; it is expressed once instead of twice.
--
-- `own_usage_read` ALSO NAMED THE WRONG ROLE. It was written without a `TO`
-- clause, which means `public` — every role, `anon` included. The predicate
-- saved it, because a signed-out reader has no `auth.uid()` and matched nothing,
-- so this was a latent shape rather than a leak: the one rule standing between
-- an anonymous reader and everybody's usage history was a comparison against
-- NULL. Commercial usage is read by signed-in accounts, so it says so.
--
-- SUPPORT ARTICLES KEEP TWO POLICIES, DELIBERATELY. A published article is
-- readable signed out, and `anon` does not hold EXECUTE on `has_role` — merging
-- the administrator rule into the anonymous one would make every signed-out read
-- of the help centre fail with a permission error rather than return the
-- article. The signed-out rule stays exactly as narrow as it was; only the
-- signed-in pair is merged.
--
-- THE SEARCH PATH. `ocade_recent_proof_window` returns a constant interval and
-- is SECURITY INVOKER, so nothing it does today depends on resolution order.
-- Pinning it costs nothing and means the answer cannot start depending on the
-- caller's `search_path` the first time somebody adds a table reference to it.

BEGIN;

ALTER FUNCTION public.ocade_recent_proof_window() SET search_path = '';

DROP POLICY IF EXISTS admin_usage_read ON public.ocade_commercial_usage;
DROP POLICY IF EXISTS own_usage_read ON public.ocade_commercial_usage;
CREATE POLICY ocade_commercial_usage_read
  ON public.ocade_commercial_usage FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS ocade_organization_events_admin_platform_read
  ON public.ocade_organization_events;
DROP POLICY IF EXISTS ocade_organization_events_admin_read
  ON public.ocade_organization_events;
CREATE POLICY ocade_organization_events_read
  ON public.ocade_organization_events FOR SELECT TO authenticated
  USING (
    public.ocade_org_can_administer(organization_id)
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS ocade_organizations_admin_platform_read ON public.ocade_organizations;
DROP POLICY IF EXISTS ocade_organizations_member_read ON public.ocade_organizations;
CREATE POLICY ocade_organizations_read
  ON public.ocade_organizations FOR SELECT TO authenticated
  USING (
    public.ocade_org_role(id) IS NOT NULL
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS ocade_support_articles_admin_read ON public.ocade_support_articles;
DROP POLICY IF EXISTS ocade_support_articles_public_read ON public.ocade_support_articles;
CREATE POLICY ocade_support_articles_public_read
  ON public.ocade_support_articles FOR SELECT TO anon
  USING (status = 'published');
CREATE POLICY ocade_support_articles_read
  ON public.ocade_support_articles FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR public.has_role((SELECT auth.uid()), 'admin'::public.app_role)
  );

COMMIT;

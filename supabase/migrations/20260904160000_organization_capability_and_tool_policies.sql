/*
 * WHAT A WORKSPACE ALLOWS ITS MEMBERS TO USE — PLAN.md §21 and §G.
 *
 * §21 asks for "capability policy" and "connector tool permissions"; §G asks
 * the admin panel to manage them. This is where they live.
 *
 * ONE ROW PER ORGANIZATION, HOLDING ONLY WHAT IS TAKEN AWAY. A row listing
 * everything permitted would have to be rewritten every time the product grows
 * a capability, and the day somebody forgot, an existing workspace would
 * silently lose a feature it had never decided anything about. Storing the
 * WITHHELD set means a new capability arrives allowed, which is the only
 * direction that cannot break a workspace by omission.
 *
 * IT IS A CEILING, NOT A GRANT. Nothing here turns anything on. Every
 * capability an organization allows is still subject to the checks that already
 * govern it — the device probe, the permission prompt, the risk band, the
 * protected-input rule that no policy may lower. That is what keeps this from
 * becoming a second authority over capabilities that already have one.
 *
 * THE VOCABULARIES ARE CHECKED, AND THEY ARE THE PRODUCT'S OWN. The CHECK
 * constraints list exactly the capability ids the product reports on and the
 * tool domains the agent router groups by. An unknown string is refused at
 * write time rather than stored and silently ignored — a policy that appears to
 * forbid something it does not is worse than no policy, because somebody is
 * relying on it.
 *
 * `conversation` is deliberately not a withholdable domain. It is the one that
 * touches no machine — talking, and what OCADE remembers between sessions — and
 * a workspace that withheld it would leave its members with a product that
 * cannot answer them.
 *
 * WHO MAY READ IT: every member of the organization. A person whose product is
 * missing a feature is owed the reason, and hiding the policy from the people
 * it governs turns an administrative decision into a bug report.
 *
 * WHO MAY WRITE IT: owners and admins, through the RPC only, with recent strong
 * authentication — §B names connector administration among the high-risk
 * actions — and every change is recorded in the organization's audit log.
 */

CREATE TABLE IF NOT EXISTS public.ocade_organization_policies (
  organization_id uuid PRIMARY KEY
    REFERENCES public.ocade_organizations(id) ON DELETE CASCADE,
  withheld_capabilities text[] NOT NULL DEFAULT '{}',
  withheld_tool_domains text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT ocade_organization_policies_capabilities CHECK (
    withheld_capabilities <@ ARRAY[
      'localAI', 'privateSync', 'browser', 'computerControl', 'codeTerminal',
      'voice', 'vision', 'automationRunner', 'monitors', 'payments',
      'desktopInstaller'
    ]::text[]
  ),
  CONSTRAINT ocade_organization_policies_tool_domains CHECK (
    withheld_tool_domains <@ ARRAY[
      'os_app', 'files', 'content', 'web', 'connectors', 'cross_device'
    ]::text[]
  )
);

ALTER TABLE public.ocade_organization_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ocade_organization_policies_member_read
  ON public.ocade_organization_policies;
CREATE POLICY ocade_organization_policies_member_read
  ON public.ocade_organization_policies FOR SELECT TO authenticated
  USING (public.ocade_org_role(organization_id) IS NOT NULL);

/*
 * SELECT ONLY, AND ONLY THROUGH A POLICY.
 *
 * Supabase's default privileges grant ALL on a new table directly to
 * `authenticated`, and a grant made directly to a role is not removed by
 * revoking from PUBLIC. Without these two lines a member could write their own
 * organization's policy — or rather, could try: RLS has no INSERT or UPDATE
 * policy here, so the write would be refused. Both are stated anyway, because
 * a table protected by only one of the two is a table one forgotten policy away
 * from being open.
 */
REVOKE ALL ON TABLE public.ocade_organization_policies FROM anon, authenticated;
GRANT SELECT ON TABLE public.ocade_organization_policies TO authenticated;

/**
 * Replace an organization's policy.
 *
 * Whole-set replacement rather than add and remove: two administrators editing
 * the same policy with incremental operations produce a result neither of them
 * chose, and the screen has the whole set in front of it anyway.
 *
 * The audit row records BOTH sides. "computerControl was withheld" is the fact
 * somebody will need months later, and a row holding only the new state cannot
 * answer it.
 */
CREATE OR REPLACE FUNCTION public.ocade_set_organization_policy(
  p_organization_id uuid,
  p_withheld_capabilities text[],
  p_withheld_tool_domains text[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  previous public.ocade_organization_policies;
  capabilities text[] := COALESCE(p_withheld_capabilities, '{}');
  domains text[] := COALESCE(p_withheld_tool_domains, '{}');
BEGIN
  IF NOT public.ocade_org_can_administer(p_organization_id) THEN
    RAISE EXCEPTION 'Only an owner or admin may change what this organization allows.';
  END IF;

  SELECT * INTO previous
    FROM public.ocade_organization_policies
   WHERE organization_id = p_organization_id
   FOR UPDATE;

  -- Nothing to record and nothing to prove: an administrator pressing Save on
  -- an unchanged form should not be asked to answer a factor challenge.
  IF previous.organization_id IS NOT NULL
     AND previous.withheld_capabilities @> capabilities
     AND previous.withheld_capabilities <@ capabilities
     AND previous.withheld_tool_domains @> domains
     AND previous.withheld_tool_domains <@ domains THEN
    RETURN 0;
  END IF;

  PERFORM public.ocade_require_recent_strong_auth('changing what this organization allows');

  INSERT INTO public.ocade_organization_policies AS existing (
    organization_id, withheld_capabilities, withheld_tool_domains, updated_at, updated_by
  )
  VALUES (p_organization_id, capabilities, domains, now(), auth.uid())
  ON CONFLICT (organization_id) DO UPDATE
    SET withheld_capabilities = EXCLUDED.withheld_capabilities,
        withheld_tool_domains = EXCLUDED.withheld_tool_domains,
        updated_at = now(),
        updated_by = auth.uid();

  PERFORM public.ocade_record_organization_event(
    p_organization_id, 'policy.changed', NULL,
    jsonb_build_object(
      'from', jsonb_build_object(
        'capabilities', to_jsonb(COALESCE(previous.withheld_capabilities, '{}'::text[])),
        'tool_domains', to_jsonb(COALESCE(previous.withheld_tool_domains, '{}'::text[]))
      ),
      'to', jsonb_build_object(
        'capabilities', to_jsonb(capabilities),
        'tool_domains', to_jsonb(domains)
      )
    )
  );
  RETURN 1;
END;
$$;

/*
 * The audit log's event vocabulary is a closed set on purpose — free text drifts
 * into six spellings of the same event — so a new kind of event has to be added
 * to it deliberately, which is this.
 */
ALTER TABLE public.ocade_organization_events
  DROP CONSTRAINT IF EXISTS ocade_organization_events_event;
ALTER TABLE public.ocade_organization_events
  ADD CONSTRAINT ocade_organization_events_event CHECK (
    event IN (
      'organization.created',
      'organization.renamed',
      'organization.deleted',
      'invite.sent',
      'invite.resent',
      'invite.accepted',
      'invite.revoked',
      'member.role_changed',
      'member.deactivated',
      'member.reactivated',
      'member.removed',
      'ownership.transferred',
      'group.created',
      'group.deleted',
      'group.member_added',
      'group.member_removed',
      'policy.changed'
    )
  );

REVOKE ALL ON FUNCTION public.ocade_set_organization_policy(uuid, text[], text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ocade_set_organization_policy(uuid, text[], text[])
  TO authenticated;

-- Proves the retired products are gone, and that what remains still works.
--
-- Two halves, because removal is only half the claim. A migration that drops
-- seventy tables has obviously removed something; what it must also not have
-- done is break the product that stays — and the way that happens is a policy
-- or a constraint disappearing in a cascade, silently, on a table nobody
-- dropped. That is exactly what happened here to `ocade_conversations`, and the
-- second half below is what catches it next time.
DO $$
DECLARE
  gone TEXT[] := ARRAY[
    'public.access_requests',
    'public.cania_alert_prefs',
    'public.cania_saved_topics',
    'public.cania_settings',
    'public.company_obligations',
    'public.compliance_events',
    'public.country_pack_versions',
    'public.country_packs',
    'public.feature_flags',
    'public.ficia_approval_decisions',
    'public.ficia_approval_policies',
    'public.ficia_approval_requests',
    'public.ficia_custom_roles',
    'public.ficia_departments',
    'public.ficia_employments',
    'public.ficia_locations',
    'public.ficia_role_grants',
    'public.ficia_teams',
    'public.historical_test_cases',
    'public.launch_gate_history',
    'public.launch_gate_items',
    'public.madee_resume_projects',
    'public.madee_resume_versions',
    'public.msg_attachments',
    'public.msg_cross_company_grants',
    'public.msg_message_edits',
    'public.msg_message_links',
    'public.msg_messages',
    'public.msg_pins',
    'public.msg_reactions',
    'public.msg_read_receipts',
    'public.msg_thread_members',
    'public.msg_threads',
    'public.ocade_approvals',
    'public.ocade_automation_runs',
    'public.ocade_automation_step_receipts',
    'public.ocade_automations',
    'public.ocade_browser_site_policy',
    'public.ocade_conversation_shares',
    'public.ocade_memory',
    'public.ocade_monitors',
    'public.ocade_organization_events',
    'public.ocade_organization_group_members',
    'public.ocade_organization_groups',
    'public.ocade_organization_invites',
    'public.ocade_organization_members',
    'public.ocade_organization_policies',
    'public.ocade_organizations',
    'public.ocade_project_files',
    'public.ocade_project_folders',
    'public.ocade_project_items',
    'public.ocade_projects',
    'public.ocade_provider_events',
    'public.ocade_provider_prefs',
    'public.ocade_retired_subscriptions',
    'public.ocade_status_incident_updates',
    'public.ocade_status_incidents',
    'public.ocade_support_access_events',
    'public.ocade_support_article_revisions',
    'public.ocade_support_articles',
    'public.ocade_support_grants',
    'public.ocade_support_messages',
    'public.ocade_support_tickets',
    'public.ocade_task_comments',
    'public.ocade_tasks',
    'public.pack_reviews',
    'public.rule_sources',
    'public.tenant_members',
    'public.tenants',
    'public.vault_config',
    'public.tenants'
  ];
  name TEXT;
  owner UUID := '00000000-0000-4000-8000-00000000d001';
  visible INT;
  policies INT;
BEGIN
  -- HALF ONE: every retired table is gone from the catalogue.
  FOREACH name IN ARRAY gone LOOP
    IF to_regclass(name) IS NOT NULL THEN
      RAISE EXCEPTION 'a retired product table is still present: %', name;
    END IF;
  END LOOP;

  -- And no function is left holding a reference to one of them.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname IN ('public', 'private')
       AND p.prosrc ~ '\\m(ocade_tasks|ocade_projects|ocade_organizations|ocade_automations|ocade_support_tickets|msg_messages|ficia_employments|cania_settings|madee_resume_projects|tenants)\\M'
  ) THEN
    RAISE EXCEPTION 'a function still reads a table that no longer exists';
  END IF;

  -- And the messenger bucket went with its tables.
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'messenger') THEN
    RAISE EXCEPTION 'the messenger bucket outlived the product that used it';
  END IF;

  -- HALF TWO: the product that stays still works. A table with row-level
  -- security enabled and no policy is unreadable by everybody, which is how a
  -- cascade turns a cleanup into an outage.
  SELECT count(*) INTO policies FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'ocade_conversations';
  IF policies = 0 THEN
    RAISE EXCEPTION 'conversations have row-level security and no policy: nobody can read their own';
  END IF;

  INSERT INTO auth.users (id, email) VALUES (owner, 'reduction@verification.test')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ocade_conversations (user_id, title) VALUES (owner, 'After the reduction');

  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claim.sub', owner::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', owner, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO visible FROM public.ocade_conversations;
  RESET ROLE;
  IF visible <> 1 THEN
    RAISE EXCEPTION 'an account can see % of its own conversations after the reduction', visible;
  END IF;

  RAISE NOTICE 'reduction verified: retired objects gone, conversations still readable';
  RAISE EXCEPTION 'rollback verification fixture';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'rollback verification fixture' THEN RAISE; END IF;
END $$;

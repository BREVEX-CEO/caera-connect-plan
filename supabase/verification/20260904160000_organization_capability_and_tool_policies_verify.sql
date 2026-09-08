-- Verification for 20260904160000_organization_capability_and_tool_policies.

DO $$
BEGIN
  IF to_regclass('public.ocade_organization_policies') IS NULL THEN
    RAISE EXCEPTION 'the organization policy table is missing';
  END IF;
  IF NOT (
    SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ocade_organization_policies'::regclass
  ) THEN
    RAISE EXCEPTION 'row-level security is off on ocade_organization_policies';
  END IF;
END $$;

-- Readable by members, writable by nobody directly. Both halves matter: a table
-- with no write policy but a lingering default-privilege grant is one forgotten
-- policy away from being open.
DO $$
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.ocade_organization_policies', 'SELECT') THEN
    RAISE EXCEPTION 'members cannot read the policy that governs them';
  END IF;
  FOR i IN 1..1 LOOP
    IF has_table_privilege('authenticated', 'public.ocade_organization_policies', 'INSERT')
       OR has_table_privilege('authenticated', 'public.ocade_organization_policies', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.ocade_organization_policies', 'DELETE') THEN
      RAISE EXCEPTION 'a member holds a direct write grant on the policy table';
    END IF;
  END LOOP;
  IF has_table_privilege('anon', 'public.ocade_organization_policies', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read organization policies';
  END IF;
END $$;

-- The vocabularies are enforced by the database, not only by the screen.
DO $$
DECLARE
  refused boolean := false;
  organization uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ocade_organization_policies'::regclass
       AND conname = 'ocade_organization_policies_capabilities'
  ) THEN
    RAISE EXCEPTION 'nothing checks which capabilities may be withheld';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.ocade_organization_policies'::regclass
       AND conname = 'ocade_organization_policies_tool_domains'
  ) THEN
    RAISE EXCEPTION 'nothing checks which tool areas may be withheld';
  END IF;

  -- A fixed slug, removed at the end of this block. The column is capped at
  -- forty characters, so a uuid suffix does not fit.
  DELETE FROM public.ocade_organizations WHERE slug = 'policy-verification';
  INSERT INTO public.ocade_organizations (name, slug)
  VALUES ('Policy verification', 'policy-verification')
  RETURNING id INTO organization;

  BEGIN
    INSERT INTO public.ocade_organization_policies (organization_id, withheld_capabilities)
    VALUES (organization, ARRAY['not_a_capability']);
  EXCEPTION WHEN check_violation THEN
    refused := true;
  END;
  IF NOT refused THEN
    RAISE EXCEPTION 'an unknown capability was accepted into a policy';
  END IF;

  refused := false;
  BEGIN
    INSERT INTO public.ocade_organization_policies (organization_id, withheld_tool_domains)
    VALUES (organization, ARRAY['conversation']);
  EXCEPTION WHEN check_violation THEN
    refused := true;
  END;
  IF NOT refused THEN
    RAISE EXCEPTION 'the conversation domain was accepted as withholdable';
  END IF;

  DELETE FROM public.ocade_organizations WHERE id = organization;
END $$;

-- The writer exists, is reachable by a browser, and demands recent proof.
DO $$
DECLARE
  body text;
BEGIN
  IF to_regprocedure('public.ocade_set_organization_policy(uuid, text[], text[])') IS NULL THEN
    RAISE EXCEPTION 'the policy writer is missing';
  END IF;
  IF NOT has_function_privilege(
       'authenticated', 'public.ocade_set_organization_policy(uuid, text[], text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'an administrator cannot call the policy writer';
  END IF;
  IF has_function_privilege(
       'anon', 'public.ocade_set_organization_policy(uuid, text[], text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can call the policy writer';
  END IF;

  SELECT prosrc INTO body FROM pg_proc
   WHERE oid = to_regprocedure('public.ocade_set_organization_policy(uuid, text[], text[])');
  IF body NOT LIKE '%ocade_require_recent_strong_auth%' THEN
    RAISE EXCEPTION 'changing what an organization allows does not require recent proof';
  END IF;
  IF body NOT LIKE '%ocade_record_organization_event%' THEN
    RAISE EXCEPTION 'a policy change leaves no audit row';
  END IF;
END $$;

-- The audit vocabulary admits the new event, or every policy change would fail
-- at its last step with a constraint violation.
DO $$
DECLARE
  definition text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition
    FROM pg_constraint
   WHERE conrelid = 'public.ocade_organization_events'::regclass
     AND conname = 'ocade_organization_events_event';
  IF definition IS NULL OR definition NOT LIKE '%policy.changed%' THEN
    RAISE EXCEPTION 'the audit log does not admit policy.changed';
  END IF;
END $$;

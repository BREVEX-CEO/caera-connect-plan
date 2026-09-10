-- Verifies 20260910110000_one_read_policy_per_role.sql.

DO $$
DECLARE
  target text;
  policy_count integer;
  anon_reads_articles boolean;
BEGIN
  -- One permissive SELECT policy per role means one policy naming `authenticated`.
  FOREACH target IN ARRAY ARRAY[
    'ocade_commercial_usage', 'ocade_organization_events',
    'ocade_organizations', 'ocade_support_articles'
  ] LOOP
    SELECT count(*) INTO policy_count
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = target
       AND cmd = 'SELECT' AND permissive = 'PERMISSIVE'
       AND 'authenticated' = ANY (roles);
    IF policy_count <> 1 THEN
      RAISE EXCEPTION
        '% has % permissive SELECT policies for authenticated; every read runs all of them',
        target, policy_count;
    END IF;

    SELECT count(*) INTO policy_count
      FROM pg_policies
     WHERE schemaname = 'public' AND tablename = target
       AND cmd = 'SELECT' AND 'public' = ANY (roles);
    IF policy_count <> 0 THEN
      RAISE EXCEPTION
        '% still has a SELECT policy naming the public role, so it is evaluated for every role including anon',
        target;
    END IF;
  END LOOP;

  -- A published support article must still be readable signed out.
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ocade_support_articles'
       AND cmd = 'SELECT' AND 'anon' = ANY (roles)
  ) INTO anon_reads_articles;
  IF NOT anon_reads_articles THEN
    RAISE EXCEPTION 'no anon SELECT policy on ocade_support_articles, so the signed-out help centre is empty';
  END IF;

  -- anon holds no EXECUTE on has_role, so an anon policy that calls it would
  -- fail the read rather than refuse it.
  IF EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ocade_support_articles'
       AND cmd = 'SELECT' AND 'anon' = ANY (roles)
       AND qual LIKE '%has_role%'
  ) THEN
    RAISE EXCEPTION 'the anon policy on ocade_support_articles calls has_role, which anon cannot execute';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE pronamespace = 'public'::regnamespace
       AND proname = 'ocade_recent_proof_window'
       AND proconfig IS NOT NULL
       AND EXISTS (SELECT 1 FROM unnest(proconfig) c WHERE c LIKE 'search_path=%')
  ) THEN
    RAISE EXCEPTION 'ocade_recent_proof_window still resolves names through the caller search_path';
  END IF;
END $$;

-- A table with RLS on and NO policy is closed, which is the intended shape for
-- the service-role-only usage tables. That is only true while nothing has also
-- granted a table privilege to `anon` or `authenticated`: a grant plus a missing
-- policy is one defence where there should be two, and a policy added later for
-- an unrelated reason would open the table without anybody deciding to.
DO $$
DECLARE
  offender text;
BEGIN
  SELECT string_agg(format('%s (%s)', t.relname, roles.role), ', ' ORDER BY t.relname)
    INTO offender
    FROM pg_class t
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS roles(role)
   WHERE t.relnamespace = 'public'::regnamespace
     AND t.relkind = 'r'
     AND t.relrowsecurity
     AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = t.oid)
     AND (
       has_table_privilege(roles.role, t.oid, 'SELECT')
       OR has_table_privilege(roles.role, t.oid, 'INSERT')
       OR has_table_privilege(roles.role, t.oid, 'UPDATE')
       OR has_table_privilege(roles.role, t.oid, 'DELETE')
     );

  IF offender IS NOT NULL THEN
    RAISE EXCEPTION
      'these tables have RLS enabled and no policy, yet still grant table privileges: %',
      offender;
  END IF;
END $$;

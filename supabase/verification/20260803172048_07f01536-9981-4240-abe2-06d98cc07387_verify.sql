-- Verify the hardened cross-company grant policy and messenger realtime setup.
DO $$
DECLARE
  policy_check text;
  realtime_table_count integer;
  full_replica_count integer;
BEGIN
  SELECT with_check
  INTO policy_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'msg_cross_company_grants'
    AND policyname = 'grants_update';

  IF policy_check IS NULL THEN
    RAISE EXCEPTION 'grants_update policy is missing';
  END IF;

  IF policy_check = 'true'
     OR policy_check NOT ILIKE '%has_tenant_role%' THEN
    RAISE EXCEPTION 'grants_update WITH CHECK is not securely restricted';
  END IF;

  /*
   * GUARDED THE SAME WAY THE MIGRATION IS.
   *
   * `supabase_realtime` is created by the Supabase platform's bootstrap, not by
   * any migration here. The migration already skips its `ALTER PUBLICATION`
   * when the publication is absent — that was defect DB-02 — but this check did
   * not, so on any non-Supabase PostgreSQL it failed on a condition the
   * migration had deliberately declined to create. A bare rebuild, a staging
   * box and the PGlite twin all hit it.
   *
   * A verification that contradicts its own migration is worse than none: it
   * teaches whoever runs it that a red result is normal and can be ignored,
   * which is exactly how a real failure gets waved through.
   */
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RAISE NOTICE
      'supabase_realtime is absent, so realtime membership is not checked here. This is expected on any PostgreSQL that is not a hosted Supabase project; the migration skips the same step.';
    RETURN;
  END IF;

  SELECT count(*)
  INTO realtime_table_count
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename IN ('msg_messages', 'msg_threads');

  IF realtime_table_count <> 2 THEN
    RAISE EXCEPTION
      'Expected both messenger tables in realtime publication, found %',
      realtime_table_count;
  END IF;

  SELECT count(*)
  INTO full_replica_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('msg_messages', 'msg_threads')
    AND c.relreplident = 'f';

  IF full_replica_count <> 2 THEN
    RAISE EXCEPTION
      'Expected REPLICA IDENTITY FULL on both messenger tables, found %',
      full_replica_count;
  END IF;

  RAISE NOTICE
    'verify 20260803172048 messenger security and realtime setup OK';
END;
$$;
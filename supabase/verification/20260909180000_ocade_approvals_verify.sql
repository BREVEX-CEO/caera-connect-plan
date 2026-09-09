-- Verifies 20260909180000_ocade_approvals.sql.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ocade_approvals'
  ) THEN
    RAISE EXCEPTION 'ocade_approvals is missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_class
    WHERE relname = 'ocade_approvals' AND relnamespace = 'public'::regnamespace AND relrowsecurity
  ) THEN
    RAISE EXCEPTION 'ocade_approvals does not have row-level security enabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ocade_approvals'
  ) THEN
    RAISE EXCEPTION 'ocade_approvals has row-level security and no policy, so it is unreadable';
  END IF;

  -- The whole point of the function: a decision is one statement, so two phones
  -- answering together cannot both believe they decided it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'ocade_decide_approval' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'ocade_decide_approval is missing or is not SECURITY DEFINER';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('ocade_decide_approval', 'ocade_expire_due_approvals')
      AND (p.proconfig IS NULL OR NOT p.proconfig::text LIKE '%search_path%')
  ) THEN
    RAISE EXCEPTION 'an approval function runs without a pinned search_path';
  END IF;

  IF has_function_privilege('anon', 'public.ocade_decide_approval(uuid, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon may decide approvals';
  END IF;
END $$;

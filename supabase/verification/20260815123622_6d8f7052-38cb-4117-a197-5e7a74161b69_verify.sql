-- Verify the idempotent automation-worker lifecycle replay.
DO $$
DECLARE
  required_function_count integer;
BEGIN
  IF to_regclass('public.ocade_automation_step_receipts') IS NULL THEN
    RAISE EXCEPTION 'Automation step receipts table is missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('ocade_automation_runs', 'ocade_automation_step_receipts')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'An automation worker table is missing RLS';
  END IF;

  SELECT count(*) INTO required_function_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'ocade_enqueue_automation_run',
      'ocade_claim_automation_run',
      'ocade_heartbeat_automation_run',
      'ocade_append_automation_receipt',
      'ocade_complete_automation_run',
      'ocade_recover_stale_automation_runs'
    );

  IF required_function_count <> 6 THEN
    RAISE EXCEPTION 'Expected 6 automation worker RPCs, found %', required_function_count;
  END IF;
END;
$$;

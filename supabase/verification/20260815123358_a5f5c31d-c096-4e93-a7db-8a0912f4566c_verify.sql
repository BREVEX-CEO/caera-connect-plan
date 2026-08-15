-- Verify the idempotent automation schema replay.
DO $$
BEGIN
  IF to_regclass('public.ocade_automations') IS NULL
     OR to_regclass('public.ocade_automation_runs') IS NULL THEN
    RAISE EXCEPTION 'OCADE automation tables are missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('ocade_automations', 'ocade_automation_runs')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'An OCADE automation table is missing RLS';
  END IF;

  IF to_regclass('public.ocade_automation_runs_one_in_flight_idx') IS NULL THEN
    RAISE EXCEPTION 'Automation one-in-flight guard is missing';
  END IF;
END;
$$;

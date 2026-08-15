-- Verify the idempotent projects, outputs and opt-in memory replay.
DO $$
BEGIN
  IF to_regclass('public.ocade_projects') IS NULL
     OR to_regclass('public.ocade_project_items') IS NULL
     OR to_regclass('public.ocade_outputs') IS NULL
     OR to_regclass('public.ocade_memory') IS NULL THEN
    RAISE EXCEPTION 'OCADE projects, outputs or memory tables are missing';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('ocade_projects', 'ocade_project_items', 'ocade_outputs', 'ocade_memory')
      AND NOT c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'An OCADE projects/output/memory table is missing RLS';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings'
      AND column_name = 'ocade_memory_enabled'
  ) THEN
    RAISE EXCEPTION 'user_settings.ocade_memory_enabled is missing';
  END IF;
END;
$$;

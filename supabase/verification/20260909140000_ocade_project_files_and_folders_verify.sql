-- Verifies 20260909140000_ocade_project_files_and_folders.sql.

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['ocade_project_files', 'ocade_project_folders'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = target
    ) THEN
      RAISE EXCEPTION '% is missing', target;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_class
      WHERE relname = target AND relnamespace = 'public'::regnamespace AND relrowsecurity
    ) THEN
      RAISE EXCEPTION '% does not have row-level security enabled', target;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = target) THEN
      RAISE EXCEPTION '% has row-level security and no policy, so it is unreadable', target;
    END IF;
  END LOOP;
END $$;

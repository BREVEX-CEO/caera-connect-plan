-- Verification for 20260721144246 (MADEE resume).
DO $$
BEGIN
  IF to_regclass('public.madee_resume_projects') IS NULL THEN RAISE EXCEPTION 'missing table madee_resume_projects'; END IF;
  IF to_regclass('public.madee_resume_versions') IS NULL THEN RAISE EXCEPTION 'missing table madee_resume_versions'; END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN ('madee_resume_projects','madee_resume_versions') AND c.relrowsecurity=false)
    THEN RAISE EXCEPTION 'RLS not enabled on madee resume tables'; END IF;
  PERFORM 1 FROM pg_proc WHERE proname='set_resume_version_number'; IF NOT FOUND THEN RAISE EXCEPTION 'missing function set_resume_version_number'; END IF;
  PERFORM 1 FROM pg_proc WHERE proname='enforce_resume_attestation'; IF NOT FOUND THEN RAISE EXCEPTION 'missing function enforce_resume_attestation'; END IF;
  RAISE NOTICE 'verify 20260721144246 OK';
END $$;

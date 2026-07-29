-- Verification for 20260721150351 (access requests + company functions + tenant unique indexes).
DO $$
BEGIN
  IF to_regclass('public.access_requests') IS NULL THEN RAISE EXCEPTION 'missing table access_requests'; END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname='public' AND c.relname='access_requests') THEN RAISE EXCEPTION 'RLS off on access_requests'; END IF;
  PERFORM 1 FROM pg_indexes WHERE schemaname='public' AND indexname='tenants_country_regnum_uniq';
  IF NOT FOUND THEN RAISE EXCEPTION 'missing index tenants_country_regnum_uniq'; END IF;
  PERFORM 1 FROM pg_proc WHERE proname='find_conflicting_legal_id'; IF NOT FOUND THEN RAISE EXCEPTION 'missing function find_conflicting_legal_id'; END IF;
  PERFORM 1 FROM pg_proc WHERE proname='find_similar_company_names'; IF NOT FOUND THEN RAISE EXCEPTION 'missing function find_similar_company_names'; END IF;
  RAISE NOTICE 'verify 20260721150351 OK';
END $$;

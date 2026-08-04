-- Verification for 20260721145409 (country packs + compliance schema).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['country_packs','country_pack_versions','rule_sources',
    'compliance_events','historical_test_cases','pack_reviews','company_obligations'] LOOP
    IF to_regclass('public.'||t) IS NULL THEN RAISE EXCEPTION 'missing table %', t; END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname=t) THEN RAISE EXCEPTION 'RLS off on %', t; END IF;
  END LOOP;
  PERFORM 1 FROM pg_proc WHERE proname='enforce_pack_ga_gate'; IF NOT FOUND THEN RAISE EXCEPTION 'missing function enforce_pack_ga_gate'; END IF;
  RAISE NOTICE 'verify 20260721145409 OK';
END $$;

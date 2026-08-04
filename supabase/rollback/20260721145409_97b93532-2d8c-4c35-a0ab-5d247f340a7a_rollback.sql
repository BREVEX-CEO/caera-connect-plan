-- Rollback for 20260721145409 (country packs, versions, rule sources, compliance
-- events, historical test cases, pack reviews, company obligations, GA gate).
-- Idempotent, reverse order. Not applied automatically here.
BEGIN;
DROP TABLE IF EXISTS public.company_obligations CASCADE;
DROP TABLE IF EXISTS public.pack_reviews CASCADE;
DROP TABLE IF EXISTS public.historical_test_cases CASCADE;
DROP TABLE IF EXISTS public.compliance_events CASCADE;
DROP TABLE IF EXISTS public.rule_sources CASCADE;
DROP TABLE IF EXISTS public.country_pack_versions CASCADE;  -- CASCADE removes trg_cpv_ga_gate
DROP TABLE IF EXISTS public.country_packs CASCADE;
DROP FUNCTION IF EXISTS public.enforce_pack_ga_gate();
COMMIT;

-- Rollback for 20260721150351 (access_requests, tenant unique indexes, company
-- lookup/creation functions). Idempotent, reverse order. Not applied automatically.
BEGIN;
DROP TABLE IF EXISTS public.access_requests CASCADE;  -- CASCADE removes trg_ar_updated + policies
DROP INDEX IF EXISTS public.tenants_country_pan_uniq;
DROP INDEX IF EXISTS public.tenants_country_gstin_uniq;
DROP INDEX IF EXISTS public.tenants_country_regnum_uniq;
DROP FUNCTION IF EXISTS public.create_company_with_owner(jsonb);              -- the _payload-only signature added here
DROP FUNCTION IF EXISTS public.find_similar_company_names(text, text);
DROP FUNCTION IF EXISTS public.find_conflicting_legal_id(text, text, text, text);
COMMIT;

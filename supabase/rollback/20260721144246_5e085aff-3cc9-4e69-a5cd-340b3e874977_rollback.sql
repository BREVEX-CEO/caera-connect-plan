-- Rollback for 20260721144246 (MADEE resume projects + versions).
-- Idempotent, reverse order. Not applied automatically here.
BEGIN;
DROP TABLE IF EXISTS public.madee_resume_versions CASCADE;   -- child (FK -> projects); CASCADE drops its triggers/indexes/policies
DROP TABLE IF EXISTS public.madee_resume_projects CASCADE;
DROP FUNCTION IF EXISTS public.set_resume_version_number();
DROP FUNCTION IF EXISTS public.enforce_resume_attestation();
COMMIT;

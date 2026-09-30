-- Remove the second-factor enforcement (back to the client-side challenge only).
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
    ALTER ROLE authenticator RESET pgrst.db_pre_request;
  END IF;
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Enrolled accounts need their second factor" ON storage.objects;
  END IF;
END
$$;
DROP FUNCTION IF EXISTS public.ocade_enforce_second_factor();
DROP FUNCTION IF EXISTS public.ocade_session_meets_second_factor();
NOTIFY pgrst, 'reload config';
COMMIT;

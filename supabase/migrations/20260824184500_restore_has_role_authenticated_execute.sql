-- Keep the live OCADE database and repository migration history aligned.
--
-- `public.has_role(uuid, public.app_role)` is a SECURITY DEFINER predicate used
-- by authenticated-user RLS policies. The live project requires an explicit
-- authenticated EXECUTE grant after public function defaults were hardened.
-- Without it, ordinary signed-in profile reads can fail with permission denied
-- while evaluating their RLS policy.

BEGIN;

DO $$
BEGIN
  IF pg_catalog.to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'Expected RLS helper public.has_role(uuid, public.app_role) is missing';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated, service_role;

COMMIT;

-- Assert the RLS helper exists and that only authenticated/service_role can
-- execute it, which is what signed-in policy evaluation depends on.

DO $$
BEGIN
  IF to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'public.has_role(uuid, public.app_role) is missing.';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.has_role(uuid,public.app_role)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute public.has_role; signed-in RLS reads will fail.';
  END IF;

  IF has_function_privilege('anon', 'public.has_role(uuid,public.app_role)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute public.has_role; the grant was not narrowed.';
  END IF;
END;
$$;

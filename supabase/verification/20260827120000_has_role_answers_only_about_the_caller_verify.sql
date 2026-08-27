-- Assert has_role still exists, is still SECURITY DEFINER, is still executable
-- by authenticated (the policies need it), and now refuses to answer about
-- anybody other than the caller.

DO $$
DECLARE
  v_body text;
BEGIN
  IF to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'public.has_role(uuid, public.app_role) is missing.';
  END IF;

  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.has_role(uuid,public.app_role)'::regprocedure) THEN
    RAISE EXCEPTION 'has_role is no longer SECURITY DEFINER; RLS policies on user_roles would recurse.';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.has_role(uuid,public.app_role)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated cannot execute has_role; ordinary profile reads will fail.';
  END IF;

  IF has_function_privilege('anon', 'public.has_role(uuid,public.app_role)'::regprocedure, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute has_role.';
  END IF;

  v_body := pg_get_functiondef('public.has_role(uuid,public.app_role)'::regprocedure);
  IF v_body NOT LIKE '%auth.uid()%' THEN
    RAISE EXCEPTION 'has_role no longer consults the caller identity.';
  END IF;
  IF v_body NOT LIKE '%IS DISTINCT FROM%' THEN
    RAISE EXCEPTION 'has_role no longer refuses questions about other accounts.';
  END IF;
END;
$$;

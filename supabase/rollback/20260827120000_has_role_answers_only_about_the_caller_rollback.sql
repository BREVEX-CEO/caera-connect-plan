-- Restore the previous has_role, which answered about any user id.
--
-- Only for the case where a policy or a server path turns out to need an
-- answer about somebody other than the caller. Restoring this re-opens the
-- administrator-enumeration the migration closed, so prefer changing that
-- call site to pass auth.uid().

BEGIN;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

COMMIT;

-- `has_role` answered questions about other people, over the public API.
--
-- The function is SECURITY DEFINER because RLS policies need it: a policy on
-- `user_roles` cannot read `user_roles` to decide whether the caller is an
-- administrator without recursing. That is correct, and the EXECUTE grant to
-- `authenticated` is required — policy expressions are evaluated with the
-- querying role's privileges, and without the grant an ordinary profile read
-- fails with "permission denied for function has_role". Migration
-- 20260824184500 exists because somebody already found that out.
--
-- What was NOT required is that the function answer truthfully about anybody
-- other than the caller. Because it is SECURITY DEFINER it bypasses row-level
-- security, so `/rest/v1/rpc/has_role` with someone else's id returned the
-- answer that a direct `select … from user_roles where user_id = <them>`
-- correctly refuses. Any signed-in account could enumerate the deployment's
-- administrators — a list whose whole value is telling an attacker which
-- accounts are worth attacking.
--
-- Every one of the 27 policy call sites passes `auth.uid()`, and no client code
-- calls the RPC at all, so refusing the other case costs nothing. A caller with
-- no JWT — `service_role`, and anything running server-side — is unaffected:
-- `auth.uid()` is null there and the guard does not apply.

BEGIN;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    -- A signed-in caller asking about somebody else gets the same answer row
    -- level security would give them for the table itself: nothing.
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

COMMIT;

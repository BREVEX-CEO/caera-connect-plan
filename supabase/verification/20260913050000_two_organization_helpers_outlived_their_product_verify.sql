-- Proves the two organization helpers are gone, and that nothing else which
-- runs as its owner is reachable by a signed-in browser without checking who
-- is calling.
--
-- The second half is the point. Dropping two named functions is easy to verify
-- and easy to regress: the next retired product leaves its own helpers behind
-- the same way. So this asserts the RULE rather than the instance — every
-- `SECURITY DEFINER` function that `authenticated` may execute either binds
-- its caller or checks a role, and the two that did neither are named here so
-- a reader knows what the rule is protecting against.
DO $$
DECLARE
  leftover TEXT;
BEGIN
  IF to_regprocedure('public.ocade_org_is_owner(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'ocade_org_is_owner survived its product';
  END IF;
  IF to_regprocedure('public.ocade_org_can_administer(uuid)') IS NOT NULL THEN
    RAISE EXCEPTION 'ocade_org_can_administer survived its product';
  END IF;

  /*
   * Every function a signed-in browser can call that runs as its owner has to
   * decide for itself who is calling. `auth.uid()` is the usual way; a role
   * check through `has_role` or `ocade_is_support_admin` is the other.
   *
   * `has_role` itself is the oracle the others are measured against, so it is
   * excluded rather than exempted: it takes the caller's id as an argument and
   * answers about that id alone.
   */
  SELECT string_agg(p.proname, ', ') INTO leftover
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prosecdef
     AND p.proname <> 'has_role'
     AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
     AND pg_get_functiondef(p.oid) !~* 'auth\s*\.\s*uid\s*\(\s*\)'
     AND pg_get_functiondef(p.oid) !~* 'has_role|ocade_is_support_admin';

  IF leftover IS NOT NULL THEN
    RAISE EXCEPTION
      'these run as their owner, are callable by any signed-in browser, and never ask who is calling: %',
      leftover;
  END IF;

  RAISE NOTICE 'the organization helpers are gone and every reachable definer function binds its caller';
END $$;

-- WAS TWO-STEP SET UP IN THIS VERY SIGN-IN?
--
-- 20261001095000 makes a factor newer than the session prove nothing, so the
-- recovery codes OCADE makes the moment two-step is turned on were refused to
-- the session that turned it on. The difference that matters: an account that
-- had a factor before this sign-in is protected by it (a thief who added a
-- second one must not replace the codes), while an account whose every factor
-- is newer than this sign-in had none to protect, and its codes are made now.
BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_two_step_set_up_in_this_sign_in()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
           SELECT 1 FROM auth.mfa_factors AS f
            WHERE f.user_id = auth.uid() AND f.status = 'verified')
     AND NOT EXISTS (
           SELECT 1
             FROM auth.sessions AS s
             JOIN auth.mfa_factors AS f ON f.user_id = s.user_id
            WHERE s.id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
              AND s.user_id = auth.uid()
              AND f.status = 'verified'
              AND f.created_at <= s.created_at)
     AND EXISTS (
           SELECT 1 FROM auth.sessions AS s
            WHERE s.id = NULLIF(auth.jwt() ->> 'session_id', '')::uuid
              AND s.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.ocade_two_step_set_up_in_this_sign_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_two_step_set_up_in_this_sign_in() TO authenticated, service_role;

COMMIT;

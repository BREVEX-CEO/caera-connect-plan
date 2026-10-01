-- THE CONSOLE TRUSTS NO FACTOR ADDED DURING ITS OWN SESSION.
--
-- 20261001095000 makes a factor added after signing in useless for recent
-- proof. Staff READS ask only for aal2 in a console session, so a console
-- session that enrolled a factor itself (the Primary Owner while two-step was
-- still off, or a stolen console token) could still reach aal2 that way and
-- read customers. The console session holds staff authority only while no
-- factor is newer than it; ocade.in's "Open the console" asks the same of the
-- site's session (console.functions.ts), so a new factor means a new sign-in.
BEGIN;

CREATE OR REPLACE FUNCTION private.ocade_caller_in_console()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(auth.jwt() ->> 'session_id', '') = ''
      OR (EXISTS (SELECT 1 FROM public.ocade_console_sessions AS c
                   WHERE c.session_id = (auth.jwt() ->> 'session_id')::uuid
                     AND c.user_id = auth.uid())
          AND NOT public.ocade_factor_added_since_sign_in());
$$;

COMMIT;

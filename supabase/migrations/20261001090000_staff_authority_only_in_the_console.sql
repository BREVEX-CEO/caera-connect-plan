-- STAFF AUTHORITY ONLY IN THE CONSOLE'S OWN SESSION.
--
-- The consoles live at admin.ocade.in (PLAN.md Phases 31/46). A separate origin
-- only separates something if the database can tell the two apart: until now
-- any session of a staff account, including the one on ocade.in that renders
-- chat answers and web content, carried the account's whole staff authority.
-- A token lifted from that page could have gone straight to the privileged RPCs.
--
-- Now staff authority belongs to a session the console opened for itself.
-- ocade.in hands over by minting a one-time sign-in; the server redeems it on
-- admin.ocade.in and records the NEW session here. That session starts at aal1,
-- so it still has to answer the second factor itself before it may do anything
-- (the Primary Owner may look, never change, while setting two-step up — as
-- before). Every staff check reads private.ocade_staff_has, has_role('admin')
-- or the support-admin check; all three now also ask this.
BEGIN;

CREATE TABLE IF NOT EXISTS public.ocade_console_sessions (
  -- Ended sessions take their row with them: sign-out, "sign out everywhere",
  -- the emergency staff sign-out.
  session_id uuid PRIMARY KEY REFERENCES auth.sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  opened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ocade_console_sessions_user ON public.ocade_console_sessions (user_id);
ALTER TABLE public.ocade_console_sessions ENABLE ROW LEVEL SECURITY;
-- Written and read only by the server; no browser session touches it.
REVOKE ALL ON TABLE public.ocade_console_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.ocade_console_sessions TO service_role;

-- Is the caller's session one the console opened? A token that names no session
-- was not issued by Supabase Auth to a browser (the same rule as
-- ocade_caller_session_live): there is no origin for it to be bound to.
CREATE OR REPLACE FUNCTION private.ocade_caller_in_console()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT COALESCE(auth.jwt() ->> 'session_id', '') = ''
      OR EXISTS (SELECT 1 FROM public.ocade_console_sessions AS c
                  WHERE c.session_id = (auth.jwt() ->> 'session_id')::uuid
                    AND c.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION private.ocade_caller_in_console() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.ocade_caller_in_console() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.ocade_staff_has(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ocade_staff AS s
     WHERE s.user_id = auth.uid()
       AND (p_permission = ANY (private.ocade_role_permissions(s.role))
            OR p_permission = ANY (s.granted))
       AND NOT (p_permission = ANY (s.denied))
  ) AND private.ocade_caller_session_live() AND private.ocade_caller_in_console();
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NOT NULL AND _user_id IS DISTINCT FROM auth.uid() THEN false
    WHEN _role = 'admin'::public.app_role THEN EXISTS (
      SELECT 1 FROM public.ocade_staff
       WHERE user_id = _user_id AND role IN ('primary_owner', 'backup_owner', 'admin')
         AND (auth.uid() IS NULL OR role = 'primary_owner'
              OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
    ) AND (auth.uid() IS NULL OR private.ocade_caller_in_console())
    ELSE EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
    )
  END;
$$;

CREATE OR REPLACE FUNCTION private.ocade_is_support_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ocade_staff
     WHERE user_id = (SELECT auth.uid()) AND role IN ('primary_owner', 'backup_owner', 'admin')
       AND (role = 'primary_owner' OR COALESCE(auth.jwt() ->> 'aal', '') = 'aal2')
  ) AND private.ocade_caller_in_console();
$$;

COMMIT;

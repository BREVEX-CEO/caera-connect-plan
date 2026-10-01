-- Undo "staff authority only in the console": every session of a staff account
-- carries its authority again (20260930093000's definitions), and the record of
-- console sessions goes.
BEGIN;

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
  ) AND private.ocade_caller_session_live();
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
    )
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
  );
$$;

DROP FUNCTION IF EXISTS private.ocade_caller_in_console();
DROP TABLE IF EXISTS public.ocade_console_sessions;

COMMIT;

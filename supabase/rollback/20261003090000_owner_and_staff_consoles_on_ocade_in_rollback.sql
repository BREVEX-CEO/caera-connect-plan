-- Undo "Owner and Staff Consoles on ocade.in". Staff authority returns to
-- 20260930093000's definitions (every live session of a staff account, which is
-- what production ran before this), NOT to the retired console origin's sessions:
-- that origin no longer exists, and restoring its binding would lock every owner
-- out. Allowances are enforced for everybody again. The unlimited-grant record
-- and the widened audit vocabulary stay (append-only evidence; rows may use them).
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

CREATE OR REPLACE FUNCTION public.ocade_consume_commercial_work(
  p_user_id uuid,
  p_window_kind text,
  p_window_start timestamptz,
  p_cost_hundredths bigint,
  p_limit_hundredths bigint
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO ''
AS $$
DECLARE
  v_used bigint;
BEGIN
  IF p_cost_hundredths < 0 THEN
    RAISE EXCEPTION 'a request cannot cost less than nothing'
      USING ERRCODE = 'check_violation';
  END IF;
  INSERT INTO public.ocade_commercial_usage (
    user_id, window_kind, window_start, used_hundredths
  )
  VALUES (p_user_id, p_window_kind, p_window_start, p_cost_hundredths)
  ON CONFLICT (user_id, window_kind, window_start)
  DO UPDATE SET
    used_hundredths = public.ocade_commercial_usage.used_hundredths + p_cost_hundredths
  RETURNING used_hundredths INTO v_used;
  IF p_limit_hundredths IS NOT NULL AND v_used > p_limit_hundredths THEN
    RAISE EXCEPTION 'allowance_exhausted' USING ERRCODE = 'check_violation';
  END IF;
  RETURN v_used;
END;
$$;

DROP FUNCTION IF EXISTS public.ocade_grant_unlimited(uuid, timestamptz, text);
DROP FUNCTION IF EXISTS public.ocade_revoke_unlimited(uuid, text);
DROP FUNCTION IF EXISTS private.ocade_owner_require(text);
DROP FUNCTION IF EXISTS public.ocade_account_unlimited(uuid);
DROP FUNCTION IF EXISTS private.ocade_usage_unlimited(uuid);

DROP FUNCTION IF EXISTS public.ocade_staff_transfer_ownership(uuid, text, boolean);
CREATE FUNCTION public.ocade_staff_transfer_ownership(p_to uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_me uuid := auth.uid();
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'hand over ownership');
  IF private.ocade_staff_role_of(v_me) <> 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner hands over ownership.' USING ERRCODE = '42501';
  END IF;
  IF private.ocade_staff_role_of(p_to) IS DISTINCT FROM 'backup_owner' THEN
    RAISE EXCEPTION 'Ownership goes to the Backup Owner. Name one first.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_staff SET role = 'backup_owner', updated_at = now() WHERE user_id = v_me;
  UPDATE public.ocade_staff SET role = 'primary_owner', denied = '{}', updated_at = now()
   WHERE user_id = p_to;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_to, 'owner_transfer', btrim(p_reason));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_staff_transfer_ownership(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_staff_transfer_ownership(uuid, text) TO authenticated;

COMMIT;

-- Undo: the 20260930093000 / 094000 definitions.
BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_staff_grant(p_email text, p_role text, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_email text := lower(btrim(p_email));
  v_me uuid := auth.uid();
  v_target uuid;
  v_current text;
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE');
  IF p_role NOT IN ('backup_owner', 'admin', 'support', 'billing', 'operations', 'read_only') THEN
    RAISE EXCEPTION 'That is not a staff role.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_role = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner names a Backup Owner.' USING ERRCODE = '42501';
  END IF;

  SELECT u.id INTO v_target FROM auth.users AS u
   WHERE lower(u.email) = v_email AND u.email_confirmed_at IS NOT NULL
   LIMIT 1;

  IF v_target IS NULL THEN
    UPDATE public.ocade_staff_invites SET withdrawn_at = now()
     WHERE email = v_email AND accepted_at IS NULL AND withdrawn_at IS NULL;
    INSERT INTO public.ocade_staff_invites (email, role, invited_by, expires_at)
    VALUES (v_email, p_role, v_me, now() + interval '14 days');
    INSERT INTO public.ocade_admin_actions (actor, action, reason)
    VALUES (v_me, 'staff_invite', btrim(p_reason));
    RETURN jsonb_build_object('status', 'invited');
  END IF;

  IF v_target = v_me THEN
    RAISE EXCEPTION 'Nobody changes their own access.' USING ERRCODE = '42501';
  END IF;
  v_current := private.ocade_staff_role_of(v_target);
  IF v_current = 'primary_owner' THEN
    RAISE EXCEPTION 'The Primary Owner''s access is changed only by handing ownership over.'
      USING ERRCODE = '42501';
  END IF;
  IF v_current = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner changes the Backup Owner.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.ocade_staff (user_id, role, granted_by)
  VALUES (v_target, p_role, v_me)
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role, granted_by = EXCLUDED.granted_by, updated_at = now();
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, v_target, 'staff_grant', btrim(p_reason));
  RETURN jsonb_build_object('status', 'granted', 'user_id', v_target);
END;
$$;


CREATE OR REPLACE FUNCTION public.ocade_staff_set_permissions(
  p_user uuid, p_granted text[], p_denied text[], p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text;
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_user = v_me THEN
    RAISE EXCEPTION 'Nobody changes their own access.' USING ERRCODE = '42501';
  END IF;
  v_role := private.ocade_staff_role_of(p_user);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  IF v_role = 'primary_owner'
     OR (v_role = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner') THEN
    RAISE EXCEPTION 'Only the Primary Owner changes an owner''s access.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ocade_staff
     SET granted = COALESCE(p_granted, '{}'), denied = COALESCE(p_denied, '{}'), updated_at = now()
   WHERE user_id = p_user;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_user, 'staff_permissions', btrim(p_reason));
  RETURN true;
END;
$$;


CREATE OR REPLACE FUNCTION public.ocade_staff_end_customer_sessions(p_user uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_removed integer;
BEGIN
  PERFORM private.ocade_staff_require('sessions.manage', 'end a customer''s sessions');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF private.ocade_staff_role_of(p_user) IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'An owner''s sessions are ended by the owner.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM auth.sessions WHERE user_id = p_user;
  GET DIAGNOSTICS v_removed = ROW_COUNT;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'customer_sessions_ended', btrim(p_reason));
  RETURN v_removed;
END;
$$;


CREATE OR REPLACE FUNCTION public.ocade_staff_reset_second_factor(p_user uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM private.ocade_staff_require('sessions.manage', 'turn off a customer''s two-step verification');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'Nobody turns off their own two-step verification this way.' USING ERRCODE = '42501';
  END IF;
  IF private.ocade_staff_role_of(p_user) IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'An owner''s two-step verification is changed by the owner.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user) THEN
    RETURN false;
  END IF;
  DELETE FROM auth.sessions WHERE user_id = p_user;
  DELETE FROM public.ocade_mfa_recovery_codes WHERE user_id = p_user;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (auth.uid(), p_user, 'second_factor_reset', btrim(p_reason));
  RETURN true;
END;
$$;


COMMIT;

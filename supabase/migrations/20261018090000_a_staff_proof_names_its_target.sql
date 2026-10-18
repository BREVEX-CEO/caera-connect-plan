-- PLAN Phase 08 SEC-08-01: a staff proof pays for the operator it was confirmed for, not another.
--
-- Since 20261017100000 a proof OCADE's server spent is adopted only for the action it was spent
-- on, but the four operator changes all shared one action, "change who operates OCADE". A token
-- used right after confirming one operator's removal could, within the minute, call the database
-- directly to remove or re-permission a different operator on that same confirmation. Each change
-- now names its own kind and its target in the action; the server spends the proof under the same
-- words (staff.functions.ts), so the gate's existing comparison binds the target too.
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
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE: add ' || lower(btrim(p_email)));
  IF p_role NOT IN ('backup_owner', 'admin', 'support', 'billing', 'operations', 'read_only') THEN
    RAISE EXCEPTION 'That is not a staff role.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  -- Nobody below an owner hands out more than they hold themselves.
  IF NOT private.ocade_staff_role_of(v_me) IN ('primary_owner', 'backup_owner')
     AND EXISTS (SELECT 1 FROM unnest(private.ocade_role_permissions(p_role)) AS p(name)
                  WHERE NOT private.ocade_staff_has(p.name)) THEN
    RAISE EXCEPTION 'You can only give access you hold yourself.' USING ERRCODE = '42501';
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
  v_before text[];
  v_after text[];
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE: permissions of ' || p_user);
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  IF p_user = v_me THEN
    RAISE EXCEPTION 'Nobody changes their own access.' USING ERRCODE = '42501';
  END IF;
  -- Locked, so two editors compare against the same before.
  SELECT s.role,
         ARRAY(SELECT DISTINCT p FROM unnest(private.ocade_role_permissions(s.role) || s.granted) AS p
                WHERE NOT (p = ANY (s.denied)))
    INTO v_role, v_before
    FROM public.ocade_staff AS s WHERE s.user_id = p_user FOR UPDATE;
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  IF v_role = 'primary_owner'
     OR (v_role = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner') THEN
    RAISE EXCEPTION 'Only the Primary Owner changes an owner''s access.' USING ERRCODE = '42501';
  END IF;
  v_after := ARRAY(SELECT DISTINCT p
                     FROM unnest(private.ocade_role_permissions(v_role) || COALESCE(p_granted, '{}')) AS p
                    WHERE NOT (p = ANY (COALESCE(p_denied, '{}'))));
  -- Nobody below an owner gives more than they hold, however it is given: a new grant, or a
  -- denial taken away that brings a role default back.
  IF NOT private.ocade_staff_role_of(v_me) IN ('primary_owner', 'backup_owner')
     AND EXISTS (SELECT 1 FROM unnest(v_after) AS p(name)
                  WHERE NOT (p.name = ANY (v_before)) AND NOT private.ocade_staff_has(p.name)) THEN
    RAISE EXCEPTION 'You can only give access you hold yourself.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ocade_staff
     SET granted = COALESCE(p_granted, '{}'), denied = COALESCE(p_denied, '{}'), updated_at = now()
   WHERE user_id = p_user;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_user, 'staff_permissions', btrim(p_reason));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_staff_revoke(p_user uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_role text;
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE: remove ' || p_user);
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  v_role := private.ocade_staff_role_of(p_user);
  IF v_role IS NULL THEN
    RETURN false;
  END IF;
  IF v_role = 'primary_owner' THEN
    RAISE EXCEPTION 'The Primary Owner is removed only by handing ownership over.'
      USING ERRCODE = '42501';
  END IF;
  IF v_role = 'backup_owner' AND private.ocade_staff_role_of(v_me) <> 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner removes the Backup Owner.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.ocade_staff WHERE user_id = p_user;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_user, 'staff_revoke', btrim(p_reason));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.ocade_staff_withdraw_invite(p_invite uuid, p_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'change who operates OCADE: withdraw invite ' || p_invite);
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_staff_invites SET withdrawn_at = now()
   WHERE id = p_invite AND accepted_at IS NULL AND withdrawn_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, subject, action, reason)
  VALUES (auth.uid(), p_invite, 'staff_invite_withdrawn', btrim(p_reason));
  RETURN true;
END;
$$;
COMMIT;

-- A customer who lost their phone AND their recovery codes cannot sign in at
-- all: the second factor is enforced on every request. An operator who has
-- checked who they are talking to can turn that account's two-step verification
-- off. This records and authorises it (permission, second factor, fresh proof,
-- a reason), ends the account's sessions and retires its recovery codes; the
-- server then removes the factor through the Auth API, which is what tells the
-- account by email. Owners are excluded: nobody below them switches their
-- protection off.
BEGIN;

ALTER TABLE public.ocade_admin_actions DROP CONSTRAINT IF EXISTS ocade_admin_actions_action_check;
ALTER TABLE public.ocade_admin_actions ADD CONSTRAINT ocade_admin_actions_action_check CHECK (
  action IN ('remove_device', 'owner_bootstrap', 'owner_transfer', 'staff_grant', 'staff_invite',
             'staff_invite_withdrawn', 'staff_invite_accepted', 'staff_permissions', 'staff_revoke',
             'staff_sessions_ended', 'customer_sessions_ended', 'case_open', 'case_close', 'case_read',
             'second_factor_reset')
);

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
REVOKE ALL ON FUNCTION public.ocade_staff_reset_second_factor(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_staff_reset_second_factor(uuid, text) TO authenticated;

COMMIT;

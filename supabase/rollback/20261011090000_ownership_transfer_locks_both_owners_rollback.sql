-- Undo: re-apply the hand-over from 20261003090000 (unlocked). Only for an emergency rollback.
BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_staff_transfer_ownership(p_to uuid, p_reason text, p_stay_owner boolean DEFAULT true)
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
    RAISE EXCEPTION 'Ownership goes to an Owner. Make them an Owner first.' USING ERRCODE = '22023';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_staff SET role = 'backup_owner', updated_at = now() WHERE user_id = v_me;
  UPDATE public.ocade_staff SET role = 'primary_owner', denied = '{}', updated_at = now()
   WHERE user_id = p_to;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_to, 'owner_transfer', btrim(p_reason));
  IF NOT COALESCE(p_stay_owner, true) THEN
    DELETE FROM public.ocade_staff WHERE user_id = v_me;
    INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
    VALUES (v_me, v_me, 'staff_revoke', 'Left the staff when handing over ownership.');
  END IF;
  RETURN true;
END;
$$;

COMMIT;

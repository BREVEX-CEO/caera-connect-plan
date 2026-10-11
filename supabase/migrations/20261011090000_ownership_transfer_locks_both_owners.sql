-- Handing over ownership locks both Owners and ends with exactly one Primary Owner.
--
-- The roles were checked without a lock. A transfer racing the target's removal
-- demoted the Primary Owner, promoted nobody (zero rows), and committed an account
-- with no Primary Owner. Both rows are now locked in one order, the roles re-read
-- under the lock, each write must touch exactly one row, and the transaction fails
-- unless exactly one Primary Owner remains.
BEGIN;

CREATE OR REPLACE FUNCTION public.ocade_staff_transfer_ownership(p_to uuid, p_reason text, p_stay_owner boolean DEFAULT true)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_rows integer;
BEGIN
  PERFORM private.ocade_staff_require('staff.manage', 'hand over ownership');
  IF p_reason IS NULL OR length(btrim(p_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  -- One lock order for both rows, so two hand-overs cannot deadlock or interleave.
  PERFORM 1 FROM public.ocade_staff WHERE user_id IN (v_me, p_to) ORDER BY user_id FOR UPDATE;
  IF private.ocade_staff_role_of(v_me) IS DISTINCT FROM 'primary_owner' THEN
    RAISE EXCEPTION 'Only the Primary Owner hands over ownership.' USING ERRCODE = '42501';
  END IF;
  -- To a verified account that is already an Owner: two deliberate steps, never one slip.
  IF private.ocade_staff_role_of(p_to) IS DISTINCT FROM 'backup_owner' THEN
    RAISE EXCEPTION 'Ownership goes to an Owner. Make them an Owner first.' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ocade_staff SET role = 'backup_owner', updated_at = now() WHERE user_id = v_me;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'Ownership changed meanwhile. Try again.' USING ERRCODE = '40001'; END IF;
  UPDATE public.ocade_staff SET role = 'primary_owner', denied = '{}', updated_at = now()
   WHERE user_id = p_to AND role = 'backup_owner';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN RAISE EXCEPTION 'Ownership changed meanwhile. Try again.' USING ERRCODE = '40001'; END IF;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
  VALUES (v_me, p_to, 'owner_transfer', btrim(p_reason));
  IF NOT COALESCE(p_stay_owner, true) THEN
    DELETE FROM public.ocade_staff WHERE user_id = v_me;
    INSERT INTO public.ocade_admin_actions (actor, target_user, action, reason)
    VALUES (v_me, v_me, 'staff_revoke', 'Left the staff when handing over ownership.');
  END IF;
  IF (SELECT count(*) FROM public.ocade_staff WHERE role = 'primary_owner') <> 1 THEN
    RAISE EXCEPTION 'Ownership changed meanwhile. Try again.' USING ERRCODE = '40001';
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.ocade_staff_transfer_ownership(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_staff_transfer_ownership(uuid, text, boolean) TO authenticated;

COMMIT;

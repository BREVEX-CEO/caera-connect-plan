-- Staff device removal ends the device's tasks the way the owner's own removal does (146).
--
-- The staff function predated the task authority: it marked tasks stopped without a finish
-- time, kept their controller, and never told the person, and it used the older second-factor
-- check instead of the one-proof-per-change staff check. It now authorises like every other
-- staff change and then removes the device through jarvis_revoke_device, the same path as
-- Settings -> Devices, so tasks stop through jarvis_stop_task and the person is told.

CREATE OR REPLACE FUNCTION public.ocade_admin_remove_device(device uuid, remove_reason text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_owner uuid;
BEGIN
  PERFORM private.ocade_staff_require('devices.manage', 'remove a device: ' || device);
  IF remove_reason IS NULL OR length(btrim(remove_reason)) < 10 THEN
    RAISE EXCEPTION 'Say why, in at least ten characters.' USING ERRCODE = '22023';
  END IF;
  SELECT d.user_id INTO v_owner FROM public.jarvis_devices AS d
   WHERE d.id = device AND d.revoked_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF private.ocade_staff_role_of(v_owner) IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'An owner''s devices are removed by the owner.' USING ERRCODE = '42501';
  END IF;
  IF private.ocade_staff_role_of(v_owner) IS NOT NULL
     AND private.ocade_staff_role_of(auth.uid()) NOT IN ('primary_owner', 'backup_owner') THEN
    RAISE EXCEPTION 'A member of staff is changed by an owner.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.jarvis_revoke_device(v_owner, device) THEN
    RETURN false;
  END IF;
  INSERT INTO public.ocade_admin_actions (actor, target_user, action, subject, reason)
  VALUES (auth.uid(), v_owner, 'remove_device', device, btrim(remove_reason));
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.ocade_admin_remove_device(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ocade_admin_remove_device(uuid, text) TO authenticated, service_role;

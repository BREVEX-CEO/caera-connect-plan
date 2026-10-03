-- A phone may be a JARVIS device.
DO $$
BEGIN
  IF pg_get_constraintdef((SELECT oid FROM pg_constraint WHERE conname = 'jarvis_devices_kind_check'))
     NOT LIKE '%android%' THEN
    RAISE EXCEPTION 'android devices are not accepted';
  END IF;
END
$$;
